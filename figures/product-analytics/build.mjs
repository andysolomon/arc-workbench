// Fig 11 · Product Analytics. The Workbench's `analytics` data-flow example as a water-treatment
// works: data really is sources, streams and sinks. Back to front: a canal intake (the web app) and
// a windpump over a well (mobile) feed a pump house (the edge API). A distribution chamber sends
// identity and consent water through a consent sluice into a sealed tank (the PII vault) inside a
// walled compound, entered and left only through two glands, and everything else down a settling
// channel of 24 lanes (the event stream), which spills over a weir into an outlet chamber, with a
// reject sump beside it (the dead-letter queue). The outlet fills a reservoir (the warehouse), which
// feeds a trough fountain (dashboards) and a header tank on legs (the feature store); the header tank
// feeds a slow sand filter of six cells (the ML model, one cell per instance), whose inlet channel
// fills with the model's backlog. Every level and flow comes from the Workbench's own queueing
// engine (includeAsync, as the data-flow HUD runs it), live on the page; a WebGL layer moves the water.
//
//   node figures/product-analytics/build.mjs [--light] [--audit] [--out=dir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import { truth } from "../lib/truth.mjs";
import { workshop, PIPE_Z, PIPE_R, BOSS_T } from "../lib/bench.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";
const outDir = argv.find((a) => a.startsWith("--out="))?.slice(6) ?? HERE;

// ---------- truth: the example and the engine ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const EX = TRUTH.WB.EXAMPLES.dataflow.find((e) => e.id === "analytics");
if (!EX) throw new Error("the analytics example is missing from src/paradigms/examples.ts");
const node = (id) => EX.nodes.find((n) => n.id === id);
const edge = (from, to) => EX.edges.find((e) => e.from === from && e.to === to);
const capOf = (n, inst = n.inst ?? 1) => (inst * (n.cap ?? 1) * 1000) / n.ms;
// what reaches the model per offered event: the engine splits the load over the two sources, then
// the edge weights carry it on
const sources = EX.nodes.filter((n) => n.type === "source");
const toEdge = sources.reduce((s, n) => s + edge(n.id, "edge").w / sources.length, 0);
const ML_SHARE = toEdge * edge("edge", "stream").w * edge("stream", "wh").w * edge("wh", "feat").w * edge("feat", "ml").w;
const ML_CELL = capOf(node("ml"), 1);
const ML_CAP = capOf(node("ml"));
const ML_TIPS = ML_CAP / ML_SHARE;
// how many model instances the example's load needs, asked of the engine itself: from a cold start,
// and after the model has fallen behind and retries have piled on (they hold a saturated node there)
const settled = (inst, from = null) => {
  const sim = TRUTH.WB.makeSim();
  sim.noise = 0;
  const run = (n) => {
    const nodes = EX.nodes.map((x) => (x.id === "ml" ? { ...x, inst: n } : x));
    let m;
    for (let i = 0; i < 480; i++) m = TRUTH.WB.tick(sim, nodes, EX.edges, EX.rps, 0.25, { includeAsync: true });
    return m;
  };
  if (from !== null) run(from);
  return run(inst).nodes.ml.health !== "crit";
};
const CELLS = 6;
const ML_FIT = [1, 2, 3, 4, 5, 6].find((n) => settled(n));
const ML_RECOVER = [1, 2, 3, 4, 5, 6].find((n) => settled(n, node("ml").inst));
export const RPS_MAX = 8000;

// ---------- camera and world ----------
const WIDTH = 640;
const HEIGHT = 450;
const SITE = { x: -170, y: -152, w: 340, d: 304, r: 10 };
const WALL = 1.8;
// the canal (web), its intake chamber, the windpump over its well (mobile), the pump house (edge API)
const CANAL = { x: -160, y: -146, w: 158, d: 22 };
const CANAL_TOP = 12;
const CANAL_Z = 9;
const INTAKE = { x: -2, y: -148, w: 24, d: 26 };
const INTAKE_TOP = 14;
const HOUSE = { x: 30, y: -122, w: 46, d: 30 };
const HOUSE_H = 22;
const RIDGE = 33;
const WELL = [124, -108];
const WELL_R = 6;
const VALVE_BOX = { x: 108, y: -114, w: 10, d: 12, r: 0.8 };
const TOWER_TOP = 52;
// the distribution chamber with the consent sluice, and the settling channel of 24 lanes (the stream)
const DIST = { x: -30, y: -78, w: 28, d: 34 };
const DIST_TOP = 12;
const DIST_Z = 9;
const CHAN = { x: -2, y: -82, w: 142, d: 42 };
const CHAN_TOP = 11;
const CHAN_Z = 8.5;
const DIV_TOP = 9.8;
const LANES = 24;
const OUTLET = { x: 140, y: -82, w: 22, d: 42 };
const WEIR_TOP = 8.2;
const OUTLET_Z = 4.5;
const SUMP = { x: 112, y: -36, w: 22, d: 14 };
const SUMP_TOP = 7;
// the compound (the governed zone) and its sealed tank (the PII vault)
const COMPOUND = { x: -160, y: -96, w: 92, d: 102 };
const COMPOUND_H = 12;
const FENCE_TOP = 30;
const TANK = { x: -138, y: -70, w: 40, d: 40, r: 1.5 };
const TANK_H = 24;
// the reservoir (warehouse) and its two chambers, the header tank on legs (feature store), the
// fountain (dashboards) and the slow sand filter (ML model)
const RES = [40, 30];
const RES_R = 34;
const RES_TOP = 14;
const RES_Z = 11;
const RES_IN = { x: 74, y: 22, w: 12, d: 16, r: 0.8 };
const RES_OUT = { x: -6, y: 22, w: 12, d: 16, r: 0.8 };
const TOWER = [146, 62];
const TOWER_LEG = 7;
const TANK2_R = 13;
const HEADER = { x: 133, y: 49, w: 26, d: 26, r: 0.8 };
const TANK2_Z = [40, 52];
const INLET = { x: -30, y: 76, w: 156, d: 14 };
const INLET_TOP = 12;
const FILTER = { x: -30, y: 90, w: 156, d: 46 };
const FILTER_TOP = 10;
const STILL = { x: 126, y: 76, w: 16, d: 14, r: 0.8 };
const TROUGH = { x: -150, y: 84, w: 44, d: 32 };
const TROUGH_TOP = 10;
const TROUGH_Z = 8;
const SPOUT = [-128, 78.6];

export const P = k.fitProjection(
  [...k.boxCorners(SITE, -17, 0), [WELL[0], WELL[1], 90], [TOWER[0], TOWER[1], 62], [HOUSE.x, HOUSE.y, RIDGE], [-118, -50, FENCE_TOP]],
  WIDTH,
  HEIGHT,
  { pad: 28, azimuth: 58, elevation: 40 },
);
const W = workshop({ P, theme, layers: ["back"] });
const { R, at, S, L, D, VERT, put, byDepth, poly } = W;
const V = G.viewOf(P);
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const layer = "back";

// ---------- water bodies: the SVG surface (the fallback, and the shader's ground) ----------
// each body tells the shader its plan, its level, the rim that hides its near side and its flow
export const WATER = [];
const waterFill = (pts, z, id, extra = "") => `<path class="pa-water" data-water="${id}"${extra} d="${k.pathOf(pts.map(([x, y]) => at([x, y, z])), true)}"/>`;
function water(id, plan, z, top, { flow = [1, 0], level = null, ref = null } = {}) {
  const inner = { x: plan.x, y: plan.y, w: plan.w, d: plan.d, r: plan.r ?? 0.3 };
  WATER.push({ id, kind: 0, x0: inner.x, y0: inner.y, x1: inner.x + inner.w, y1: inner.y + inner.d, r: inner.r, z, top, flow, level });
  put({ name: `water.${id}`, layer, at: [inner.x + inner.w / 2, inner.y + inner.d / 2, z], bias: 0.02, svg: waterFill(k.roundedPlan(inner, 3), z, id, ref ? ` data-ref="${ref}"` : ""), shapes: [A.slab(inner, z - 0.2, 0.2, { name: `water.${id}` })] });
}

