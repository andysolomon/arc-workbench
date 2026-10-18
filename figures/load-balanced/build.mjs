// Fig 4 · Load Balanced. A bench instrument for the Workbench's `lb` preset: a load generator
// (the clients) feeds a rotary distributor (the load balancer) whose rotor deals requests in turn
// over three commutator segments, 34 / 33 / 33, to three identical API pods. Every pod queries one
// Postgres. Heat in each window is that box's utilization, from the Workbench's own queueing
// engine, which this page runs live (figures/lib/truth.mjs). The bench parts are figures/lib/bench.mjs;
// the distributor and its turning rotor are this figure's own.
//
//   node figures/load-balanced/build.mjs [--light] [--audit [--quick] [--only=a,b]] [--verify] [--out=dir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { turning } from "../kit/turn-build.mjs";
import * as TA from "../kit/turn-audit.mjs";
import { truth } from "../lib/truth.mjs";
import { workshop, PIPE_Z } from "../lib/bench.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";
const verify = argv.includes("--verify");
const outDir = argv.find((a) => a.startsWith("--out="))?.slice(6) ?? HERE;

// ---------- truth: the Workbench preset and engine ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const PRESET = TRUTH.WB.PRESETS.find((p) => p.id === "lb");
if (!PRESET) throw new Error("the lb preset is missing from src/paradigms/presets.ts");
const node = (id) => PRESET.nodes.find((n) => n.id === id);
const capOf = (n) => ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / n.ms;
const SPLIT = ["s1", "s2", "s3"].map((id) => PRESET.edges.find((e) => e.from === "lb" && e.to === id).w);
const POD_CAP = capOf(node("s1"));
const DB_CAP = capOf(node("db"));
export const RPS_MAX = 8000;

// ---------- camera and world ----------
const WIDTH = 640;
const HEIGHT = 470;
const BENCH = { x: -150, y: -124, w: 262, d: 268, r: 9 };
const TC = [0, -78];
const GEN = { x: -138, y: -112, w: 54, d: 38, r: 3 };
const TP = { x: TC[0] - 22, y: TC[1] - 22, w: 44, d: 44, r: 3 };
const PLINTH_TOP = 14;
const DRUM_R = 20;
const COLUMN_R = 8.5;
const HEAD_Z = 40;
const DRUM_TOP = 48;
const DECK_R = 19;
const DECK_TOP = 49.5;
const SEG_TOP = 50.5;
const ROTOR_Z = SEG_TOP - 24.5;
const SEG_R = [9.5, 18];
const PODS = [-78, 0, 78];
const POD_Y = [-17, 17];
const DBP = { x: -34, y: 80, w: 68, d: 40, r: 3 };

export const P = k.fitProjection(
  [...k.boxCorners(BENCH, -17, 0), [-17, 100, 50], [17, 100, 50], [TC[0], TC[1] - DRUM_R, SEG_TOP + 8.5], [-111, -102, 29], [-100, -17, 36], [100, -17, 36]],
  WIDTH,
  HEIGHT,
  { pad: 30, azimuth: 72, elevation: 34 },
);
const W = workshop({ P, theme, layers: ["back", "grille"] });
const { R, at, S, L, D, VERT, put, rad } = W;

