// Fig 6 · Async Workers. A bench instrument for the Workbench's `workers` preset: the load generator
// feeds an ingest API that only hangs a ticket on the rail (the job queue) and answers. A rack of
// six worker cartridges, some switched on, pulls tickets off the rail and writes to Postgres. The
// tickets on the rail and the depth gauge follow the engine's queue depth; window heat is utilization.
//
//   node figures/async-workers/build.mjs [--light] [--audit] [--out=dir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import { truth } from "../lib/truth.mjs";
import { workshop, PIPE_Z } from "../lib/bench.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";
const outDir = argv.find((a) => a.startsWith("--out="))?.slice(6) ?? HERE;

// ---------- truth ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const PRESET = TRUTH.WB.PRESETS.find((p) => p.id === "workers");
if (!PRESET) throw new Error("the workers preset is missing from src/paradigms/presets.ts");
const node = (id) => PRESET.nodes.find((n) => n.id === id);
const perWorker = (node("w").cap * 1000) / node("w").ms;
const WORKERS = node("w").inst;
export const BAYS = 6;
export const LOAD_MAX = 1500;
export const DEPTH_MAX = 1e5;

// ---------- world ----------
const WIDTH = 640;
const HEIGHT = 470;
const BENCH = { x: -152, y: -142, w: 272, d: 300, r: 9 };
const GEN = { x: -142, y: -130, w: 54, d: 38, r: 3 };
const API = { x: -52, y: -130, w: 44, d: 34, r: 3 };
const QB = { x: -76, y: -50, w: 152, d: 26, r: 2.5 };
const QB_TOP = 12;
const POSTS = [-68, 68];
const BAR = { x: -71, y: -40, w: 142, d: 6, r: 0.8 };
const BAR_Z = [36, 38.5];
const TICKETS = 24;
const TICKET = { w: 6, z0: 22, z1: BAR_Z[0] };
const BP = { x: -80, y: 6, w: 160, d: 8, r: 1.5 };
const BP_TOP = 30;
const CART_Y = BP.y + BP.d;
const DBP = { x: -34, y: 104, w: 68, d: 40, r: 3 };
const GS = { x: -142, y: -50, w: 30, d: 26, r: 2.5 };
const GS_TOP = 16;

export const P = k.fitProjection([...k.boxCorners(BENCH, -17, 0), [-17, 124, 50], [17, 124, 50], [-30, -130, 37], [-115, -120, 29], [-127, -40, 18]], WIDTH, HEIGHT, { pad: 30, azimuth: 72, elevation: 34 });
const W = workshop({ P, theme, layers: ["back", "grille"] });
const { R, at, S, L, D, VERT, put, rad } = W;

