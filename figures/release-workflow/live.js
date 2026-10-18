// Fig 9's own motion. The Workbench token engine (tickWorkflow) runs at 4 Hz at its own speed, 20
// simulated minutes a second. Bottles waiting on the belt are the changes at each step (one per
// twenty); the lit bottle is the engine's traced change: it waits its turn in the queue as its time at
// the step runs down, the station works it, and it moves on, gets pushed onto the return conveyor, or
// drops down the rollback chute, by the edge the engine took.
const SIM = WB.makeParadigmSim("workflow");
const DT = 0.25;
let simClock = 0;
const graphOf = (c) => ({ nodes: DATA.preset.nodes.map((n) => (n.id === "qg" ? { ...n, pass: c.params.pass } : n)), edges: DATA.preset.edges });
const engine = {
  advance(c, dt) {
    simClock += dt;
    let m = c.metrics;
    while (simClock >= DT) {
      const g = graphOf(c);
      m = WB.tickWorkflow(SIM, g.nodes, g.edges, c.load, DT);
      simClock -= DT;
    }
    return m;
  },
  // the state a constant rate and gate settle into, worked out once per setting: a still frame
  // (reduced motion) asks for it every frame and must stay still
  steady(c) {
    const key = `${c.load}|${c.params.pass}`;
    if (key === steadyKey && steadyM) return steadyM;
    const g = graphOf(c);
    let m = c.metrics;
    for (let i = 0; i < 600; i++) m = WB.tickWorkflow(SIM, g.nodes, g.edges, c.load, DT);
    steadyKey = key;
    steadyM = m;
    return m;
  },
};
let steadyKey = null;
let steadyM = null;
const byId = Object.fromEntries(DATA.preset.nodes.map((n) => [n.id, n]));
const durOf = (id) => byId[id]?.dur ?? 0;
const stage = document.querySelector(".bx-stage");
const layerSvg = (name) => stage.children[DATA.stackIndex[name]];
const P = DATA.proj;
const BT = DATA.bt;
const X = DATA.x;
const Q = DATA.queue;

// ---------- what each step holds: bottles on the belt, vials in the rack, bottles in the crate and bin ----------
const slotEls = Object.fromEntries(Object.keys(DATA.slots).map((id) => [id, [...stage.querySelectorAll(`[data-slot="${id}"]`)].sort((a, b) => a.dataset.i - b.dataset.i)]));
const vials = [...stage.querySelectorAll("[data-vial]")];
const crateEls = [...stage.querySelectorAll("[data-crate]")];
const binEls = [...stage.querySelectorAll("[data-bin]")];
const shown = {};
const countAt = (c, id) => Math.ceil((c.metrics?.nodes[id]?.q ?? 0) / DATA.per);
const show = (els, n, skip = -1) => els.forEach((el, i) => {
  const on = i < n && i !== skip;
  if (el.__on === on) return;
  el.__on = on;
  on ? el.removeAttribute("data-off") : el.setAttribute("data-off", "");
});
const paintCounts = (c, hidden) => {
  for (const id of Object.keys(slotEls)) {
    shown[id] = Math.min(slotEls[id].length, countAt(c, id));
    show(slotEls[id], shown[id], hidden.id === id ? hidden.i : -1);
  }
  show(vials, Math.min(vials.length, countAt(c, "canary")));
  // the ends hold the completions the engine keeps (its p99 window), released or rolled back
  const bad = SIM.doneBad.reduce((a, b) => a + b, 0);
  show(crateEls, Math.min(crateEls.length, Math.ceil((SIM.done.length - bad) / DATA.per)));
  show(binEls, Math.min(binEls.length, Math.ceil(bad / DATA.per)));
};