// ---------- an open basin: four walls on a floor pad; the shader knows which rim hides what ----------
function basin(name, plan, z0, top, { t = WALL, skip = [], tops = {} } = {}) {
  const { x, y, w, d } = plan;
  const walls = [
    { side: "back", plan: { x, y, w, d: t, r: 0.3 } },
    { side: "left", plan: { x, y: y + t, w: t, d: d - 2 * t, r: 0.3 } },
    { side: "right", plan: { x: x + w - t, y: y + t, w: t, d: d - 2 * t, r: 0.3 } },
    { side: "front", plan: { x, y: y + d - t, w, d: t, r: 0.3 } },
  ];
  for (const wall of walls) {
    if (skip.includes(wall.side)) continue;
    const p = wall.plan;
    const h = (tops[wall.side] ?? top) - z0;
    put({ name: `${name}.${wall.side}`, layer, at: [p.x + p.w / 2, p.y + p.d / 2, z0], svg: S(k.slabOf(p, z0, h, P, 2, 0.3), { tone: "mid", crease: "lo" }), shapes: [A.slab(p, z0, h, {}, 2)] });
  }
}
const pad = (name, plan, h, tone = "lo") => put({ name, layer, at: [plan.x + plan.w / 2, plan.y + plan.d / 2, 0], bias: -10, svg: S(k.slabOf({ ...plan, r: plan.r ?? 1.2 }, 0, h, P, 3, 0.4), { tone }), shapes: [A.slab({ ...plan, r: plan.r ?? 1.2 }, 0, h)] });
const inside = (plan, by = WALL) => ({ x: plan.x + by, y: plan.y + by, w: plan.w - 2 * by, d: plan.d - 2 * by });

// ---------- rods: a turned rod between two points, for legs, braces and stems ----------
function rod(name, a, b, r, { tone = "mid", owner } = {}) {
  const axis = G.sub3(b, a);
  const len = G.len3(axis);
  const F = G.frameAlong(a, axis);
  const profile = [[0, r], [len, r]];
  put({ name, layer, at: G.lerp3(a, b, 0.5), svg: S(G.solidOf(profile, F, P), { tone, crease: "none" }), shapes: [A.solid(F, profile, { name, owner })] });
}

// ---------- the canal and its intake: the web app's events, flowing in from the river ----------
function canal() {
  pad("canal.floor", CANAL, 1.2);
  basin("canal", CANAL, 1.2, CANAL_TOP, { skip: ["right"] });
  water("canal", { x: CANAL.x + WALL, y: CANAL.y + WALL, w: CANAL.w - WALL - 1.6, d: CANAL.d - 2 * WALL, r: 0.4 }, CANAL_Z, CANAL_TOP, { flow: [1, 0] });
  pad("intake.floor", INTAKE, 1.2);
  basin("intake", INTAKE, 1.2, INTAKE_TOP, { skip: ["left"] });
  water("intake", { x: INTAKE.x + 0.8, y: INTAKE.y + WALL, w: INTAKE.w - WALL - 0.8, d: INTAKE.d - 2 * WALL, r: 0.4 }, CANAL_Z, INTAKE_TOP, { flow: [0.3, 1] });
  // the trash screen across the canal mouth: bars standing on the floor, a beam across their tops
  const bars = [];
  const shapes = [];
  const y0 = CANAL.y + WALL + 1.6;
  const y1 = CANAL.y + CANAL.d - WALL - 1.6;
  for (let i = 0; i < 7; i++) {
    const y = y0 + (i * (y1 - y0)) / 6;
    const bar = { x: INTAKE.x - 0.3, y: y - 0.35, w: 0.6, d: 0.7, r: 0.1 };
    bars.push(S(k.slabOf(bar, 1.2, INTAKE_TOP + 1 - 1.2, P, 2), { tone: "hi", crease: "none" }));
    shapes.push(A.slab(bar, 1.2, INTAKE_TOP + 1 - 1.2));
  }
  const beam = { x: INTAKE.x - 1, y: CANAL.y, w: 2, d: CANAL.d, r: 0.3 };
  put({ name: "intake.screen", layer, at: [INTAKE.x, CANAL.y + CANAL.d / 2, CANAL_Z], bias: 2, svg: bars.join("") + S(k.slabOf(beam, INTAKE_TOP + 1, 1.4, P, 2, 0.2), { tone: "mid", crease: "lo" }), shapes: [...shapes, A.slab(beam, INTAKE_TOP + 1, 1.4)] });
}

