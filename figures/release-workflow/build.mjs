// Fig 9 · Release Delivery Workflow. A bottling line for the Workbench's `release` example. One
// conveyor runs left to right through a station per step: a loader (commit), a review gantry with two
// inspectors' stamps (pull request, two approvals), a filler (build), an inspection camera with a
// reject pusher (quality gates), a hand stamping press (approve), a sampling probe with its test
// rack (canary), a capper and labeler with the label printer beside it (release, release notes) and
// a shipping crate (released). Rejected bottles are pushed onto a return conveyor in front that
// carries them back to the review gantry; a canary breach drops down a chute into the rolled-back
// bin. Bottles waiting on the belt are the changes in flight at each step, one bottle per twenty;
// the lit bottle is the engine's traced change. Everything moves by the Workbench's own token engine
// (tickWorkflow), run live at its own speed, 1 s = 20 min.
//
// Painter's order is by zone. The main bottles stand in a slab of space (y within ±2.2, z from the
// belt to their lip); every static part lies wholly below it, behind it (y), above it (z) or in front
// of it (y), and those go in the layers before and after. The return conveyor, its slides and the
// chute lie wholly in front of the main line, so they and their bottles are the last layers.
//
//   node figures/release-workflow/build.mjs [--light] [--audit] [--out=dir]
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

// ---------- truth: the Workbench example and its token engine ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const EX = TRUTH.WB.EXAMPLES.workflow.find((e) => e.id === "release");
if (!EX) throw new Error("the release example is missing from src/paradigms/examples.ts");
const byId = Object.fromEntries(EX.nodes.map((n) => [n.id, n]));
const passOf = (id) => byId[id].pass ?? 1;
const HAPPY = ["commit", "pr", "build", "qg", "approve", "canary", "release", "done"];
const HAPPY_MIN = HAPPY.reduce((s, id) => s + (byId[id].dur ?? 0), 0);
const YIELD = HAPPY.reduce((s, id) => s * passOf(id), 1);
// the engine's own steady state at the preset rate: who waits at the approval, what share rolls back
const STEADY = (() => {
  const sim = TRUTH.WB.makeParadigmSim("workflow");
  let waiting = 0;
  let n = 0;
  let rolled = 0;
  for (let i = 0; i < 24000; i++) {
    const m = TRUTH.WB.tickWorkflow(sim, EX.nodes, EX.edges, EX.rps, 0.25);
    if (i > 600) {
      waiting += sim.runs.filter((r) => r.at === "approve").length;
      rolled += m.sys.err;
      n++;
    }
  }
  return { approve: waiting / n, rolled: rolled / n };
})();
export const RATE_MAX = 100;
// the owner of each step, as the example's lanes have it: 1 developer · 2 CI · 3 release governance · 4 production
const LANES = EX.regions.filter((r) => r.variant === "lane");
const ownerOf = (id) => Math.max(0, LANES.findIndex((r) => byId[id].y + 40 >= r.y && byId[id].y + 40 < r.y + r.h)) + 1;

// ---------- camera and world ----------
const WIDTH = 640;
const HEIGHT = 300;
const FLOOR = { x: -214, y: -44, w: 324, d: 86, r: 8 };
const BT = 28; // main belt top: bottles stand here
const RT = 16; // return belt top
const BOTTLE_H = 9.4;
const ZONE = { y: 2.2, top: BT + BOTTLE_H }; // the main bottles' slab
// where each step's machine stands on the line, and where a reject leaves it
export const X = { commit: -188, pr: -138, build: -104, qg: -76, approve: -20, canary: 16, release: 46 };
const KICK = { qg: -70, approve: -14, canary: 22 };
const BELT = [-196, 70];
const RET = [-172.5, -8];
const ELEV = -178.5;
const QUEUE = { gap: 4.6, lead: 12, slots: { pr: 5, build: 2, qg: 2, approve: 8, release: 2, commit: 1 } };
export const PER = 20;

export const P = k.fitProjection([...k.boxCorners(FLOOR, -15, 0), [-20, 12, 62], [-104, -10, 60], [-188, -24, 31]], WIDTH, HEIGHT, { pad: 26, azimuth: 68, elevation: 36 });
const LAYERS = ["back", "mainB", "mainF", "ret", "retB", "retF"];
const W = workshop({ P, theme, layers: LAYERS });
const { R, at, S, L, D, put } = W;
const VERT = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const ALONG_X = { o: [0, 0, 0], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] };
const ALONG_Y = (x, z) => ({ o: [x, 0, z], a: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] });
const plan = (x0, x1, y0, y1, r = 0.4) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });
const slab = (p, z, h, style = {}, steps = 3, bevel = 0.3) => ({ svg: S(k.slabOf(p, z, h, P, steps, bevel), { tone: "mid", ...style }), shape: A.slab(p, z, h) });
const cyl = (x, y, r, z, h, style = {}, steps = 28) => ({ svg: S(k.cylinder(x, y, r, z, h, P, steps), { tone: "mid", ...style }), shape: A.cylinder(x, y, r, z, h) });
const join2 = (...parts) => ({ svg: parts.map((p) => p.svg).join(""), shapes: parts.map((p) => p.shape).filter(Boolean) });
const item = (name, layer, atPoint, parts, { bias = 0, extra = "", wrap = null } = {}) => {
  const j = join2(...parts);
  const svg = j.svg + extra;
  put({ name, layer, at: atPoint, bias, svg: wrap ? wrap(svg) : svg, shapes: j.shapes });
};
// a prism across the line (extruded along x) from a convex (y, z) polygon
const across = (x0, x1, poly, style = {}) => ({ svg: S(G.prismOf(ALONG_X, poly, x0, x1, P), { tone: "mid", ...style }), shape: A.prism(ALONG_X, poly, x0, x1) });

