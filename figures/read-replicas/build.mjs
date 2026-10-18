// Fig 7 · Read Replicas. A pantograph copying table for the Workbench's `replicas` preset: three
// drawing tablets in a row, the master (the primary) between two copies (the replicas). An elbow
// drafting machine clamped to the back edge holds a long copy beam with three styluses, so every
// stroke written on the master is drawn on both copies at once: every write replays on every
// replica, as the engine's repl edges carry every primary arrival to each replica. Reading lamps
// over the copies are the reads they serve; a dial in front of each tablet reads its utilization.
// The engine is the Workbench's own (figures/lib/truth.mjs), run live by figures/lib/bench-live.js.
//
//   node figures/read-replicas/build.mjs [--light] [--audit] [--out=dir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { truth } from "../lib/truth.mjs";
import { workshop } from "../lib/bench.mjs";
import { makeLinkage, glyph } from "./linkage.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";
const outDir = argv.find((a) => a.startsWith("--out="))?.slice(6) ?? HERE;

// ---------- truth: the Workbench preset ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const PRESET = TRUTH.WB.PRESETS.find((p) => p.id === "replicas");
if (!PRESET) throw new Error("the replicas preset is missing from src/paradigms/presets.ts");
const node = (id) => PRESET.nodes.find((n) => n.id === id);
const capOf = (n) => ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / n.ms;
const SHARE = PRESET.edges.find((e) => e.id === "api>pri").w;
const API_CAP = capOf(node("api"));
const DB_CAP = capOf(node("pri"));
const LOAD_MAX = 12000;
// the caption's example, measured: the engine at a write-heavy mix, settled
const HEAVY = { rps: 5800, share: 0.8 };
const heavy = (() => {
  const edges = PRESET.edges.map((e) => (e.id === "api>pri" ? { ...e, w: HEAVY.share } : e.id === "api>r1" || e.id === "api>r2" ? { ...e, w: (1 - HEAVY.share) / 2 } : e));
  const sim = TRUTH.WB.makeSim();
  sim.noise = 0;
  let m = null;
  for (let i = 0; i < 240; i++) m = TRUTH.WB.tick(sim, PRESET.nodes, edges, HEAVY.rps, 0.25);
  return { master: m.nodes.pri.util, copy: Math.max(m.nodes.r1.util, m.nodes.r2.util), copyHealth: m.nodes.r1.health };
})();
if (heavy.copyHealth !== "crit" || heavy.master >= 1) throw new Error("the caption's write-heavy example no longer saturates the copies before the master");

// ---------- the table ----------
const WIDTH = 640;
const HEIGHT = 384;
const TABLE = { x: -165, y: -78, w: 330, d: 156, r: 5 };
const TOP = 0;
const TOP_H = 5;
const LEG_Z = -52;
const TABLETS = [
  { id: "r1", cx: -92 },
  { id: "pri", cx: 0 },
  { id: "r2", cx: 92 },
];
const BOARD = { w: 60, d: 46 };
const PAPER_Z = 2;
const LINK = {
  O: [0, -66],
  p: [-4.24, 4.24],
  q: [4.9, 3.44],
  arm: 42,
  headBack: [0, -8],
  barW: 1.7,
  beam: [-101, 101],
  beamW: 2.2,
  offsets: [-92, 0, 92],
  z: { tip: [PAPER_Z, 2.6], rod: [2.6, 4.6], collar: [4.6, 6.5], beam: [6.5, 8.5], head: [8.5, 9.4], lower: [9.4, 11], elbow: [11, 13], upper: [13, 14.6] },
};
export const P = k.fitProjection(
  [...k.boxCorners(TABLE, LEG_Z - 3, 0), [-92, -72, 46], [92, -72, 46], [-142, -58, 30], [0, -66, 15]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 70, elevation: 40 },
);
LINK.scale = G.scaleOf(P);
const W = workshop({ P, theme, layers: ["back", "arm", "front"] });
const { at, S, L, D, VERT, put, byDepth, rad } = W;
const linkage = makeLinkage(k, LINK, P);
const PAGE = glyph();