// ---------- the pump house: the edge API ----------
function pumpHouse() {
  const { x, y, w, d } = HOUSE;
  const plan = { x, y, w, d, r: 0.6 };
  const front = y + d;
  const doorPath = poly([[x + 8, front, 0.4], [x + 17, front, 0.4], [x + 17, front, 15], [x + 8, front, 15]]);
  const win = (x0) => poly([[x0, front, 10], [x0 + 9, front, 10], [x0 + 9, front, 17], [x0, front, 17]]);
  const mull = (x0) => k.pathOf([at([x0 + 4.5, front, 10]), at([x0 + 4.5, front, 17])]) + k.pathOf([at([x0, front, 13.5]), at([x0 + 9, front, 13.5])]);
  // a framed vent on the gable wall; the slats run frame to frame
  const vent = poly([[x + w, y + 8, 5], [x + w, y + d - 8, 5], [x + w, y + d - 8, 16.5], [x + w, y + 8, 16.5]]);
  const louvres = vent + [7.5, 10.25, 13].map((z) => k.pathOf([at([x + w, y + 8, z]), at([x + w, y + d - 8, z])])).join("");
  const handle = D([at([x + 15.4, front, 7.6])], { size: 0.5, tone: "hi" });
  const body = S(k.slabOf(plan, 0, HOUSE_H, P, 2, 0.4), { tone: "mid", crease: "lo", inner: L(k.sideSeam(plan, 3, P, 2), { tone: "faint" }) + L(doorPath + win(x + 26) + win(x + 37), { tone: "lo" }) + L(mull(x + 26) + mull(x + 37), { tone: "faint" }) + L(louvres, { tone: "lo" }) }) + handle;
  put({ name: "house.body", layer, at: [x + w / 2, y + d / 2, 0], svg: body, shapes: [A.slab(plan, 0, HOUSE_H, {}, 2)] });
  // the roof: a ridge along x, eaves over the walls, gables at the ends
  const F = G.frameOf([x - 1.6, y + d / 2, HOUSE_H], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const ROOF = [[-d / 2 - 2, 0], [d / 2 + 2, 0], [d / 2 + 2, 0.8], [0, RIDGE - HOUSE_H], [-d / 2 - 2, 0.8]];
  const roofShape = A.prism(F, ROOF, 0, w + 3.2);
  put({ name: "house.roof", layer, at: [x + w / 2, y + d / 2, HOUSE_H], bias: 1, svg: S(G.prismOf(F, ROOF, 0, w + 3.2, P), { tone: "hi", crease: "lo" }), shapes: [roofShape] });
  // a vent cowl on the ridge
  const cowl = [x + w - 10, y + d / 2];
  put({ name: "house.cowl", layer, at: [cowl[0], cowl[1], RIDGE], bias: 2, svg: S(k.cylinder(cowl[0], cowl[1], 2.4, RIDGE - 1.2, 3.4, P, 20), { tone: "mid" }) + S(k.cylinder(cowl[0], cowl[1], 3.6, RIDGE + 2.2, 1.2, P, 24, 0.3), { tone: "hi", crease: "lo" }), shapes: [A.cylinder(cowl[0], cowl[1], 2.4, RIDGE - 1.2, 3.4, { seated: true, cut: [roofShape] }), A.cylinder(cowl[0], cowl[1], 3.6, RIDGE + 2.2, 1.2)] });
}

// ---------- the windpump over its well: the mobile app's events ----------
export const WHEEL = {};
function windpump() {
  const [cx, cy] = WELL;
  put({ name: "well.curb", layer, at: [cx, cy, 0], svg: S(k.cylinder(cx, cy, WELL_R, 0, 6, P, 40, 0.4), { tone: "lo", crease: "lo" }) + S(k.cylinder(cx, cy, 2.6, 6, 3, P, 24), { tone: "mid" }), shapes: [A.cylinder(cx, cy, WELL_R, 0, 6), A.cylinder(cx, cy, 2.6, 6, 3)] });
  put({ name: "well.valve", layer, at: [VALVE_BOX.x + VALVE_BOX.w / 2, VALVE_BOX.y + VALVE_BOX.d / 2, 0], svg: S(k.slabOf(VALVE_BOX, 0, 13, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(VALVE_BOX, 10, P, 3), { tone: "faint" }) }) + D(k.corners(VALVE_BOX, 1.8).map(([x, y]) => at([x, y, 13])), { size: 0.4 }), shapes: [A.slab(VALVE_BOX, 0, 13, {}, 3)] });
  // the tower: four legs leaning in from footings, braced in two rings, a platform on top
  const base = 10;
  const topHalf = 3.2;
  const legR = 0.9;
  const legAt = (sx, sy, z) => {
    const h = base + (topHalf - base) * (z / TOWER_TOP);
    return [cx + sx * h, cy + sy * h, z];
  };
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const foot = legAt(sx, sy, 0);
    put({ name: `tower.footing.${sx}.${sy}`, layer, at: foot, svg: S(k.cylinder(foot[0], foot[1], 2.2, 0, 1.4, P, 16), { tone: "lo" }), shapes: [A.cylinder(foot[0], foot[1], 2.2, 0, 1.4)] });
    rod(`tower.leg.${sx}.${sy}`, legAt(sx, sy, 1.4), legAt(sx, sy, TOWER_TOP), legR, { tone: "hi" });
  }
  for (const z of [16, 34]) {
    const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < 4; i++) {
      const a = legAt(ring[i][0], ring[i][1], z);
      const b = legAt(ring[(i + 1) % 4][0], ring[(i + 1) % 4][1], z);
      const dir = G.unit3(G.sub3(b, a));
      rod(`tower.brace.${z}.${i}`, G.add3(a, G.mul3(dir, legR - 0.25)), G.sub3(b, G.mul3(dir, legR - 0.25)), 0.45, { tone: "mid" });
    }
  }
  const PLAT = { x: cx - topHalf - 0.8, y: cy - topHalf - 0.8, w: 2 * topHalf + 1.6, d: 2 * topHalf + 1.6, r: 0.6 };
  put({ name: "tower.platform", layer, at: [cx, cy, TOWER_TOP], svg: S(k.slabOf(PLAT, TOWER_TOP, 1.2, P, 2, 0.3), { tone: "mid", crease: "lo" }), shapes: [A.slab(PLAT, TOWER_TOP, 1.2)] });
  // the pump rod down the middle to the well head
  rod("tower.pumprod", [cx, cy, 9], [cx, cy, TOWER_TOP], 0.45, { tone: "hi" });
  // the gearbox, a post up to the shaft, the wheel facing the wind (and the viewer)
  const GB = { x: cx - 3, y: cy - 2.5, w: 6, d: 5, r: 0.6 };
  const gbTop = TOWER_TOP + 1.2 + 4.4;
  put({ name: "wheel.gearbox", layer, at: [cx, cy, TOWER_TOP + 1.2], svg: S(k.slabOf(GB, TOWER_TOP + 1.2, 4.4, P, 2, 0.3), { tone: "mid", crease: "lo" }), shapes: [A.slab(GB, TOWER_TOP + 1.2, 4.4)] });
  const axis = G.unit3([V[0], V[1], 0]);
  const shaftZ = gbTop + 14;
  const post = { x: cx - 1, y: cy - 1, w: 2, d: 2, r: 0.4 };
  put({ name: "wheel.post", layer, at: [cx, cy, gbTop], svg: S(k.slabOf(post, gbTop, shaftZ + 1 - gbTop, P, 2), { tone: "mid", crease: "none" }), shapes: [A.slab(post, gbTop, shaftZ + 1 - gbTop)] });
  const shaftFrom = [cx + axis[0] * 1, cy + axis[1] * 1, shaftZ];
  const hubAt = [cx + axis[0] * 7, cy + axis[1] * 7, shaftZ];
  const FH = G.frameAlong(hubAt, axis);
  const RIM = 15;
  // the sails turn in the wheel's own plane: a matrix maps the plane's (a, b) onto the screen
  const u = G.unit3(G.cross3([0, 0, 1], axis));
  const c = at(hubAt);
  const pu = at(G.add3(hubAt, u));
  const pv = at(G.add3(hubAt, [0, 0, -1]));
  const M = `matrix(${(pu[0] - c[0]).toFixed(4)} ${(pu[1] - c[1]).toFixed(4)} ${(pv[0] - c[0]).toFixed(4)} ${(pv[1] - c[1]).toFixed(4)} ${c[0].toFixed(3)} ${c[1].toFixed(3)})`;
  const sail = (i) => {
    const a0 = (i / 16) * Math.PI * 2;
    const a1 = a0 + 0.26;
    const p = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
    const pts = [p(3.4, a0 + 0.02), p(RIM - 0.9, a0), p(RIM - 0.9, a1), p(3.4, a0 + 0.2)];
    return `M${pts.map((q) => q.map((v) => v.toFixed(3)).join(" ")).join("L")}Z`;
  };
  const sails = Array.from({ length: 16 }, (_, i) => sail(i)).join("");
  const spokes = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + 0.13;
    return `M${(3.6 * Math.cos(a)).toFixed(3)} ${(3.6 * Math.sin(a)).toFixed(3)}L${((RIM - 1.1) * Math.cos(a)).toFixed(3)} ${((RIM - 1.1) * Math.sin(a)).toFixed(3)}`;
  }).join("");
  const wheelSvg =
    S(G.disc(0, 6, 0.9, G.frameAlong(shaftFrom, axis), P), { tone: "mid" }) +
    S(G.ringBand(-0.4, 0.4, RIM - 1.1, RIM, FH, P), { tone: "hi", crease: "lo" }) +
    `<g transform="${M}"><g class="pa-sails" data-ref="sails"><path class="pa-sail" d="${sails}"/><path class="iso-line" data-tone="lo" d="${spokes}"/></g></g>` +
    S(G.disc(0.1, 1.9, 2.6, FH, P), { tone: "mid", crease: "lo" }) +
    S(G.disc(1.9, 2.7, 1.4, FH, P), { tone: "hi" });
  put({ name: "wheel", layer, at: hubAt, bias: 3, svg: wheelSvg, shapes: [A.disc(G.frameAlong(shaftFrom, axis), 0, 6, 0.9), A.ring(FH, -0.4, 0.4, RIM - 1.1, RIM), A.disc(FH, -0.1, 0.1, RIM - 1.1, { name: "wheel.sails" }), A.disc(FH, 0.1, 2.7, 2.6, { name: "wheel.hub" })] });
  WHEEL.matrix = M;
}