// ---------- the distributor: plinth, column, head, commutator ----------
// segment arcs follow the preset's split: s1 gets 34 % of the turn, s2 and s3 33 % each
const SEG_GAP = 3.4;
const segStart = 90 - (SPLIT[1] * 360) / 2;
export const SEGMENTS = (() => {
  const b = [segStart, segStart + SPLIT[1] * 360];
  const a = [b[1], b[1] + SPLIT[0] * 360];
  const c = [a[1], a[1] + SPLIT[2] * 360];
  return [{ node: "s1", from: a[0], to: a[1] }, { node: "s2", from: b[0], to: b[1] }, { node: "s3", from: c[0], to: c[1] }];
})();
const PORT = {
  feed: { o: [TP.x, -92, PIPE_Z], n: [-1, 0, 0] },
  a: { o: [TP.x, -64, PIPE_Z], n: [-1, 0, 0] },
  b: { o: [TC[0], TP.y + TP.d, PIPE_Z], n: [0, 1, 0] },
  c: { o: [TP.x + TP.w, -64, PIPE_Z], n: [1, 0, 0] },
};
function turret() {
  const [cx, cy] = TC;
  const screws = k.corners(TP, 4.5);
  const plinth =
    S(k.slabOf(TP, 0, PLINTH_TOP, P, 6, 0.9), { tone: "mid", inner: L(k.sideSeam(TP, 3.2, P, 6), { tone: "faint" }) }) +
    L(screws.map(([x, y]) => k.ring(x, y, 1.7, PLINTH_TOP, P, 14)).join(""), { tone: "lo" }) +
    D(screws.map(([x, y]) => at([x, y, PLINTH_TOP])), { size: 0.45 });
  put({ name: "lb.plinth", layer: "back", at: [cx, cy, 0], svg: plinth, shapes: [A.slab(TP, 0, PLINTH_TOP)] });
  // the column carries the head clear of everything on the bench, so the rotor turns above it all
  const FC = VERT(cx, cy);
  const collar = S(k.cylinder(cx, cy, 12.5, PLINTH_TOP, 3, P, 56, 0.4), { tone: "lo" }) + D(G.dotsOf(FC, PLINTH_TOP + 3, 10.6, 8, P, { all: true, phase: 0.4 }), { size: 0.42 });
  const column = S(k.cylinder(cx, cy, COLUMN_R, PLINTH_TOP + 3, HEAD_Z - 7 - PLINTH_TOP - 3, P, 48), { tone: "mid", crease: "none", inner: L([24, 29].map((z) => k.sideArc(cx, cy, COLUMN_R, z, P, 32)).join(""), { tone: "faint" }) });
  const CONE = [[HEAD_Z - 7, COLUMN_R], [HEAD_Z, DRUM_R - 1.5]];
  const cone = S(G.solidOf(CONE, FC, P, { rims: "none" }), { tone: "mid", crease: "none" });
  put({ name: "lb.column", layer: "back", at: [cx, cy, PLINTH_TOP], svg: collar + column + cone, shapes: [A.cylinder(cx, cy, 12.5, PLINTH_TOP, 3), A.cylinder(cx, cy, COLUMN_R, PLINTH_TOP + 3, HEAD_Z - 7 - PLINTH_TOP - 3), A.solid(FC, CONE, { name: "lb.cone" })] });
  const drum = S(k.cylinder(cx, cy, DRUM_R, HEAD_Z, DRUM_TOP - HEAD_Z, P, 80, 0.5), { tone: "mid", crease: "lo", inner: L(k.sideArc(cx, cy, DRUM_R, HEAD_Z + 4, P, 48), { tone: "faint" }) });
  const deck = S(k.cylinder(cx, cy, DECK_R, DRUM_TOP, DECK_TOP - DRUM_TOP, P, 80, 0.4), { tone: "lo" });
  const boss = S(k.cylinder(cx, cy, 5, DECK_TOP, SEG_TOP - DECK_TOP, P, 32), { tone: "lo" });
  const segs = SEGMENTS.map(({ from, to }) => {
    const a0 = from + SEG_GAP / 2;
    const a1 = to - SEG_GAP / 2;
    const n = Math.max(8, Math.round((a1 - a0) / 3));
    const ring = [];
    for (let j = 0; j <= n; j++) ring.push([cx + SEG_R[1] * Math.cos(rad(a0 + ((a1 - a0) * j) / n)), cy + SEG_R[1] * Math.sin(rad(a0 + ((a1 - a0) * j) / n))]);
    for (let j = n; j >= 0; j--) ring.push([cx + SEG_R[0] * Math.cos(rad(a0 + ((a1 - a0) * j) / n)), cy + SEG_R[0] * Math.sin(rad(a0 + ((a1 - a0) * j) / n))]);
    const mid = rad((a0 + a1) / 2);
    const screw = [cx + 13.75 * Math.cos(mid), cy + 13.75 * Math.sin(mid)];
    return { ring, svg: `<g data-mat="brass">${S(k.extrude(ring, DECK_TOP, SEG_TOP - DECK_TOP, P, { convex: false, bevel: 0.25 }), { tone: "hi", crease: "lo" })}</g>` + L(k.ring(screw[0], screw[1], 1, SEG_TOP, P, 12), { tone: "lo" }) + D([at([screw[0], screw[1], SEG_TOP])], { size: 0.4 }) };
  });
  put({
    name: "lb.drum",
    layer: "back",
    at: [cx, cy, HEAD_Z],
    svg: drum + deck + boss + segs.map((s) => s.svg).join(""),
    shapes: [A.cylinder(cx, cy, DRUM_R, HEAD_Z, DRUM_TOP - HEAD_Z), A.cylinder(cx, cy, DECK_R, DRUM_TOP, DECK_TOP - DRUM_TOP), A.cylinder(cx, cy, 5, DECK_TOP, SEG_TOP - DECK_TOP), ...segs.map((s, i) => A.extruded(s.ring, DECK_TOP, SEG_TOP - DECK_TOP, { name: `lb.segment.${i}` }))],
  });
}