// ---------- the traced bottle ----------
const traced = stage.querySelector('[data-ref="traced"]');
const cap = traced.querySelector("[data-cap]");
const car = { run: null, node: null, at: [...DATA.home], legs: [], layer: "mainB", alpha: { x: 0, v: 0 }, pending: true, capped: false, s: 0, from: null };
const tailOf = (id) => [X[id] - Q.lead - (shown[id] ?? 0) * Q.gap, 0, BT];
// where a change waiting at a step stands: it enters at the tail of the queue, works its way to the
// head as its time there runs down, and the station works it in the last fifth
const parkOf = (id, progress) => {
  if (id === "canary") return { at: [X.canary, 0, BT] };
  if (id === "rollback") return { at: DATA.paths["canary>rollback"].at(-1).p, layer: "retB" };
  if (id === "commit") return { at: [X.commit, 0, BT] };
  if (!(id in X)) return null;
  const n = shown[id] ?? 0;
  if (!Q.slots[id] || progress >= 0.8) {
    const t = Q.slots[id] ? (progress - 0.8) / 0.2 : 1;
    return { at: [X[id] - Q.lead * (1 - t), 0, BT] };
  }
  const j = n * (1 - progress / 0.8);
  return { at: [X[id] - Q.lead - j * Q.gap, 0, BT], slot: Math.round(j) < n ? Math.round(j) : -1 };
};
const progressOf = (id) => {
  const r = SIM.track;
  const d = durOf(id);
  if (!r || !d) return 1;
  return Math.min(1, Math.max(0, 1 - r.left / d));
};
const toLayer = (name) => {
  if (car.layer === name) return;
  car.layer = name;
  layerSvg(name).appendChild(traced);
};
const legsFor = (edgeId, to) => {
  const path = DATA.paths[edgeId];
  const legs = path ? path.map((l) => ({ ...l, p: [...l.p] })) : [];
  if (to === "pr" || to === "build" || to === "qg" || to === "approve" || to === "release") legs.push({ queue: to, layer: "mainB", speed: 60 });
  else if (to === "canary") legs.push({ p: [X.canary, 0, BT], layer: "mainB", speed: 60 });
  return legs;
};
const strokes = { pr: 0, build: 0, approve: 0, canary: 0, release: 0 };
const pushes = { qg: -1, approve: -1, canary: -1 };
let clock = 0;
const follow = (c, dt, calm) => {
  const r = SIM.track;
  let moving = false;
  if (r !== car.run) {
    // the traced change finished (or a new one was picked): finish its way out, fade, start the next
    if (car.run && !car.pending) {
      if (car.node === "release") car.legs.push(...DATA.paths["release>done"].map((l) => ({ ...l, p: [...l.p] })), { fade: true });
      else if (car.node === "rollback") car.legs.push({ fade: true });
    }
    car.run = r;
    car.pending = true;
    car.node = r?.at ?? null;
  } else if (r && r.at !== car.node) {
    const edge = DATA.preset.edges.find((e) => e.id === r.last);
    if (edge && edge.from === car.node && !car.pending) {
      car.legs.push(...legsFor(edge.id, r.at));
      if (edge.from === "release") car.capped = true;
    } else car.pending = true;
    car.node = r.at;
  }
  let target = 1;
  let hidden = { id: null, i: -1 };
  // a station works the traced bottle only while it stands there
  for (const id of Object.keys(strokes)) strokes[id] = 0;
  if (car.legs.length) {
    const g = car.legs[0];
    if (g.fade) {
      target = 0;
      if (calm || car.alpha.x < 0.02) car.legs.shift();
    } else {
      if (!g.p) g.p = tailOf(g.queue);
      if (g.layer) toLayer(g.layer);
      if (!g.started) {
        g.started = true;
        g.from = [...car.at];
        car.s = 0;
        const kick = Object.keys(pushes).find((id) => Math.abs(g.from[0] - DATA.kick[id]) < 0.5 && g.from[1] === 0 && g.p[1] > 0);
        if (kick) pushes[kick] = clock;
      }
      const len = Math.hypot(g.p[0] - g.from[0], g.p[1] - g.from[1], g.p[2] - g.from[2]);
      const speed = (g.speed ?? 60) * (car.legs.length > 4 ? 2 : 1);
      car.s = calm ? len : Math.min(len, car.s + speed * dt);
      const t = len ? car.s / len : 1;
      car.at = g.from.map((v, i) => v + (g.p[i] - v) * t);
      if (car.s >= len) car.legs.shift();
    }
    moving = true;
  } else if (car.pending) {
    target = 0;
    if (calm || car.alpha.x < 0.02) {
      car.pending = false;
      car.capped = false;
      const park = car.node && parkOf(car.node, progressOf(car.node));
      if (park) {
        car.at = [...park.at];
        toLayer(park.layer ?? "mainB");
        target = 1;
      }
    }
    moving = true;
  } else if (car.node) {
    const p = progressOf(car.node);
    const park = parkOf(car.node, p);
    if (park) {
      toLayer(park.layer ?? "mainB");
      const k = calm ? 1 : 1 - Math.exp(-dt / 0.12);
      car.at = car.at.map((v, i) => v + (park.at[i] - v) * k);
      if (park.slot !== undefined && park.slot >= 0) hidden = { id: car.node, i: park.slot };
      if (car.node === "pr" && p > 0.86) strokes.pr = 1;
      if (car.node === "build" && p > 0.84 && p < 0.98) strokes.build = 1;
      if (car.node === "approve" && p > 0.9) strokes.approve = 1;
      if (car.node === "canary" && p > 0.08 && p < 0.92) strokes.canary = 1;
      if (car.node === "release" && p > 0.86) strokes.release = 1;
      target = 1;
    } else target = 0;
  }
  if (settle(car.alpha, target, dt, 0.08, calm)) moving = true;
  traced.setAttribute("transform", translateAlong(P, [car.at[0] - DATA.home[0], car.at[1] - DATA.home[1], car.at[2] - DATA.home[2]]));
  c.setVar(traced, "--rw-traced", car.alpha.x.toFixed(3));
  car.capped ? cap.removeAttribute("data-off") : cap.setAttribute("data-off", "");
  return { moving, hidden };
};