// ---------- the distribution chamber, the consent sluice and the settling channel ----------
export const LANE_LIST = [];
function settling() {
  pad("dist.floor", DIST, 1.2);
  basin("dist", DIST, 1.2, DIST_TOP, { skip: ["right"] });
  water("dist", { x: DIST.x + WALL, y: DIST.y + WALL, w: DIST.w - WALL, d: DIST.d - 2 * WALL, r: 0.4 }, DIST_Z, DIST_TOP, { flow: [1, 0] });
  // the consent sluice: a penstock on the chamber's left wall, its gate raised as far as the
  // governed edge's share; guides, a lifting beam, the stem and its hand wheel
  const gx = DIST.x + WALL / 2;
  const gy = DIST.y + DIST.d / 2;
  const share = edge("edge", "gate").w;
  const guide = (y) => ({ x: gx - 0.9, y: y - 0.9, w: 1.8, d: 1.8, r: 0.3 });
  const plate = { x: gx - 0.35, y: gy - 6, w: 0.7, d: 12, r: 0.1 };
  const lift = 12 * share;
  const beam = { x: gx - 1.1, y: gy - 9, w: 2.2, d: 18, r: 0.4 };
  const beamTop = DIST_TOP + 16 + 1.4;
  const stemTop = beamTop + 4;
  const FW = G.frameAlong([gx, gy, stemTop], [0, 0, 1]);
  const svg =
    S(k.slabOf(guide(gy - 8), DIST_TOP, 16, P, 2), { tone: "mid", crease: "none" }) +
    S(k.slabOf(plate, DIST_TOP, lift, P, 2, 0.2), { tone: "hi", crease: "lo" }) +
    S(k.slabOf(guide(gy + 8), DIST_TOP, 16, P, 2), { tone: "mid", crease: "none" }) +
    S(k.cylinder(gx, gy, 0.5, DIST_TOP + lift, DIST_TOP + 16 - DIST_TOP - lift, P, 12), { tone: "hi", crease: "none" }) +
    S(k.slabOf(beam, DIST_TOP + 16, 1.4, P, 2, 0.3), { tone: "mid", crease: "lo" }) +
    S(k.cylinder(gx, gy, 0.5, beamTop, stemTop - beamTop - 0.5, P, 12), { tone: "hi", crease: "none" }) +
    S(k.cylinder(gx, gy, 0.8, stemTop - 0.5, 1.2, P, 12), { tone: "mid" }) +
    S(G.ringBand(-0.5, 0.5, 3.2, 4, FW, P), { tone: "hi", crease: "lo" }) +
    L([0, 1, 2].map((j) => k.lineOnTop([gx + 0.8 * Math.cos((j * 2 * Math.PI) / 3), gy + 0.8 * Math.sin((j * 2 * Math.PI) / 3)], [gx + 3.2 * Math.cos((j * 2 * Math.PI) / 3), gy + 3.2 * Math.sin((j * 2 * Math.PI) / 3)], stemTop + 0.5, P)).join(""), { tone: "mid" });
  put({ name: "sluice", layer, at: [gx, gy, DIST_TOP], bias: 1, svg, shapes: [A.slab(guide(gy - 8), DIST_TOP, 16), A.slab(plate, DIST_TOP, lift), A.slab(guide(gy + 8), DIST_TOP, 16), A.cylinder(gx, gy, 0.5, DIST_TOP + lift, 16 - lift), A.slab(beam, DIST_TOP + 16, 1.4), A.cylinder(gx, gy, 0.5, beamTop, stemTop - beamTop - 0.5), A.cylinder(gx, gy, 0.8, stemTop - 0.5, 1.2), A.disc(FW, -0.5, 0.5, 4)] });
  // the channel: an inlet weir from the chamber, 24 lanes, a spill weir into the outlet chamber
  pad("chan.floor", CHAN, 1.2);
  const weir = { x: CHAN.x, y: CHAN.y + WALL, w: WALL, d: CHAN.d - 2 * WALL, r: 0.2 };
  put({ name: "chan.weir", layer, at: [weir.x + weir.w / 2, weir.y + weir.d / 2, 1.2], svg: S(k.slabOf(weir, 1.2, CHAN_Z - 0.6 - 1.2, P, 2), { tone: "mid", crease: "lo" }), shapes: [A.slab(weir, 1.2, CHAN_Z - 0.6 - 1.2)] });
  basin("chan", CHAN, 1.2, CHAN_TOP, { skip: ["left", "right"] });
  const inner = { x: CHAN.x + WALL, y: CHAN.y + WALL, w: CHAN.w - WALL, d: CHAN.d - 2 * WALL };
  WATER.push({ id: "lanes", kind: 2, x0: inner.x, y0: inner.y, x1: inner.x + inner.w, y1: inner.y + inner.d, r: 0, z: CHAN_Z, top: WEIR_TOP, divTop: DIV_TOP, lanes: LANES, frontTop: CHAN_TOP, flow: [1, 0] });
  put({ name: "water.lanes", layer, at: [inner.x + inner.w / 2, inner.y + inner.d / 2, CHAN_Z], bias: 0.02, svg: waterFill(k.roundedPlan({ ...inner, r: 0 }, 1), CHAN_Z, "lanes"), shapes: [A.slab({ ...inner, r: 0 }, CHAN_Z - 0.2, 0.2, { name: "water.lanes" })] });
  const lane = inner.d / LANES;
  for (let i = 1; i < LANES; i++) {
    const y = inner.y + i * lane;
    const p = { x: inner.x + 2, y: y - 0.18, w: inner.w - 4, d: 0.36, r: 0.1 };
    put({ name: `chan.div.${i}.under`, layer, at: [p.x + p.w / 2, y, 1.2], bias: -0.2, svg: S(k.slabOf(p, 1.2, CHAN_Z - 1.2, P, 2), { tone: "lo", crease: "none" }), shapes: [A.slab(p, 1.2, CHAN_Z - 1.2)] });
    put({ name: `chan.div.${i}`, layer, at: [p.x + p.w / 2, y, CHAN_Z], svg: S(k.slabOf(p, CHAN_Z, DIV_TOP - CHAN_Z, P, 2), { tone: "hi", crease: "none" }), shapes: [A.slab(p, CHAN_Z, DIV_TOP - CHAN_Z)] });
  }
  for (let i = 0; i < LANES; i++) LANE_LIST.push({ y: inner.y + (i + 0.5) * lane, x0: inner.x + 2, x1: inner.x + inner.w - 2, z: CHAN_Z });
  // the outlet chamber: its left wall is the spill weir the lanes fall over
  pad("outlet.floor", OUTLET, 1.2);
  basin("outlet", OUTLET, 1.2, CHAN_TOP, { tops: { left: WEIR_TOP } });
  water("outlet", { x: OUTLET.x + WALL, y: OUTLET.y + WALL, w: OUTLET.w - 2 * WALL, d: OUTLET.d - 2 * WALL, r: 0.4 }, OUTLET_Z, CHAN_TOP, { flow: [0.3, 1] });
  // the falling sheet over the weir crest
  const fx = OUTLET.x + WALL + 0.15;
  const fall = [[fx, inner.y + 0.4, WEIR_TOP], [fx, inner.y + inner.d - 0.4, WEIR_TOP], [fx, inner.y + inner.d - 0.4, OUTLET_Z], [fx, inner.y + 0.4, OUTLET_Z]];
  WATER.push({ id: "fall", kind: 3, x0: fx, y0: inner.y + 0.4, x1: fx, y1: inner.y + inner.d - 0.4, z0: OUTLET_Z, z1: WEIR_TOP, r: 0, z: OUTLET_Z, top: CHAN_TOP, frontY: OUTLET.y + OUTLET.d - WALL, flow: [0, -1] });
  put({ name: "water.fall", layer, at: [fx, OUTLET.y + OUTLET.d / 2, OUTLET_Z], bias: 0.5, svg: `<path class="pa-fall" d="${poly(fall)}"/>`, shapes: [A.box([fx - 0.15, inner.y + 0.4, OUTLET_Z], [fx + 0.15, inner.y + inner.d - 0.4, WEIR_TOP], { name: "water.fall" })] });
  // the reject sump: poison water piles up here, it has no outlet
  pad("sump.floor", SUMP, 0.8);
  basin("sump", SUMP, 0.8, SUMP_TOP);
  water("sump", { x: SUMP.x + WALL, y: SUMP.y + WALL, w: SUMP.w - 2 * WALL, d: SUMP.d - 2 * WALL, r: 0.4 }, 2.4, SUMP_TOP, { flow: [0, 0], ref: "sump", level: "sump" });
}

