// Fig 5's own motion: the carousel turns with the load (every request turns it to a bin), the
// dumbwaiter makes a trip per batch of misses, the lever shows the miss rate, the dials read the
// engine's utilization and the dispenser's dial reads the load. The rest is figures/lib/bench-live.js.
const STAGE = document.querySelector(".bx-stage");
const PP = DATA.proj;
// the preset, then a cold cache (everything to the loft), then past the loft's 5,000 rps but under the counter's 5,333, and back
const TOUR = [[0, 1500, DATA.miss], [3, 1500, DATA.miss], [6, 1500, 1], [9, 1500, 1], [14, 5200, 1], [19, 5200, 1], [24, 1500, DATA.miss], [28, 1500, DATA.miss]];
const tourAt = (t) => {
  const s = t % TOUR[TOUR.length - 1][0];
  for (let i = 1; i < TOUR.length; i++) {
    const [t1, l1, m1] = TOUR[i];
    const [t0, l0, m0] = TOUR[i - 1];
    if (s <= t1) {
      const f = smooth(t0, t1, s);
      return { load: l0 + (l1 - l0) * f, miss: Math.round((m0 + (m1 - m0) * f) / 0.05) * 0.05 };
    }
  }
  return { load: TOUR[0][1], miss: TOUR[0][2] };
};
const q = (sel) => STAGE.querySelector(sel);
const needles = DATA.needles.map((n) => ({ n, el: q(`[data-ref="${n.ref}"]`), s: { x: 0, v: 0 } }));
const dispenser = q('[data-ref="dispenser"]');
const leverEl = q('[data-ref="lever"]');
const carEl = q('[data-ref="car"]');
const ropeEl = q('[data-ref="rope"]');
const tickets = DATA.tickets.map((id) => Array.from({ length: 6 }, (_, t) => q(`[data-ticket="${id}.${t}"]`)));
const pointer = (c, z, from, span, f, r0, r1) => {
  const a = from + Math.min(1, Math.max(0, f)) * span;
  return lineOnTop([c[0] + Math.sin(a) * r0, c[1] - Math.cos(a) * r0], [c[0] + Math.sin(a) * r1, c[1] - Math.cos(a) * r1], z, PP);
};
const TOP = DATA.dumb.low;
const leverSvg = (miss) => {
  const { c: [cx, cy], len, w, knob, from, span } = DATA.lever;
  const a = from + span * miss;
  const d = [Math.sin(a), -Math.cos(a)];
  const n = [-d[1], d[0]];
  const ring = [[0, -w / 2], [len, -w / 2], [len, w / 2], [0, w / 2]].map(([s, t]) => [cx + d[0] * s + n[0] * t, cy + d[1] * s + n[1] * t]);
  const tip = [cx + d[0] * len, cy + d[1] * len];
  return solidSvg(extrude(ring, TOP + 2.2, 1.2, PP), { tone: "hi", crease: "lo" }) + solidSvg(cylinder(cx, cy, 1.4, TOP + 2.2, 1.6, PP, 16), { tone: "hi", crease: "lo" }) + solidSvg(cylinder(tip[0], tip[1], knob, TOP + 2.2, 3.4, PP, 20, 0.3), { tone: "hi", crease: "lo" });
};
const CAR = DATA.dumb.car;
const CAR_H = DATA.dumb.carH;
const ROPE = DATA.dumb.rope;
const carSvg = (z, lamp) => {
  const front = CAR.y + CAR.d;
  const door = pathOf(roundedPlan({ x: CAR.x + 2.4, y: z + 2.2, w: CAR.w - 4.8, d: CAR_H - 5, r: 0.8 }, 3).map(([x, zz]) => iso([x, front, zz], PP)), true);
  const eye = iso([ROPE.x, ROPE.y, z + CAR_H], PP);
  const lampAt = iso([CAR.x + CAR.w - 1.6, front, z + CAR_H - 1.8], PP);
  return solidSvg(slabOf(CAR, z, CAR_H, PP, 3, 0.4), { tone: "mid", crease: "lo", inner: lineSvg(door, { tone: "lo" }) }) + dotsSvg([eye], { size: 0.55, tone: "hi" }) + `<circle class="cx-lamp" cx="${lampAt[0].toFixed(2)}" cy="${lampAt[1].toFixed(2)}" r="${(0.9 * cameraOf(PP).k).toFixed(2)}" style="opacity:${lamp.toFixed(3)}"/>`;
};
let spin = 0;
let phase = 0;
// a tool driving the turn (window.__isoTurn) holds the figure: its own motion (the car, the spin)
// stops so every captured frame is the angle the tool set and nothing else
let toolHold = false;
let drawnLever = "";
let drawnCar = "";
const SAT = { db: "stock loft", api: "counter" };
const fig = benchFigure({
  load: { max: DATA.rpsMax, home: DATA.preset.rps },
  params: [{ name: "miss", value: DATA.miss, min: 0, max: 1, step: 0.05 }],
  graph: (c) => ({ nodes: DATA.preset.nodes, edges: DATA.preset.edges.map((e) => (e.id === "api>db" ? { ...e, w: c.shown.miss } : e)) }),
  turn: {},
  alwaysMoving: true,
  tour: (t) => tourAt(t),
  readout: (c) => {
    const load = c.fmt(c.metrics?.sys?.rps ?? c.load);
    const miss = `${Math.round(c.params.miss * 100)}% miss`;
    const errors = c.pct(c.metrics?.sys?.err ?? 0);
    const api = c.health("api") === "crit";
    const db = c.health("db") === "crit";
    if (api && db) return `${load} rps · ${miss} · counter and loft saturated · ${errors} errors`;
    if (api || db) return `${load} rps · ${miss} · ${SAT[api ? "api" : "db"]} saturated · ${errors} errors`;
    return `${load} rps · ${miss} · stock loft ${c.pct(c.util("db"))}`;
  },
  describe: (c) => `${c.fmt(c.target)} requests per second, ${Math.round(c.params.miss * 100)} percent miss`,
  frame: (c, dt, calm) => {
    if (toolHold) return false;
    // every request turns the carousel to a bin: its speed follows the load
    if (!calm) spin += (c.load / 40) * dt;
    c.controller?.set({ carousel: spin });
    // a trip per batch of misses, slowed so the eye can follow; with no misses the car parks below
    const rate = Math.min(1.4, (c.load * c.shown.miss) / 2000);
    if (!calm && (rate > 0.02 || phase > 0)) {
      phase += Math.max(rate, 0.25) * dt;
      if (phase >= 1) phase = rate > 0.02 ? phase % 1 : 0;
    }
    if (calm) phase = c.params.miss > 0 ? 0.5 : 0;
    const h = smooth(0.05, 0.45, phase) - smooth(0.55, 0.95, phase);
    const z = DATA.dumb.low + (DATA.dumb.high - DATA.dumb.low) * h;
    const lamp = phase > 0 ? smooth(0, 0.06, phase) * (1 - smooth(0.94, 1, phase)) : 0;
    const carKey = `${z.toFixed(2)}|${lamp.toFixed(2)}`;
    if (carKey !== drawnCar) {
      drawnCar = carKey;
      carEl.innerHTML = carSvg(z, lamp);
      ropeEl.setAttribute("d", segment([ROPE.x, ROPE.y, z + CAR_H], [ROPE.x, ROPE.y, ROPE.top], PP));
    }
    const leverKey = c.shown.miss.toFixed(4);
    if (leverKey !== drawnLever) {
      drawnLever = leverKey;
      leverEl.innerHTML = leverSvg(c.shown.miss);
    }
    for (const { n, el, s } of needles) {
      settle(s, Math.min(c.util(n.node), n.max), dt, 0.35, calm);
      c.setAttr(el, "d", pointer(n.c, n.z, n.from, n.span, s.x / n.max, n.r0, n.r1));
    }
    const D = DATA.dispenser;
    c.setAttr(dispenser, "d", pointer(D.c, D.z, D.from, D.span, c.load / DATA.rpsMax, D.r0, D.r1));
    // the work in hand at each position: a ticket per sixth of its utilization
    const shown = Math.round(Math.min(1, c.util("api")) * 6);
    for (const list of tickets) list.forEach((el, t) => c.setVar(el, "display", t < Math.max(1, shown) ? "inline" : "none"));
    return !calm;
  },
});
if (window.__isoTurn) {
  const set = window.__isoTurn.set;
  window.__isoTurn.set = (...args) => {
    toolHold = true;
    return set(...args);
  };
}
void fig;
