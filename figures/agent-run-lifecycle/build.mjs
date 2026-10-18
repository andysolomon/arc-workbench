// Fig 12 · Agent Run Lifecycle. The Workbench's `agentrun` state machine as a pinball table on the
// bench. Each state is a saucer on the playfield, laid out where the example puts it; each
// transition is a lane engraved between two saucers, as wide as its weight; the four terminal
// outcomes are drain cups. A plunger launches a traced run, which walks the table exactly as the
// Workbench's Markov token simulator walks it (tickState, live on the page); balls resting in a
// saucer are the runs waiting there, and the counters on the apron are the shares of every run
// the simulator has finished, converging on the chain's own result.
//
//   node figures/agent-run-lifecycle/build.mjs [--light] [--audit] [--out=dir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { truth } from "../lib/truth.mjs";
import { workshop } from "../lib/bench.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";
const outDir = argv.find((a) => a.startsWith("--out="))?.slice(6) ?? HERE;

// ---------- truth: the example, its chain, and where runs end up ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const EX = TRUTH.WB.EXAMPLES.state.find((e) => e.id === "agentrun");
if (!EX) throw new Error("the agentrun example is missing from src/paradigms/examples.ts");
const TERMINAL = new Set(["completed", "cancelled", "failed", "expired"]);
// the exact chain result: mass iterated along the weights until it settles (as src/docs/facts.ts does)
const outcome = (() => {
  let mass = new Map([["queued", 1]]);
  const done = new Map();
  for (let step = 0; step < 4000; step++) {
    const next = new Map();
    for (const [id, m] of mass) {
      const list = EX.edges.filter((e) => e.from === id);
      const total = list.reduce((s, e) => s + (e.p ?? 1), 0);
      if (!list.length) done.set(id, (done.get(id) ?? 0) + m);
      else for (const e of list) next.set(e.to, (next.get(e.to) ?? 0) + (m * (e.p ?? 1)) / total);
    }
    mass = next;
  }
  return Object.fromEntries([...TERMINAL].map((id) => [id, done.get(id) ?? 0]));
})();
// how long a run dwells in each state before it moves on, in simulated minutes (the engine's own rule)
const DWELL = Object.fromEntries(EX.nodes.map((n) => [n.id, n.dwell ?? TRUTH.WB.PARADIGMS.state.TYPES[n.type]?.dwell ?? 0]));
export const RATE_MAX = 600;
export const RUNS_PER_BALL = 25;

// ---------- camera and world ----------
const WIDTH = 640;
const HEIGHT = 410;
const BENCH = { x: -126, y: -130, w: 252, d: 236, r: 9 };
const GEN = { x: -117, y: -122, w: 54, d: 38, r: 3 };
const CAB = { x: -106, y: -70, w: 212, d: 164, r: 4 };
const CAB_Z = [7, 21];
const TOP = 21.8;
const RAIL_H = 4;
const PF = { x: -100, y: -64, w: 200, d: 118 };
const APRON_Y = PF.y + PF.d + 1.5;
// where each state sits: the example's own layout, scaled onto the playfield
const place = (n) => [(n.x - 560) * 0.15, (n.y - 296) * 0.21 - 6];
export const POCKETS = Object.fromEntries(EX.nodes.map((n) => [n.id, place(n)]));
const SAUCER = { out: 9.6, in: 7.6 };
const DRAIN = { out: 10, in: 7.8 };
const BALL_R = 2.9;

export const P = k.fitProjection(
  [...k.boxCorners(BENCH, -17, 0), [-90, -103, 29], [0, CAB.y + CAB.d, TOP + 12], [-100, -64, TOP + RAIL_H], [100, -64, TOP + RAIL_H]],
  WIDTH,
  HEIGHT,
  { pad: 30, azimuth: 72, elevation: 34 },
);
const W = workshop({ P, theme, layers: ["back"] });
const { at, S, L, D, VERT, put, byDepth } = W;