// the linkage must reach every point of the page, and neither parallelogram may fold flat
{
  const angle = (a, b) => Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
  let worst = Math.PI;
  for (const [u, v] of PAGE) {
    const { K, E } = linkage.solve([u, v]);
    if (Math.hypot(K[0] - LINK.O[0], K[1] - LINK.O[1]) > 2 * LINK.arm - 2) throw new Error(`linkage out of reach at ${u}, ${v}`);
    const up = [E[0] - LINK.O[0], E[1] - LINK.O[1]];
    const lo = [K[0] - E[0], K[1] - E[1]];
    for (const [a, b] of [[up, LINK.p], [lo, LINK.q]]) worst = Math.min(worst, angle(a, b), Math.PI - angle(a, b));
  }
  if (worst < rad(35)) throw new Error(`a parallelogram folds to ${((worst * 180) / Math.PI).toFixed(0)}°`);
}

// ---------- the table: top, apron, legs, stretchers, feet ----------
function table() {
  const legs = k.corners(TABLE, 12);
  for (const [x, y] of byDepth(legs)) {
    const leg = { x: x - 4.5, y: y - 4.5, w: 9, d: 9, r: 1.2 };
    put({ name: `stand.leg.${x}.${y}`, layer: "back", at: [x, y, LEG_Z], svg: S(k.slabOf(leg, LEG_Z, TOP - TOP_H - LEG_Z, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(leg, LEG_Z + 6, P, 3), { tone: "faint" }) }) + S(k.cylinder(x, y, 5.6, LEG_Z - 3, 3, P, 24), { tone: "lo" }), shapes: [A.slab(leg, LEG_Z, TOP - TOP_H - LEG_Z), A.cylinder(x, y, 5.6, LEG_Z - 3, 3, { ground: true })] });
  }
  // an H stretcher low between the legs
  const SZ = [-40, -36.5];
  for (const x of [-153, 153]) {
    const bar = { x: x - 2, y: -61.5, w: 4, d: 123, r: 1 };
    put({ name: `stand.stretcher.${x}`, layer: "back", at: [x, 0, SZ[0]], svg: S(k.slabOf(bar, SZ[0], SZ[1] - SZ[0], P, 2, 0.3), { tone: "lo" }), shapes: [A.slab(bar, SZ[0], SZ[1] - SZ[0])] });
  }
  const mid = { x: -151, y: -2, w: 302, d: 4, r: 1 };
  put({ name: "stand.stretcher.mid", layer: "back", at: [0, 0, SZ[0]], svg: S(k.slabOf(mid, SZ[0], SZ[1] - SZ[0], P, 2, 0.3), { tone: "lo" }), shapes: [A.slab(mid, SZ[0], SZ[1] - SZ[0])] });
  // the apron: four rails under the top, between the legs
  for (const [name, rail] of [["front", { x: -148.5, y: 62.5, w: 297, d: 3, r: 0.6 }], ["back", { x: -148.5, y: -65.5, w: 297, d: 3, r: 0.6 }], ["left", { x: -156.5, y: -61.5, w: 3, d: 123, r: 0.6 }], ["right", { x: 153.5, y: -61.5, w: 3, d: 123, r: 0.6 }]]) {
    put({ name: `stand.apron.${name}`, layer: "back", at: [rail.x + rail.w / 2, rail.y + rail.d / 2, -13], svg: S(k.slabOf(rail, -13, 8, P, 2, 0.3), { tone: "mid", inner: L(k.sideSeam(rail, -9, P, 2), { tone: "faint" }) }), shapes: [A.slab(rail, -13, 8)] });
  }
  const screws = k.corners(TABLE, 6);
  const top =
    S(k.slabOf(TABLE, TOP - TOP_H, TOP_H, P, 6, 1.2), { tone: "mid", inner: L(k.sideSeam(TABLE, TOP - 1.6, P, 6), { tone: "faint" }) }) +
    L(k.planOutline(k.insetPlan(TABLE, 4), TOP, P, 6), { tone: "faint" }) +
    L(screws.map(([x, y]) => k.ring(x, y, 1.5, TOP, P, 12)).join(""), { tone: "lo" }) +
    D(screws.map(([x, y]) => at([x, y, TOP])), { size: 0.45 });
  put({ name: "stand.top", layer: "back", at: [0, 0, TOP - TOP_H], bias: -300, svg: top, shapes: [A.slab(TABLE, TOP - TOP_H, TOP_H)] });
  W.rulerStrip({ x: -118, y: 66, w: 236, d: 7, r: 1 });
  W.labelPlate({ x: 112, y: -74, w: 46, d: 16, r: 2 });
}