// ---------- the job queue: a ticket rail on a base, one prebuilt ticket per slot ----------
const ticketX = (i) => -57.5 + i * 5;
const ticketY = (i) => BAR.y + 1.6 + i * 0.12;
function queueRail() {
  const base = S(k.slabOf(QB, 0, QB_TOP, P, 6, 0.9), { tone: "mid", inner: L(k.sideSeam(QB, 3.2, P, 6), { tone: "faint" }) }) + L(k.planOutline(k.insetPlan(QB, 3), QB_TOP, P, 4), { tone: "faint" });
  const screws = k.corners(QB, 4);
  put({ name: "queue.base", layer: "back", at: [0, QB.y + QB.d / 2, 0], svg: base + L(screws.map(([x, y]) => k.ring(x, y, 1.5, QB_TOP, P, 12)).join(""), { tone: "lo" }) + D(screws.map(([x, y]) => at([x, y, QB_TOP])), { size: 0.42 }), shapes: [A.slab(QB, 0, QB_TOP)] });
  const py = BAR.y + BAR.d / 2;
  for (const x of POSTS) {
    const svg = S(k.cylinder(x, py, 4.2, QB_TOP, 1.6, P, 32, 0.3), { tone: "lo" }) + S(k.cylinder(x, py, 2.6, QB_TOP + 1.6, BAR_Z[0] - QB_TOP - 1.6, P, 28), { tone: "mid", crease: "none", inner: L(k.sideArc(x, py, 2.6, 26, P, 20), { tone: "faint" }) });
    put({ name: `queue.post.${x}`, layer: "back", at: [x, py, QB_TOP], svg, shapes: [A.cylinder(x, py, 4.2, QB_TOP, 1.6), A.cylinder(x, py, 2.6, QB_TOP + 1.6, BAR_Z[0] - QB_TOP - 1.6)] });
  }
  const barSvg = S(k.slabOf(BAR, BAR_Z[0], BAR_Z[1] - BAR_Z[0], P, 3, 0.4), { tone: "hi", crease: "lo", inner: L(k.sideSeam(BAR, BAR_Z[0] + 0.8, P, 3), { tone: "faint" }) }) + D(POSTS.map((x) => at([x, py, BAR_Z[1]])), { size: 0.45 });
  put({ name: "queue.bar", layer: "back", at: [0, py, BAR_Z[0]], bias: 0.5, svg: barSvg, shapes: [A.slab(BAR, BAR_Z[0], BAR_Z[1] - BAR_Z[0])] });
  for (let i = 0; i < TICKETS; i++) {
    const x = ticketX(i);
    const y = ticketY(i);
    const plan = { x: x - TICKET.w / 2, y, w: TICKET.w, d: 0.3, r: 0 };
    const z0 = TICKET.z0 - [0, 2.4, 1, 3.2, 0.6, 1.8][(i * 7) % 6];
    const fy = y + 0.3;
    const rule = (z, a, b) => L(k.segment([x - 2.2 + a, fy, z], [x - 2.2 + b, fy, z], P), { tone: "lo", free: true });
    const face = rule(33.4, 0, 4.4) + rule(31.4, 0, 3.4) + rule(29.4, 0, 3.9) + rule(z0 + 2.4, 0, 2.2) + L(k.segment([x - TICKET.w / 2, fy, z0 + 4.4], [x + TICKET.w / 2, fy, z0 + 4.4], P), { tone: "faint" });
    const svg = `<g class="aw-ticket" data-ticket="${i}">${S(k.slabOf(plan, z0, TICKET.z1 - z0, P, 1), { tone: "hi", crease: "none", inner: face })}</g>`;
    put({ name: `queue.ticket.${i}`, layer: "back", at: [x, y, z0], svg, shapes: [A.slab(plan, z0, TICKET.z1 - z0)] });
  }
}

// ---------- the depth gauge on its stand, wired to the queue base by a sense line ----------
export const DEPTH = { c: [GS.x + GS.w / 2, GS.y + GS.d / 2], z: GS_TOP + 0.8, r: 7.6, r0: 1.2, from: rad(-135), span: rad(270) };
function depthGauge() {
  const [cx, cy] = DEPTH.c;
  const body = S(k.slabOf(GS, 0, GS_TOP, P, 6, 0.9), { tone: "mid", inner: L(k.sideSeam(GS, 4, P, 6), { tone: "faint" }) });
  const screws = k.corners(GS, 3.2);
  const rim = 9.4;
  const angle = (f) => DEPTH.from + f * DEPTH.span;
  const tick = (f, len, tone) => {
    const a = angle(f);
    return L(k.lineOnTop([cx + Math.sin(a) * (rim - len), cy - Math.cos(a) * (rim - len)], [cx + Math.sin(a) * rim, cy - Math.cos(a) * rim], DEPTH.z, P), { tone });
  };
  const decades = Math.log10(DEPTH_MAX);
  let ticks = "";
  for (let d = 0; d <= decades; d++) {
    ticks += tick(d / decades, 2.6, d === 0 ? "hi" : "mid");
    if (d < decades) for (const m of [2, 5]) ticks += tick((d + Math.log10(m)) / decades, 1.3, "lo");
  }
  const dial = S(k.cylinder(cx, cy, 11, GS_TOP, 0.8, P, 64, 0.3), { tone: "lo" }) + L(k.ring(cx, cy, rim, DEPTH.z, P, 72), { tone: "lo" }) + ticks + L(k.ring(cx, cy, DEPTH.r0, DEPTH.z, P, 14), { tone: "mid" }) + `<path class="iso-line" data-tone="lit" data-free="end" data-ref="depth" d="${k.lineOnTop([cx, cy - DEPTH.r0], [cx, cy - DEPTH.r], DEPTH.z, P)}"/>`;
  put({ name: "depth.stand", layer: "back", at: [cx, cy, 0], svg: body + L(screws.map(([x, y]) => k.ring(x, y, 1.3, GS_TOP, P, 12)).join(""), { tone: "lo" }) + D(screws.map(([x, y]) => at([x, y, GS_TOP])), { size: 0.4 }) + dial, shapes: [A.slab(GS, 0, GS_TOP), A.cylinder(cx, cy, 11, GS_TOP, 0.8)] });
  // the sense line: a thin tube from the queue base to the stand, each end on a small boss
  const r = 0.9;
  const o0 = [QB.x, QB.y + QB.d / 2, 6];
  const o1 = [GS.x + GS.w, QB.y + QB.d / 2, 6];
  const pts = [o0, o1];
  const total = G.pathLength(pts);
  const gaps = [[0, 1], [total - 1, total]];
  R.route("sense.depth", pts, r, { gaps });
  tubePieces(pts, r, P, { maxLength: 14, gaps }).forEach((part, index) => R.put({ name: `sense.depth:${index}`, at: part.mid, layer: "back", svg: tubeSvg(part, { tone: "mid" }), route: "sense.depth", chunk: index, shapes: [A.tube(part.points, part.radii)] }));
  for (const [end, o, n] of [["0", o0, [-1, 0, 0]], ["1", o1, [1, 0, 0]]]) {
    const F = G.frameAlong(o, n);
    put({ name: `sense.depth.boss${end}`, layer: "back", at: o, bias: 0.05, svg: S(G.disc(0, 1, 1.9, F, P), { tone: "mid", crease: "lo" }), shapes: [A.disc(F, 0, 1, 1.9, { name: `sense.depth.boss${end}`, owner: "sense.depth" })] });
  }
}