// ---------- the cabinet: legs, body, playfield, rails ----------
function cabinet() {
  const legs = k.corners(CAB, 9);
  for (const [x, y] of byDepth(legs)) {
    const svg = S(k.cylinder(x, y, 4.6, 0, 1.4, P, 24), { tone: "lo" }) + S(k.cylinder(x, y, 3, 1.4, CAB_Z[0] - 1.4, P, 20), { tone: "mid", crease: "none" });
    put({ name: `table.leg.${x}.${y}`, layer: "back", at: [x, y, 0], svg, shapes: [A.cylinder(x, y, 4.6, 0, 1.4), A.cylinder(x, y, 3, 1.4, CAB_Z[0] - 1.4)] });
  }
  const screws = k.corners(CAB, 3);
  const body =
    S(k.slabOf(CAB, CAB_Z[0], CAB_Z[1] - CAB_Z[0], P, 6, 1), { tone: "mid", inner: L(k.sideSeam(CAB, CAB_Z[0] + 4, P, 6), { tone: "faint" }) }) +
    D(screws.map(([x, y]) => at([x, y, CAB_Z[1]])), { size: 0.42 });
  put({ name: "table.body", layer: "back", at: [0, 0, CAB_Z[0]], bias: -30, svg: body, shapes: [A.slab(CAB, CAB_Z[0], CAB_Z[1] - CAB_Z[0])] });
}
// rails round the playfield, split so each is one slab; a gap at the back-left lets the launch lane in
function rails() {
  const t = 3;
  const list = [
    { name: "back", plan: { x: PF.x - t, y: PF.y - t, w: PF.w + 2 * t, d: t, r: 0.8 } },
    { name: "left", plan: { x: PF.x - t, y: PF.y, w: t, d: APRON_Y - PF.y + 26, r: 0.8 } },
    { name: "right", plan: { x: PF.x + PF.w, y: PF.y, w: t, d: APRON_Y - PF.y + 26, r: 0.8 } },
    { name: "apron", plan: { x: PF.x + 22, y: APRON_Y - 1.5, w: PF.w - 22, d: 2.4, r: 0.6 } },
    { name: "front-left", plan: { x: PF.x - t, y: APRON_Y + 26, w: t + 5.5, d: t, r: 0.8 } },
    { name: "front", plan: { x: PF.x + 12.5, y: APRON_Y + 26, w: PF.w - 12.5 + t, d: t, r: 0.8 } },
  ];
  for (const { name, plan } of list) {
    const h = name === "apron" ? 2.4 : RAIL_H;
    const dots = name === "apron" ? [] : [0.2, 0.5, 0.8].map((f) => (plan.w > plan.d ? [plan.x + plan.w * f, plan.y + plan.d / 2] : [plan.x + plan.w / 2, plan.y + plan.d * f]));
    put({ name: `table.rail.${name}`, layer: "back", at: [plan.x + plan.w / 2, plan.y + plan.d / 2, TOP], svg: S(k.slabOf(plan, TOP, h, P, 2, 0.4), { tone: name === "apron" ? "mid" : "hi", crease: "lo" }) + D(dots.map(([x, y]) => at([x, y, TOP + h])), { size: 0.4 }), shapes: [A.slab(plan, TOP, h)] });
  }
}

// ---------- lanes: one engraved lane per transition, as wide as its weight ----------
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len2 = (a) => Math.hypot(a[0], a[1]);
const CURVE = {
  "reviewing>planning": -24,
  "executing>approval": 6, "approval>executing": 6,
  "executing>blocked": 6, "blocked>executing": 6,
  "retrying>planning": 6, "planning>cancelled": -4,
};
const laneWidth = (p) => 1.6 + 4.4 * p;
export const LANES = {};
function laneOf(e) {
  const a = POCKETS[e.from];
  const b = POCKETS[e.to];
  const d = sub2(b, a);
  const n = [-d[1] / len2(d), d[0] / len2(d)];
  const off = CURVE[`${e.from}>${e.to}`] ?? 0;
  const c = [(a[0] + b[0]) / 2 + n[0] * off, (a[1] + b[1]) / 2 + n[1] * off];
  const steps = 32;
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  });
  return pts;
}
function lanes() {
  const parts = [];
  for (const e of EX.edges) {
    const pts = laneOf(e);
    LANES[e.id] = pts.map(([x, y]) => [Number(x.toFixed(2)), Number(y.toFixed(2))]);
    // a ribbon: the centreline offset both ways, cut back to the saucer rims at both ends
    const rimFrom = TERMINAL.has(e.from) ? DRAIN.in : SAUCER.in;
    const rimTo = TERMINAL.has(e.to) ? DRAIN.in : SAUCER.in;
    const keep = pts.filter((p) => len2(sub2(p, POCKETS[e.from])) > rimFrom - 1 && len2(sub2(p, POCKETS[e.to])) > rimTo - 1);
    const w = laneWidth(e.p ?? 1) / 2;
    const side = (sign) =>
      keep.map((p, i) => {
        const q = keep[Math.min(keep.length - 1, i + 1)];
        const o = keep[Math.max(0, i - 1)];
        const t = sub2(q, o);
        const l = len2(t) || 1;
        return [p[0] - (sign * t[1] * w) / l, p[1] + (sign * t[0] * w) / l];
      });
    const ring = [...side(1), ...side(-1).reverse()];
    parts.push(`<path class="ar-lane" d="${k.onTop(ring, TOP, P, true)}"/>`);
  }
  return parts.join("");
}