// ---------- the tablets: a board, a clipped sheet, the ink, and a reading lamp's pool on the copies ----------
const INK_REF = {};
function tablets() {
  for (const t of TABLETS) {
    const board = { x: t.cx - BOARD.w / 2, y: -BOARD.d / 2, w: BOARD.w, d: BOARD.d, r: 2 };
    const paper = k.insetPlan(board, 3);
    const clips = k.corners(paper, 0).map(([x, y]) => ({ x: x - 2.2, y: y - 2.2, w: 4.4, d: 4.4, r: 0.8 }));
    const isMaster = t.id === "pri";
    const offset = k.axisVector(P, [t.cx, 0, 0]);
    const pool = isMaster ? "" : `<path class="rr-pool" data-pool="${t.id}" d="${k.pathOf(k.circleRing(t.cx, -6, 15, 48).map(([x, y]) => at([x, y, PAPER_Z])), true)}"/>`;
    INK_REF[t.id] = offset;
    const svg =
      S(k.slabOf(board, TOP, 1.6, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(board, 0.8, P, 4), { tone: "faint" }) }) +
      S(k.slabOf(paper, 1.6, PAPER_Z - 1.6, P, 2), { tone: "hi", crease: "none" }) +
      L(k.planOutline(k.insetPlan(paper, 2.2), PAPER_Z, P, 2), { tone: "faint" }) +
      pool +
      `<path class="iso-line rr-ink" data-tone="mid" data-free="" data-ink="${t.id}" transform="translate(${offset[0].toFixed(3)} ${offset[1].toFixed(3)})" d=""/>` +
      clips.map((c) => `<g data-mat="steel">${S(k.slabOf(c, PAPER_Z, 0.8, P, 2, 0.2), { tone: "mid", crease: "lo" })}</g>`).join("");
    put({ name: `tablet.${t.id}`, layer: "back", at: [t.cx, 0, TOP], svg, shapes: [A.slab(board, TOP, 1.6), A.slab(paper, 1.6, PAPER_Z - 1.6), ...clips.map((c) => A.slab(c, PAPER_Z, 0.8))] });
  }
}