// ---------- the stations' strokes: stamps, nozzle, ram and lever, probe, capper, and the pushers ----------
const heads = {
  pr: { els: [...stage.querySelectorAll('[data-move="pr"]')], drop: 2.4 },
  build: { els: [...stage.querySelectorAll('[data-move="build"]')], drop: 1.6 },
  approve: { els: [...stage.querySelectorAll('[data-move="approve"]')], drop: 3.4 },
  canary: { els: [...stage.querySelectorAll('[data-move="canary"]')], drop: 2.6 },
  release: { els: [...stage.querySelectorAll('[data-move="release"]')], drop: 2 },
};
for (const h of Object.values(heads)) h.s = { x: 0, v: 0 };
const pushEls = Object.fromEntries(Object.keys(pushes).map((id) => [id, stage.querySelector(`[data-push="${id}"]`)]));
const lever = stage.querySelector("[data-lever]");
const LV = DATA.lever;
const paintStrokes = (c, dt, calm) => {
  let moving = false;
  for (const [id, h] of Object.entries(heads)) {
    if (settle(h.s, strokes[id], dt, 0.07, calm)) moving = true;
    const t = translateAlong(P, [0, 0, -h.drop * h.s.x]);
    for (const el of h.els) c.setAttr(el, "transform", t);
  }
  for (const [id, at] of Object.entries(pushes)) {
    const age = clock - at;
    const out = at < 0 || calm ? 0 : age < 0.12 ? smooth(0, 0.12, age) : Math.max(0, 1 - smooth(0.16, 0.5, age));
    if (out > 0) moving = true;
    const [dx, dy] = axisVector(P, [0, DATA.push * out, 0]);
    const el = pushEls[id];
    if (el) {
      c.setAttr(el, "transform", out ? `translate(${dx.toFixed(2)} ${dy.toFixed(2)})` : "");
      holdStill(el, [Number(dx.toFixed(2)), Number(dy.toFixed(2))]);
    }
  }
  // the press's lever follows its ram: one turn in the lever's own plane, as an affine matrix on screen
  const turn = -(LV.rest - LV.down) * heads.approve.s.x;
  const [a, b] = LV.ey;
  const [cc, d] = LV.ez;
  const det = a * d - b * cc;
  const cs = Math.cos(turn);
  const sn = Math.sin(turn);
  // M = A · R · A⁻¹, A = [ey ez], R the turn in (y, z)
  const inv = [d / det, -b / det, -cc / det, a / det];
  const AR = [a * cs + cc * sn, b * cs + d * sn, -a * sn + cc * cs, -b * sn + d * cs];
  const m = [AR[0] * inv[0] + AR[2] * inv[1], AR[1] * inv[0] + AR[3] * inv[1], AR[0] * inv[2] + AR[2] * inv[3], AR[1] * inv[2] + AR[3] * inv[3]];
  const [sx, sy] = LV.screen;
  const e = sx - (m[0] * sx + m[2] * sy);
  const f = sy - (m[1] * sx + m[3] * sy);
  c.setAttr(lever, "transform", Math.abs(turn) < 1e-4 ? "" : `matrix(${m.map((v) => v.toFixed(4)).join(" ")} ${e.toFixed(2)} ${f.toFixed(2)})`);
  return moving;
};