// ---------- the rotor: the one part that turns ----------
export const T = turning(P, { recorder: R });
const rotor = T.group("rotor", { turn: { pivot: TC } });
const live = T.layer("rotor");
T.stack(["back", "grille", "rotor"]);
export const BRUSH = [TC[0] + 17.4, TC[1], SEG_TOP];
export const poses = () => Array.from({ length: 720 }, (_, i) => ({ rotor: i * 0.5 }));
const ringD = (r, steps) => Array.from({ length: steps }, (_, j) => `${j ? "L" : "M"}${(r * Math.cos((j / steps) * Math.PI * 2)).toFixed(3)} ${(r * Math.sin((j / steps) * Math.PI * 2)).toFixed(3)}`).join("") + "Z";
function rotorParts() {
  const [cx, cy] = TC;
  const H = { group: rotor, layer: live };
  T.round({ name: "rotor.hub", ...H, F: VERT(cx, cy), s0: SEG_TOP, s1: ROTOR_Z + 30.5, r: 6.5, tone: "hi", crease: "lo", material: "steel", details: { seams: [SEG_TOP + 1.1] } });
  const cap = T.round({ name: "rotor.cap", ...H, F: VERT(cx, cy), s0: ROTOR_Z + 30.5, s1: ROTOR_Z + 32.6, r: 4.2, tone: "hi", crease: "lo", material: "brass", details: { ribs: { s0: ROTOR_Z + 30.5, s1: ROTOR_Z + 32.6, count: 44, fade: [0.08, 0.5], tone: "lo" } } });
  T.plane({ part: cap, o: [cx, cy, ROTOR_Z + 32.6], u: [1, 0, 0], v: [0, 1, 0], svg: `<path class="iso-line" data-tone="mid" d="${ringD(1, 18)}"/><path class="iso-line" data-tone="hi" d="M1 0L4.2 0"/>` });
  T.prism({ name: "rotor.arm", ...H, plan: { x: cx + 6.5, y: cy - 2, w: 8.5, d: 4, r: 0.6 }, z: ROTOR_Z + 27, h: 2.5, steps: 2, bevel: 0.3, tone: "hi", crease: "lo", material: "steel" });
  T.prism({ name: "rotor.wiper", ...H, plan: { x: cx + 15, y: cy - 2.8, w: 4.8, d: 5.6, r: 0.6 }, z: ROTOR_Z + 25.4, h: 4.1, steps: 2, bevel: 0.3, tone: "mid", material: "gunmetal", details: { dots: [{ at: [ROTOR_Z + 29.5, cx + 17.4, cy], normal: [0, 0, 1], size: 0.42 }] } });
  T.prism({ name: "rotor.brush", ...H, plan: { x: cx + 16.2, y: cy - 1.3, w: 2.4, d: 2.6, r: 0.3 }, z: SEG_TOP, h: 0.9, steps: 2, tone: "mid", material: "copper" });
  T.prism({ name: "rotor.weight", ...H, plan: { x: cx - 14.5, y: cy - 3.6, w: 8, d: 7.2, r: 1.2 }, z: ROTOR_Z + 26.4, h: 3.6, steps: 3, bevel: 0.4, tone: "mid", material: "gunmetal", details: { dots: [-1.8, 1.8].map((dy) => ({ at: [ROTOR_Z + 30, cx - 10.5, cy + dy], normal: [0, 0, 1], size: 0.42 })) } });
}

