// Fig 1's own motion. The arrivals lever slides with the load; the kiosk screens light for the
// share they answer; every lamp tower, desk lamp and handler's lamp reads its node from the engine;
// bags ride the belts at the rate the event bus receives them, and the carousel's pile is the
// engine's queue behind the bus. Everything else is the shared bench runtime.
const HALLS = ["apia", "apib"];
const fmtN = (n) => Math.round(n).toLocaleString("en-US");
const fmtMs = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
const stage = document.querySelector(".bx-stage");
// bags a second piling up behind the bus: what reaches it beyond what the handlers can clear
const behind = (c) => Math.max(0, (c.metrics?.nodes.bus?.arr ?? 0) - DATA.wrkCap);

// the tour: the example, then everyone past the kiosks, then a rush, then back
const TOUR = [[0, 4200, 0.4], [4, 4200, 0.4], [9, 4200, 1], [15, 17000, 1], [19, 17000, 1], [25, 4200, 0.4], [29, 4200, 0.4]];
const tourAt = (t) => {
  const s = t % TOUR[TOUR.length - 1][0];
  for (let i = 1; i < TOUR.length; i++) {
    const [t1, l1, o1] = TOUR[i];
    const [t0, l0, o0] = TOUR[i - 1];
    if (s <= t1) {
      const f = smooth(t0, t1, s);
      return { load: l0 + (l1 - l0) * f, origin: o0 + (o1 - o0) * f };
    }
  }
  return { load: TOUR[0][1], origin: TOUR[0][2] };
};

// ---------- parts the live code drives ----------
const lever = stage.querySelector('[data-ref="lever"]');
const screens = [...stage.querySelectorAll("[data-kiosk]")];
const towers = {};
for (const el of stage.querySelectorAll("[data-andon]")) (towers[el.dataset.andon] ??= { segs: [], s: { x: 0, v: 0 } }).segs[+el.dataset.seg] = el;
const deskDots = { apia: [...stage.querySelectorAll('[data-desk="apia"]')], apib: [...stage.querySelectorAll('[data-desk="apib"]')] };
const handlerDots = [...stage.querySelectorAll("[data-handler]")];
const luggage = [...stage.querySelectorAll("[data-luggage]")];
// a lane's luggage slots stand full one by one as the hall's utilization rises
const STAND = [0.04, 0.35, 0.7];
const pile = [...stage.querySelectorAll("[data-pile]")].sort((a, b) => +a.dataset.pile - +b.dataset.pile);
const beacon = stage.querySelector(".pd-beacon");
const obsDial = stage.querySelector('[data-dial="obs"]');
const lanes = Object.fromEntries([...stage.querySelectorAll("[data-bags]")].map((g) => [g.dataset.bags, g]));
const SEG = [0.05, 0.25, 0.5, 0.75, 0.98];
const pileFill = { x: 0, v: 0 };
const beam = { x: 0, v: 0 };
const telemetry = { x: 0, v: 0 };
const hallLamp = { apia: { x: 0, v: 0 }, apib: { x: 0, v: 0 }, wrk: { x: 0, v: 0 } };

// ---------- bags: one drawing, placed by translation; each rides its desk's belt to the carousel ----------
const svgNS = "http://www.w3.org/2000/svg";
const host = lanes.main?.ownerSVGElement;
if (host && !host.querySelector("#pd-bag")) {
  const defs = document.createElementNS(svgNS, "defs");
  defs.innerHTML = `<g id="pd-bag">${solidSvg(slabOf({ x: -2, y: -1.5, w: 4, d: 3, r: 0.5 }, 0, 3, DATA.proj, 2, 0.3), { tone: "mid", crease: "lo" })}</g>`;
  host.insertBefore(defs, host.firstChild);
}
const L = DATA.lanes;
const BELT_X = L.a.plan.x + L.a.plan.w / 2;
const MAIN_Y = L.main.plan.y + L.main.plan.d / 2;
const END_X = L.main.plan.x + L.main.plan.w - 2.5;
const Z = L.main.z;
const DESKS = { apia: [-70, -52, -34], apib: [22, 40, 58] };
const SPEED = 26;
const bags = [];
let seed = 11;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let owed = 0;
const spawn = (c, dt) => {
  // more bags as the bus receives more, easing toward what one belt can carry (a bag every
  // 6 units at belt speed); the readout carries the exact rate
  const carry = SPEED / 6;
  owed += carry * (1 - Math.exp(-(c.metrics?.nodes.bus?.arr ?? 0) / 2500)) * dt;
  while (owed >= 1 && bags.length < 60) {
    owed -= 1;
    const hall = random() < 0.5 ? "apia" : "apib";
    const y = DESKS[hall][Math.floor(random() * 3)];
    bags.push({ hall, x: BELT_X, y, leg: hall === "apia" ? "a" : "b" });
  }
  if (owed > 1) owed = 1;
};
const step = (dt) => {
  for (let i = bags.length - 1; i >= 0; i--) {
    const b = bags[i];
    let d = SPEED * dt;
    if (b.leg !== "main") {
      const dir = Math.sign(MAIN_Y - b.y);
      const left = Math.abs(MAIN_Y - b.y);
      if (d < left) b.y += dir * d;
      else {
        b.y = MAIN_Y;
        d -= left;
        b.leg = "main";
      }
    }
    if (b.leg === "main") {
      b.x += d;
      if (b.x >= END_X) bags.splice(i, 1);
    }
  }
};
const laneOf = (b) => (b.leg === "main" ? "main" : b.leg);
const drawBags = () => {
  const byLane = { a: [], b: [], main: [] };
  for (const b of bags) byLane[laneOf(b)].push(b);
  for (const [lane, list] of Object.entries(byLane)) {
    const g = lanes[lane];
    if (!g) continue;
    list.sort((p, q) => p.x * DATA.proj.depthX + p.y * DATA.proj.depthY - (q.x * DATA.proj.depthX + q.y * DATA.proj.depthY));
    const html = list.map((b) => `<use href="#pd-bag" transform="${translateAlong(DATA.proj, [b.x, b.y, Z])}"/>`).join("");
    if (g.innerHTML !== html) g.innerHTML = html;
  }
};
DATA.proj.depthX = Math.cos(((DATA.proj.azimuth ?? 45) * Math.PI) / 180);
DATA.proj.depthY = Math.sin(((DATA.proj.azimuth ?? 45) * Math.PI) / 180);