// ---------- the compound: the governed zone, a wall with a fence on it, and its sealed tank ----------
function compound() {
  const { x, y, w, d } = COMPOUND;
  const T = 2;
  const walls = [
    { side: "back", plan: { x, y, w, d: T, r: 0.3 } },
    { side: "left", plan: { x, y: y + T, w: T, d: d - 2 * T, r: 0.3 } },
    { side: "right", plan: { x: x + w - T, y: y + T, w: T, d: d - 2 * T, r: 0.3 } },
    { side: "front", plan: { x, y: y + d - T, w, d: T, r: 0.3 } },
  ];
  for (const wall of walls) {
    const p = wall.plan;
    put({ name: `compound.wall.${wall.side}`, layer, at: [p.x + p.w / 2, p.y + p.d / 2, 0], svg: S(k.slabOf(p, 0, COMPOUND_H, P, 2, 0.4), { tone: "mid", crease: "lo", inner: L(k.sideSeam(p, COMPOUND_H - 2.4, P, 2), { tone: "faint" }) }), shapes: [A.slab(p, 0, COMPOUND_H, {}, 2)] });
  }
  // the fence on the wall: posts, a top rail between them, wire mesh
  const H = FENCE_TOP - COMPOUND_H;
  const along = (x0, y0, x1, y1, n) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  const posts = [
    ...along(x + 1, y + 1, x + w - 1, y + 1, 4),
    ...along(x + w - 1, y + 1, x + w - 1, y + d - 1, 4).slice(1),
    ...along(x + w - 1, y + d - 1, x + 1, y + d - 1, 4).slice(1),
    ...along(x + 1, y + d - 1, x + 1, y + 1, 4).slice(1, -1),
  ];
  const POST = 0.7;
  for (let i = 0; i < posts.length; i++) {
    const a = posts[i];
    const b = posts[(i + 1) % posts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    const p0 = [a[0] + ux * POST, a[1] + uy * POST];
    const p1 = [b[0] - ux * POST, b[1] - uy * POST];
    const lines = [];
    const n = Math.max(2, Math.round((len - 2 * POST) / 3.2));
    for (let j = 1; j < n; j++) {
      const s = j / n;
      const px = p0[0] + (p1[0] - p0[0]) * s;
      const py = p0[1] + (p1[1] - p0[1]) * s;
      lines.push(k.pathOf([at([px, py, COMPOUND_H]), at([px, py, FENCE_TOP - 1.2])]));
    }
    for (let z = COMPOUND_H + 3.2; z < FENCE_TOP - 1.6; z += 3.2) lines.push(k.pathOf([at([p0[0], p0[1], z]), at([p1[0], p1[1], z])]));
    const horizontal = Math.abs(ux) > 0.5;
    const railPlan = horizontal ? { x: Math.min(p0[0], p1[0]), y: p0[1] - 0.45, w: Math.abs(p1[0] - p0[0]), d: 0.9, r: 0.2 } : { x: p0[0] - 0.45, y: Math.min(p0[1], p1[1]), w: 0.9, d: Math.abs(p1[1] - p0[1]), r: 0.2 };
    const meshBox = horizontal ? A.box([Math.min(p0[0], p1[0]), p0[1] - 0.1, COMPOUND_H], [Math.max(p0[0], p1[0]), p0[1] + 0.1, FENCE_TOP - 1.2]) : A.box([p0[0] - 0.1, Math.min(p0[1], p1[1]), COMPOUND_H], [p0[0] + 0.1, Math.max(p0[1], p1[1]), FENCE_TOP - 1.2]);
    put({ name: `compound.fence.${i}`, layer, at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, COMPOUND_H + H / 2], svg: L(lines.join(""), { tone: "faint" }) + S(k.slabOf(railPlan, FENCE_TOP - 1.2, 1.2, P, 2), { tone: "mid", crease: "lo" }), shapes: [meshBox, A.slab(railPlan, FENCE_TOP - 1.2, 1.2)] });
  }
  for (const [px, py] of byDepth(posts)) put({ name: `compound.post.${px.toFixed(1)}.${py.toFixed(1)}`, layer, at: [px, py, COMPOUND_H], svg: S(k.cylinder(px, py, POST, COMPOUND_H, H + 0.6, P, 14), { tone: "hi", crease: "none" }) + S(k.cylinder(px, py, POST + 0.4, FENCE_TOP + 0.6, 0.6, P, 14), { tone: "mid" }), shapes: [A.cylinder(px, py, POST, COMPOUND_H, H + 0.6), A.cylinder(px, py, POST + 0.4, FENCE_TOP + 0.6, 0.6)] });
  // the sealed tank: riveted plate, seam bands, a bolted manway on top
  const t = TANK;
  const rivets = [];
  for (const z of [4, TANK_H - 4]) {
    for (let i = 0; i <= 8; i++) rivets.push(at([t.x + 3 + ((t.w - 6) * i) / 8, t.y + t.d, z]));
    for (let i = 0; i <= 8; i++) rivets.push(at([t.x + t.w, t.y + 3 + ((t.d - 6) * i) / 8, z]));
  }
  const seams = [8, 16].map((z) => k.sideSeam(t, z, P, 3)).join("");
  const MAN = [t.x + t.w / 2, t.y + t.d / 2];
  const FM = VERT(MAN[0], MAN[1]);
  const tank =
    S(k.slabOf(t, 0, TANK_H, P, 3, 0.8), { tone: "hi", crease: "lo", inner: L(seams, { tone: "faint" }) }) + D(rivets, { size: 0.38, tone: "mid" }) +
    S(k.cylinder(MAN[0], MAN[1], 7, TANK_H, 1.6, P, 40, 0.3), { tone: "mid", crease: "lo" }) +
    S(k.cylinder(MAN[0], MAN[1], 5.2, TANK_H + 1.6, 1.2, P, 32), { tone: "hi", crease: "lo" }) +
    D(G.dotsOf(FM, TANK_H + 1.6, 6.1, 12, P, { all: true }), { size: 0.4 });
  put({ name: "tank", layer, at: [t.x + t.w / 2, t.y + t.d / 2, 0], svg: tank, shapes: [A.slab(t, 0, TANK_H, {}, 3), A.cylinder(MAN[0], MAN[1], 7, TANK_H, 1.6), A.cylinder(MAN[0], MAN[1], 5.2, TANK_H + 1.6, 1.2)] });
}

// ---------- the reservoir (the warehouse), its inlet and draw-off chambers ----------
function ringHalf(name, c, rIn, rOut, z0, top, from, to) {
  const ringPts = [];
  const n = 64;
  for (let j = 0; j <= n; j++) ringPts.push([c[0] + rOut * Math.cos(from + ((to - from) * j) / n), c[1] + rOut * Math.sin(from + ((to - from) * j) / n)]);
  for (let j = n; j >= 0; j--) ringPts.push([c[0] + rIn * Math.cos(from + ((to - from) * j) / n), c[1] + rIn * Math.sin(from + ((to - from) * j) / n)]);
  const mid = (from + to) / 2;
  put({ name, layer, at: [c[0] + ((rIn + rOut) / 2) * Math.cos(mid), c[1] + ((rIn + rOut) / 2) * Math.sin(mid), z0], svg: S(k.extrude(ringPts, z0, top - z0, P, { convex: false, bevel: 0.3 }), { tone: "mid", crease: "lo" }), shapes: [A.extruded(ringPts, z0, top - z0)] });
}
function reservoir() {
  put({ name: "res.floor", layer, at: [RES[0], RES[1], 0], bias: -10, svg: S(k.cylinder(RES[0], RES[1], RES_R, 0, 1.2, P, 96, 0.4), { tone: "lo" }), shapes: [A.cylinder(RES[0], RES[1], RES_R, 0, 1.2)] });
  const a = Math.atan2(V[1], V[0]);
  ringHalf("res.wall.back", RES, RES_R - WALL, RES_R, 1.2, RES_TOP, a + Math.PI / 2, a + (3 * Math.PI) / 2);
  ringHalf("res.wall.front", RES, RES_R - WALL, RES_R, 1.2, RES_TOP, a - Math.PI / 2, a + Math.PI / 2);
  const rIn = RES_R - WALL;
  WATER.push({ id: "res", kind: 1, x0: RES[0], y0: RES[1], x1: rIn, y1: 0, r: rIn, z: RES_Z, top: RES_TOP, flow: [0.55, 0.84] });
  put({ name: "water.res", layer, at: [RES[0], RES[1], RES_Z], bias: 0.02, svg: waterFill(k.circleRing(RES[0], RES[1], rIn, 96), RES_Z, "res"), shapes: [A.cylinder(RES[0], RES[1], rIn, RES_Z - 0.2, 0.2, { name: "water.res" })] });
  for (const [name, ch] of [["res.in", RES_IN], ["res.out", RES_OUT]]) {
    put({ name, layer, at: [ch.x + ch.w / 2, ch.y + ch.d / 2, 0], svg: S(k.slabOf(ch, 0, RES_TOP + 1, P, 3, 0.4), { tone: "mid", crease: "lo", inner: L(k.sideSeam(ch, 4, P, 3), { tone: "faint" }) }) + S(k.slabOf(k.insetPlan(ch, 1.6), RES_TOP + 1, 0.8, P, 3), { tone: "hi", crease: "lo" }) + D(k.corners(ch, 1.2).map(([x, y]) => at([x, y, RES_TOP + 1])), { size: 0.38 }), shapes: [A.slab(ch, 0, RES_TOP + 1, {}, 3), A.slab(k.insetPlan(ch, 1.6), RES_TOP + 1, 0.8)] });
  }
}