// ---------- a dial on a short drum: utilization, the needle driven by the shared runtime ----------
function gauge(id, cx, cy, z0, { r = 9.5, h = 4.5, name = `gauge.${id}` } = {}) {
  const top = z0 + h;
  const g = { id, c: [cx, cy], z: top, r: r - 3.6, r0: 1.2, from: rad(-135), span: rad(270), max: 1.4 };
  W.GAUGES.push(g);
  const rim = r - 1.4;
  const t = k.radialTicks(cx, cy, rim, 28, 4, top, [1.1, 2.3], P, g.from, g.span);
  const at100 = g.from + g.span / g.max;
  const full = k.lineOnTop([cx + Math.sin(at100) * (rim - 2.9), cy - Math.cos(at100) * (rim - 2.9)], [cx + Math.sin(at100) * rim, cy - Math.cos(at100) * rim], top, P);
  const svg =
    S(k.cylinder(cx, cy, r + 1.2, z0, 1, P, 48, 0.3), { tone: "lo" }) +
    S(k.cylinder(cx, cy, r, z0 + 1, h - 1, P, 56, 0.5), { tone: "mid", crease: "lo", inner: L(k.sideArc(cx, cy, r, z0 + 2.6, P, 32), { tone: "faint" }) }) +
    L(k.ring(cx, cy, rim, top, P, 64), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(full, { tone: "hi" }) +
    L(k.ring(cx, cy, 1.2, top, P, 12), { tone: "mid" }) +
    `<path class="iso-line" data-tone="hi" data-free="end" data-gauge="${id}" d="${k.lineOnTop([cx, cy - 1.2], [cx, cy - g.r], top, P)}"/>`;
  put({ name, layer: "back", at: [cx, cy, z0], svg, shapes: [A.cylinder(cx, cy, r + 1.2, z0, 1), A.cylinder(cx, cy, r, z0 + 1, h - 1)] });
}

// ---------- a knob on a scale plate: the load (left) and the write mix (right) ----------
function knob(ref, cx, cy, { ticks, every, marks = [], name }) {
  const z = TOP;
  const from = rad(-135);
  const span = rad(270);
  const t = k.radialTicks(cx, cy, 11.2, ticks, every, z + 0.6, [1.2, 2.5], P, from, span);
  const mark = (f) => k.lineOnTop([cx + Math.sin(from + f * span) * 8.2, cy - Math.cos(from + f * span) * 8.2], [cx + Math.sin(from + f * span) * 11.2, cy - Math.cos(from + f * span) * 11.2], z + 0.6, P);
  const top = z + 7.4;
  const svg =
    S(k.cylinder(cx, cy, 12.4, z, 0.6, P, 56, 0.3), { tone: "lo" }) + L(k.ring(cx, cy, 11.2, z + 0.6, P, 64), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + marks.map((f) => L(mark(f), { tone: "hi" })).join("") +
    S(k.cylinder(cx, cy, 6.8, z + 0.6, 1.2, P, 40), { tone: "lo" }) +
    S(k.cylinder(cx, cy, 5.6, z + 1.8, top - z - 1.8, P, 40, 0.4), { tone: "hi", crease: "lo", inner: L(k.knurl(cx, cy, 5.6, z + 1.8, top, 36, P), { tone: "lo" }) }) +
    L(k.ring(cx, cy, 3.8, top, P, 28), { tone: "faint" }) + L(k.ring(cx, cy, 0.9, top, P, 12), { tone: "mid" }) +
    `<path class="iso-line" data-tone="hi" data-free="end" data-ref="${ref}" d="${k.lineOnTop([cx, cy - 0.9], [cx, cy - 4.9], top, P)}"/>`;
  put({ name, layer: "back", at: [cx, cy, z], svg, shapes: [A.cylinder(cx, cy, 12.4, z, 0.6), A.cylinder(cx, cy, 6.8, z + 0.6, 1.2), A.cylinder(cx, cy, 5.6, z + 1.8, top - z - 1.8)] });
  return { c: [cx, cy], z: top, from, span, r0: 0.9, r1: 4.9 };
}

// ---------- the API: a three-tier letter tray of incoming requests, its dial on top ----------
function tray() {
  const base = { x: -160, y: -74, w: 36, d: 28, r: 1.5 };
  const tiers = [1.2, 9.2, 17.2];
  let svg = S(k.slabOf(base, TOP, 1.2, P, 3, 0.3), { tone: "lo" });
  const shapes = [A.slab(base, TOP, 1.2)];
  tiers.forEach((z, i) => {
    const plate = k.insetPlan(base, 1);
    const lip = { x: plate.x, y: plate.y + plate.d - 1.4, w: plate.w, d: 1.4, r: 0.4 };
    // the spacers stand at the back corners and just behind the lip, so each tier rests on the one below
    const spacers = i < tiers.length - 1 ? [[2.4, 2.4], [plate.w - 2.4, 2.4], [2.4, plate.d - 3.4], [plate.w - 2.4, plate.d - 3.4]].map(([x, y]) => ({ x: plate.x + x - 1.6, y: plate.y + y - 1.6, w: 3.2, d: 3.2, r: 0.6 })) : [];
    const cards = [0, 1, 2].map((j) => ({ x: plate.x + 5 + j * 0.8, y: plate.y + 4.6 + j * 1.2, w: plate.w - 13, d: plate.d - 12, r: 0.3 }));
    svg += S(k.slabOf(plate, z, 1, P, 3, 0.3), { tone: "mid", crease: "lo" });
    shapes.push(A.slab(plate, z, 1));
    cards.forEach((c, j) => {
      svg += S(k.slabOf(c, z + 1 + j * 0.3, 0.3, P, 2), { tone: "hi", crease: "none" });
      shapes.push(A.slab(c, z + 1 + j * 0.3, 0.3));
    });
    spacers.forEach((sp) => {
      svg += S(k.slabOf(sp, z + 1, tiers[i + 1] - z - 1, P, 2), { tone: "lo" });
      shapes.push(A.slab(sp, z + 1, tiers[i + 1] - z - 1));
    });
    svg += S(k.slabOf(lip, z + 1, 2.4, P, 2, 0.2), { tone: "mid", crease: "lo" });
    shapes.push(A.slab(lip, z + 1, 2.4));
  });
  put({ name: "api.tray", layer: "back", at: [base.x + base.w / 2, base.y + base.d / 2, TOP], svg, shapes });
  // the API's dial stands on the table beside its tray
  gauge("api", -113.5, -62, TOP, { r: 7.4, h: 3.4, name: "gauge.api" });
}

// ---------- reading lamps over the copies: a post at the back edge, an arm, a shade ----------
function lamps() {
  for (const t of TABLETS.filter((x) => x.id !== "pri")) {
    const x = t.cx;
    const post = [x, -71];
    const FP = VERT(post[0], post[1]);
    const clamp = { x: x - 5, y: -77, w: 10, d: 11, r: 1.2 };
    put({ name: `lamp.${t.id}.clamp`, layer: "back", at: [x, -71, TOP], svg: S(k.slabOf(clamp, TOP, 3.4, P, 3, 0.4), { tone: "lo" }) + D([at([x - 2.6, -71, TOP + 3.4]), at([x + 2.6, -71, TOP + 3.4])], { size: 0.42 }), shapes: [A.slab(clamp, TOP, 3.4)] });
    // the post below the linkage's band is behind the moving parts; above it, it is in front of them
    put({ name: `lamp.${t.id}.post`, layer: "back", at: [x, -71, TOP + 3.4], svg: S(G.disc(TOP + 3.4, 16, 1.4, FP, P), { tone: "mid", crease: "none" }), shapes: [A.disc(FP, TOP + 3.4, 16, 1.4)] });
    // post, knuckle, arm, a small ball over the shade, and the shade on a short stem below the ball;
    // each rod ends where its rim lies on the ball it meets (rim on sphere: sqrt(R² − a²) short of the centre)
    const knuckle = [x, -71, 40];
    const ball = [x, -12, 40.6];
    const BALL_R = 1.4;
    const armF = G.frameAlong(knuckle, G.sub3(ball, knuckle));
    const armLen = G.len3(G.sub3(ball, knuckle));
    const shadeF = G.frameOf([ball[0], ball[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const SHADE = [[29, 9.5], [37.4, 2.6]];
    const stemTop = ball[2] - Math.sqrt(BALL_R ** 2 - 0.7 ** 2);
    const own = { owner: `lamp.${t.id}` };
    const upper =
      S(G.disc(16, 40 - Math.sqrt(2.2 ** 2 - 1.4 ** 2), 1.4, FP, P), { tone: "mid", crease: "none" }) +
      `<g data-mat="gunmetal">${S(G.solidOf(SHADE, shadeF, P, { rims: "all" }), { tone: "hi", crease: "lo" })}</g>` +
      S(G.disc(37.4, stemTop, 0.7, shadeF, P), { tone: "mid", crease: "none" }) +
      S(G.sphereOf(ball, BALL_R, P), { tone: "mid" }) +
      S(G.sphereOf(knuckle, 2.2, P), { tone: "mid" }) +
      S(G.disc(Math.sqrt(2.2 ** 2 - 1.1 ** 2), armLen - Math.sqrt(BALL_R ** 2 - 1.1 ** 2), 1.1, armF, P), { tone: "mid", crease: "none" });
    put({ name: `lamp.${t.id}.head`, layer: "front", at: [x, -40, 30], svg: upper, shapes: [A.disc(FP, 16, 40 - Math.sqrt(2.2 ** 2 - 1.4 ** 2), 1.4, own), A.solid(shadeF, SHADE, { name: `lamp.${t.id}.shade`, ...own }), A.disc(shadeF, 37.4, stemTop, 0.7, own), A.ball(ball, BALL_R, own), A.ball(knuckle, 2.2, own), A.disc(armF, Math.sqrt(2.2 ** 2 - 1.1 ** 2), armLen - Math.sqrt(BALL_R ** 2 - 1.1 ** 2), 1.1, own)] });
  }
}

// ---------- the linkage's fixed parts: the clamp on the back edge and the base plate ----------
function base() {
  const [ox, oy] = LINK.O;
  const block = { x: ox - 11, y: -78, w: 22, d: 19, r: 1.6 };
  const lip = { x: ox - 11, y: -81.5, w: 22, d: 3.5, r: 0.8 };
  const jaw = { x: ox - 9, y: -78, w: 18, d: 8, r: 1 };
  // the clamp wraps the back edge: the lip and jaw below the tabletop's plane are one item, behind and
  // under the top; the block and the lip above it are another, standing on it
  const lipLow = { ...lip };
  put({ name: "link.clamp.under", layer: "back", at: [ox, -80, -6], svg: S(k.slabOf(lipLow, -12, 12, P, 2, 0.3), { tone: "lo" }) + S(k.slabOf(jaw, -9, 4, P, 2, 0.3), { tone: "lo" }), shapes: [A.slab(lipLow, -12, 12), A.slab(jaw, -9, 4)] });
  const svg =
    S(k.slabOf(lip, TOP, LINK.z.elbow[0], P, 2, 0.3), { tone: "lo" }) +
    S(k.slabOf(block, TOP, LINK.z.elbow[0], P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(block, 4, P, 4), { tone: "faint" }) }) +
    D([at([ox - 7, -64, LINK.z.elbow[0]]), at([ox + 7, -64, LINK.z.elbow[0]])], { size: 0.42 });
  put({ name: "link.clamp", layer: "back", at: [ox, -70, TOP], svg, shapes: [A.slab(lip, TOP, LINK.z.elbow[0]), A.slab(block, TOP, LINK.z.elbow[0])] });
  const ring = linkage.rounded([LINK.O, [LINK.O[0] + LINK.p[0], LINK.O[1] + LINK.p[1]]], 3.4);
  put({ name: "link.base", layer: "back", at: [ox, oy, LINK.z.elbow[0]], svg: `<g data-mat="gunmetal">${S(k.extrude(ring, LINK.z.elbow[0], LINK.z.elbow[1] - LINK.z.elbow[0], P, { bevel: 0.3 }), { tone: "mid", crease: "lo" })}</g>`, shapes: [A.extruded(ring, LINK.z.elbow[0], LINK.z.elbow[1] - LINK.z.elbow[0])] });
}

// ---------- the drafting table's own furniture: a pencil trough with two pencils, a set square ----------
function desk() {
  const trough = { x: -112, y: 52, w: 224, d: 9, r: 1.5 };
  const floor = k.insetPlan(trough, 1.2);
  const svg =
    S(k.slabOf(trough, TOP, 2.4, P, 3, 0.4), { tone: "lo", inner: L(k.sideSeam(trough, TOP + 1.2, P, 3), { tone: "faint" }) }) +
    L(k.planOutline(floor, TOP + 2.4, P, 3), { tone: "faint" });
  put({ name: "desk.trough", layer: "back", at: [0, 56.5, TOP], svg, shapes: [A.slab(trough, TOP, 2.4)] });
  // two pencils lying in it: hexagonal bodies along x, a sharpened tip and a ferrule
  const hex = Array.from({ length: 6 }, (_, j) => [1.05 * Math.cos(((2 * j + 1) * Math.PI) / 6), 1.05 * Math.sin(((2 * j + 1) * Math.PI) / 6)]);
  [[-70, 55.4, 44], [18, 57.8, 52]].forEach(([x0, y, l], i) => {
    const z = TOP + 2.4 + 1.05 * Math.sin(Math.PI / 3);
    const F = G.frameOf([0, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const body = S(G.prismOf(F, hex, x0, x0 + l, P), { tone: "hi", crease: "lo" });
    const tipF = G.frameOf([x0 + l, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const tip = S(G.solidOf([[0, 0.95], [3.4, 0.18]], tipF, P), { tone: "mid", crease: "lo" });
    const ferrule = `<g data-mat="brass">${S(G.disc(x0 - 2.2, x0, 1.05, F, P), { tone: "mid" })}</g>`;
    put({ name: `desk.pencil.${i}`, layer: "back", at: [x0 + l / 2, y, z], svg: ferrule + body + tip, shapes: [A.prism(F, hex, x0, x0 + l), A.solid(tipF, [[0, 0.95], [3.4, 0.18]]), A.disc(F, x0 - 2.2, x0, 1.05)] });
  });
  // a set square lying flat beyond the arm's reach, its hole and its edge scale
  const sq = [[52, -62], [86, -62], [52, -36]];
  const hole = [[57.5, -57.5], [70, -57.5], [57.5, -46]];
  const t = [];
  for (let x = 55; x <= 83; x += 2) t.push(k.lineOnTop([x, -62], [x, -62 + ((x - 55) % 10 ? 1.1 : 2)], TOP + 0.8, P));
  const square = S(k.extrude(sq, TOP, 0.8, P, { bevel: 0.3 }), { tone: "hi", crease: "lo", inner: L(k.pathOf(hole.map(([x, y]) => at([x, y, TOP + 0.8])), true), { tone: "lo" }) }) + L(t.join(""), { tone: "lo" });
  put({ name: "desk.square", layer: "back", at: [62, -54, TOP], svg: square, shapes: [A.extruded(sq, TOP, 0.8)] });
}

// ---------- the moving linkage, at rest on the first point of the page ----------
function arm() {
  const H = [PAGE[0][0], PAGE[0][1]];
  const shapes = linkage.parts(H).map((part) => (part.kind === "round" ? A.cylinder(part.c[0], part.c[1], part.r, part.z, part.h, { name: part.name }) : A.extruded(part.ring, part.z, part.h, { name: part.name })));
  put({ name: "link.moving", layer: "arm", at: [H[0], H[1], 8], svg: `<g data-ref="linkage">${linkage.svg(H)}</g>`, shapes });
}

table();
tablets();
base();
tray();
lamps();
for (const t of TABLETS) gauge(t.id, t.cx, 38, TOP);
desk();
const loadKnob = knob("loadknob", -140, 50, { ticks: 24, every: 4, marks: [API_CAP / LOAD_MAX], name: "knob.load" });
const mixKnob = knob("mix", 140, 50, { ticks: 20, every: 5, marks: [SHARE], name: "knob.mix" });
arm();

const { layerOf } = W.finish();
if (argv.includes("--audit")) A.auditOrExit(W.R, P);

// ---------- page ----------
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const page = W.page({
  title: "Read replicas",
  fig: "Fig 7",
  hint: "Drag · ← → load · ↑ ↓ write mix",
  readout: `${fmt(PRESET.rps)} rps · ${Math.round(SHARE * 100)}% writes`,
  keys: [
    { mark: "lit", label: "The master stylus: every write" },
    { mark: "raised", label: "The copy beam: every write, redrawn on each copy" },
    { mark: "flat", label: "Lamps: reads on the copies" },
  ],
  caption: `Writes (${Math.round(SHARE * 100)}% in the preset) all go to the master, and the copy beam redraws each one on both copies, while reads go only to the copies. So a copy carries half the reads plus every write, and as the mix tips toward writes the copies saturate before the master does: at ${Math.round(HEAVY.share * 100)}% writes and ${fmt(HEAVY.rps)} rps each copy runs past its ${fmt(DB_CAP)} rps while the master is at ${Math.round(heavy.master * 100)}%. The numbers come from the Workbench's own queueing engine running the Read Replicas preset.`,
  label: "A pantograph copying table. Three drawing tablets sit in a row on a drafting table: the master in the middle and a copy on each side. An elbow drafting machine clamped to the table's back edge holds a long beam with three styluses, so the stroke written on the master is drawn on both copies at the same time. Reading lamps hang over the two copies, a dial in front of each tablet reads how busy it is, and a three-tier letter tray of requests sits at the back left.",
  width: WIDTH,
  height: HEIGHT,
  stack: ["back", "arm", "front"],
  stageClass: "rr",
  layerOf,
  halo: `<path class="iso-halo" d="${k.haloOf(k.insetPlan(TABLE, 6), LEG_Z - 3, 3, P)}"/>`,
  stageAttrs: { role: "slider", "aria-label": "Read replicas: drag across the figure or use the left and right arrow keys to set the load, up and down for the share of writes, Home for the preset", "aria-valuemin": 0, "aria-valuemax": LOAD_MAX, "aria-valuenow": PRESET.rps, "aria-valuetext": `${PRESET.rps} requests per second, ${Math.round(SHARE * 100)} percent writes` },
  data: { preset: { nodes: PRESET.nodes, edges: PRESET.edges, rps: PRESET.rps }, loadMax: LOAD_MAX, share: SHARE, link: LINK, page: PAGE, ink: INK_REF, loadKnob, mixKnob, tablets: TABLETS.map((t) => t.cx) },
  truthCode: TRUTH.code,
  css: readFileSync(join(HERE, "figure.css"), "utf8"),
  live: readFileSync(join(HERE, "linkage.mjs"), "utf8").replace(/^export /gm, "") + "\n" + readFileSync(join(HERE, "live.js"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `read-replicas${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${W.R.items.length} items · ${W.R.solids.length} solids`);
}