// ---------- the worker rack: a backplane and six cartridge bays; the knob switches them on ----------
export const CARTS = Array.from({ length: BAYS }, (_, i) => -63.5 + i * 25.4);
function rack() {
  const svg = S(k.slabOf(BP, 0, BP_TOP, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BP, 4, P, 4), { tone: "faint" }) }) + L(k.planOutline(k.insetPlan(BP, 1.6), BP_TOP, P, 3), { tone: "faint" }) + D(CARTS.map((x) => at([x, BP.y + BP.d / 2, BP_TOP])), { size: 0.42 });
  put({ name: "rack.backplane", layer: "back", at: [0, BP.y + BP.d / 2, 0], svg, shapes: [A.slab(BP, 0, BP_TOP)] });
  const boxes = CARTS.map((cx, i) => W.box({ id: `w${i}`, name: `rack.cart.${i}`, plan: { x: cx - 11, y: CART_Y, w: 22, d: 32, r: 2 }, lamp: false }));
  // a pull handle on each cartridge: a bar on two standoffs, how a worker slides into its bay
  const front = CART_Y + 32;
  CARTS.forEach((cx, i) => {
    const legs = [cx - 6, cx + 4.6].map((x) => ({ x, y: front, w: 1.4, d: 1.4, r: 0.2 }));
    const bar = { x: cx - 6.4, y: front + 1.4, w: 12.8, d: 1.3, r: 0.5 };
    const svg = legs.map((l) => S(k.slabOf(l, 6.2, 1.6, P, 1), { tone: "lo", crease: "none" })).join("") + S(k.slabOf(bar, 6, 2, P, 3, 0.25), { tone: "hi", crease: "lo" });
    put({ name: `rack.cart.${i}.handle`, layer: "back", at: [cx, front + 1.4, 6], bias: 0.1, svg, shapes: [...legs.map((l) => A.slab(l, 6.2, 1.6)), A.slab(bar, 6, 2)] });
  });
  return boxes;
}
// a power lamp on each cartridge: hi when the cartridge is one of the node's instances
const POWER = [];
function powerLamps() {
  CARTS.forEach((cx, i) => {
    const o = [cx, CART_Y + 32, 34];
    const F = G.frameAlong(o, [0, 1, 0]);
    const c = at(G.pointOf(F, 1.1, 0, 0));
    POWER.push(i);
    put({ name: `rack.cart.${i}.power`, layer: "grille", at: o, bias: 0.2, svg: S(G.disc(0, 0.6, 1.4, F, P), { tone: "lo" }) + S(G.disc(0.6, 1.1, 0.9, F, P), { tone: "mid" }) + `<circle class="aw-power" data-power="${i}" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="${(0.8 * G.scaleOf(P)).toFixed(2)}"/>`, shapes: [A.disc(F, 0, 0.6, 1.4), A.disc(F, 0.6, 1.1, 0.9)] });
  });
}