// ---------- the header tank on its stand: the feature store, a sectional panel tank ----------
function headerTank() {
  const [cx, cy] = TOWER;
  const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [cx + a * TOWER_LEG, cy + b * TOWER_LEG]);
  for (const [x, y] of byDepth(legs)) {
    put({ name: `tower2.foot.${x}.${y}`, layer, at: [x, y, 0], svg: S(k.cylinder(x, y, 2.2, 0, 1.2, P, 16), { tone: "lo" }), shapes: [A.cylinder(x, y, 2.2, 0, 1.2)] });
    put({ name: `tower2.leg.${x}.${y}`, layer, at: [x, y, 1.2], svg: S(k.cylinder(x, y, 1.2, 1.2, TANK2_Z[0] - 1.2 - 1.6, P, 16), { tone: "hi", crease: "none" }), shapes: [A.cylinder(x, y, 1.2, 1.2, TANK2_Z[0] - 1.2 - 1.6)] });
  }
  for (const z of [16, 28]) {
    const order = [0, 1, 3, 2];
    for (let i = 0; i < 4; i++) {
      const a = legs[order[i]];
      const b = legs[order[(i + 1) % 4]];
      const dir = G.unit3([b[0] - a[0], b[1] - a[1], 0]);
      rod(`tower2.brace.${z}.${i}`, G.add3([a[0], a[1], z], G.mul3(dir, 0.95)), G.sub3([b[0], b[1], z], G.mul3(dir, 0.95)), 0.5, { tone: "mid" });
    }
  }
  // the bearer frame across the leg tops, the tank standing on it
  const BEARER = { x: cx - TOWER_LEG - 2, y: cy - TOWER_LEG - 2, w: 2 * TOWER_LEG + 4, d: 2 * TOWER_LEG + 4, r: 0.6 };
  put({ name: "tower2.bearer", layer, at: [cx, cy, TANK2_Z[0] - 1.6], svg: S(k.slabOf(BEARER, TANK2_Z[0] - 1.6, 1.6, P, 2, 0.3), { tone: "mid", crease: "lo" }), shapes: [A.slab(BEARER, TANK2_Z[0] - 1.6, 1.6)] });
  // the tank: bolted panels, a seam every panel width, edge to edge on each face; a hatch on the roof
  const T2 = HEADER;
  const z0 = TANK2_Z[0];
  const z1 = TANK2_Z[1];
  const panels = 4;
  const vertical = [];
  for (let i = 1; i < panels; i++) {
    const fx = T2.x + (T2.w * i) / panels;
    vertical.push(k.pathOf([at([fx, T2.y + T2.d, z0]), at([fx, T2.y + T2.d, z1])]));
    const fy = T2.y + (T2.d * i) / panels;
    vertical.push(k.pathOf([at([T2.x + T2.w, fy, z0]), at([T2.x + T2.w, fy, z1])]));
  }
  const seam = k.sideSeam(T2, (z0 + z1) / 2, P, 2);
  const bolts = [];
  for (let i = 0; i <= panels * 2; i++) {
    bolts.push(at([T2.x + (T2.w * i) / (panels * 2), T2.y + T2.d, z1 - 0.9]));
    bolts.push(at([T2.x + T2.w, T2.y + (T2.d * i) / (panels * 2), z1 - 0.9]));
  }
  const HATCH = { x: cx - 4, y: cy - 4, w: 8, d: 8, r: 0.6 };
  const tank =
    S(k.slabOf(T2, z0, z1 - z0, P, 2, 0.6), { tone: "hi", crease: "lo", inner: L(vertical.join("") + seam, { tone: "faint" }) }) + D(bolts, { size: 0.36, tone: "mid" }) +
    S(k.slabOf(HATCH, z1, 1.2, P, 2, 0.3), { tone: "mid", crease: "lo" }) + D(k.corners(HATCH, 1).map(([x, y]) => at([x, y, z1 + 1.2])), { size: 0.36 }) +
    S(k.cylinder(cx + 8, cy - 8, 1.4, z1, 3.4, P, 14), { tone: "mid" }) + S(k.cylinder(cx + 8, cy - 8, 2.4, z1 + 3.4, 1, P, 18, 0.2), { tone: "hi", crease: "lo" });
  put({ name: "tower2.tank", layer, at: [cx, cy, z0], svg: tank, shapes: [A.slab(T2, z0, z1 - z0, {}, 2), A.slab(HATCH, z1, 1.2), A.cylinder(cx + 8, cy - 8, 1.4, z1, 3.4), A.cylinder(cx + 8, cy - 8, 2.4, z1 + 3.4, 1)] });
}

// ---------- the slow sand filter: the ML model, one cell per instance ----------
export const CELL_LIST = [];
function filterBed() {
  const F = FILTER;
  pad("filter.floor", { x: F.x, y: INLET.y, w: F.w, d: F.y + F.d - INLET.y }, 1.2);
  basin("inlet", INLET, 1.2, INLET_TOP);
  const inl = inside(INLET);
  WATER.push({ id: "inlet", kind: 0, x0: inl.x, y0: inl.y, x1: inl.x + inl.w, y1: inl.y + inl.d, r: 0.3, z: 4, top: INLET_TOP, flow: [-1, 0], level: "inlet" });
  put({ name: "water.inlet", layer, at: [inl.x + inl.w / 2, inl.y + inl.d / 2, 4], bias: 0.02, svg: waterFill(k.roundedPlan({ ...inl, r: 0.3 }, 3), 4, "inlet", ` data-ref="inlet"`), shapes: [A.slab({ ...inl, r: 0.3 }, 3.8, 0.2, { name: "water.inlet" })] });
  basin("filter", F, 1.2, FILTER_TOP);
  const cw = (F.w - 2 * WALL) / CELLS;
  for (let i = 0; i < CELLS; i++) {
    const x0 = F.x + WALL + i * cw;
    if (i) {
      const div = { x: x0 - 0.5, y: F.y + WALL, w: 1, d: F.d - 2 * WALL, r: 0.2 };
      put({ name: `filter.div.${i}`, layer, at: [x0, F.y + F.d / 2, 1.2], bias: 0.5, svg: S(k.slabOf(div, 1.2, FILTER_TOP - 1.2, P, 2), { tone: "mid", crease: "lo" }), shapes: [A.slab(div, 1.2, FILTER_TOP - 1.2)] });
    }
    const cell = { x: x0 + (i ? 0.5 : 0), y: F.y + WALL, w: cw - (i ? 0.5 : 0) - (i < CELLS - 1 ? 0.5 : 0), d: F.d - 2 * WALL, r: 0.2 };
    CELL_LIST.push({ i, x0: cell.x, x1: cell.x + cell.w, y0: cell.y, y1: cell.y + cell.d });
    // the sand bed, ruled with its raking lines; water over it when the cell is in service
    const rakes = [];
    for (let j = 1; j < 6; j++) rakes.push(k.pathOf([at([cell.x, cell.y + (cell.d * j) / 6, 5]), at([cell.x + cell.w, cell.y + (cell.d * j) / 6, 5])]));
    put({ name: `filter.sand.${i}`, layer, at: [cell.x + cell.w / 2, cell.y + cell.d / 2, 1.2], bias: 0.1, svg: `<g class="pa-sand">${S(k.slabOf(cell, 1.2, 3.8, P, 2), { tone: "lo", crease: "none" })}</g>` + L(rakes.join(""), { tone: "faint" }), shapes: [A.slab(cell, 1.2, 3.8)] });
    put({ name: `water.cell.${i}`, layer, at: [cell.x + cell.w / 2, cell.y + cell.d / 2, 7.4], bias: 0.2, svg: `<g data-cell="${i}">${waterFill(k.roundedPlan(cell, 2), 7.4, `cell${i}`)}</g>`, shapes: [A.slab(cell, 7.2, 0.2, { name: `water.cell.${i}` })] });
    WATER.push({ id: `cell${i}`, kind: 0, x0: cell.x, y0: cell.y, x1: cell.x + cell.w, y1: cell.y + cell.d, r: 0.2, z: 7.4, top: FILTER_TOP, flow: [0, 1], cell: i });
    // the cell's gate in the inlet channel's front wall: raised when the cell is in service
    const gx = cell.x + cell.w / 2;
    const wy = INLET.y + INLET.d - WALL;
    const frame = (sx) => ({ x: sx - 0.5, y: wy, w: 1, d: WALL, r: 0.15 });
    const head = { x: gx - 4, y: wy, w: 8, d: WALL, r: 0.2 };
    const gate = { x: gx - 2.8, y: wy + 0.6, w: 5.6, d: 0.6, r: 0.1 };
    put({ name: `filter.gate.${i}`, layer, at: [gx, wy + WALL / 2, INLET_TOP], bias: 1, svg: S(k.slabOf(frame(gx - 3.4), INLET_TOP, 5, P, 2), { tone: "mid", crease: "none" }) + S(k.slabOf(frame(gx + 3.4), INLET_TOP, 5, P, 2), { tone: "mid", crease: "none" }) + S(k.slabOf(head, INLET_TOP + 5, 1, P, 2), { tone: "hi", crease: "lo" }) + `<g data-gate="${i}">${S(k.slabOf(gate, INLET_TOP, 3.6, P, 2), { tone: "hi", crease: "lo" })}</g>`, shapes: [A.slab(frame(gx - 3.4), INLET_TOP, 5), A.slab(frame(gx + 3.4), INLET_TOP, 5), A.slab(head, INLET_TOP + 5, 1), A.slab(gate, INLET_TOP, 3.6)] });
  }
  // the stilling box at the inlet's head: the feed from the header tank lands here
  put({ name: "inlet.box", layer, at: [STILL.x + STILL.w / 2, STILL.y + STILL.d / 2, 0], svg: S(k.slabOf(STILL, 0, INLET_TOP + 2, P, 3, 0.4), { tone: "mid", crease: "lo", inner: L(k.sideSeam(STILL, 4, P, 3), { tone: "faint" }) }) + S(k.slabOf(k.insetPlan(STILL, 1.4), INLET_TOP + 2, 0.8, P, 3), { tone: "hi", crease: "lo" }), shapes: [A.slab(STILL, 0, INLET_TOP + 2, {}, 3), A.slab(k.insetPlan(STILL, 1.4), INLET_TOP + 2, 0.8)] });
  // the alarm lamp on a post at the inlet's far end: lit while the model is falling behind
  const post = [INLET.x - 6, INLET.y + 6];
  const FL = VERT(post[0], post[1]);
  const lampTop = 22;
  const DOME = [[lampTop + 1.2, 1.6], [lampTop + 2.4, 1.6, 1], [lampTop + 3.2, 1.1, 1], [lampTop + 3.6, 0]];
  const c = at([post[0], post[1], lampTop + 2.4]);
  put({ name: "filter.lamp", layer, at: [post[0], post[1], 0], svg: S(k.cylinder(post[0], post[1], 2.2, 0, 1.2, P, 16), { tone: "lo" }) + S(k.cylinder(post[0], post[1], 0.8, 1.2, lampTop - 1.2, P, 12), { tone: "mid", crease: "none" }) + S(k.cylinder(post[0], post[1], 2.2, lampTop, 1.2, P, 20, 0.3), { tone: "mid", crease: "lo" }) + S(G.solidOf(DOME, FL, P), { tone: "hi" }) + `<circle class="bx-lamp" data-lamp="0" data-node="ml" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="${(1.4 * G.scaleOf(P)).toFixed(2)}"/>`, shapes: [A.cylinder(post[0], post[1], 2.2, 0, 1.2), A.cylinder(post[0], post[1], 0.8, 1.2, lampTop - 1.2), A.cylinder(post[0], post[1], 2.2, lampTop, 1.2), A.solid(FL, DOME)] });
}

