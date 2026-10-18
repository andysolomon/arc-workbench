// Fig 3 · Single Server. The Workbench's `single` preset as a literal bottleneck: two glass
// powder funnels in series on a retort stand. A steel hopper pours sand at the load; the upper
// funnel's neck is the API server (2,667 rps), the lower one's is Postgres (5,000 rps), and a
// beaker below catches what got served. Each funnel's heap is that node's queue, from the
// Workbench's own queueing engine run live in the page; past the API's neck the upper funnel fills
// and spills over its lip, while the lower one runs half-empty.
//
//   node figures/single-server/build.mjs [--light] [--audit] [--out=dir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import { truth } from "../lib/truth.mjs";
import { workshop } from "../lib/bench.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";
const outDir = argv.find((a) => a.startsWith("--out="))?.slice(6) ?? HERE;

// ---------- truth ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const PRESET = TRUTH.WB.PRESETS.find((p) => p.id === "single");
if (!PRESET) throw new Error("the single preset is missing from src/paradigms/presets.ts");
const capOf = (id) => { const n = PRESET.nodes.find((x) => x.id === id); return ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / n.ms; };
const API_CAP = capOf("api");
const DB_CAP = capOf("db");
export const RPS_MAX = 6000;

// ---------- the stand, in world units (z up, the funnels on the axis x = y = 0) ----------
const AZIMUTH = 62;
const ELEVATION = 30;
const PLATE = { x: -58, y: -46, w: 120, d: 92, r: 6 };
const PLATE_H = 8;
const ROD = [0, -34];
const ROD_R = 2.6;
const ROD_TOP = 204;
const RING_T = 1.1;
// a neck's bore follows its capacity (area ∝ rps): the API's is the narrower one
const DB_NECK = 2.6;
const API_NECK = +(DB_NECK * Math.sqrt(API_CAP / DB_CAP)).toFixed(2);
const BEAKER = { r: 14, top: 30 };
// lab funnels with 30° walls (a 60° cone): the radius grows by tan 30° per unit of height
const TAN = Math.tan((30 * Math.PI) / 180);
const LOWER = { id: "db", mouth: 17, rim: 84, neck: DB_NECK, tip: 40 };
const UPPER = { id: "api", mouth: 21, rim: 138, neck: API_NECK, tip: 94 };
for (const f of [LOWER, UPPER]) (f.zn = f.rim - (f.mouth - f.neck) / TAN), (f.tan = TAN);
const HOP = { r: 14, tip: 148, block: [154, 160], coneTop: 170, top: 190 };
const rOf = (f, z) => f.neck + (z - f.zn) * TAN;
const SPILL_DIR = [Math.sin((AZIMUTH * Math.PI) / 180), -Math.cos((AZIMUTH * Math.PI) / 180)]; // screen right, at the axis's depth
const LIP = { from: UPPER.mouth - 0.6, to: UPPER.mouth + 6, half: 2.4 };
const SPILL_R = UPPER.mouth + 5;
const TRAY_C = [SPILL_DIR[0] * (SPILL_R + 2), SPILL_DIR[1] * (SPILL_R + 2)];
const TRAY = { x: TRAY_C[0] - 7, y: TRAY_C[1] - 7, w: 14, d: 14, r: 2 };
const TRAY_H = 4.5;

// ---------- camera: the family's px per unit, the card cut to the stand ----------
const WIDTH = 640;
const SCALE = 2.05;
const PAD = 30;
const extremes = [...k.boxCorners(PLATE, -PLATE_H - 4, 0), [0, ROD[1], ROD_TOP + 2], [-HOP.r, 0, HOP.top + 4], [HOP.r, 0, HOP.top + 4], [SPILL_DIR[0] * (SPILL_R + 1), SPILL_DIR[1] * (SPILL_R + 1), UPPER.rim], [-UPPER.mouth, 0, UPPER.rim], [0, UPPER.mouth, UPPER.rim], [24, 0, 160]];
const unit = { origin: [0, 0], scale: 1, azimuth: AZIMUTH, elevation: ELEVATION };
const flat = extremes.map((p) => k.iso(p, unit));
const xs = flat.map(([x]) => x);
const ys = flat.map(([, y]) => y);
const HEIGHT = Math.ceil((Math.max(...ys) - Math.min(...ys)) * SCALE + PAD * 2);
export const P = { origin: [WIDTH / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * SCALE, HEIGHT / 2 - ((Math.min(...ys) + Math.max(...ys)) / 2) * SCALE], scale: SCALE, azimuth: AZIMUTH, elevation: ELEVATION };
const W = workshop({ P, theme, layers: ["back"] });
const { R, at, S, L, D, VERT, put, byDepth } = W;
const AXIS = VERT(0, 0);
const V = G.viewOf(P);