// ---------- a bottle: body, shoulder, neck, lip (and a cap once it is released) ----------
const bottle = (x, y, z, { tone = "hi", lit = false, cap = false } = {}) => {
  const F = VERT(x, y);
  const style = { tone, crease: "lo", lit };
  let svg = S(k.cylinder(x, y, 2, z, 5.2, P, 24), { ...style, inner: L(k.sideArc(x, y, 2, z + 1.4, P, 16) + k.sideArc(x, y, 2, z + 4, P, 16), { tone: "faint" }) });
  svg += S(G.solidOf([[z + 5.2, 2], [z + 7, 0.9]], F, P, { rims: "none" }), style);
  svg += S(k.cylinder(x, y, 0.9, z + 7, 1.8, P, 16), style);
  svg += S(k.cylinder(x, y, 1.05, z + 8.8, 0.6, P, 16), style);
  const shapes = [A.cylinder(x, y, 2, z, 5.2), A.solid(F, [[z + 5.2, 2], [z + 7, 0.9]]), A.cylinder(x, y, 0.9, z + 7, 1.8), A.cylinder(x, y, 1.05, z + 8.8, 0.6)];
  if (cap) {
    svg += S(k.cylinder(x, y, 1.2, z + 9.4, 0.8, P, 16), { tone: "mid", crease: "lo", lit });
    shapes.push(A.cylinder(x, y, 1.2, z + 9.4, 0.8));
  }
  return { svg, shapes };
};

// ---------- the floor ----------
const { halo } = W.bench(FLOOR, { h: 10, label: { x: 60, y: 22, w: 42, d: 16, r: 2 }, ruler: { x: -204, y: 33, w: 172, d: 7, r: 1 } });

// ---------- the main conveyor ----------
const LEGS = [-190, -150, -100, -50, 0, 50];
function mainConveyor() {
  for (const x of LEGS) {
    for (const [y0, y1] of [[-6, -4], [4, 6]]) {
      item(`main.leg.${x}.${y0}`, "back", [x, (y0 + y1) / 2, 0], [slab(plan(x - 2.2, x + 2.2, y0 - 1, y1 + 1), 0, 0.8, { tone: "lo" }, 2, 0.2), slab(plan(x - 1.2, x + 1.2, y0, y1, 0.3), 0.8, 22.2, {}, 2, 0.2)]);
    }
    item(`main.brace.${x}`, "back", [x, 0, 8], [slab(plan(x - 0.8, x + 0.8, -4, 4, 0.2), 8, 1.6, { tone: "lo" }, 2, 0)]);
  }
  for (const [name, y0, y1] of [["back", -6, -4], ["front", 4, 6]]) {
    const p = plan(BELT[0] - 2, BELT[1] + 2, y0, y1, 0.5);
    item(`main.beam.${name}`, "back", [(BELT[0] + BELT[1]) / 2, (y0 + y1) / 2, 23], [slab(p, 23, BT - 23, { inner: L(k.sideSeam(p, 25.4, P, 3), { tone: "faint" }) }, 3, 0.3)], { bias: name === "front" ? 2 : 0 });
  }
  const belt = plan(BELT[0], BELT[1], -4, 4, 0);
  item("main.belt", "back", [(BELT[0] + BELT[1]) / 2, 0, BT - 1], [slab(belt, BT - 1.6, 1.6, { tone: "lo", crease: "none" }, 2, 0)], { bias: 1, extra: slatsSvg(belt, BT, "main") });
  for (const x of [BELT[0] - 1.7, BELT[1] + 1.7]) {
    const F = { ...ALONG_Y(x, BT - 1.7), o: [x, -4, BT - 1.7] };
    item(`main.roller.${x}`, "back", [x, 0, BT - 1.7], [{ svg: S(G.disc(0, 8, 1.7, F, P), { tone: "mid", crease: "lo" }), shape: A.disc(F, 0, 8, 1.7) }]);
  }
}
// slats across a belt, every 4 units, clipped to the belt's top face; the live code slides them along
function slatsSvg(belt, z, id) {
  const lines = [];
  for (let x = belt.x - 4; x <= belt.x + belt.w + 4; x += 4) lines.push(k.lineOnTop([x, belt.y], [x, belt.y + belt.d], z, P));
  const clip = `rw-slat-${theme}-${id}`;
  const top = k.pathOf([at([belt.x, belt.y, z]), at([belt.x + belt.w, belt.y, z]), at([belt.x + belt.w, belt.y + belt.d, z]), at([belt.x, belt.y + belt.d, z])], true);
  return `<defs><clipPath id="${clip}"><path d="${top}"/></clipPath></defs><g clip-path="url(#${clip})"><g data-slide="${id}">${L(lines.join(""), { tone: "faint" })}</g></g>`;
}
// side guards: a rail on posts along each beam, gapped where a pusher reaches in or a bottle leaves
function guards() {
  const gaps = { front: [ELEV, KICK.qg, KICK.approve, KICK.canary], back: [KICK.qg, KICK.approve, KICK.canary] };
  for (const side of ["back", "front"]) {
    const y0 = side === "back" ? -5 : 4.1;
    const y1 = y0 + 0.9;
    const cuts = gaps[side].map((x) => [x - 5.5, x + 5.5]).sort((a, b) => a[0] - b[0]);
    const runs = [];
    let from = BELT[0] + 2;
    for (const [a, b] of cuts) {
      runs.push([from, a]);
      from = b;
    }
    runs.push([from, BELT[1] - 2]);
    runs.filter(([a, b]) => b - a > 3).forEach(([a, b], i) => {
      const parts = [slab(plan(a, b, y0, y1, 0.3), BT + 2, 0.8, { tone: "hi", crease: "lo" }, 2, 0.2)];
      const n = Math.max(1, Math.round((b - a) / 22));
      for (let j = 0; j <= n; j++) {
        const x = a + 1 + ((b - a - 2) * j) / n;
        parts.push(slab(plan(x - 0.35, x + 0.35, y0 + 0.1, y1 - 0.1, 0.15), BT, 2, { tone: "mid", crease: "none" }, 2, 0));
      }
      item(`guard.${side}.${i}`, side === "back" ? "back" : "mainF", [(a + b) / 2, (y0 + y1) / 2, BT + 1.4], parts);
    });
  }
}