// ---------- paint ----------
const paint = (c, dt, calm) => {
  let moving = false;
  const K = DATA.lever;
  c.setAttr(lever, "transform", translateAlong(DATA.proj, [(K.span * c.load) / DATA.rpsMax, 0, 0]));
  const answered = 1 - c.shown.origin;
  screens.forEach((el, i) => c.setVar(el, "--pd-on", (0.12 + 0.88 * Math.min(1, Math.max(0, answered * screens.length - i))).toFixed(3)));
  for (const [id, t] of Object.entries(towers)) {
    if (settle(t.s, Math.min(c.util(id), 1.4), dt, 0.35, calm)) moving = true;
    t.segs.forEach((el, i) => c.setVar(el, "--pd-on", smooth(SEG[i] - 0.04, SEG[i] + 0.04, t.s.x).toFixed(3)));
  }
  for (const id of ["apia", "apib", "wrk"]) if (settle(hallLamp[id], Math.min(c.util(id), 1), dt, 0.35, calm)) moving = true;
  for (const id of HALLS) deskDots[id].forEach((el) => c.setVar(el, "--pd-on", (0.1 + 0.9 * hallLamp[id].x).toFixed(3)));
  handlerDots.forEach((el) => c.setVar(el, "--pd-on", (0.1 + 0.9 * hallLamp.wrk.x).toFixed(3)));
  luggage.forEach((el) => c.setAttr(el, "visibility", hallLamp[el.dataset.luggage].x >= STAND[+el.dataset.slot] ? "visible" : "hidden"));
  // the pile is the queue behind the bus, a bag per step of a log scale up to the engine's cap
  const q = c.queue("bus");
  if (settle(pileFill, Math.log10(1 + q) / Math.log10(1 + 50000), dt, 0.5, calm)) moving = true;
  const shown = Math.round(pileFill.x * pile.length);
  pile.forEach((el, i) => c.setAttr(el, "visibility", i < shown ? "visible" : "hidden"));
  if (settle(beam, smooth(0, 40, behind(c)), dt, 0.25, calm)) moving = true;
  c.setVar(beacon, "--pd-on", beam.x.toFixed(3));
  if (settle(telemetry, Math.min(1, (c.metrics?.edges["wrk>obs"] ?? 0) / 200), dt, 0.4, calm)) moving = true;
  const d = DATA.dials.obs;
  if (obsDial) {
    const a = d.from + telemetry.x * d.span;
    c.setAttr(obsDial, "d", lineOnTop([d.c[0] + Math.sin(a) * d.r0, d.c[1] - Math.cos(a) * d.r0], [d.c[0] + Math.sin(a) * d.r1, d.c[1] - Math.cos(a) * d.r1], d.z, DATA.proj));
  }
  if (calm) bags.length = 0;
  else {
    spawn(c, dt);
    step(dt);
    if (bags.length) moving = true;
  }
  drawBags();
  // a growing pile is something happening: keep the beacon and pile honest while it climbs
  return moving || (!calm && behind(c) > 0);
};

benchFigure({
  load: { max: DATA.rpsMax, home: DATA.preset.rps, step: 500, big: 2000, snap: 100 },
  params: [{ name: "origin", value: DATA.origin, min: 0.2, max: 1, step: 0.05, big: 0.2 }],
  graph: (c) => ({ nodes: DATA.preset.nodes, edges: DATA.preset.edges.map((e) => (e.id === "edge>gw" ? { ...e, w: c.shown.origin } : e)) }),
  tour: (t) => tourAt(t),
  key: (c, event) => {
    if (event.key !== "Home") return false;
    c.target = DATA.preset.rps;
    c.params.origin = DATA.origin;
    return true;
  },
  readout: (c) => {
    // the load and every number beside it come from the same engine tick
    const sys = c.metrics?.sys;
    const load = fmtN(sys?.rps ?? c.load);
    const kiosks = `kiosks ${Math.round((1 - c.shown.origin) * 100)}%`;
    if (HALLS.some((id) => c.health(id) === "crit")) return `${load} rps · halls saturated · ${c.pct(sys?.err ?? 0)} errors`;
    if (c.health("dr") === "crit") return `${load} rps · ${kiosks} · DR copy saturated`;
    if (c.health("wrk") === "crit") return `${load} rps · ${kiosks} · ${fmtMs(sys?.p50 ?? 0)} · bags +${fmtN(behind(c))}/s`;
    return `${load} rps · ${kiosks} · ${fmtMs(sys?.p50 ?? 0)} · handlers ${c.pct(c.util("wrk"))}`;
  },
  describe: (c) => `${fmtN(c.target)} requests per second, kiosks answer ${Math.round((1 - c.params.origin) * 100)} percent`,
  frame: paint,
});