// ---------- base plate, feet, ruler, label ----------
function plate() {
  const z0 = -PLATE_H;
  for (const [x, y] of byDepth(k.corners(PLATE, 10))) {
    const svg = S(k.cylinder(x, y, 5, z0 - 4, 4, P, 24), { tone: "lo" });
    put({ name: `stand.foot.${x}.${y}`, layer: "back", at: [x, y, z0 - 4], svg, shapes: [A.cylinder(x, y, 5, z0 - 4, 4, { ground: true })] });
  }
  const screws = k.corners(PLATE, 5.5);
  const svg =
    S(k.slabOf(PLATE, z0, PLATE_H, P, 6, 1.4), { tone: "mid", inner: L(k.sideSeam(PLATE, z0 + 2.6, P, 6), { tone: "faint" }) }) +
    L(k.planOutline(k.insetPlan(PLATE, 3.6), 0, P, 6), { tone: "lo" }) +
    L(screws.map(([x, y]) => k.ring(x, y, 1.8, 0, P, 14)).join(""), { tone: "lo" }) +
    D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.45 });
  put({ name: "stand.plate", layer: "back", at: [0, 0, z0], bias: -400, svg, shapes: [A.slab(PLATE, z0, PLATE_H, { ground: true })] });
  W.rulerStrip({ x: PLATE.x + 10, y: PLATE.y + PLATE.d - 11, w: 100, d: 6, r: 1 });
  W.labelPlate({ x: PLATE.x + 8, y: PLATE.y + 16, w: 34, d: 18, r: 1.6 });
}