// ---------- the trough fountain: the dashboards ----------
export const FOUNT = {};
function fountain() {
  pad("trough.floor", TROUGH, 1.2);
  basin("trough", TROUGH, 1.2, TROUGH_TOP);
  water("trough", { ...inside(TROUGH), r: 0.4 }, TROUGH_Z, TROUGH_TOP, { flow: [0.2, 1] });
  // the standpipe behind the trough, its spout over the back wall, a gauge on its cap
  const [sx, sy] = SPOUT;
  const top = 26;
  put({ name: "fountain.column", layer, at: [sx, sy, 0], svg: S(k.cylinder(sx, sy, 4.6, 0, 1.6, P, 32, 0.3), { tone: "lo" }) + S(k.cylinder(sx, sy, 3.4, 1.6, top - 1.6, P, 32), { tone: "mid", crease: "lo", inner: L(k.sideArc(sx, sy, 3.4, 6, P, 24), { tone: "faint" }) }) + S(k.cylinder(sx, sy, 4.4, top, 1.4, P, 36, 0.3), { tone: "hi", crease: "lo" }), shapes: [A.cylinder(sx, sy, 4.6, 0, 1.6), A.cylinder(sx, sy, 3.4, 1.6, top - 1.6), A.cylinder(sx, sy, 4.4, top, 1.4)] });
  // the gauge on the cap reads the dashboards' utilization
  const gz = top + 1.4;
  const t = k.radialTicks(sx, sy, 3.9, 14, 7, gz, [0.7, 1.3], P, -0.75 * Math.PI, 1.5 * Math.PI);
  const needle = `<path class="iso-line" data-tone="hi" data-free="end" data-gauge="dash" d="${k.lineOnTop([sx, sy - 0.6], [sx, sy - 3.2], gz, P)}"/>`;
  put({ name: "fountain.gauge", layer, at: [sx, sy, gz], bias: 0.2, svg: L(k.ring(sx, sy, 3.9, gz, P, 40), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(k.ring(sx, sy, 0.6, gz, P, 12), { tone: "mid" }) + needle, shapes: [A.cylinder(sx, sy, 4.4, gz - 0.05, 0.05, { name: "fountain.gauge" })] });
  // the spout: an arm from the column out over the trough, its nozzle pointing down
  const armY = TROUGH.y + 10;
  rod("fountain.arm", [sx, sy + 3.4, 20], [sx, armY, 20], 1.1, { tone: "mid" });
  const FN = G.frameAlong([sx, armY, 20 - 1.1], [0, 0, -1]);
  const NOZ = [[0, 1.5], [2, 1.5], [2.8, 0.9]];
  put({ name: "fountain.nozzle", layer, at: [sx, armY, 18], bias: 0.4, svg: S(G.solidOf(NOZ, FN, P), { tone: "hi", crease: "lo" }), shapes: [A.solid(FN, NOZ, { name: "fountain.nozzle" })] });
  // the falling jet from the nozzle into the trough
  const jet = { c: [sx, armY], r: 0.7, z0: TROUGH_Z, z1: 20 - 1.1 - 2.8 };
  WATER.push({ id: "jet", kind: 4, x0: jet.c[0], y0: jet.c[1], x1: jet.r, y1: 0, r: jet.r, z: jet.z0, top: jet.z1, flow: [0, -1] });
  put({ name: "water.jet", layer, at: [jet.c[0], jet.c[1], jet.z0], bias: 0.6, svg: `<g class="pa-jet">${S(k.cylinder(jet.c[0], jet.c[1], jet.r, jet.z0, jet.z1 - jet.z0, P, 16), { tone: "lo", crease: "none" })}</g>`, shapes: [A.cylinder(jet.c[0], jet.c[1], jet.r, jet.z0, jet.z1 - jet.z0, { name: "water.jet" })] });
  FOUNT.jet = jet;
  FOUNT.gauge = { id: "dash", c: [sx, sy], z: gz, r: 3.2, r0: 0.6, from: -0.75 * Math.PI, span: 1.5 * Math.PI, max: 1 };
  W.GAUGES.push(FOUNT.gauge);
}

// ---------- pipes: a flange on every port, glands where they pass the compound wall ----------
const GLAND_T = 1.2;
function pipe(name, waypoints, n0, n1, { through = [], valve = null } = {}) {
  const points = G.fillet(waypoints, 9, 12, { P, tube: PIPE_R });
  const total = G.pathLength(points);
  const gaps = [...(n0 ? [[0, BOSS_T]] : []), ...(n1 ? [[total - BOSS_T, total]] : [])];
  const crossing = (axis, value) => {
    let walked = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const len = G.len3(G.sub3(b, a));
      if ((a[axis] - value) * (b[axis] - value) <= 0 && Math.abs(b[axis] - a[axis]) > 1e-9) return walked + (len * (value - a[axis])) / (b[axis] - a[axis]);
      walked += len;
    }
    return null;
  };
  for (const wall of through) {
    const s = crossing(wall.axis, wall.at);
    if (s === null) throw new Error(`${name} doesn't cross its wall`);
    const half = wall.t / 2;
    gaps.push([s - half - GLAND_T, s + half + GLAND_T]);
    const o = G.pointAlong(points, s);
    const n = G.tangentAlong(points, s);
    const F = G.frameAlong(o, n);
    for (const [side, s0] of [["in", -half - GLAND_T], ["out", half]]) {
      const facing = G.dot3(F.a, V) > 0.12 && side === "out";
      const face = facing ? L(G.circleOf(F, s0 + GLAND_T, 2.9, P), { tone: "faint" }) + D([0, 1, 2, 3].map((j) => at(G.pointOf(F, s0 + GLAND_T, 3.3, (j * Math.PI) / 2 + Math.PI / 4))), { size: 0.38 }) : "";
      put({ name: `${name}.gland.${side}`, layer, at: G.add3(o, G.mul3(n, s0 + GLAND_T / 2)), svg: S(G.disc(s0, s0 + GLAND_T, 3.9, F, P), { tone: "hi", crease: "lo" }) + face, shapes: [A.disc(F, s0, s0 + GLAND_T, 3.9, { name: `${name}.gland.${side}`, owner: name })] });
    }
  }
  if (valve !== null) {
    // a valve on a straight: a bulged body with a padlocked wheel on its bonnet
    const s = valve;
    const o = G.pointAlong(points, s);
    const n = G.tangentAlong(points, s);
    const F = G.frameAlong(o, n);
    gaps.push([s - 4, s + 4]);
    const BODY = [[-4, 3.2], [-3.2, 3.2], [-3.2, 2.8], [-1.6, 3.6, 1], [0, 3.9, 1], [1.6, 3.6, 1], [3.2, 2.8], [3.2, 3.2], [4, 3.2]];
    const bonnet = [o[0], o[1], o[2] + 3.6];
    const FB = VERT(bonnet[0], bonnet[1]);
    const svg = S(G.solidOf(BODY, F, P), { tone: "hi", crease: "lo" }) +
      S(k.cylinder(bonnet[0], bonnet[1], 1.4, bonnet[2], 3.2, P, 16), { tone: "mid" }) +
      S(G.disc(bonnet[2] + 3.2, bonnet[2] + 3.9, 3.6, FB, P), { tone: "hi", crease: "lo" }) +
      S(k.cylinder(bonnet[0], bonnet[1], 1.2, bonnet[2] + 3.9, 0.7, P, 16), { tone: "mid" });
    // the padlock that keeps this join restricted, hung on the wheel
    const lock = { x: bonnet[0] + 2.2, y: bonnet[1] - 1.2, w: 2.4, d: 2.4, r: 0.4 };
    const lockSvg = S(k.slabOf(lock, bonnet[2] + 0.8, 2.4, P, 2, 0.2), { tone: "hi", crease: "lo" });
    put({ name: `${name}.valve`, layer, at: o, bias: 0.3, svg: svg + lockSvg, shapes: [A.solid(F, BODY, { name: `${name}.valve`, owner: name }), A.cylinder(bonnet[0], bonnet[1], 1.4, bonnet[2], 3.2), A.disc(FB, bonnet[2] + 3.2, bonnet[2] + 3.9, 3.6), A.cylinder(bonnet[0], bonnet[1], 1.2, bonnet[2] + 3.9, 0.7), A.slab(lock, bonnet[2] + 0.8, 2.4)] });
  }
  gaps.sort((a, b) => a[0] - b[0]);
  R.route(name, points, PIPE_R, { gaps });
  tubePieces(points, PIPE_R, P, { maxLength: 14, gaps }).forEach((part, index) => R.put({ name: `${name}:${index}`, at: part.mid, bias: 0, layer, svg: tubeSvg(part, { tone: "mid" }), route: name, chunk: index, shapes: [A.tube(part.points, part.radii)] }));
  for (const [end, o, nrm] of [["0", waypoints[0], n0], ["1", waypoints[waypoints.length - 1], n1]]) if (nrm) put({ name: `${name}.boss${end}`, layer, at: o, bias: 0.05, svg: W.bossSvg(o, nrm), shapes: [W.bossShape(`${name}.boss${end}`, o, nrm, name)] });
}
function pipes() {
  const Z = PIPE_Z;
  pipe("pipe.canal", [[12, INTAKE.y + INTAKE.d, Z], [12, -104, Z], [HOUSE.x, -104, Z]], [0, 1, 0], [-1, 0, 0]);
  pipe("pipe.well", [[VALVE_BOX.x, -107, Z], [HOUSE.x + HOUSE.w, -107, Z]], [-1, 0, 0], [1, 0, 0]);
  pipe("pipe.edge", [[HOUSE.x, -95, Z], [-16, -95, Z], [-16, DIST.y, Z]], [-1, 0, 0], [0, -1, 0]);
  pipe("pipe.consent", [[DIST.x, -62, Z], [TANK.x + TANK.w, -62, Z]], [-1, 0, 0], [1, 0, 0], { through: [{ axis: 0, at: COMPOUND.x + COMPOUND.w - 1, t: 2 }] });
  const ZL = 5.5;
  pipe("pipe.join", [[-118, TANK.y + TANK.d, ZL], [-118, TROUGH.y, ZL]], [0, 1, 0], [0, -1, 0], { through: [{ axis: 1, at: COMPOUND.y + COMPOUND.d - 1, t: 2 }], valve: 50 });
  pipe("pipe.outlet", [[151, OUTLET.y + OUTLET.d, Z], [151, 30, Z], [RES_IN.x + RES_IN.w, 30, Z]], [0, 1, 0], [1, 0, 0]);
  pipe("pipe.dash", [[RES_OUT.x, 30, ZL], [-90, 30, ZL], [-90, 100, ZL], [TROUGH.x + TROUGH.w, 100, ZL]], [-1, 0, 0], [1, 0, 0]);
  // the riser climbs beside the stand and enters the tank's side; the feed drops from its front
  // face into the stilling box at the inlet's head
  pipe("pipe.riser", [[80, RES_IN.y + RES_IN.d, Z], [80, 62, Z], [114, 62, Z], [114, 62, 46], [HEADER.x, 62, 46]], [0, 1, 0], [-1, 0, 0]);
  pipe("pipe.feed", [[136, HEADER.y + HEADER.d, 46], [136, 83, 46], [136, 83, INLET_TOP + 2.8]], [0, 1, 0], [0, 0, 1]);
}