// ---------- the belts run at the line's speed; the dials ----------
const slides = { main: stage.querySelector('[data-slide="main"]'), ret: stage.querySelector('[data-slide="ret"]') };
let phase = 0;
const rateEl = stage.querySelector('[data-ref="rate"]');
const passEl = stage.querySelector('[data-ref="pass"]');
const pointer = (D, f) => {
  const ang = D.from + Math.min(1, Math.max(0, f)) * D.span;
  return lineOnTop([D.c[0] + Math.sin(ang) * D.r0, D.c[1] - Math.cos(ang) * D.r0], [D.c[0] + Math.sin(ang) * D.r1, D.c[1] - Math.cos(ang) * D.r1], D.z, P);
};
const paintBelts = (c, dt, calm) => {
  if (!calm) phase += (6 + c.load * 0.12) * dt;
  const f = (phase / 4) % 1;
  c.setAttr(slides.main, "transform", `translate(${(DATA.slats.main[0] * f).toFixed(2)} ${(DATA.slats.main[1] * f).toFixed(2)})`);
  c.setAttr(slides.ret, "transform", `translate(${(-DATA.slats.ret[0] * f).toFixed(2)} ${(-DATA.slats.ret[1] * f).toFixed(2)})`);
  c.setAttr(rateEl, "d", pointer(DATA.rateKnob, c.load / DATA.rateMax));
  const pd = DATA.passDial;
  c.setAttr(passEl, "d", pointer(pd, (c.shown.pass - pd.lo) / (pd.hi - pd.lo)));
};

// ---------- the tour: the preset, a busier hour, a stricter gate, and back ----------
const TOUR = [[0, 40, 0.82], [8, 40, 0.82], [13, 80, 0.82], [19, 80, 0.82], [23, 40, 0.82], [26, 40, 0.6], [33, 40, 0.6], [36, 40, 0.82], [42, 40, 0.82]];
const tourAt = (t) => {
  const s = t % TOUR[TOUR.length - 1][0];
  for (let i = 1; i < TOUR.length; i++) {
    const [t1, r1, p1] = TOUR[i];
    const [t0, r0, p0] = TOUR[i - 1];
    if (s <= t1) {
      const f = smooth(t0, t1, s);
      return { load: Math.round(r0 + (r1 - r0) * f), pass: Math.round((p0 + (p1 - p0) * f) * 50) / 50 };
    }
  }
  return { load: TOUR[0][1], pass: TOUR[0][2] };
};
const passOfNode = (id) => byId[id].pass ?? 1;
const yieldOf = (c) => c.params.pass * passOfNode("approve") * passOfNode("canary");
benchFigure({
  load: { max: DATA.rateMax, min: 1, home: DATA.preset.rps, step: 5, big: 20, snap: 1, unit: "changes/h" },
  params: [{ name: "pass", value: passOfNode("qg"), min: 0.5, max: 1, step: 0.02, big: 0.1 }],
  engine,
  alwaysMoving: true,
  tour: tourAt,
  readout: (c) => {
    // one engine tick: the rate it ran, who waits at the press, the share of finished changes rolled back
    const m = c.metrics;
    return `${c.fmt(m?.sys?.rps ?? c.load)}/h · ${c.fmt(m?.nodes.approve?.q ?? 0)} at the press · ${c.pct(m?.sys?.err ?? 0)} rolled back`;
  },
  describe: (c) => `${c.fmt(c.target)} changes per hour, ${c.fmt(c.metrics?.sys?.qtot ?? 0)} in flight; the inspection camera passes ${Math.round(c.params.pass * 100)}%, so ${Math.round(yieldOf(c) * 100)}% get through the first time; ${Math.round((c.metrics?.sys?.err ?? 0) * 100)}% of recent changes were rolled back`,
  frame: (c, dt, calm) => {
    clock += dt;
    const { moving, hidden } = follow(c, dt, calm);
    paintCounts(c, hidden);
    const stroking = paintStrokes(c, dt, calm);
    paintBelts(c, dt, calm);
    return moving || stroking;
  },
});
