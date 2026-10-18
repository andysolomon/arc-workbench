// Fig 8 · Rate Limited API. The Workbench's `ratelimit` preset on the shared bench: a load generator
// feeds a turnstile tower, the rate limiter, whose 3D rotor turns at the admitted rate; whatever
// arrives above the limit drops out of a reject slot into a bin, whose meter reads the share turned
// away. Admitted requests go on to an API (two instances in one chassis) and Postgres. Every number
// is the Workbench's own queueing engine, run live with the limiter's cap set to the limit dial.
//
//   node figures/rate-limited-api/build.mjs [--light] [--audit [--quick] [--only=a,b]] [--verify] [--out=dir]
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
import { chassis } from "../lib/chassis.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";
const verify = argv.includes("--verify");
const outDir = argv.find((a) => a.startsWith("--out="))?.slice(6) ?? HERE;

// ---------- truth ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const PRESET = TRUTH.WB.PRESETS.find((p) => p.id === "ratelimit");
if (!PRESET) throw new Error("the ratelimit preset is missing from src/paradigms/presets.ts");
const nodeOf = (id) => PRESET.nodes.find((x) => x.id === id);
const capOf = (id) => { const n = nodeOf(id); return ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / n.ms; };
const API_CAP = capOf("api");
const DB_CAP = capOf("db");
const LIMIT = nodeOf("rl").cap;
export const RPS_MAX = 8000;
export const LIMIT_MAX = 7000;

// ---------- camera: the family's scale (Fig 4) ----------
const WIDTH = 640;
const SCALE = 1.3811428586737253;
const PAD = 30;
const familyProjection = (points) => {
  const unit = { origin: [0, 0], scale: 1, azimuth: 72, elevation: 34 };
  const flat = points.map((p) => k.iso(p, unit));
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  const height = Math.ceil((Math.max(...ys) - Math.min(...ys)) * SCALE + PAD * 2);
  const origin = [WIDTH / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * SCALE, height / 2 - ((Math.min(...ys) + Math.max(...ys)) / 2) * SCALE];
  return { P: { origin, scale: SCALE, azimuth: 72, elevation: 34 }, height };
};
const BENCH = { x: -162, y: -42, w: 262, d: 184, r: 9 };
const GEN = { x: -152, y: -19, w: 54, d: 38, r: 3 };
const LP = { x: -78, y: -24, w: 52, d: 48, r: 3 };
const TC = [-52, -6];
const PLINTH_TOP = 14;
const COLUMN_R = 8.5;
const HEAD_Z = 40;
const DRUM_R = 20;
const DRUM_TOP = 48;
const DECK_TOP = 49.5;
const ROTOR_Z0 = 50.5;
const DIAL = { c: [-36.5, 13.5], r: 7.2 };
const BIN = { x: -73, y: 26, w: 26, d: 18, r: 1.5 };
const BIN_H = 8;
const API = { x: -2, y: -17, w: 88, d: 34, r: 3 };
const DBP = { x: 10, y: 80, w: 68, d: 40, r: 3 };
export const { P, height: HEIGHT } = familyProjection([...k.boxCorners(BENCH, -17, 0), [27, 100, 50], [61, 100, 50], [44, 83, 50], [-125, -9, 29], [TC[0], TC[1] - DRUM_R, ROTOR_Z0 + 8.2], [TC[0] - DRUM_R, TC[1], DRUM_TOP], [TC[0] + DRUM_R, TC[1], DRUM_TOP], [-2, -17, 37.2], [86, -17, 37.2]]);
const W = workshop({ P, theme, layers: ["back", "grille"] });
const { R, at, S, L, D, VERT, put, rad } = W;