// ---------- build ----------
const { halo } = W.bench(SITE, { label: { x: -160, y: 124, w: 52, d: 18, r: 2 }, ruler: { x: -92, y: 142, w: 236, d: 6, r: 1 } });
canal();
pumpHouse();
windpump();
settling();
compound();
reservoir();
headerTank();
filterBed();
fountain();
pipes();

const { layerOf } = W.finish();
if (argv.includes("--audit")) A.auditOrExit(R, P);

// ---------- page ----------
const page = W.page({
  title: "Product analytics",
  fig: "Fig 11",
  hint: "Drag · ← → events · ↑ ↓ filter cells",
  readout: `${fmt(EX.rps)} events/s`,
  keys: [
    { mark: "lit", label: "The filter's alarm: the model is falling behind" },
    { mark: "raised", label: "The compound: personal data stays inside, except through its two glands" },
    { mark: "flat", label: "Water: events, levels and flows from the engine" },
  ],
  caption: `Water is events. The engine splits the offered load between the two sources, so the pump house sees half of it and ${Math.round(ML_SHARE * 100)}% reaches the filter. Each filter cell is one model instance scoring ${fmt(ML_CELL)} events/s, so two cells fall behind past ${fmt(ML_TIPS)} events/s; at the example's ${fmt(EX.rps)} the inlet channel fills to the engine's ceiling. ${ML_FIT} cells keep up from a cold start, but once the bed is behind, retries hold it there and it takes ${ML_RECOVER} to recover.`,
  label: "A water-treatment works on a site plate. At the back a canal runs into an intake chamber, and a windpump on a lattice tower pumps a well; both feed a pump house. In the middle a distribution chamber sends some water through a sluice gate into a sealed, riveted tank inside a walled, fenced compound, and the rest down a long settling channel divided into 24 narrow lanes, which spills over a weir into an outlet chamber with a small reject sump beside it. In front, a round reservoir feeds a trough fountain and a header tank on four legs, which feeds a slow sand filter of six cells; the filter's inlet channel fills with the backlog.",
  width: WIDTH,
  height: HEIGHT,
  stack: ["back", "canvas"],
  layerOf,
  halo,
  css: readFileSync(join(HERE, "figure.css"), "utf8"),
  stageClass: "pa",
  stageAttrs: { role: "slider", "aria-label": "Product analytics as a water works: drag across the figure or use the left and right arrow keys to set the events per second; up and down open or close filter cells, the model's instances", "aria-valuemin": 0, "aria-valuemax": RPS_MAX, "aria-valuenow": EX.rps, "aria-valuetext": `${EX.rps} events per second` },
  data: { preset: { nodes: EX.nodes, edges: EX.edges, rps: EX.rps }, rpsMax: RPS_MAX, mlInst: node("ml").inst, mlRecover: ML_RECOVER, cells: CELLS, water: WATER, lanes: LANE_LIST, cellList: CELL_LIST, inletZ: [4, INLET_TOP - 1.4], inlet: INLET, sump: SUMP, view: V, wheel: WHEEL, fountGauge: FOUNT.gauge },
  truthCode: TRUTH.code,
  live: readFileSync(join(HERE, "live.js"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `product-analytics${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${R.items.length} items · ${R.solids.length} solids · ${R.tubes.length} tubes · ${WATER.length} water bodies · ML ${fmt(ML_CAP)}/s, tips at ${fmt(ML_TIPS)}, ${ML_FIT} cells fit cold, ${ML_RECOVER} recover`);
}
export { R };