// ---------- the playfield: lanes, saucers, drain cups, lamps ----------
export const SLOTS = {};
function playfield() {
  const plan = { x: PF.x, y: PF.y, w: PF.w, d: APRON_Y - PF.y + 26, r: 0.5 };
  const field = S(k.slabOf(plan, CAB_Z[1], TOP - CAB_Z[1], P, 2), { tone: "hi" }) + `<g class="ar-lanes">${lanes()}</g>`;
  // the launch lane: from the plunger up the left rail to the queued saucer
  const q = POCKETS.queued;
  // the ball waits in the shooter lane behind the plunger housing, clear of it
  const launch = [[PF.x + 9, APRON_Y - 12], [PF.x + 9, q[1] - 16], [PF.x + 12, q[1] - 22], [q[0] - 9, q[1] - 6]];
  const launchPath = G.fillet(launch.map(([x, y]) => [x, y, 0]), 6, 10).map(([x, y]) => [x, y]);
  LANES.launch = launchPath.concat([q]).map(([x, y]) => [Number(x.toFixed(2)), Number(y.toFixed(2))]);
  const lw = 2.2;
  const lside = (sign) =>
    launchPath.map((p, i) => {
      const n1 = launchPath[Math.min(launchPath.length - 1, i + 1)];
      const n0 = launchPath[Math.max(0, i - 1)];
      const t = sub2(n1, n0);
      const l = len2(t) || 1;
      return [p[0] - (sign * t[1] * lw) / l, p[1] + (sign * t[0] * lw) / l];
    });
  const launchSvg = `<path class="ar-lane" d="${k.onTop([...lside(1), ...lside(-1).reverse()], TOP, P, true)}"/>`;
  let pockets = "";
  let lampIndex = 0;
  const pocketShapes = [];
  for (const n of EX.nodes) {
    const [x, y] = POCKETS[n.id];
    const term = TERMINAL.has(n.id);
    const R = term ? DRAIN : SAUCER;
    pocketShapes.push(A.cylinder(x, y, R.out, TOP, term ? 0.8 : 0.6, { name: `table.pocket.${n.id}` }));
    if (term) {
      // a drain cup: a chrome ring round a dark hole
      pockets += `<g data-mat="chrome">${S(k.cylinder(x, y, R.out, TOP, 0.8, P, 48, 0.25), { tone: "hi", crease: "lo" })}</g>` + `<path class="iso-shade" data-shade="0" d="${k.ring(x, y, R.in, TOP + 0.8, P, 48)}"/>` + L(k.ring(x, y, R.in, TOP + 0.8, P, 48), { tone: "mid" }) + L(k.ring(x, y, R.in - 2.2, TOP + 0.8, P, 40), { tone: "lo" });
    } else {
      pockets += S(k.cylinder(x, y, R.out, TOP, 0.6, P, 48, 0.25), { tone: "mid", crease: "lo" }) + `<path class="iso-shade" data-shade="1" d="${k.ring(x, y, R.in, TOP + 0.6, P, 48)}"/>` + L(k.ring(x, y, R.in, TOP + 0.6, P, 48), { tone: "lo" }) + L(k.ring(x, y, 2, TOP + 0.6, P, 20), { tone: "faint" });
      // up to six resting balls, each one RUNS_PER_BALL runs waiting in this state
      SLOTS[n.id] = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        return [x + 4.2 * Math.cos(a), y + 4.2 * Math.sin(a)];
      });
    }
    // a lamp lens set into the playfield behind the saucer: lit while the traced run is in this state
    const lamp = [x + (term ? 12.6 : 12) * Math.cos(-2.3), y + (term ? 12.6 : 12) * Math.sin(-2.3)];
    const c = at([lamp[0], lamp[1], TOP + 0.4]);
    pocketShapes.push(A.cylinder(lamp[0], lamp[1], 1.8, TOP, 0.4, { name: `table.lamp.${n.id}` }));
    pockets += S(k.cylinder(lamp[0], lamp[1], 1.8, TOP, 0.4, P, 20), { tone: "lo" }) + `<circle class="bx-lamp" data-lamp="${lampIndex++}" data-node="${n.id}" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="${(1.05 * G.scaleOf(P)).toFixed(2)}"/>`;
  }
  // a printed border inset from the rails, and the launch lane's two guide rails
  const border = k.planOutline({ x: PF.x + 4, y: PF.y + 4, w: PF.w - 8, d: APRON_Y - PF.y - 8, r: 3 }, TOP, P, 4);
  pockets += L(border, { tone: "faint" });
  put({ name: "table.playfield", layer: "back", at: [0, 0, CAB_Z[1]], bias: -10, svg: field + launchSvg + pockets, shapes: [A.slab(plan, CAB_Z[1], TOP - CAB_Z[1]), ...pocketShapes] });
  const guide = { x: PF.x + 13.6, y: q[1] + 12, w: 1.4, d: APRON_Y - (q[1] + 12), r: 0.5 };
  put({ name: "table.guide", layer: "back", at: [guide.x, guide.y + guide.d / 2, TOP], svg: S(k.slabOf(guide, TOP, 2.2, P, 2, 0.2), { tone: "hi", crease: "lo" }), shapes: [A.slab(guide, TOP, 2.2)] });
  // rubber-ringed posts at the playfield's corners
  for (const [x, y] of [[PF.x + 9, PF.y + 9], [PF.x + PF.w - 9, PF.y + 9], [PF.x + PF.w - 9, APRON_Y - 9], [PF.x + 26, APRON_Y - 9]]) {
    put({ name: `table.post.${x}.${y}`, layer: "back", at: [x, y, TOP], svg: S(k.cylinder(x, y, 2.6, TOP, 2.4, P, 24), { tone: "lo", crease: "lo" }) + S(k.cylinder(x, y, 1.3, TOP + 2.4, 1.6, P, 16), { tone: "hi" }) + D([at([x, y, TOP + 4])], { size: 0.4 }), shapes: [A.cylinder(x, y, 2.6, TOP, 2.4), A.cylinder(x, y, 1.3, TOP + 2.4, 1.6)] });
  }
}