// ---------- the turnstile tower: plinth with the limit dial and the reject slot, column, head ----------
export const LIMIT_DIAL = { c: DIAL.c, z: PLINTH_TOP + 5.6, r0: 0.9, r1: 3.6, from: rad(-135), span: rad(270), max: LIMIT_MAX };
const MOUTH = { x0: -68, x1: -52, z0: 9, z1: 12 };
function tower() {
  const [cx, cy] = TC;
  const front = LP.y + LP.d;
  const screws = k.corners(LP, 4);
  const mouth = W.poly(k.roundedPlan({ x: MOUTH.x0, y: MOUTH.z0, w: MOUTH.x1 - MOUTH.x0, d: MOUTH.z1 - MOUTH.z0, r: 1 }, 3).map(([x, z]) => [x, front, z]));
  const lip = W.poly([[MOUTH.x0 + 0.6, front, MOUTH.z0 + 0.6], [MOUTH.x1 - 0.6, front, MOUTH.z0 + 0.6], [MOUTH.x1 - 0.6, front, MOUTH.z1 - 0.6], [MOUTH.x0 + 0.6, front, MOUTH.z1 - 0.6]]);
  const [dx, dy] = DIAL.c;
  const t = k.radialTicks(dx, dy, DIAL.r - 0.6, 35, 5, PLINTH_TOP + 0.6, [1, 2], P, LIMIT_DIAL.from, LIMIT_DIAL.span);
  const tickAt = (v) => LIMIT_DIAL.from + (v / LIMIT_MAX) * LIMIT_DIAL.span;
  const mark = (v) => k.lineOnTop([dx + Math.sin(tickAt(v)) * (DIAL.r - 3.2), dy - Math.cos(tickAt(v)) * (DIAL.r - 3.2)], [dx + Math.sin(tickAt(v)) * (DIAL.r - 0.6), dy - Math.cos(tickAt(v)) * (DIAL.r - 0.6)], PLINTH_TOP + 0.6, P);
  const plinth =
    S(k.slabOf(LP, 0, PLINTH_TOP, P, 6, 0.9), { tone: "mid", inner: L(k.sideSeam(LP, 3.2, P, 6), { tone: "faint" }) + `<g class="bx-cavity"><path class="iso-shade" data-shade="0" d="${mouth}"/></g>` + L(mouth, { tone: "lo" }) + L(lip, { tone: "faint" }) }) +
    L(screws.map(([x, y]) => k.ring(x, y, 1.6, PLINTH_TOP, P, 14)).join(""), { tone: "lo" }) +
    D(screws.map(([x, y]) => at([x, y, PLINTH_TOP])), { size: 0.45 }) +
    S(k.cylinder(dx, dy, DIAL.r, PLINTH_TOP, 0.6, P, 48, 0.3), { tone: "lo" }) +
    L(k.ring(dx, dy, DIAL.r - 0.6, PLINTH_TOP + 0.6, P, 48), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(mark(DB_CAP), { tone: "hi" }) +
    S(k.cylinder(dx, dy, 4.2, PLINTH_TOP + 0.6, 5, P, 32, 0.4), { tone: "hi", crease: "lo", inner: L(k.knurl(dx, dy, 4.2, PLINTH_TOP + 1.1, PLINTH_TOP + 5, 28, P), { tone: "lo" }) }) +
    L(k.ring(dx, dy, 0.9, PLINTH_TOP + 5.6, P, 12), { tone: "mid" }) +
    `<path class="iso-line" data-tone="hi" data-free="end" data-ref="limit" d="${k.lineOnTop([dx, dy - 0.9], [dx, dy - 3.6], PLINTH_TOP + 5.6, P)}"/>`;
  put({ name: "rl.plinth", layer: "back", at: [cx, cy, 0], svg: plinth, shapes: [A.slab(LP, 0, PLINTH_TOP), A.cylinder(dx, dy, DIAL.r, PLINTH_TOP, 0.6), A.cylinder(dx, dy, 4.2, PLINTH_TOP + 0.6, 5)] });
  const FC = VERT(cx, cy);
  const collar = S(k.cylinder(cx, cy, 12.5, PLINTH_TOP, 3, P, 56, 0.4), { tone: "lo" }) + D(G.dotsOf(FC, PLINTH_TOP + 3, 10.6, 8, P, { all: true, phase: 0.4 }), { size: 0.42 });
  const column = S(k.cylinder(cx, cy, COLUMN_R, PLINTH_TOP + 3, HEAD_Z - 7 - PLINTH_TOP - 3, P, 48), { tone: "mid", crease: "none", inner: L([24, 29].map((z) => k.sideArc(cx, cy, COLUMN_R, z, P, 32)).join(""), { tone: "faint" }) });
  const CONE = [[HEAD_Z - 7, COLUMN_R], [HEAD_Z, DRUM_R - 1.5]];
  const cone = S(G.solidOf(CONE, FC, P, { rims: "none" }), { tone: "mid", crease: "none" });
  put({ name: "rl.column", layer: "back", at: [cx, cy, PLINTH_TOP], svg: collar + column + cone, shapes: [A.cylinder(cx, cy, 12.5, PLINTH_TOP, 3), A.cylinder(cx, cy, COLUMN_R, PLINTH_TOP + 3, HEAD_Z - 7 - PLINTH_TOP - 3), A.solid(FC, CONE, { name: "rl.cone" })] });
  // the head: a drum with a ring of stops the arms pass over, read like a turnstile's housing
  const drum = S(k.cylinder(cx, cy, DRUM_R, HEAD_Z, DRUM_TOP - HEAD_Z, P, 80, 0.5), { tone: "mid", crease: "lo", inner: L(k.sideArc(cx, cy, DRUM_R, HEAD_Z + 4, P, 48), { tone: "faint" }) });
  const deck = S(k.cylinder(cx, cy, 19, DRUM_TOP, DECK_TOP - DRUM_TOP, P, 80, 0.4), { tone: "lo" });
  const rim = L(k.ring(cx, cy, 16.5, DECK_TOP, P, 96), { tone: "faint" });
  const studs = D(G.dotsOf(VERT(cx, cy), DECK_TOP, 17.8, 24, P, { all: true, phase: 0.13 }), { size: 0.42 });
  const boss = S(k.cylinder(cx, cy, 4.6, DECK_TOP, ROTOR_Z0 - DECK_TOP, P, 32), { tone: "lo" });
  put({ name: "rl.head", layer: "back", at: [cx, cy, HEAD_Z], svg: drum + deck + rim + studs + boss, shapes: [A.cylinder(cx, cy, DRUM_R, HEAD_Z, DRUM_TOP - HEAD_Z), A.cylinder(cx, cy, 19, DRUM_TOP, DECK_TOP - DRUM_TOP), A.cylinder(cx, cy, 4.6, DECK_TOP, ROTOR_Z0 - DECK_TOP)] });
  return { left: (y = 0) => [LP.x, y, PIPE_Z], right: (y = 0) => [LP.x + LP.w, y, PIPE_Z] };
}

// ---------- the reject bin under the slot, with a meter for the share turned away ----------
export const METER = { n: 10 };
function bin() {
  const top = BIN_H;
  const inner = k.insetPlan(BIN, 1.3);
  const front = BIN.y + BIN.d;
  // an open bin: the inner back and left walls and the floor seen over the rim
  const floorZ = 1.4;
  const back = W.poly([[inner.x, inner.y, top], [inner.x + inner.w, inner.y, top], [inner.x + inner.w, inner.y, floorZ], [inner.x, inner.y, floorZ]]);
  const left = W.poly([[inner.x, inner.y, top], [inner.x, inner.y + inner.d, top], [inner.x, inner.y + inner.d, floorZ], [inner.x, inner.y, floorZ]]);
  const floor = W.poly([[inner.x, inner.y, floorZ], [inner.x + inner.w, inner.y, floorZ], [inner.x + inner.w, inner.y + inner.d, floorZ], [inner.x, inner.y + inner.d, floorZ]]);
  const hole = k.planOutline(inner, top, P, 3);
  const clip = `rl-bin-${theme}`;
  const segW = (BIN.w - 6) / METER.n;
  const segs = [];
  for (let i = 0; i < METER.n; i++) {
    const x0 = BIN.x + 3 + i * segW + 0.25;
    const ring = W.poly([[x0, front, 2.4], [x0 + segW - 0.5, front, 2.4], [x0 + segW - 0.5, front, 5.6], [x0, front, 5.6]]);
    segs.push(`<path class="rl-seg" data-seg="${i}" d="${ring}"/>` + L(ring, { tone: "lo" }));
  }
  const strip = W.poly([[BIN.x + 2.4, front, 1.8], [BIN.x + BIN.w - 2.4, front, 1.8], [BIN.x + BIN.w - 2.4, front, 6.2], [BIN.x + 2.4, front, 6.2]]);
  const svg =
    S(k.slabOf(BIN, 0, top, P, 3, 0.4), { tone: "mid", inner: L(strip, { tone: "faint" }) + segs.join("") }) +
    `<defs><clipPath id="${clip}"><path d="${hole}"/></clipPath></defs><g clip-path="url(#${clip})" class="bx-cavity"><path class="iso-shade" data-shade="1" d="${floor}"/><path class="iso-shade" data-shade="3" d="${back}"/><path class="iso-shade" data-shade="2" d="${left}"/></g>` +
    L(hole, { tone: "lo" });
  put({ name: "rl.bin", layer: "back", at: [BIN.x + BIN.w / 2, BIN.y + BIN.d / 2, 0], svg, shapes: [A.slab(BIN, 0, top, { cut: [A.box([inner.x, inner.y, floorZ], [inner.x + inner.w, inner.y + inner.d, top + 0.01])] })] });
}

// ---------- the turnstile rotor: the one part that turns ----------
export const T = turning(P, { recorder: R });
const rotor = T.group("rotor", { turn: { pivot: TC } });
const live = T.layer("rotor");
T.stack(["back", "grille", "rotor"]);
export const poses = () => Array.from({ length: 720 }, (_, i) => ({ rotor: i * 0.5 }));
const ringD = (r, steps) => Array.from({ length: steps }, (_, j) => `${j ? "L" : "M"}${(r * Math.cos((j / steps) * Math.PI * 2)).toFixed(3)} ${(r * Math.sin((j / steps) * Math.PI * 2)).toFixed(3)}`).join("") + "Z";
const HUB_R = 5.6;
const ARM = [HUB_R, 15.2];
const POST_R = 1.9;
function rotorParts() {
  const [cx, cy] = TC;
  const H = { group: rotor, layer: live };
  T.round({ name: "rotor.hub", ...H, F: VERT(cx, cy), s0: ROTOR_Z0, s1: ROTOR_Z0 + 6, r: HUB_R, tone: "hi", crease: "lo", material: "steel", details: { seams: [ROTOR_Z0 + 1.1] } });
  const cap = T.round({ name: "rotor.cap", ...H, F: VERT(cx, cy), s0: ROTOR_Z0 + 6, s1: ROTOR_Z0 + 8.2, r: 3.6, tone: "hi", crease: "lo", material: "brass", details: { ribs: { s0: ROTOR_Z0 + 6, s1: ROTOR_Z0 + 8.2, count: 40, fade: [0.08, 0.5], tone: "lo" } } });
  T.plane({ part: cap, o: [cx, cy, ROTOR_Z0 + 8.2], u: [1, 0, 0], v: [0, 1, 0], svg: `<path class="iso-line" data-tone="mid" d="${ringD(0.9, 16)}"/><path class="iso-line" data-tone="hi" d="M0.9 0L3.6 0"/>` });
  for (let i = 0; i < 3; i++) {
    const a = rad(i * 120);
    const u = [Math.cos(a), Math.sin(a), 0];
    const v = [-Math.sin(a), Math.cos(a), 0];
    // the arm's inner end is tangent to the hub, its outer end tangent to its post
    T.prism({ name: `rotor.arm.${i}`, ...H, F: { o: [cx, cy, 0], a: [0, 0, 1], u, v }, polygon: [[ARM[0], -1.5], [ARM[1], -1.5], [ARM[1], 1.5], [ARM[0], 1.5]], s0: ROTOR_Z0 + 1.8, s1: ROTOR_Z0 + 4.2, steps: 2, bevel: 0.25, tone: "hi", crease: "lo", material: "steel" });
    const tip = [cx + (ARM[1] + POST_R) * u[0], cy + (ARM[1] + POST_R) * u[1]];
    T.round({ name: `rotor.post.${i}`, ...H, F: VERT(tip[0], tip[1]), s0: ROTOR_Z0 + 1.2, s1: ROTOR_Z0 + 4.8, r: POST_R, tone: "mid", crease: "lo", material: "gunmetal", details: { seams: [ROTOR_Z0 + 2.2, ROTOR_Z0 + 3.8] } });
  }
}

// ---------- build ----------
const { halo } = W.bench(BENCH, { label: { x: -152, y: 82, w: 66, d: 20, r: 2 }, ruler: { x: -152, y: 128, w: 160, d: 7, r: 1 } });
const gen = W.generator(GEN, { rpsMax: RPS_MAX, marks: [DB_CAP, API_CAP] });
const rl = tower();
bin();
rotorParts();
const api = chassis(W, { id: "api", name: "api", plan: API, count: 2, lamp: false });
const db = W.database({ id: "db", plinth: DBP });
W.conduit("pipe.feed", [gen.right(0), rl.left(0)], [1, 0, 0], [-1, 0, 0]);
W.conduit("pipe.admit", [rl.right(0), api.left(0)], [1, 0, 0], [-1, 0, 0]);
W.conduit("pipe.query", [api.front(44), db.back(44)], [0, 1, 0], [0, -1, 0]);

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
const CSS = `.rl-seg{fill:var(--anatomy-lit);stroke:none;opacity:var(--rl-on,0)}`;
const page = W.page({
  title: "Rate limited API",
  fig: "Fig 8",
  hint: "Drag across · ← → load · ↑ ↓ limit",
  readout: `${fmt(PRESET.rps)} rps · limit ${fmt(LIMIT)} · 55% turned away · db 18%`,
  keys: [
    { mark: "lit", label: "The reject meter: the share turned away" },
    { mark: "raised", label: "The turnstile: the rate limiter, turning at the admitted rate" },
    { mark: "flat", label: "Window heat: utilization" },
  ],
  caption: `The limiter admits up to its limit and turns the rest away before it costs anything: at the preset's ${fmt(PRESET.rps)} rps and ${fmt(LIMIT)} limit, 55% drops into the bin. It only protects what sits behind it if the limit is below their capacity. Raise it past Postgres's ${fmt(DB_CAP)} rps and Postgres saturates anyway. The numbers come from the Workbench's own queueing engine running the Rate Limited API preset with the limit you set.`,
  label: "A rate limiter on a bench. A load generator feeds a turnstile tower whose arms turn at the rate it admits; requests over the limit drop through a slot into a reject bin, whose meter shows the share turned away. Admitted requests go on to an API chassis with two server windows and then a Postgres drum. A window in each box glows with how hard it is working.",
  width: WIDTH,
  height: HEIGHT,
  stack: ["back", "canvas", "grille", "rotor"],
  liveLayers: ["rotor"],
  layerOf,
  out,
  halo,
  verify,
  css: CSS,
  stageAttrs: { role: "slider", "aria-label": `Rate limited API: drag across the figure or use the left and right arrow keys to set the load, up and down to set the limit, Home for the preset's ${PRESET.rps} requests per second`, "aria-valuemin": 0, "aria-valuemax": RPS_MAX, "aria-valuenow": PRESET.rps, "aria-valuetext": `${PRESET.rps} requests per second, limit ${LIMIT}` },
  data: { preset: { nodes: PRESET.nodes, edges: PRESET.edges, rps: PRESET.rps }, rpsMax: RPS_MAX, limit: LIMIT, limitMax: LIMIT_MAX, limitDial: LIMIT_DIAL, meter: METER, heat: api.heat },
  truthCode: TRUTH.code,
  live: readFileSync(join(HERE, "live.js"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `rate-limited-api${verify ? "-verify" : ""}${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${R.items.length} items · ${out.report.parts} live parts · ${out.report.layers.map((l) => `${l.name}: ${l.planar} planes, ${l.dynamic} dynamic`).join(" · ")} · ${WIDTH}×${HEIGHT}`);
}
export { out };