// ---------- build ----------
const { halo } = W.bench(BENCH, { label: { x: 36, y: -116, w: 66, d: 20, r: 2 }, ruler: { x: -136, y: 132, w: 232, d: 7, r: 1 } });
const gen = W.generator(GEN, { rpsMax: RPS_MAX, marks: [DB_CAP] });
turret();
rotorParts();
const pods = PODS.map((cx, i) => W.box({ id: ["s1", "s2", "s3"][i], name: `pod.${"abc"[i]}`, plan: { x: cx - 22, y: POD_Y[0], w: 44, d: POD_Y[1] - POD_Y[0], r: 3 } }));
const db = W.database({ id: "db", plinth: DBP });
W.conduit("pipe.feed", [gen.right(-92), PORT.feed.o], [1, 0, 0], [-1, 0, 0]);
W.conduit("pipe.a", [PORT.a.o, [PODS[0], PORT.a.o[1], PIPE_Z], pods[0].back()], PORT.a.n, [0, -1, 0]);
W.conduit("pipe.b", [PORT.b.o, pods[1].back()], PORT.b.n, [0, -1, 0]);
W.conduit("pipe.c", [PORT.c.o, [PODS[2], PORT.c.o[1], PIPE_Z], pods[2].back()], PORT.c.n, [0, -1, 0]);
W.conduit("pipe.qa", [pods[0].front(), [PODS[0], 100, PIPE_Z], db.left(100)], [0, 1, 0], [-1, 0, 0]);
W.conduit("pipe.qb", [pods[1].front(), db.back(0)], [0, 1, 0], [0, -1, 0]);
W.conduit("pipe.qc", [pods[2].front(), [PODS[2], 100, PIPE_Z], db.right(100)], [0, 1, 0], [1, 0, 0]);

const { out, layerOf } = W.finish({ T, poses, verify });
if (argv.includes("--audit")) {
  A.auditOrExit(R, P);
  TA.orbitOrExit(T, R, P, {
    sweep: { at: (x) => ({ rotor: x }), from: 0, to: 360, frame: 0.3 },
    quick: argv.includes("--quick"),
    only: argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? null,
    log: argv.includes("--verbose") ? (text) => console.log(`  … ${text}`) : null,
  });
}

// ---------- page ----------
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const page = W.page({
  title: "Load balanced",
  fig: "Fig 4",
  hint: "Drag across · ← → load",
  readout: `${PRESET.rps} rps · pods 11% · db 18%`,
  keys: [
    { mark: "lit", label: "The pod the rotor is dealing to" },
    { mark: "raised", label: "Rotor and commutator: the load balancer" },
    { mark: "flat", label: "Window heat: utilization" },
  ],
  caption: `Each pod serves ${fmt(POD_CAP)} rps and Postgres ${fmt(DB_CAP)}, so three pods move the bottleneck to the database: past ${fmt(DB_CAP)} rps its window runs white-hot and retries pile on. The numbers come from the Workbench's own queueing engine running the Load Balanced preset.`,
  label: "A load balancer on a bench. A load generator at the back feeds a rotary distributor; its rotor turns over three brass commutator segments and deals each request in turn to one of three identical API pods. All three pods send their queries to one Postgres drum in front. A window in each box glows with how hard it is working.",
  width: WIDTH,
  height: HEIGHT,
  stack: ["back", "canvas", "grille", "rotor"],
  liveLayers: ["rotor"],
  layerOf,
  out,
  halo,
  verify,
  stageAttrs: { role: "slider", "aria-label": "Load balancer: drag across the figure or use the arrow keys to set the load, Home for the preset's 900 requests per second", "aria-valuemin": 0, "aria-valuemax": RPS_MAX, "aria-valuenow": PRESET.rps, "aria-valuetext": `${PRESET.rps} requests per second` },
  data: { preset: { nodes: PRESET.nodes, edges: PRESET.edges, rps: PRESET.rps }, rpsMax: RPS_MAX, segments: SEGMENTS, pivot: TC, brush: BRUSH },
  truthCode: TRUTH.code,
  live: readFileSync(join(HERE, "live.js"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `load-balanced${verify ? "-verify" : ""}${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${R.items.length} items · ${out.report.parts} live parts · ${out.report.layers.map((l) => `${l.name}: ${l.planar} planes, ${l.dynamic} dynamic`).join(" · ")} · build ${out.report.seconds.toFixed(1)} s`);
}
export { out };
