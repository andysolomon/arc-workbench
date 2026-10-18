// Fig 3's own mechanism. Sand heaps are the engine's queues; grains fall at the flow each neck
// passes: the API's arrivals into the upper funnel, what the API serves down its neck, what
// Postgres serves into the beaker, and the API's failures over the lip into the tray.
// The shared bench runtime (figures/lib/bench-live.js) runs the engine, the controls and the tour.
const FUN = Object.fromEntries(DATA.funnels.map((f) => [f.id, f]));
const BK = DATA.beaker;
const HOP = DATA.hop;
const TRAY = DATA.tray;
const SPILL = DATA.spill;
const AX = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const TF = G.frameOf([TRAY.c[0], TRAY.c[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const stageEl = document.querySelector(".bx-stage");
const slotEl = Object.fromEntries([...stageEl.querySelectorAll("[data-slot]")].map((el) => [el.dataset.slot, el]));
const heapEl = Object.fromEntries([...stageEl.querySelectorAll("[data-heap]")].map((el) => [el.dataset.heap, el]));
const spokes = stageEl.querySelector('[data-ref="spokes"]');
const needle = stageEl.querySelector('[data-ref="knob"]');
const Q_CAP = 50000;
const GRAIN = 0.55 * DATA.proj.scale * Math.sqrt(1.6);
const qFill = (q) => Math.log10(1 + Math.max(0, q)) / Math.log10(1 + Q_CAP);

// ---------- heaps: a funnel's sand takes the funnel's shape up to its level, with a low mound ----------
const level = { api: { x: 0, v: 0 }, db: { x: 0, v: 0 }, served: { x: 0, v: 0 }, spill: { x: 0, v: 0 } };
const drawnLevel = {};
const surface = { api: FUN.api.zn, db: FUN.db.zn, served: 0.4, spill: TRAY.floor };
const funnelHeap = (f, x) => {
  const span = (f.rim - f.zn) * 0.8;
  const zL = f.zn + x * span;
  const rL = Math.max(f.neck - 0.35, f.neck + (zL - f.zn) * f.tan - 0.5);
  const mound = Math.min(0.28 * rL, f.rim - 0.6 - zL);
  return { profile: [[f.zn - 0.2, f.neck - 0.35], [zL, rL], [zL + mound, 0]], top: zL + mound };
};
const paintHeap = (id, x) => {
  if (drawnLevel[id] !== undefined && Math.abs(drawnLevel[id] - x) < 0.0025) return;
  drawnLevel[id] = x;
  let svg = "";
  if (id === "api" || id === "db") {
    const f = FUN[id];
    if (x > 0.004) {
      const h = funnelHeap(f, x);
      surface[id] = h.top;
      svg = solidSvg(G.solidOf(h.profile, AX, DATA.proj, { rims: "none" }), { tone: "mid", crease: "lo" });
    } else surface[id] = f.zn;
  } else if (id === "served") {
    const z = 0.5 + x * (BK.top - 5);
    surface.served = z + 1.4;
    if (x > 0.004) svg = solidSvg(G.solidOf([[0.4, BK.r - 0.55], [z, BK.r - 0.55], [z + 1.4, 0]], AX, DATA.proj, { rims: "none" }), { tone: "mid", crease: "lo" });
  } else {
    const rp = 1.6 + x * 5.2;
    const hp = rp * 0.42;
    surface.spill = TRAY.floor + (x > 0.004 ? hp : 0);
    if (x > 0.004) svg = solidSvg(G.solidOf([[TRAY.floor, rp], [TRAY.floor + hp, 0]], TF, DATA.proj, { rims: "none" }), { tone: "mid", crease: "lo" });
  }
  heapEl[id].innerHTML = svg;
};

// ---------- grains ----------
// a stream: where grains start, how fast they come, how they fall, and which slot draws them where
const G0 = 150;
const streams = {
  feed: { at: () => [0, 0, HOP.tip - 0.4], jitter: 0.9, stem: null, floor: () => surface.api, slot: (z) => (z >= FUN.api.rim ? "air.api" : "in.api") },
  api: { at: () => [0, 0, FUN.api.zn], jitter: FUN.api.neck * 0.45, stem: FUN.api.tip, floor: () => surface.db, slot: (z) => (z >= FUN.api.tip ? "in.api" : z >= FUN.db.rim ? "air.db" : "in.db") },
  db: { at: () => [0, 0, FUN.db.zn], jitter: FUN.db.neck * 0.45, stem: FUN.db.tip, floor: () => surface.served, slot: (z) => (z >= FUN.db.tip ? "in.db" : z >= BK.top ? "air.served" : "in.served") },
  spill: { at: () => [SPILL.dir[0] * SPILL.r, SPILL.dir[1] * SPILL.r, SPILL.from], jitter: 0.7, stem: null, floor: () => surface.spill, slot: (z) => (z >= TRAY.h ? "air.spill" : "in.spill") },
};
const grains = Object.fromEntries(Object.keys(streams).map((id) => [id, []]));
const credit = Object.fromEntries(Object.keys(streams).map((id) => [id, 0]));
let seed = 11;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const dps = (rate) => Math.min(170, rate / 24);
const step = (id, rate, dt) => {
  const s = streams[id];
  const list = grains[id];
  credit[id] += dps(rate) * dt;
  while (credit[id] >= 1 && list.length < 150) {
    credit[id] -= 1;
    const [x, y, z] = s.at();
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * s.jitter;
    list.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: z - random() * 0.8, vz: s.stem ? -36 : -6 });
  }
  if (credit[id] > 1) credit[id] = 1;
  const floor = s.floor();
  for (let i = list.length - 1; i >= 0; i--) {
    const g = list[i];
    if (s.stem !== null && g.z > s.stem) g.z -= 36 * dt;
    else {
      g.vz -= G0 * dt;
      g.z += g.vz * dt;
    }
    if (g.z <= floor) list.splice(i, 1);
  }
};
// reduced motion: the same streams, still, grains spaced by the flow
const still = (id, rate) => {
  const s = streams[id];
  const [x, y, z0] = s.at();
  const floor = s.floor();
  const n = Math.round(Math.min(26, dps(rate) / 6));
  grains[id] = Array.from({ length: n }, (_, i) => ({ x: x + Math.sin(i * 2.4) * s.jitter * 0.6, y: y + Math.cos(i * 2.4) * s.jitter * 0.6, z: z0 - ((i + 0.5) / n) * (z0 - floor), vz: 0 }));
};
const paintGrains = () => {
  const out = {};
  for (const [id, list] of Object.entries(grains)) {
    const s = streams[id];
    for (const g of list) {
      const name = s.slot(g.z);
      const [cx, cy] = iso([g.x, g.y, g.z], DATA.proj);
      out[name] = (out[name] ?? "") + `<circle class="ss-grain" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${GRAIN.toFixed(2)}"/>`;
    }
  }
  for (const [name, el] of Object.entries(slotEl)) {
    const svg = out[name] ?? "";
    if (el.__svg !== svg) {
      el.innerHTML = svg;
      el.__svg = svg;
    }
  }
};

// ---------- the gate's handwheel and the load dial ----------
let drawnLoad = null;
const paintGate = (load) => {
  if (drawnLoad !== null && Math.abs(drawnLoad - load) < 0.5) return;
  drawnLoad = load;
  const W = DATA.wheel;
  const turn = (load / DATA.rpsMax) * Math.PI * 1.5;
  const y = W.c[1] + 1.05;
  let d = "";
  for (let i = 0; i < 3; i++) {
    const a = turn + (i * Math.PI * 2) / 3;
    const p = (r) => iso([W.c[0] + Math.cos(a) * r, y, W.c[2] + Math.sin(a) * r], DATA.proj);
    const [x0, y0] = p(W.hub);
    const [x1, y1] = p(W.rIn);
    d += `M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  spokes?.setAttribute("d", d);
  const K = DATA.dial;
  const a = K.from + Math.min(1, load / DATA.rpsMax) * K.span;
  needle?.setAttribute("d", lineOnTop([K.c[0] + Math.sin(a) * K.r0, K.c[1] - Math.cos(a) * K.r0], [K.c[0] + Math.sin(a) * K.r1, K.c[1] - Math.cos(a) * K.r1], K.z, DATA.proj));
};

// ---------- the tour: idle, warm, past the API's neck, and back to drain ----------
const TOUR = [[0, 300], [3, 300], [8, 2400], [12, 2400], [16, 4200], [25, 4200], [30, 300], [42, 300]];
const tourAt = (t) => {
  const s = t % TOUR[TOUR.length - 1][0];
  for (let i = 1; i < TOUR.length; i++) {
    const [t1, v1] = TOUR[i];
    const [t0, v0] = TOUR[i - 1];
    if (s <= t1) return v0 + (v1 - v0) * smooth(t0, t1, s);
  }
  return TOUR[0][1];
};

benchFigure({
  load: { max: DATA.rpsMax, home: DATA.preset.rps },
  tour: (t) => ({ load: tourAt(t) }),
  alwaysMoving: true,
  readout: (c) => {
    // the load and the shares beside it come from the same engine tick
    const load = c.fmt(c.metrics?.sys?.rps ?? c.load);
    if (c.health("api") === "crit") return `${load} rps · api saturated · ${c.pct(c.err("api"))} spill · db ${c.pct(c.util("db"))}`;
    return `${load} rps · api ${c.pct(c.util("api"))} · db ${c.pct(c.util("db"))}`;
  },
  describe: (c) => `${c.fmt(c.target)} requests per second`,
  frame: (c, dt, calm) => {
    const m = c.metrics;
    const api = m?.nodes.api;
    const db = m?.nodes.db;
    const arr = api?.arr ?? 0;
    const served = m?.edges["api>db"] ?? 0;
    const dbServed = Math.min(db?.arr ?? 0, DATA.caps.db) * (1 - (db?.err ?? 0));
    const spill = arr * (api?.err ?? 0);
    const t = { api: 0.06 * Math.min(1, api?.util ?? 0) + 0.94 * qFill(api?.q ?? 0), db: 0.06 * Math.min(1, db?.util ?? 0) + 0.94 * qFill(db?.q ?? 0), served: Math.min(1, dbServed / DATA.rpsMax), spill: Math.min(1, spill / DATA.rpsMax) };
    let moving = false;
    for (const id of Object.keys(level)) {
      if (settle(level[id], t[id], dt, 0.5, calm)) moving = true;
      paintHeap(id, level[id].x);
    }
    const rates = { feed: arr, api: served, db: dbServed, spill };
    for (const id of Object.keys(streams)) {
      if (calm) still(id, rates[id]);
      else step(id, rates[id], dt);
      if (grains[id].length) moving = true;
    }
    paintGrains();
    paintGate(c.load);
    return moving;
  },
});