// ---------- queues: one bottle per twenty changes waiting at a step ----------
export const SLOTS = {};
function queues() {
  for (const [id, count] of Object.entries(QUEUE.slots)) {
    SLOTS[id] = [];
    for (let i = 0; i < count; i++) {
      const x = X[id] - QUEUE.lead - i * QUEUE.gap;
      SLOTS[id].push(x);
      const b = bottle(x, 0, BT, { tone: "mid" });
      put({ name: `q.${id}.${i}`, layer: "mainB", at: [x, 0, BT], svg: `<g data-slot="${id}" data-i="${i}">${b.svg}</g>`, shapes: b.shapes });
    }
  }
}

// ---------- the loader (commit): a control cabinet with the line-speed knob, a feed arm over the belt start ----------
export const KNOB = { c: [-189, -23], z: 31, r0: 1, r1: 4.6, from: (-135 * Math.PI) / 180, span: (270 * Math.PI) / 180 };
function loader() {
  const cab = plan(-206, -172, -36, -11, 2);
  const front = cab.y + cab.d;
  const slot = (z) => {
    const pts = [];
    for (let j = 0; j <= 8; j++) pts.push([-180 + 0.8 * Math.sin((j / 8) * Math.PI), front, z + 0.8 * Math.cos((j / 8) * Math.PI)]);
    for (let j = 0; j <= 8; j++) pts.push([-198 - 0.8 * Math.sin((j / 8) * Math.PI), front, z - 0.8 * Math.cos((j / 8) * Math.PI)]);
    return k.pathOf(pts.map(at), true);
  };
  const [cx, cy] = KNOB.c;
  const t = k.radialTicks(cx, cy, 7.4, 20, 5, 24.6, [1, 2], P, KNOB.from, KNOB.span);
  const screws = k.corners(cab, 2.6);
  item("loader.cabinet", "back", [-189, -23, 0], [
    slab(cab, 0, 24, { inner: L(k.sideSeam(cab, 20, P, 3), { tone: "faint" }) + L([6, 9, 12].map(slot).join(""), { tone: "lo" }) }, 4, 0.8),
    cyl(cx, cy, 8.4, 24, 0.6, { tone: "lo" }, 48),
    cyl(cx, cy, 5.2, 24.6, KNOB.z - 24.6, { tone: "hi", crease: "lo", inner: L(k.knurl(cx, cy, 5.2, 24.6, KNOB.z, 32, P), { tone: "lo" }) }, 40),
  ], { extra: L(k.ring(cx, cy, 7.4, 24.6, P, 48), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(k.ring(cx, cy, 1, KNOB.z, P, 12), { tone: "mid" }) + `<path class="iso-line" data-tone="hi" data-free="end" data-ref="rate" d="${k.lineOnTop([cx, cy - 1], [cx, cy - 4.6], KNOB.z, P)}"/>` + L(screws.map(([x, y]) => k.ring(x, y, 1.1, 24, P, 10)).join(""), { tone: "lo" }) + D(screws.map(([x, y]) => at([x, y, 24])), { size: 0.4 }) });
  // the feed arm: a post on the cabinet and an arm reaching over the belt start, a gripper at its end
  item("loader.post", "back", [-180, -14, 24], [cyl(-180, -14, 1.4, 24, 16, {}, 20)]);
  item("loader.arm", "mainF", [-184, -6, 40], [slab(plan(-189.5, -178.5, -15.6, 1.4, 0.6), 40, 2.4, { tone: "hi", crease: "lo" }, 3, 0.3), slab(plan(-190.4, -185.6, -1.8, 1.8, 0.4), 38.4, 1.6, { tone: "mid" }, 2, 0.2)]);
}

// ---------- the review gantry (pull request): two portal frames, a beam and two inspectors' stamps ----------
function gantry(id, x, { stamps = [], tone = "mid" } = {}) {
  for (const px of [x - 8, x + 8]) {
    item(`${id}.post.back.${px}`, "back", [px, -8, 0], [slab(plan(px - 1, px + 1, -9, -7, 0.3), 0, 46, { tone }, 2, 0.2)]);
    item(`${id}.post.front.${px}`, "mainF", [px, 8, 0], [slab(plan(px - 1, px + 1, 7, 9, 0.3), 0, 46, { tone }, 2, 0.2)]);
    item(`${id}.top.${px}`, "mainF", [px, 0, 46], [slab(plan(px - 1.2, px + 1.2, -9.4, 9.4, 0.4), 46, 2, { tone: "hi", crease: "lo" }, 2, 0.3)]);
  }
  item(`${id}.beam`, "mainF", [x, 0, 48], [slab(plan(x - 9.2, x + 9.2, -1.4, 1.4, 0.4), 48, 1.8, { tone: "hi", crease: "lo" }, 2, 0.3)]);
  for (const sx of stamps) {
    item(`${id}.stamp.body.${sx}`, "mainF", [sx, 0, 44], [cyl(sx, 0, 1.7, 43.4, 4.6, {}, 24)]);
    // the plunger and pad drop together onto the lip (data-move); at rest they hang 2.4 clear
    item(`${id}.stamp.pad.${sx}`, "mainF", [sx, 0, 41], [cyl(sx, 0, 0.8, 40.6, 2.8, { tone: "hi" }, 16), cyl(sx, 0, 1.9, 40, 0.6, { tone: "lo" }, 24)], { wrap: (svg) => `<g data-move="${id}">${svg}</g>` });
  }
}

// ---------- the filler (build): a tank on a post, a nozzle that dips into the bottle ----------
function filler() {
  const x = X.build;
  item("filler.post", "back", [x, -11, 0], [slab(plan(x - 1.6, x + 1.6, -12.6, -9.4, 0.5), 1.2, 50.8, {}, 2, 0.3), slab(plan(x - 3.2, x + 3.2, -14.2, -7.8, 0.8), 0, 1.2, { tone: "lo" }, 2, 0.3)]);
  item("filler.arm", "mainF", [x, -7, 52], [slab(plan(x - 1.4, x + 1.4, -9.4, -5.4, 0.4), 49, 1.8, { tone: "hi", crease: "lo" }, 2, 0.2)]);
  const F = VERT(x, 0);
  const TANK = [[44, 0.9], [44, 2.6, 1], [45.2, 4.6, 1], [47, 5.4], [55, 5.4], [55.6, 5]];
  item("filler.tank", "mainF", [x, 0, 50], [{ svg: S(G.solidOf(TANK, F, P), { tone: "hi", crease: "lo", inner: L(k.sideArc(x, 0, 5.4, 51, P, 32), { tone: "faint" }) }), shape: A.solid(F, TANK) }, cyl(x, 0, 2, 55.6, 1.6, { tone: "mid" }, 24)]);
  item("filler.nozzle", "mainF", [x, 0, 41], [cyl(x, 0, 0.6, 39.4, 2, { tone: "mid" }, 16), cyl(x, 0, 1.1, 41.4, 0.8, { tone: "lo" }, 16), cyl(x, 0, 0.6, 42.2, 1.8, { tone: "mid" }, 16)], { wrap: (svg) => `<g data-move="build">${svg}</g>` });
}

// ---------- a pusher behind the line: a cylinder on a post, its rod reaches across the belt ----------
// one rod, built at full stroke and clipped at the gland (G.rodOut), so the gland face stays put
export const PUSH = 4.2;
function pusher(id, x) {
  const z = BT + 3;
  item(`${id}.pusher.post`, "back", [x, -14, 0], [slab(plan(x - 1.4, x + 1.4, -15.4, -12.6, 0.4), 0, z - 2, {}, 2, 0.2)]);
  const F = G.frameAlong([x, -17, z], [0, 1, 0]);
  item(`${id}.pusher.body`, "back", [x, -13, z], [{ svg: S(G.disc(0, 8, 2, F, P), { tone: "mid", crease: "lo", inner: L(G.arcOf(F, 1.2, 2, P) + G.arcOf(F, 6.8, 2, P), { tone: "faint" }) }), shape: A.disc(F, 0, 8, 2) }]);
  const ROD = G.rodOut(F, 8, 10.6, 0.55, P, { stroke: PUSH });
  const PLATE = G.frameAlong([x, -17 + 10.6, z], [0, 1, 0]);
  const clip = `rw-rod-${theme}-${id}`;
  const svg = `<defs><clipPath id="${clip}"><path data-hold d="${ROD.clip}"/></clipPath></defs><g clip-path="url(#${clip})">${S(ROD.paths, { tone: "hi", crease: "none" })}</g>` + S(G.disc(0, 0.6, 1.4, PLATE, P), { tone: "mid", crease: "lo" });
  put({ name: `${id}.pusher.rod`, layer: "back", at: [x, -6, z], svg: `<g data-push="${id}">${svg}</g>`, shapes: [A.slide(F, 8, 10.6, 0.55), A.disc(PLATE, 0, 0.6, 1.4)] });
}

// ---------- the inspection camera (quality gates): an arch, a camera looking down, its pass dial ----------
export const PASS_DIAL = { c: [X.qg, -5], z: 48.4, r0: 0.7, r1: 2.8, from: (-135 * Math.PI) / 180, span: (270 * Math.PI) / 180, lo: 0.5, hi: 1 };
function camera() {
  const x = X.qg;
  item("qg.post.back", "back", [x, -8, 0], [slab(plan(x - 1.1, x + 1.1, -9.2, -6.8, 0.3), 0, 44, {}, 2, 0.2)]);
  item("qg.post.front", "mainF", [x, 8, 0], [slab(plan(x - 1.1, x + 1.1, 6.8, 9.2, 0.3), 0, 44, {}, 2, 0.2)]);
  item("qg.bar", "mainF", [x, 0, 45], [slab(plan(x - 1.6, x + 1.6, -9.6, 9.6, 0.5), 44, 2.6, { tone: "hi", crease: "lo" }, 2, 0.3)]);
  const [dx, dy] = PASS_DIAL.c;
  const t = k.radialTicks(dx, dy, 2.9, 10, 5, PASS_DIAL.z, [0.6, 1.1], P, PASS_DIAL.from, PASS_DIAL.span);
  item("qg.camera", "mainF", [x, 0, 41], [
    slab(plan(x - 3, x + 3, -3, 3, 0.8), 40.4, 3.6, { tone: "mid", inner: L(k.sideSeam(plan(x - 3, x + 3, -3, 3, 0.8), 42.6, P, 3), { tone: "faint" }) }, 3, 0.3),
    cyl(x, 0, 1.6, 39.2, 1.2, { tone: "lo" }, 20),
  ], { extra: L(k.ring(x, 0, 0.9, 39.2, P, 14), { tone: "mid" }) });
  item("qg.dial", "mainF", [dx, dy, 46.6], [cyl(dx, dy, 3.6, 46.6, 1.8, { tone: "lo" }, 32)], { extra: L(k.ring(dx, dy, 2.9, PASS_DIAL.z, P, 32), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(k.ring(dx, dy, 0.7, PASS_DIAL.z, P, 10), { tone: "mid" }) + `<path class="iso-line" data-tone="hi" data-free="end" data-ref="pass" d="${k.lineOnTop([dx, dy - 0.7], [dx, dy - 2.8], PASS_DIAL.z, P)}"/>` });
  pusher("qg", KICK.qg);
}

// ---------- the hand press (approve): a column, a head, a ram and its lever ----------
export const LEVER = { x: X.approve - 4.6, pivot: [-1, 51], length: 15, rest: 0.95, down: 0.25, ball: 1.7, rod: 0.7 };
function press() {
  const x = X.approve;
  item("press.base", "back", [x - 2, -12, 0], [slab(plan(x - 6, x + 2, -17, -8, 1), 0, 2, { tone: "lo" }, 3, 0.4), slab(plan(x - 4, x, -15, -10, 0.8), 2, 46.6, { inner: L(k.sideSeam(plan(x - 4, x, -15, -10, 0.8), 6, P, 3), { tone: "faint" }) }, 3, 0.4)]);
  item("press.head", "mainF", [x, -5, 50], [slab(plan(x - 4, x + 4, -15, 3.4, 1.4), 48.6, 4.4, { tone: "hi", crease: "lo", inner: L(k.sideSeam(plan(x - 4, x + 4, -15, 3.4, 1.4), 50.4, P, 4), { tone: "faint" }) }, 4, 0.5)]);
  item("press.ram", "mainF", [x, 0, 44], [cyl(x, 0, 1.6, 43, 5.6, { tone: "hi", crease: "lo" }, 24), cyl(x, 0, 2.6, 41.4, 1.6, { tone: "mid" }, 28)], { wrap: (svg) => `<g data-move="approve">${svg}</g>` });
  // the lever turns in the plane x = LEVER.x about the pivot; the live code applies that turn as one
  // affine matrix (exact for anything lying in the plane)
  const [py, pz] = LEVER.pivot;
  const tip = [py + LEVER.length * Math.cos(LEVER.rest), pz + LEVER.length * Math.sin(LEVER.rest)];
  const FL = G.frameAlong([LEVER.x, py, pz], [0, Math.cos(LEVER.rest), Math.sin(LEVER.rest)]);
  // the rod ends where its rim lies on the knob (rim on sphere), and starts on the hub's round face
  const rodEnd = LEVER.length - Math.sqrt(LEVER.ball ** 2 - LEVER.rod ** 2);
  const svg = S(G.disc(1.6, rodEnd, LEVER.rod, FL, P), { tone: "hi", crease: "none" }) + S(G.sphereOf([LEVER.x, tip[0], tip[1]], LEVER.ball, P), { tone: "hi" });
  put({ name: "press.lever", layer: "mainF", at: [LEVER.x, py + 6, pz + 6], svg: `<g data-lever>${svg}</g>`, shapes: [A.disc(FL, 1.6, rodEnd, LEVER.rod), A.ball([LEVER.x, tip[0], tip[1]], LEVER.ball)] });
  const FH = G.frameAlong([x - 4, py, pz], [1, 0, 0]);
  item("press.hub", "mainF", [x - 4.6, py, pz], [{ svg: S(G.disc(-1.2, 0, 1.6, FH, P), { tone: "mid", crease: "lo" }), shape: A.disc(FH, -1.2, 0, 1.6) }]);
  pusher("approve", KICK.approve);
}

// ---------- the sampler (canary): a probe over the belt, a test rack of sample vials ----------
export const RACK = { x0: 4, y: -24, slots: 4, z: 34 };
function sampler() {
  const x = X.canary;
  item("canary.post", "back", [x, -11, 0], [slab(plan(x - 1.5, x + 1.5, -12.5, -9.5, 0.5), 1.2, 48, {}, 2, 0.3), slab(plan(x - 3, x + 3, -14, -8, 0.8), 0, 1.2, { tone: "lo" }, 2, 0.3)]);
  item("canary.arm", "mainF", [x, -4, 49], [slab(plan(x - 1.4, x + 1.4, -9.5, 1.6, 0.4), 47.4, 1.8, { tone: "hi", crease: "lo" }, 2, 0.2), cyl(x, 0, 1.4, 44.4, 3, { tone: "mid" }, 20)]);
  item("canary.probe", "mainF", [x, 0, 41], [cyl(x, 0, 0.45, 40.4, 4, { tone: "hi" }, 12)], { wrap: (svg) => `<g data-move="canary">${svg}</g>` });
  // the test rack: a stand with a hole per vial; a vial stands for twenty changes in their SLO window
  // raised on two legs so it shows above the belt from the front
  const rack = plan(RACK.x0 - 1, RACK.x0 + RACK.slots * 5 + 1, RACK.y - 3.5, RACK.y + 3.5, 0.8);
  const RZ = RACK.z;
  for (const lx of [rack.x + 2, rack.x + rack.w - 2]) item(`canary.rack.leg.${lx}`, "back", [lx, RACK.y, 0], [slab(plan(lx - 1.6, lx + 1.6, RACK.y - 2.6, RACK.y + 2.6, 0.5), 0, 1, { tone: "lo" }, 2, 0.2), slab(plan(lx - 0.8, lx + 0.8, RACK.y - 0.8, RACK.y + 0.8, 0.3), 1, RZ - 4 - 1, {}, 2, 0.2)]);
  item("canary.rack", "back", [rack.x + rack.w / 2, RACK.y, RZ - 4], [slab(rack, RZ - 4, 4, { inner: L(k.sideSeam(rack, RZ - 2.6, P, 3), { tone: "faint" }) }, 3, 0.4)], { extra: L(Array.from({ length: RACK.slots }, (_, i) => k.ring(RACK.x0 + 2.5 + i * 5, RACK.y, 1.4, RZ, P, 14)).join(""), { tone: "lo" }) });
  for (let i = 0; i < RACK.slots; i++) {
    const vx = RACK.x0 + 2.5 + i * 5;
    const v = join2(cyl(vx, RACK.y, 1, RZ, 6, { tone: "hi", crease: "lo" }, 16), cyl(vx, RACK.y, 1.2, RZ + 6, 0.6, { tone: "mid" }, 16));
    put({ name: `canary.vial.${i}`, layer: "back", at: [vx, RACK.y, RACK.z], svg: `<g data-vial="${i}">${v.svg}</g>`, shapes: v.shapes });
  }
  pusher("canary", KICK.canary);
}

// ---------- the capper and labeler (release), and the label printer (release notes) ----------
function capper() {
  const x = X.release;
  item("release.post", "back", [x, -11, 0], [slab(plan(x - 1.5, x + 1.5, -12.5, -9.5, 0.5), 1.2, 48, {}, 2, 0.3), slab(plan(x - 3, x + 3, -14, -8, 0.8), 0, 1.2, { tone: "lo" }, 2, 0.3)]);
  item("release.arm", "mainF", [x, -4, 49], [slab(plan(x - 1.4, x + 1.4, -9.5, 1.6, 0.4), 47.4, 1.8, { tone: "hi", crease: "lo" }, 2, 0.2), cyl(x, 0, 1.2, 46, 1.4, { tone: "mid" }, 20)]);
  item("release.head", "mainF", [x, 0, 43], [cyl(x, 0, 0.7, 43.4, 2.6, { tone: "mid" }, 12), cyl(x, 0, 2.3, 39.6, 3.8, { tone: "hi", crease: "lo", inner: L(k.knurl(x, 0, 2.3, 39.6, 43.4, 24, P), { tone: "lo" }) }, 28)], { wrap: (svg) => `<g data-move="release">${svg}</g>` });
  // the label roll on its spindle behind the belt, fed from the label printer
  const rx = x + 8;
  const ry = -13;
  item("release.spindle", "back", [rx, ry, 0], [cyl(rx, ry, 2.2, 0, 1, { tone: "lo" }, 20), cyl(rx, ry, 0.8, 1, 19, {}, 14)]);
  item("release.roll", "back", [rx, ry, 22], [cyl(rx, ry, 5, 20, 6, { tone: "hi", crease: "lo", inner: L(k.sideArc(rx, ry, 5, 23, P, 32), { tone: "faint" }) }, 40)], { extra: L(k.ring(rx, ry, 2.4, 26, P, 24), { tone: "lo" }) + L(k.ring(rx, ry, 0.8, 26, P, 12), { tone: "mid" }) });
  const pr = plan(x + 16, x + 28, -26, -16, 1);
  item("release.printer", "back", [x + 22, -21, 0], [slab(pr, 0, 10, { inner: L(k.sideSeam(pr, 3, P, 3), { tone: "faint" }) }, 3, 0.5), slab(plan(x + 18, x + 26, -22.4, -21.6, 0.2), 10, 3.4, { tone: "hi", crease: "none" }, 2, 0)], { extra: L(k.planOutline(plan(x + 17.4, x + 26.6, -23, -21, 0.4), 10, P, 2), { tone: "lo" }) });
}

// ---------- the shipping crate at the end of the line: released bottles, capped, one per twenty ----------
export const CRATE = { x: 78, y: -10, cols: 4, rows: 3, cell: 6.4 };
function crate() {
  const w = CRATE.cols * CRATE.cell + 1.2;
  const d = CRATE.rows * CRATE.cell + 1.2;
  const c = plan(CRATE.x, CRATE.x + w, CRATE.y, CRATE.y + d, 0.6);
  const H = 11;
  item("crate.floor", "back", [c.x + w / 2, c.y + d / 2, 0], [slab(c, 0, 1, { tone: "lo" }, 2, 0.2)]);
  item("crate.wall.back", "back", [c.x + w / 2, c.y + 0.3, 1], [slab(plan(c.x, c.x + w, c.y, c.y + 0.6, 0.2), 1, H, { tone: "mid" }, 2, 0.2)]);
  item("crate.wall.left", "back", [c.x + 0.3, c.y + d / 2, 1], [slab(plan(c.x, c.x + 0.6, c.y + 0.6, c.y + d - 0.6, 0.2), 1, H, { tone: "mid" }, 2, 0.2)]);
  item("crate.wall.right", "back", [c.x + w - 0.3, c.y + d / 2, 1], [slab(plan(c.x + w - 0.6, c.x + w, c.y + 0.6, c.y + d - 0.6, 0.2), 1, H, { tone: "mid" }, 2, 0.2)]);
  item("crate.wall.front", "back", [c.x + w / 2, c.y + d - 0.3, 1], [slab(plan(c.x, c.x + w, c.y + d - 0.6, c.y + d, 0.2), 1, H, { tone: "mid", inner: L(k.sideSeam(plan(c.x, c.x + w, c.y + d - 0.6, c.y + d, 0.2), 6, P, 2), { tone: "faint" }) }, 2, 0.2)]);
  for (let r = 0; r < CRATE.rows; r++)
    for (let col = 0; col < CRATE.cols; col++) {
      const bx = c.x + 0.6 + CRATE.cell * (col + 0.5);
      const by = c.y + 0.6 + CRATE.cell * (r + 0.5);
      const b = bottle(bx, by, 1, { tone: "mid", cap: true });
      put({ name: `crate.slot.${r}.${col}`, layer: "back", at: [bx, by, 1], svg: `<g data-crate="${r * CRATE.cols + col}">${b.svg}</g>`, shapes: b.shapes });
    }
}

// ---------- the return conveyor in front, its two reject slides, the elevator back up, the chute ----------
const RLEGS = [-166, -120, -70, -20];
function returnConveyor() {
  for (const x of RLEGS) {
    for (const [y0, y1] of [[18, 20], [28, 30]]) item(`ret.leg.${x}.${y0}`, "ret", [x, (y0 + y1) / 2, 0], [slab(plan(x - 2, x + 2, y0 - 1, y1 + 1), 0, 0.8, { tone: "lo" }, 2, 0.2), slab(plan(x - 1.1, x + 1.1, y0, y1, 0.3), 0.8, 10.2, {}, 2, 0.2)]);
    item(`ret.brace.${x}`, "ret", [x, 24, 4], [slab(plan(x - 0.7, x + 0.7, 20, 28, 0.2), 4, 1.4, { tone: "lo" }, 2, 0)]);
  }
  for (const [name, y0, y1] of [["back", 18, 20], ["front", 28, 30]]) {
    const p = plan(RET[0], RET[1] + 2, y0, y1, 0.5);
    item(`ret.beam.${name}`, "ret", [(RET[0] + RET[1]) / 2, (y0 + y1) / 2, 11], [slab(p, 11, RT - 11, { inner: L(k.sideSeam(p, 13.4, P, 3), { tone: "faint" }) }, 3, 0.3)], { bias: name === "front" ? 2 : 0 });
  }
  const belt = plan(RET[0] + 2, RET[1], 20, 28, 0);
  item("ret.belt", "ret", [belt.x + belt.w / 2, 24, RT - 1], [slab(belt, RT - 1.6, 1.6, { tone: "lo", crease: "none" }, 2, 0)], { bias: 1, extra: slatsSvg(belt, RT, "ret") });
  for (const x of [RET[0] + 0.3, RET[1] + 1.7]) {
    const F = { ...ALONG_Y(x, RT - 1.7), o: [x, 20, RT - 1.7] };
    item(`ret.roller.${x}`, "ret", [x, 24, RT - 1.7], [{ svg: S(G.disc(0, 8, 1.7, F, P), { tone: "mid", crease: "lo" }), shape: A.disc(F, 0, 8, 1.7) }]);
  }
  // the return guards, gapped where the two slides land
  for (const [side, y0, layer] of [["back", 18.9, "ret"]]) {
    const cuts = side === "back" ? [KICK.qg, KICK.approve].map((x) => [x - 5, x + 5]) : [];
    const runs = [];
    let from = RET[0] + 2;
    for (const [a, b] of cuts) {
      runs.push([from, a]);
      from = b;
    }
    runs.push([from, RET[1] - 1]);
    runs.filter(([a, b]) => b - a > 3).forEach(([a, b], i) => {
      const parts = [slab(plan(a, b, y0, y0 + 0.9, 0.3), RT + 2, 0.8, { tone: "hi", crease: "lo" }, 2, 0.2)];
      const n = Math.max(1, Math.round((b - a) / 22));
      for (let j = 0; j <= n; j++) {
        const x = a + 1 + ((b - a - 2) * j) / n;
        parts.push(slab(plan(x - 0.35, x + 0.35, y0 + 0.1, y0 + 0.8, 0.15), RT, 2, { tone: "mid", crease: "none" }, 2, 0));
      }
      item(`ret.guard.${side}.${i}`, layer, [(a + b) / 2, y0 + 0.45, RT + 2], parts);
    });
  }
  // the two slides: a plate from the main belt's front edge down onto the return belt, side rails
  for (const id of ["qg", "approve"]) {
    const x = KICK[id];
    const plate = [[6, BT], [20, RT + 0.8], [20, RT], [6, BT - 0.8]];
    const rail = [[6, BT + 1.6], [20, RT + 2.4], [20, RT + 0.8], [6, BT]];
    item(`slide.${id}`, "ret", [x, 13, 22], [across(x - 3.6, x + 3.6, plate, { tone: "hi", crease: "lo" }), across(x - 4.2, x - 3.6, rail, { tone: "mid" }), across(x + 3.6, x + 4.2, rail, { tone: "mid" })]);
  }
  // the elevator: an inclined belt from the return belt's end back up to the main belt, on two posts
  const elev = [[6, BT], [26, RT - 1.33], [26, RT - 2.13], [6, BT - 0.8]];
  const erail = [[6, BT + 1.6], [26, RT + 0.27], [26, RT - 1.33], [6, BT]];
  item("elevator", "ret", [ELEV, 16, 22], [across(ELEV - 3.6, ELEV + 3.6, elev, { tone: "lo", crease: "lo" }), across(ELEV - 4.2, ELEV - 3.6, erail, { tone: "mid" }), across(ELEV + 3.6, ELEV + 4.2, erail, { tone: "mid" })]);
  const zAt = (y) => BT - 0.8 + ((RT - 2.13 - (BT - 0.8)) * (y - 6)) / 20;
  for (const y of [12, 22]) item(`elevator.post.${y}`, "ret", [ELEV, y, 0], [slab(plan(ELEV - 2, ELEV + 2, y - 2, y + 2, 0.4), 0, 0.8, { tone: "lo" }, 2, 0.2), slab(plan(ELEV - 1, ELEV + 1, y - 1, y + 1, 0.3), 0.8, zAt(y + 1) - 0.8, {}, 2, 0.2)]);
  // the rollback chute from the canary down into the rolled-back bin
  const cx = KICK.canary;
  const chute = [[6, BT], [23, 11], [23, 10.2], [6, BT - 0.8]];
  const crail = [[6, BT + 1.8], [23, 12.8], [23, 11], [6, BT]];
  item("chute", "ret", [cx, 14, 19], [across(cx - 3.6, cx + 3.6, chute, { tone: "hi", crease: "lo" }), across(cx - 4.2, cx - 3.6, crail, { tone: "mid" }), across(cx + 3.6, cx + 4.2, crail, { tone: "mid" })]);
}
export const BIN = { x: 15, y: 23, w: 14, d: 12, h: 10.2, cols: 2, rows: 2 };
function bin() {
  const { x, y, w, d, h } = BIN;
  item("bin.floor", "ret", [x + w / 2, y + d / 2, 0], [slab(plan(x, x + w, y, y + d, 0.6), 0, 1, { tone: "lo" }, 2, 0.2)]);
  item("bin.wall.back", "ret", [x + w / 2, y + 0.3, 1], [slab(plan(x, x + w, y, y + 0.6, 0.2), 1, h - 1, { tone: "mid" }, 2, 0.2)]);
  item("bin.wall.left", "ret", [x + 0.3, y + d / 2, 1], [slab(plan(x, x + 0.6, y + 0.6, y + d - 0.6, 0.2), 1, h - 1, { tone: "mid" }, 2, 0.2)]);
  item("bin.wall.right", "retF", [x + w - 0.3, y + d / 2, 1], [slab(plan(x + w - 0.6, x + w, y + 0.6, y + d - 0.6, 0.2), 1, h - 1, { tone: "mid" }, 2, 0.2)]);
  item("bin.wall.front", "retF", [x + w / 2, y + d - 0.3, 1], [slab(plan(x, x + w, y + d - 0.6, y + d, 0.2), 1, h - 1, { tone: "mid", inner: L(k.sideSeam(plan(x, x + w, y + d - 0.6, y + d, 0.2), 5, P, 2), { tone: "faint" }) }, 2, 0.2)]);
  for (let r = 0; r < BIN.rows; r++)
    for (let c = 0; c < BIN.cols; c++) {
      const bx = x + 3.8 + c * 6.4;
      const by = y + 3.6 + r * 5;
      const b = bottle(bx, by, 1, { tone: "mid" });
      put({ name: `bin.slot.${r}.${c}`, layer: "retB", at: [bx, by, 1], svg: `<g data-bin="${r * BIN.cols + c}">${b.svg}</g>`, shapes: b.shapes });
    }
}

// ---------- owner plates on the floor: one to four studs, the example's four lanes ----------
function owners() {
  for (const id of ["commit", "pr", "build", "qg", "approve", "canary", "release"]) {
    const x = X[id] - 7;
    const p = plan(x - 3.6, x + 3.6, 9, 15, 0.8);
    const n = ownerOf(id);
    const studs = Array.from({ length: n }, (_, i) => [x - (n - 1) * 0.9 + i * 1.8, 12]);
    item(`owner.${id}`, "ret", [x, 12, 0], [slab(p, 0, 0.7, { tone: "lo" }, 2, 0.25)], { extra: D(studs.map(([sx, sy]) => at([sx, sy, 0.7])), { size: 0.55, tone: "hi" }) });
  }
}

mainConveyor();
guards();
queues();
loader();
gantry("pr", X.pr, { stamps: [X.pr - 3.2, X.pr + 3.2] });
filler();
camera();
press();
sampler();
capper();
crate();
returnConveyor();
bin();
owners();

// ---------- the traced bottle: drawn once at the loader, moved by translate; capped once released ----------
export const HOME = [X.commit, 0, BT];
const traced = bottle(HOME[0], 0, BT, { lit: true });
const CAP = S(k.cylinder(HOME[0], 0, 1.2, BT + BOTTLE_H, 0.8, P, 16), { tone: "mid", crease: "lo", lit: true });
const TRACED = `<g class="rw-traced" data-ref="traced">${traced.svg}<g data-cap>${CAP}</g></g>`;

const { layerOf } = W.finish({});
if (argv.includes("--audit")) A.auditOrExit(R, P, { crowd: [] });

// ---------- the paths a traced bottle takes, in world points, with the layer each leg is drawn in ----------
const leg = (p, layer = "mainB", speed = 60) => ({ p, layer, speed });
const kickTo = (id) => [leg([KICK[id], 0, BT]), leg([KICK[id], 6, BT], "retB", 40), leg([KICK[id], 20, RT + 0.8], "retB", 50), leg([KICK[id], 24, RT], "retB", 30)];
const backToReview = [leg([ELEV + 2, 24, RT], "retB", 80), leg([ELEV, 24, RT], "retB", 30), leg([ELEV, 6, BT], "retB", 36), leg([ELEV, 0, BT], "mainB", 30)];
export const PATHS = {
  "qg>pr": [...kickTo("qg"), ...backToReview],
  "approve>pr": [...kickTo("approve"), ...backToReview],
  "canary>rollback": [leg([KICK.canary, 0, BT]), leg([KICK.canary, 6, BT], "retB", 40), leg([KICK.canary, 23, 11], "retB", 50)],
  "release>done": [leg([BELT[1], 0, BT]), leg([BELT[1] + 6, 0, BT - 4], "mainB", 40)],
};

// ---------- page ----------
const pct = (v) => `${Math.round(v * 100)}%`;
const stack = LAYERS;
const page = W.page({
  title: "Release delivery",
  fig: "Fig 9",
  hint: "Drag · ← → rate · ↑↓ gate",
  readout: `${EX.rps}/h`,
  keys: [
    { mark: "lit", label: "One traced change" },
    { mark: "raised", label: `A bottle on the belt: ${PER} changes waiting at that step` },
    { mark: "dotted", label: "Studs on a floor plate: the step's owner, 1 to 4" },
  ],
  caption: `First-pass yield is ${pct(passOf("qg"))} at the camera × ${pct(passOf("approve"))} at the press × ${pct(passOf("canary"))} at the canary = ${pct(YIELD)}. The press's ${byId.approve.dur} minutes dominate the ${(HAPPY_MIN / 60).toFixed(1)} h happy path, so at ${EX.rps} changes an hour about ${Math.round(STEADY.approve / 10) * 10} wait for it, and about ${pct(STEADY.rolled)} of finished changes are rolled back. Rejects ride the return conveyor back to review. Time runs at the Workbench's own simulation speed, 1 s for 20 minutes, in its token engine running the Release Delivery Workflow.`,
  label: "A bottling line for a release workflow. One conveyor on legs runs left to right through a station per step: a loader with the line-speed knob, a review gantry with two inspectors' stamps, a filler, an inspection camera with a reject pusher behind the belt, a hand stamping press, a sampling probe with a rack of sample vials, a capper with a label roll and printer, and a shipping crate of capped bottles. A return conveyor in front carries rejected bottles back up an elevator to the review gantry, and a chute from the sampler drops failed canaries into a rolled-back bin. Bottles waiting on the belt show how many changes wait at each step.",
  width: WIDTH,
  height: HEIGHT,
  stack,
  layerOf: (name) => (name === "mainB" ? [...layerOf(name), TRACED] : layerOf(name)),
  halo,
  stageAttrs: { role: "slider", "aria-label": "Release workflow: drag across or use the left and right arrows to set changes per hour, up and down to set the inspection camera's pass rate", "aria-valuemin": 0, "aria-valuemax": RATE_MAX, "aria-valuenow": EX.rps, "aria-valuetext": `${EX.rps} changes per hour` },
  data: {
    preset: { nodes: EX.nodes, edges: EX.edges, rps: EX.rps },
    rateMax: RATE_MAX,
    x: X,
    kick: KICK,
    queue: QUEUE,
    slots: SLOTS,
    per: PER,
    paths: PATHS,
    home: HOME,
    zone: ZONE,
    bt: BT,
    belt: BELT,
    rateKnob: KNOB,
    passDial: PASS_DIAL,
    push: PUSH,
    lever: { ...LEVER, ey: [at([LEVER.x, 1, 0])[0] - at([LEVER.x, 0, 0])[0], at([LEVER.x, 1, 0])[1] - at([LEVER.x, 0, 0])[1]], ez: [at([LEVER.x, 0, 1])[0] - at([LEVER.x, 0, 0])[0], at([LEVER.x, 0, 1])[1] - at([LEVER.x, 0, 0])[1]], screen: at([LEVER.x, LEVER.pivot[0], LEVER.pivot[1]]) },
    rack: RACK,
    crate: CRATE,
    bin: BIN,
    slats: { main: [at([4, 0, BT])[0] - at([0, 0, BT])[0], at([4, 0, BT])[1] - at([0, 0, BT])[1]], ret: [at([4, 0, RT])[0] - at([0, 0, RT])[0], at([4, 0, RT])[1] - at([0, 0, RT])[1]] },
    stackIndex: { mainB: stack.indexOf("mainB"), retB: stack.indexOf("retB") },
  },
  truthCode: TRUTH.code,
  live: readFileSync(join(HERE, "live.js"), "utf8"),
  css: readFileSync(join(HERE, "figure.css"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `release-workflow${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${R.items.length} items · ${R.solids.length} solids · waiting at approval ≈ ${STEADY.approve.toFixed(0)} · rolled back ${pct(STEADY.rolled)}`);
}
export { R };