// ---------- the rod, its boss heads, arms and ring clamps ----------
const OWN = { owner: "stand.rod" };
// the rod passes through each boss head, so it is drawn in segments between them
function rod(bosses) {
  const [x, y] = ROD;
  const foot = S(k.cylinder(x, y, 6.5, 0, 2.2, P, 32, 0.4), { tone: "lo" }) + D([at([x + 4.6, y, 2.2]), at([x - 4.6, y, 2.2])], { size: 0.42 });
  put({ name: "stand.rod.foot", layer: "back", at: [x, y, 0], svg: foot, shapes: [A.cylinder(x, y, 6.5, 0, 2.2, OWN)] });
  const cuts = [2.2, ...bosses.flatMap((z) => [z - 4, z + 4]), ROD_TOP];
  for (let i = 0; i < cuts.length; i += 2) {
    const [z0, z1] = [cuts[i], cuts[i + 1]];
    const cap = i === cuts.length - 2 ? S(k.cylinder(x, y, ROD_R + 0.5, ROD_TOP, 1.4, P, 28, 0.3), { tone: "hi", crease: "lo" }) : "";
    const shapes = [A.cylinder(x, y, ROD_R, z0, z1 - z0, OWN), ...(cap ? [A.cylinder(x, y, ROD_R + 0.5, ROD_TOP, 1.4, OWN)] : [])];
    put({ name: `stand.rod.${i / 2}`, layer: "back", at: [x, y, (z0 + z1) / 2], svg: S(k.cylinder(x, y, ROD_R, z0, z1 - z0, P, 28), { tone: "mid", crease: "none" }) + cap, shapes });
  }
}
// a boss head on the rod at height zc with an arm to a ring of radius rho (tube RING_T) round the axis
function clamp(name, zc, rho, host, wall = 0) {
  const [x, y] = ROD;
  const boss = { x: x - 4, y: y - 4.5, w: 8, d: 9, r: 1 };
  const bossSvg = S(k.slabOf(boss, zc - 4, 8, P, 3, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideSeam(boss, zc - 1.4, P, 3), { tone: "faint" }) });
  const FS = G.frameOf([x + 4, y, zc], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const screw = S(G.disc(0, 2.4, 1.1, FS, P), { tone: "mid", crease: "lo" }) + S(G.disc(2.4, 5, 2.4, FS, P), { tone: "hi", crease: "lo", inner: k.fadedSvg(G.ribsOf(FS, 2.4, 5, 2.4, 20, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
  put({ name: `${name}.boss`, layer: "back", at: [x, y, zc - 4], svg: bossSvg + screw, shapes: [A.slab(boss, zc - 4, 8, OWN), A.disc(FS, 0, 2.4, 1.1, OWN), A.disc(FS, 2.4, 5, 2.4, OWN)] });
  // the arm runs from inside the boss to the ring's back, just into the ring's tube
  const FA = G.frameOf([0, 0, zc], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const s0 = boss.y + boss.d;
  const s1 = -(rho + RING_T) + 0.2;
  put({ name: `${name}.arm`, layer: "back", at: [0, (s0 + s1) / 2, zc], svg: S(G.disc(s0, s1, RING_T, FA, P), { tone: "mid", crease: "none" }), shapes: [A.disc(FA, s0, s1, RING_T, OWN)] });
  // the ring: a closed tube round the axis, resting on its host
  const points = Array.from({ length: 72 }, (_, i) => [rho * Math.cos(-Math.PI / 2 + (i / 72) * Math.PI * 2), rho * Math.sin(-Math.PI / 2 + (i / 72) * Math.PI * 2), zc]);
  const route = `${name}.ring`;
  R.route(route, points, RING_T, { closed: true, touch: [host, `${name}.arm`], owner: route });
  // break the ring where it passes from behind its host to in front: at the host's silhouette, where
  // the host's wall (leaning `wall` from vertical) turns edge-on: cos(θ − facing) = tan(wall)·tan(elevation)
  const facing = Math.atan2(V[1], V[0]);
  const side = Math.acos(Math.min(1, Math.tan(wall) * Math.tan((ELEVATION * Math.PI) / 180)));
  const arcAt = (theta) => rho * ((((theta + Math.PI / 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
  const breaks = [facing + side, facing - side].map(arcAt).sort((p, q) => p - q);
  tubePieces(points, RING_T, P, { maxLength: 9, closed: true, breaks }).forEach((part, index) =>
    R.put({ name: `${route}:${index}`, layer: "back", at: part.mid, svg: tubeSvg(part, { tone: "mid" }), route, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
  );
}

// ---------- a glass powder funnel: tint, contents (live), edges, rim ----------
const ringPts = (F, s, r, n = 64) => Array.from({ length: n + 1 }, (_, i) => at(G.pointOf(F, s, r, (i / n) * Math.PI * 2)));
const shineAt = (() => {
  // the shine sits on the near side, toward the light: the generator a third of the way from the left limb
  const facing = (a) => Math.cos(a) * V[0] + Math.sin(a) * V[1];
  let best = 0;
  let score = -Infinity;
  for (let a = 0; a < Math.PI * 2; a += 0.01) {
    const f = facing(a);
    const side = Math.cos(a) * -V[1] + Math.sin(a) * V[0];
    const s = f > 0.4 ? -Math.abs(side + 0.55) : -9;
    if (s > score) (score = s), (best = a);
  }
  return best;
})();
export const FUNNELS = [];
function funnel(f, { lit = false, lip = false } = {}) {
  const profile = [[f.tip, f.neck], [f.zn, f.neck], [f.rim, f.mouth]];
  const paths = G.solidOf(profile, AXIS, P, { rims: "none" });
  const tint = `<path class="ss-glass" d="${paths.fill}"/>`;
  const limbs = G.silhouetteOf(profile, AXIS, P);
  const shine = k.pathOf([...[f.rim, f.zn, f.tip].map((z) => at(G.pointOf(AXIS, z, z >= f.zn ? f.neck + (z - f.zn) * TAN : f.neck, shineAt)))]);
  const rim = k.pathOf(ringPts(AXIS, f.rim, f.mouth), true) + k.pathOf(ringPts(AXIS, f.rim, f.mouth - 0.7), true);
  const tip = k.pathOf(ringPts(AXIS, f.tip, f.neck, 24), true);
  const collar = S(G.disc(f.zn - 1.6, f.zn + 1, f.neck + 1, AXIS, P), { tone: lit ? "hi" : "mid", crease: "lo", lit });
  let lipSvg = "";
  const shapes = [A.solid(AXIS, profile, { name: `funnel.${f.id}`, owner: `funnel.${f.id}` }), A.disc(AXIS, f.zn - 1.6, f.zn + 1, f.neck + 1, { name: `funnel.${f.id}.collar`, owner: `funnel.${f.id}` })];
  if (lip) {
    const [ux, uy] = SPILL_DIR;
    const [vx, vy] = [-uy, ux];
    const ring = [[LIP.from, -LIP.half], [LIP.to, -LIP.half * 0.62], [LIP.to, LIP.half * 0.62], [LIP.from, LIP.half]].map(([s, t]) => [ux * s + vx * t, uy * s + vy * t]);
    lipSvg = `<path class="ss-glass" d="${k.extrude(ring, f.rim - 0.9, 0.9, P).fill}"/>` + L(k.extrude(ring, f.rim - 0.9, 0.9, P).outline, { tone: "mid" });
    shapes.push(A.extruded(ring, f.rim - 0.9, 0.9, { name: `funnel.${f.id}.lip`, owner: `funnel.${f.id}` }));
  }
  const front = L(limbs, { tone: "mid" }) + L(rim, { tone: "mid" }) + L(tip, { tone: "lo" }) + `<path class="ss-shine" d="${shine}"/>` + lipSvg;
  FUNNELS.push({ ...f });
  put({
    name: `funnel.${f.id}`,
    layer: "back",
    at: [0, 0, (f.tip + f.rim) / 2],
    svg: `<g class="ss-funnel">${tint}<g class="ss-sand" data-heap="${f.id}"></g><g data-slot="in.${f.id}"></g>${front}${collar}<g data-slot="air.${f.id}"></g></g>`,
    shapes,
  });
}

// ---------- the beaker: what got served ----------
function beaker() {
  const profile = [[0, BEAKER.r], [BEAKER.top, BEAKER.r]];
  const paths = G.solidOf(profile, AXIS, P, { rims: "none" });
  const limbs = G.silhouetteOf(profile, AXIS, P);
  const rim = k.pathOf(ringPts(AXIS, BEAKER.top, BEAKER.r), true) + k.pathOf(ringPts(AXIS, BEAKER.top, BEAKER.r - 0.7), true);
  const base = k.pathOf(ringPts(AXIS, 0, BEAKER.r), true);
  // graduations: a printed scale on the near side, every tick rooted on its spine
  const a0 = shineAt + 0.9;
  const spine = k.pathOf([at(G.pointOf(AXIS, 0, BEAKER.r, a0)), at(G.pointOf(AXIS, BEAKER.top, BEAKER.r, a0))]);
  const ticks = [];
  for (let i = 0; i <= 8; i++) {
    const z = 3 + (i * (BEAKER.top - 6)) / 8;
    const w = i % 4 === 0 ? 0.17 : 0.1;
    ticks.push(k.pathOf(Array.from({ length: 5 }, (_, j) => at(G.pointOf(AXIS, z, BEAKER.r, a0 + (w * j) / 4)))));
  }
  const shine = k.pathOf([at(G.pointOf(AXIS, BEAKER.top, BEAKER.r, shineAt)), at(G.pointOf(AXIS, 0, BEAKER.r, shineAt))]);
  // a pouring spout on the rim, away from the scale
  const spoutA = a0 + Math.PI * 0.95;
  const [ux, uy] = [Math.cos(spoutA), Math.sin(spoutA)];
  const ring = [[BEAKER.r - 0.6, -2.2], [BEAKER.r + 2, -1.2], [BEAKER.r + 2, 1.2], [BEAKER.r - 0.6, 2.2]].map(([s, t]) => [ux * s - uy * t, uy * s + ux * t]);
  const spout = k.extrude(ring, BEAKER.top - 0.8, 0.8, P);
  const front = L(limbs, { tone: "mid" }) + L(rim, { tone: "mid" }) + L(spine + ticks.join(""), { tone: "lo" }) + `<path class="ss-shine" d="${shine}"/>` + `<path class="ss-glass" d="${spout.fill}"/>` + L(spout.outline, { tone: "mid" });
  put({
    name: "beaker",
    layer: "back",
    at: [0, 0, 0],
    svg: `<g class="ss-funnel"><path class="ss-glass" d="${paths.fill}"/>${L(base, { tone: "faint" })}<g class="ss-sand" data-heap="served"></g><g data-slot="in.served"></g>${front}<g data-slot="air.served"></g></g>`,
    shapes: [A.solid(AXIS, profile, { name: "beaker", owner: "beaker" }), A.extruded(ring, BEAKER.top - 0.8, 0.8, { name: "beaker.spout", owner: "beaker" })],
  });
}

// ---------- the spill tray: what the API turned away ----------
function tray() {
  const z = 0;
  const floor = S(k.slabOf(TRAY, z, 0.9, P, 3, 0.3), { tone: "lo" });
  const walls = [
    { x: TRAY.x, y: TRAY.y, w: TRAY.w, d: 0.9, r: 0.3 },
    { x: TRAY.x, y: TRAY.y + TRAY.d - 0.9, w: TRAY.w, d: 0.9, r: 0.3 },
    { x: TRAY.x, y: TRAY.y + 0.9, w: 0.9, d: TRAY.d - 1.8, r: 0.3 },
    { x: TRAY.x + TRAY.w - 0.9, y: TRAY.y + 0.9, w: 0.9, d: TRAY.d - 1.8, r: 0.3 },
  ];
  const back = [walls[0], walls[2]];
  const near = [walls[1], walls[3]];
  const wallSvg = (list) => list.map((w) => S(k.slabOf(w, z + 0.9, TRAY_H - 0.9, P, 2, 0.2), { tone: "mid", crease: "lo" })).join("");
  put({
    name: "tray",
    layer: "back",
    at: [TRAY_C[0], TRAY_C[1], z],
    svg: floor + wallSvg(back) + `<g class="ss-sand" data-heap="spill"></g><g data-slot="in.spill"></g>` + wallSvg(near),
    shapes: [A.slab(TRAY, z, 0.9), ...walls.map((w) => A.slab(w, z + 0.9, TRAY_H - 0.9))],
  });
}

// ---------- the feed hopper: the clients, and the gate that sets the load ----------
export const KNOB = { c: [17.5, 0], z: HOP.block[1] - 1.6, r0: 1, r1: 5, from: (-135 * Math.PI) / 180, span: (270 * Math.PI) / 180 };
export const WHEEL = { c: [0, 6.6, (HOP.block[0] + HOP.block[1]) / 2], rIn: 4.5, rOut: 5.6, hub: 1.4 };
function hopper() {
  const F = AXIS;
  const spout = S(G.disc(HOP.tip, HOP.block[0], 2.2, F, P), { tone: "mid", crease: "lo" }) + L(k.pathOf(ringPts(F, HOP.tip, 1.3, 20), true), { tone: "lo" });
  const block = { x: -5, y: -5, w: 10, d: 10, r: 1 };
  const blockSvg = S(k.slabOf(block, HOP.block[0], HOP.block[1] - HOP.block[0], P, 3, 0.4), { tone: "mid", crease: "lo", inner: L(k.sideSeam(block, HOP.block[0] + 1.6, P, 3), { tone: "faint" }) });
  // the handwheel on the gate's front: its spokes turn with the gate (live)
  const FW = G.frameOf([0, 5, WHEEL.c[2]], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const shaft = S(G.disc(0, 1.6, 0.8, FW, P), { tone: "mid" });
  const wheel = S(G.ringBand(1.6, 2.6, WHEEL.rIn, WHEEL.rOut, FW, P), { tone: "hi", crease: "lo" }) + S(G.disc(1.6, 2.6, WHEEL.hub, FW, P), { tone: "hi", crease: "lo" }) + `<path class="iso-line" data-tone="mid" data-ref="spokes" d=""/>`;
  // the load dial on a bracket to the right
  const [dx, dy] = KNOB.c;
  const bracket = { x: 5, y: -2, w: dx - 5 - 5, d: 4, r: 0.6 };
  const zt = KNOB.z;
  const bracketSvg = S(k.slabOf(bracket, zt - 2.4, 1.6, P, 2, 0.2), { tone: "mid", crease: "lo" });
  const ticks = k.radialTicks(dx, dy, 6, 30, 5, zt, [0.9, 1.8], P, KNOB.from, KNOB.span);
  const mark = (rps) => {
    const a = KNOB.from + (rps / RPS_MAX) * KNOB.span;
    return k.lineOnTop([dx + Math.sin(a) * 3.8, dy - Math.cos(a) * 3.8], [dx + Math.sin(a) * 6, dy - Math.cos(a) * 6], zt, P);
  };
  const dial = S(k.cylinder(dx, dy, 7, zt - 0.8, 0.8, P, 48, 0.3), { tone: "hi", crease: "lo" }) + L(k.ring(dx, dy, 6, zt, P, 48), { tone: "lo" }) + L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" }) + L(mark(API_CAP) + mark(DB_CAP), { tone: "hi" }) + L(k.ring(dx, dy, 1, zt, P, 12), { tone: "mid" }) + `<path class="iso-line" data-tone="hi" data-free="end" data-ref="knob" d="${k.lineOnTop([dx, dy - 1], [dx, dy - 5], zt, P)}"/>`;
  put({
    name: "hopper.gate",
    layer: "back",
    at: [0, 0, HOP.block[0]],
    svg: spout + blockSvg + shaft + wheel + bracketSvg + dial,
    shapes: [A.disc(F, HOP.tip, HOP.block[0], 2.2), A.slab(block, HOP.block[0], HOP.block[1] - HOP.block[0]), A.disc(FW, 0, 1.6, 0.8), A.disc(FW, 1.6, 2.6, WHEEL.rOut), A.slab(bracket, zt - 2.4, 1.6), A.cylinder(dx, dy, 7, zt - 0.8, 0.8)],
  });
  // the canister: a steel can on a cone that narrows to the gate
  const CAN = [[HOP.block[1], 2.2], [HOP.coneTop, HOP.r], [HOP.top, HOP.r]];
  const seams = [HOP.coneTop + 6, HOP.top - 5].map((z) => G.arcOf(F, z, HOP.r, P)).join("");
  const can = S(G.solidOf(CAN, F, P), { tone: "hi", crease: "lo", inner: L(seams, { tone: "faint" }) });
  const lid = S(k.cylinder(0, 0, HOP.r + 0.8, HOP.top, 1.6, P, 72, 0.4), { tone: "mid", crease: "lo" }) + S(k.cylinder(0, 0, 3.4, HOP.top + 1.6, 2.4, P, 28, 0.3), { tone: "hi", crease: "lo", inner: L(k.knurl(0, 0, 3.4, HOP.top + 1.6, HOP.top + 4, 24, P), { tone: "lo" }) }) + D(G.dotsOf(F, HOP.top + 1.6, HOP.r - 1.4, 10, P, { all: true, phase: 0.3 }), { size: 0.42 });
  put({ name: "hopper.can", layer: "back", at: [0, 0, HOP.block[1]], svg: can + lid, shapes: [A.solid(F, CAN, { name: "hopper.can" }), A.cylinder(0, 0, HOP.r + 0.8, HOP.top, 1.6), A.cylinder(0, 0, 3.4, HOP.top + 1.6, 2.4)] });
}

// ---------- the spill: a column beside the stand, live ----------
function spillSlot() {
  const [sx, sy] = [SPILL_DIR[0] * SPILL_R, SPILL_DIR[1] * SPILL_R];
  put({ name: "spill", layer: "back", at: [sx, sy, 80], svg: `<g data-slot="air.spill"></g>`, shapes: [A.cylinder(sx, sy, 0.8, TRAY_H, UPPER.rim - 0.4 - TRAY_H, { name: "spill.column" })] });
}

// ---------- build ----------
plate();
beaker();
tray();
funnel(LOWER);
funnel(UPPER, { lit: true, lip: true });
hopper();
spillSlot();
// a ring tangent to the cone from outside: its tube's centre sits one tube radius off the wall, along the wall's normal
const COS = Math.cos(Math.atan(TAN));
const SIN = Math.sin(Math.atan(TAN));
const ringZ = (f, zs) => ({ z: zs - (RING_T + 0.1) * SIN, rho: rOf(f, zs) + (RING_T + 0.1) * COS });
const lowRing = ringZ(LOWER, LOWER.rim - 10);
const upRing = ringZ(UPPER, UPPER.rim - 12);
clamp("clamp.db", lowRing.z, lowRing.rho, "funnel.db", Math.atan(TAN));
clamp("clamp.api", upRing.z, upRing.rho, "funnel.api", Math.atan(TAN));
clamp("clamp.hopper", HOP.top - 9, HOP.r + RING_T + 0.1, "hopper.can");
rod([lowRing.z, upRing.z, HOP.top - 9]);

const { layerOf } = W.finish();
if (argv.includes("--audit")) A.auditOrExit(R, P);

// ---------- page ----------
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const inlineLathe = () => {
  const src = readFileSync(join(HERE, "../kit/lathe.mjs"), "utf8");
  const names = [...src.matchAll(/^export (?:const|function) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  return `const G = (() => {\n${src.replace(/^import .*$/m, "").replace(/^export /gm, "")}\nreturn { ${names.join(", ")} };\n})();\n`;
};
const page = W.page({
  title: "Single server",
  fig: "Fig 3",
  hint: "Drag across · ← → load",
  readout: `${PRESET.rps} rps · api 11% · db 6%`,
  keys: [
    { mark: "lit", label: `The narrowest neck: the API server's ${fmt(API_CAP)} rps` },
    { mark: "raised", label: "Sand in a funnel: that node's queue" },
    { mark: "dotted", label: "Over the lip: requests that fail" },
  ],
  caption: `One API server (${fmt(API_CAP)} rps) in front of one Postgres (${fmt(DB_CAP)} rps), as two funnels in series: each neck passes what its node can serve. The narrower neck is the whole system's ceiling. Past ${fmt(API_CAP)} rps the upper funnel fills and spills while the lower one runs half-empty, because Postgres never sees more than the server lets through. With one of each, either failing is a full outage. The numbers come from the Workbench's own queueing engine running the Single Server preset.`,
  label: "A single server as two glass funnels in series on a retort stand. A steel hopper with a gate and a handwheel pours sand at the load into the upper funnel, whose narrow neck is the API server; it drains into the lower funnel, Postgres, and on into a beaker. Sand piles in a funnel when more arrives than its neck passes, and over the top it spills into a tray beside the stand.",
  width: WIDTH,
  height: HEIGHT,
  stack: ["back"],
  layerOf,
  stageAttrs: { role: "slider", "aria-label": "Single server: drag across the figure or use the arrow keys to set the load, Home for the preset's 300 requests per second", "aria-valuemin": 0, "aria-valuemax": RPS_MAX, "aria-valuenow": PRESET.rps, "aria-valuetext": `${PRESET.rps} requests per second` },
  css: readFileSync(join(HERE, "figure.css"), "utf8"),
  data: {
    preset: { nodes: PRESET.nodes, edges: PRESET.edges, rps: PRESET.rps },
    rpsMax: RPS_MAX,
    caps: { api: API_CAP, db: DB_CAP },
    funnels: FUNNELS,
    beaker: BEAKER,
    hop: HOP,
    tray: { c: TRAY_C, floor: 0.9, h: TRAY_H, w: TRAY.w, d: TRAY.d },
    spill: { r: SPILL_R, dir: SPILL_DIR, from: UPPER.rim - 0.4 },
    dial: KNOB,
    wheel: WHEEL,
  },
  truthCode: TRUTH.code,
  live: inlineLathe() + readFileSync(join(HERE, "live.js"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `single-server${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${R.items.length} items · ${R.solids.length} solids · ${WIDTH}×${HEIGHT}`);
}