// ---------- the plunger: a knob, a rod and a coil spring in a housing on the apron ----------
export const PLUNGER = { x: PF.x + 9, z: TOP + 3.2 };
function plunger() {
  const { x, z } = PLUNGER;
  const house = { x: x - 4, y: APRON_Y, w: 8, d: 6, r: 1 };
  const svg = S(k.slabOf(house, TOP, 6.4, P, 3, 0.4), { tone: "mid", crease: "lo" }) + D([at([x - 2.2, APRON_Y + 3, TOP + 6.4]), at([x + 2.2, APRON_Y + 3, TOP + 6.4])], { size: 0.38 });
  put({ name: "plunger.housing", layer: "back", at: [x, APRON_Y + 3, TOP], svg, shapes: [A.slab(house, TOP, 6.4)] });
  // the moving part: rod, spring and knob, drawn at rest and moved along y by the live code
  const F = G.frameOf([x, APRON_Y + 6, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  // the rod runs out through a gap in the front rail to a knob past it, over the cabinet's front edge
  const coil = k.coil(APRON_Y + 6.6, APRON_Y + 15, [x, z], 1.6, 7, "y", P);
  // the spring seats on a washer on the rod: its end lands on the washer's seat ring
  const washer = S(G.disc(0, 0.6, 2.4, F, P), { tone: "mid", crease: "lo" }) + L(G.circleOf(F, 0.6, 1.6, P), { tone: "lo" });
  const rod = S(G.disc(0, 24, 0.7, F, P), { tone: "hi", crease: "none" });
  const knob = S(G.disc(24, 26, 2.6, F, P), { tone: "hi", crease: "lo" }) + S(G.disc(26, 29, 2, F, P), { tone: "mid" }) + D([at(G.pointOf(F, 29, 0, 0))], { size: 0.45 });
  const svgMove = `<g data-ref="plunger">${washer}${L(coil.back, { tone: "lo" })}${rod}${L(coil.front, { tone: "mid" })}${knob}</g>`;
  put({ name: "plunger.rod", layer: "back", at: [x, APRON_Y + 16, z], svg: svgMove, shapes: [A.disc(F, 0, 24, 0.7, { owner: "plunger" }), A.disc(F, 0, 0.6, 2.4, { name: "plunger.washer", owner: "plunger" }), A.disc(F, 24, 26, 2.6), A.disc(F, 26, 29, 2)] });
}

// ---------- the counters: four share meters on the apron, one per drain ----------
export const COUNTERS = [];
function counters() {
  // each counter sits in front of its own drain cup, so a share reads straight off its outcome
  const order = ["failed", "cancelled", "expired", "completed"];
  const w = 30;
  order.forEach((id) => {
    const plan = { x: POCKETS[id][0] - w / 2, y: APRON_Y + 5, w, d: 13, r: 1.2 };
    const front = plan.y + plan.d;
    const top = TOP + 10;
    const win = { x0: plan.x + 4, x1: plan.x + plan.w - 4, z0: TOP + 3, z1: TOP + 8 };
    const winPath = k.pathOf([[win.x0, win.z0], [win.x1, win.z0], [win.x1, win.z1], [win.x0, win.z1]].map(([x, z]) => at([x, front, z])), true);
    // the digits are in the window's own plane, clipped to it, sized so "100.0" fits
    const M = k.sideMatrix([win.x0 + 1, front], win.z0 + 1.2, P, "left");
    const clip = `ar-win-${theme}-${id}`;
    const digits = `<defs><clipPath id="${clip}"><path d="${winPath}"/></clipPath></defs><path class="ar-window" d="${winPath}"/><g clip-path="url(#${clip})"><text class="iso-face-text ar-digits" data-tone="hi" data-counter="${id}" transform="${M}" font-size="3.6" x="${(win.x1 - win.x0 - 2).toFixed(2)}" y="0" text-anchor="end">${(outcome[id] * 100).toFixed(1)}</text></g>` + L(winPath, { tone: "lo" });
    const screws = [[plan.x + 2, plan.y + 2], [plan.x + plan.w - 2, plan.y + 2]];
    const svg =
      S(k.slabOf(plan, TOP, top - TOP, P, 3, 0.6), { tone: "mid", crease: "lo", inner: L(k.sideSeam(plan, top - 1.6, P, 3), { tone: "faint" }) }) +
      digits +
      D(screws.map(([x, y]) => at([x, y, top])), { size: 0.4 });
    put({ name: `counter.${id}`, layer: "back", at: [plan.x + plan.w / 2, plan.y + plan.d / 2, TOP], svg, shapes: [A.slab(plan, TOP, top - TOP)] });
    COUNTERS.push(id);
  });
}

// ---------- the balls: a traced run, and the runs resting in each saucer ----------
const ballSvg = (r, tone, cls) => `<g class="${cls}">${S(G.sphereOf([0, 0, 0], r, P), { tone })}</g>`;
function balls() {
  // drawn at the world origin and moved on screen: a sphere's shading doesn't depend on where it is
  const origin = at([0, 0, 0]);
  const rest = [];
  for (const [id, slots] of Object.entries(SLOTS)) {
    slots.forEach(([x, y], i) => {
      const p = at([x, y, TOP + 0.6 + 1.9]);
      rest.push(`<g class="ar-rest" data-rest="${id}" data-i="${i}" transform="translate(${(p[0] - origin[0]).toFixed(2)} ${(p[1] - origin[1]).toFixed(2)})">${ballSvg(1.9, "mid", "ar-ball")}</g>`);
    });
  }
  const traced = `<g class="ar-traced" data-ref="ghost" transform="translate(0 0)">${ballSvg(BALL_R, "hi", "ar-ball")}</g><g class="ar-traced" data-ref="ball" transform="translate(0 0)">${ballSvg(BALL_R, "hi", "ar-ball")}</g>`;
  // recorded where they rest: the slots on the saucer tops, the traced ball in the queued saucer
  const shapes = Object.values(SLOTS).flat().map(([x, y]) => A.ball([x, y, TOP + 0.6 + 1.9], 1.9));
  shapes.push(A.ball([POCKETS.queued[0], POCKETS.queued[1], TOP + 0.6 + BALL_R], BALL_R, { name: "balls.traced" }));
  put({ name: "balls", layer: "back", at: [0, 60, TOP + 2], bias: 400, svg: rest.join("") + traced, shapes });
}

// ---------- build ----------
const { halo } = W.bench(BENCH, { label: { x: 40, y: -124, w: 66, d: 20, r: 2 } });
const gen = W.generator(GEN, { rpsMax: RATE_MAX, marks: [EX.rps] });
cabinet();
playfield();
rails();
plunger();
counters();
balls();
W.conduit("pipe.runs", [[-90, GEN.y + GEN.d, 13], [-90, CAB.y, 13]], [0, 1, 0], [0, -1, 0]);

const { layerOf } = W.finish();
if (argv.includes("--audit")) A.auditOrExit(W.R, P);

// ---------- page ----------
const pc = (id) => `${(outcome[id] * 100).toFixed(1)}%`;
const css = `.ar-lane{fill:var(--anatomy-shade-1);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);stroke-linejoin:round}
.ar-window{fill:var(--anatomy-shade-0);stroke:none}
.ar-digits{font-variant-numeric:tabular-nums;letter-spacing:.06em}
.ar-rest{opacity:0;transition:opacity .25s}
.ar-rest[data-on]{opacity:1}
.ar-traced{opacity:0}
.ar-traced[data-on]{opacity:1}
.ar-traced .iso-edge{stroke:var(--anatomy-lit)}
@media (prefers-reduced-motion:reduce){.ar-rest{transition:none}}`;
const page = W.page({
  title: "Agent run lifecycle",
  fig: "Fig 12",
  hint: "Space launches · drag or ← → runs/hour",
  readout: `${EX.rps} runs/h · completed ${pc("completed")}`,
  keys: [
    { mark: "lit", label: "The traced run and the state it is in" },
    { mark: "raised", label: "Saucers: states · lanes: transitions, as wide as their weight · cups: outcomes" },
    { mark: "flat", label: `A resting ball: ${RUNS_PER_BALL} runs waiting in that state` },
  ],
  caption: `The counters are the shares of every run the Workbench's own Markov simulator has finished, walking this example's weights. They converge on the chain's exact result: completed ${pc("completed")}, cancelled ${pc("cancelled")}, failed ${pc("failed")}, expired ${pc("expired")}. Most runs in flight are waiting for a human: the approval saucer holds the most balls. Time runs at ten minutes a second.`,
  label: "A pinball table on legs on a bench. Saucers on the playfield are the states of an agent run, laid out like the state diagram: queued, planning, executing and reviewing across the back, retrying, needs approval and blocked in the middle, and drain cups for completed, failed, cancelled and expired. Lanes engraved between the saucers are the transitions, wider where a run is more likely to take them. A plunger on the apron launches a traced ball; four counters show the share of runs that ended in each outcome.",
  width: WIDTH,
  height: HEIGHT,
  stack: ["back"],
  layerOf,
  halo,
  css,
  stageAttrs: { role: "slider", "aria-label": "Agent run lifecycle: press space to launch a traced run, drag across or use the arrow keys to set the runs per hour, Home for the example's rate", "aria-valuemin": 0, "aria-valuemax": RATE_MAX, "aria-valuenow": EX.rps, "aria-valuetext": `${EX.rps} runs per hour` },
  data: { preset: { nodes: EX.nodes, edges: EX.edges, rps: EX.rps }, rateMax: RATE_MAX, pockets: POCKETS, lanes: LANES, slots: SLOTS, terminal: [...TERMINAL], outcome, dwell: DWELL, plunger: PLUNGER, top: TOP, ballR: BALL_R, perBall: RUNS_PER_BALL },
  truthCode: TRUTH.code,
  live: readFileSync(join(HERE, "live.js"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `agent-run-lifecycle${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${W.R.items.length} items · ${W.R.solids.length} solids · chain ${Object.entries(outcome).map(([kk, v]) => `${kk} ${(v * 100).toFixed(1)}%`).join(" ")}`);
}