// ---------- build ----------
const { halo } = W.bench(BENCH, { label: { x: 30, y: -128, w: 72, d: 20, r: 2 }, ruler: { x: -138, y: 147, w: 230, d: 7, r: 1 } });
const gen = W.generator(GEN, { rpsMax: LOAD_MAX, marks: [WORKERS * perWorker] });
const api = W.box({ id: "api", name: "ingest", plan: API, lamp: false, label: true });
queueRail();
depthGauge();
const carts = rack();
powerLamps();
const db = W.database({ id: "db", plinth: DBP });
W.conduit("pipe.feed", [gen.right(-111), api.left(-111)], [1, 0, 0], [-1, 0, 0]);
W.conduit("pipe.enqueue", [api.front(), [api.front()[0], QB.y, PIPE_Z]], [0, 1, 0], [0, -1, 0]);
W.conduit("pipe.pull", [[0, QB.y + QB.d, PIPE_Z], [0, BP.y, PIPE_Z]], [0, 1, 0], [0, -1, 0]);
W.conduit("pipe.write", [[BP.x + BP.w, BP.y + BP.d / 2, PIPE_Z], [106, BP.y + BP.d / 2, PIPE_Z], [106, DBP.y + DBP.d / 2, PIPE_Z], db.right()], [1, 0, 0], [1, 0, 0]);
void carts;

const { layerOf } = W.finish();
if (argv.includes("--audit")) A.auditOrExit(R, P);

// ---------- page ----------
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const css = `
.aw-power{fill:var(--anatomy-hi);stroke:none;opacity:var(--aw-on,0)}
.aw-ticket{opacity:var(--aw-show,1)}
`;
const page = W.page({
  title: "Async workers",
  fig: "Fig 6",
  hint: "Drag · ← → load · ↑ ↓ workers",
  readout: `${PRESET.rps} jobs/s · ${WORKERS} workers`,
  keys: [
    { mark: "lit", label: "Queue depth, log scale" },
    { mark: "raised", label: "A ticket: one waiting job" },
    { mark: "flat", label: "Window heat: utilization" },
  ],
  caption: `The ingest API hangs each job on the rail and answers at once, so it stays cool whatever the workers do. Each worker finishes ${fmt(perWorker)} jobs/s, so the preset's ${WORKERS} workers clear ${fmt(WORKERS * perWorker)} of the ${fmt(PRESET.rps)} arriving and the rail fills by ${fmt(PRESET.rps - WORKERS * perWorker)} tickets a second until more are switched on. The numbers come from the Workbench's own queueing engine running the Async Workers preset.`,
  label: "A job queue on a bench. A load generator feeds an ingest API box, which hangs job tickets on a rail between two posts. Behind a backplane, a rack of six worker cartridges pulls tickets off the rail and writes to a Postgres drum in front. A depth gauge on a stand reads how many jobs are waiting, and each box's window glows with how hard it is working.",
  width: WIDTH,
  height: HEIGHT,
  stack: ["back", "canvas", "grille"],
  layerOf,
  halo,
  css,
  stageAttrs: { role: "slider", "aria-label": "Async workers: drag across the figure or use the left and right arrow keys to set the load; up and down switch workers on and off; Home returns to the preset", "aria-valuemin": 0, "aria-valuemax": LOAD_MAX, "aria-valuenow": PRESET.rps, "aria-valuetext": `${PRESET.rps} jobs per second, ${WORKERS} workers` },
  data: { preset: { nodes: PRESET.nodes, edges: PRESET.edges, rps: PRESET.rps }, loadMax: LOAD_MAX, bays: BAYS, workers: WORKERS, perWorker, tickets: TICKETS, depth: { ...DEPTH, max: DEPTH_MAX } },
  truthCode: TRUTH.code,
  live: readFileSync(join(HERE, "live.js"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `async-workers${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${R.items.length} items · ${R.solids.length} solids · ${R.tubes.length} tubes`);
}
