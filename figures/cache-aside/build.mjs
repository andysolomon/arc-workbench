// Fig 5 · Cache Aside. The Workbench's `cache` preset as a shop parts counter. Redis is a revolving
// bin carousel on the countertop (a 3D turn group): every request turns it to a bin. The API's two
// instances are two service positions at the counter, each with a call bell, a ticket spike and a
// busy dial. A lever on the counter sets the miss rate, and every miss sends the dumbwaiter car up
// its shaft to the stock loft (Postgres: shelving, a ledger desk and the loft's dial). Customers take
// a number at the dispenser in front: its dial is the load. Numbers from the Workbench's own
// queueing engine, run live with api>db w = miss.
//
//   node figures/cache-aside/build.mjs [--light] [--audit [--quick] [--only=a,b]] [--verify] [--out=dir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { turning } from "../kit/turn-build.mjs";
import * as TA from "../kit/turn-audit.mjs";
import { truth } from "../lib/truth.mjs";
import { workshop } from "../lib/bench.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";
const verify = argv.includes("--verify");
const outDir = argv.find((a) => a.startsWith("--out="))?.slice(6) ?? HERE;

// ---------- truth ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const PRESET = TRUTH.WB.PRESETS.find((p) => p.id === "cache");
if (!PRESET) throw new Error("the cache preset is missing from src/paradigms/presets.ts");
const capOf = (id) => {
  const n = PRESET.nodes.find((x) => x.id === id);
  return ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / n.ms;
};
const API_CAP = capOf("api");
const DB_CAP = capOf("db");
const MISS = PRESET.edges.find((e) => e.id === "api>db").w;
export const RPS_MAX = 8000;

// ---------- world ----------
const WIDTH = 640;
const HEIGHT = 470;
const FLOOR = { x: -152, y: -98, w: 238, d: 146, r: 6 };
const FLOOR_H = 8;
const COUNTER = { x: -128, y: -22, w: 198, d: 30, r: 2 };
const TOP_PLAN = { x: -132, y: -26, w: 206, d: 40, r: 2.5 };
const BODY_TOP = 32;
const TOP = 35.5;
const C = [36, -6];
const POS = [-108, -76];
const LEVER = [-38, -3];
const DISP = [-136, 38];
const CAR = { x: -44.6, y: -42, w: 13.2, d: 14, r: 1 };
const CAR_H = 13;
const LOFT = { x: -148, y: -94, w: 122, d: 50, r: 2 };
const LOFT_Z = 56;
const LOFT_TOP = 60;
const JIB_Z = 80;
export const DUMB = { low: TOP, high: LOFT_TOP };

export const P = k.fitProjection(
  [...k.boxCorners(FLOOR, -FLOOR_H - 5, 0), [-148, -94, 94], [-66, -94, 94], [-48, -37, JIB_Z + 4], [-33, -37, JIB_Z + 4], [C[0] - 20, C[1], 67], [C[0] + 20, C[1], 67], [DISP[0], DISP[1], 46]],
  WIDTH,
  HEIGHT,
  { pad: 30, azimuth: 62, elevation: 32 },
);
const W = workshop({ P, theme, layers: ["back"] });
const { R, at, S, L, D, put, rad } = W;
const VERT = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const segOn = (a, b) => k.segment(a, b, P);

// a face-up dial: a housing, a ring the ticks hang from, and a needle the live code turns
export const NEEDLES = [];
function dialSvg(ref, node, c, z, r, { from = rad(-135), span = rad(270), count = 28, every = 4, max = 1.4, full = 1, housing = true } = {}) {
  const [cx, cy] = c;
  const t = k.radialTicks(cx, cy, r, count, every, z, [r * 0.12, r * 0.24], P, from, span);
  const fullAt = from + span * (full / max);
  const mark = k.lineOnTop([cx + Math.sin(fullAt) * r * 0.72, cy - Math.cos(fullAt) * r * 0.72], [cx + Math.sin(fullAt) * r, cy - Math.cos(fullAt) * r], z, P);
  NEEDLES.push({ ref, node, c, z, r0: r * 0.16, r1: r * 0.82, from, span, max });
  return (
    (housing ? S(k.cylinder(cx, cy, r + 1.4, z - 2.4, 2.4, P, 40, 0.4), { tone: "mid", crease: "lo" }) : "") +
    L(k.ring(cx, cy, r, z, P, 56), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(mark, { tone: "hi" }) +
    L(k.ring(cx, cy, r * 0.16, z, P, 14), { tone: "mid" }) +
    `<path class="iso-line" data-tone="hi" data-free="end" data-ref="${ref}" d="${k.lineOnTop([cx, cy - r * 0.16], [cx, cy - r * 0.82], z, P)}"/>`
  );
}

// ---------- the shop floor: a model base of planks on four feet ----------
function floor() {
  for (const [x, y] of byDepth(k.corners(FLOOR, 22))) {
    const z0 = -FLOOR_H - 5;
    put({ name: `stand.foot.${x}.${y}`, layer: "back", at: [x, y, z0], svg: S(k.cylinder(x, y, 6.2, z0, 1.4, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 4.8, z0 + 1.4, 3.6, P, 28), { tone: "mid" }), shapes: [A.cylinder(x, y, 6.2, z0, 1.4, { ground: true }), A.cylinder(x, y, 4.8, z0 + 1.4, 3.6)] });
  }
  // planks run front to back, edge to edge; the boards' seams are lines on the top face
  const seams = [];
  for (let x = FLOOR.x + 14; x < FLOOR.x + FLOOR.w - 6; x += 14) seams.push(segOn([x, FLOOR.y, 0], [x, FLOOR.y + FLOOR.d, 0]));
  const svg = S(k.slabOf(FLOOR, -FLOOR_H, FLOOR_H, P, 8, 1.2), { tone: "mid", inner: L(k.sideSeam(FLOOR, -3, P, 8), { tone: "faint" }) }) + L(seams.join(""), { tone: "faint" });
  put({ name: "stand.floor", layer: "back", at: [0, 0, -FLOOR_H], bias: -400, svg, shapes: [A.slab(FLOOR, -FLOOR_H, FLOOR_H, { ground: true })] });
  W.labelPlate({ x: 18, y: 25, w: 58, d: 16, r: 2 });
  // queue stanchions in front of the service positions: where customers wait their turn
  const posts = [-118, -92, -66];
  for (const x of posts) {
    const svg = S(k.cylinder(x, 30, 4.2, 0, 1.2, P, 24, 0.3), { tone: "lo" }) + S(k.cylinder(x, 30, 0.9, 1.2, 25.6, P, 12), { tone: "mid", crease: "none" }) + S(k.cylinder(x, 30, 1.6, 26.8, 2.4, P, 16, 0.3), { tone: "hi", crease: "lo" });
    put({ name: `queue.post.${x}`, layer: "back", at: [x, 30, 0], svg, shapes: [A.cylinder(x, 30, 4.2, 0, 1.2), A.cylinder(x, 30, 0.9, 1.2, 25.6), A.cylinder(x, 30, 1.6, 26.8, 2.4)] });
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const belt = { x: posts[i] + 1.6, y: 29.8, w: posts[i + 1] - posts[i] - 3.2, d: 0.4, r: 0 };
    put({ name: `queue.belt.${i}`, layer: "back", at: [(posts[i] + posts[i + 1]) / 2, 30, 26], svg: S(k.slabOf(belt, 24.8, 2.4, P, 1), { tone: "hi", crease: "none" }), shapes: [A.slab(belt, 24.8, 2.4)] });
  }
}

// ---------- the counter ----------
function counter() {
  const front = COUNTER.y + COUNTER.d;
  const panel = (x0, x1) => {
    const ring = k.roundedPlan({ x: x0, y: 5, w: x1 - x0, d: 21, r: 1.6 }, 4);
    return k.pathOf(ring.map(([x, z]) => at([x, front, z])), true);
  };
  const panels = [];
  for (let i = 0; i < 5; i++) {
    const x0 = COUNTER.x + 6 + i * 38;
    panels.push(panel(x0, x0 + 33));
  }
  const body = S(k.slabOf(COUNTER, 0, BODY_TOP, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(COUNTER, 3, P, 4), { tone: "faint" }) + L(panels.join(""), { tone: "lo" }) });
  put({ name: "counter.body", layer: "back", at: [COUNTER.x + COUNTER.w / 2, COUNTER.y + COUNTER.d / 2, 0], svg: body, shapes: [A.slab(COUNTER, 0, BODY_TOP)] });
  const top = S(k.slabOf(TOP_PLAN, BODY_TOP, TOP - BODY_TOP, P, 6, 0.8), { tone: "hi", crease: "lo", inner: L(k.sideSeam(TOP_PLAN, BODY_TOP + 1.2, P, 6), { tone: "faint" }) });
  put({ name: "counter.top", layer: "back", at: [TOP_PLAN.x + TOP_PLAN.w / 2, TOP_PLAN.y + TOP_PLAN.d / 2, BODY_TOP], svg: top, shapes: [A.slab(TOP_PLAN, BODY_TOP, TOP - BODY_TOP)] });
  // the carousel's bearing: a fixed disc the turning trays sit on
  put({ name: "carousel.bearing", layer: "back", at: [C[0], C[1], TOP], svg: S(k.cylinder(C[0], C[1], 15, TOP, 1.5, P, 56, 0.3), { tone: "lo" }) + D(G.dotsOf(VERT(C[0], C[1]), TOP + 1.5, 12.8, 10, P, { all: true, phase: 0.3 }), { size: 0.4 }), shapes: [A.cylinder(C[0], C[1], 15, TOP, 1.5)] });
}

// ---------- the API: two service positions, each a bell, a ticket spike and a busy dial ----------
export const TICKETS = [];
function positions() {
  POS.forEach((x, i) => {
    const id = "ab"[i];
    const F = VERT(x, 2);
    const BELL = [[0, 4.2], [1.1, 4.2], [1.1, 3.7, 1], [2.4, 3.5, 1], [3.6, 3.0, 1], [4.6, 2.2, 1], [5.2, 1.2, 1], [5.4, 0]];
    const bellProfile = BELL.map(([s, r, sm]) => (sm ? [TOP + s, r, 1] : [TOP + s, r]));
    const bell = S(G.solidOf(bellProfile, F, P), { tone: "hi", crease: "lo" }) + S(k.cylinder(x, 2, 0.7, TOP + 5.4, 1.6, P, 14), { tone: "mid" }) + D([at([x, 2, TOP + 7])], { size: 0.5, tone: "hi" });
    put({ name: `pos.${id}.bell`, layer: "back", at: [x, 2, TOP], svg: bell, shapes: [A.solid(F, bellProfile, { name: `pos.${id}.bell` }), A.cylinder(x, 2, 0.7, TOP + 5.4, 1.6)] });
    // the spike: tickets on it are this position's share of the work in hand
    const sx = x - 1;
    const sy = -16;
    let spike = S(k.cylinder(sx, sy, 2.8, TOP, 1, P, 20, 0.2), { tone: "lo" }) + S(k.cylinder(sx, sy, 0.42, TOP + 1, 12, P, 10), { tone: "mid", crease: "none" });
    const shapes = [A.cylinder(sx, sy, 2.8, TOP, 1, { owner: `pos.${id}.spike` }), A.cylinder(sx, sy, 0.42, TOP + 1, 12, { owner: `pos.${id}.spike` })];
    for (let t = 0; t < 6; t++) {
      const a = rad(t * 47 + i * 20);
      const half = 2.4;
      const ring = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([u, v]) => [sx + u * Math.cos(a) - v * Math.sin(a), sy + u * Math.sin(a) + v * Math.cos(a)]);
      const z = TOP + 1.6 + t * 1.5;
      spike += `<g data-ticket="${id}.${t}" style="display:${t < 1 ? "inline" : "none"}">${S(k.extrude(ring, z, 0.35, P), { tone: "hi", crease: "none" })}</g>`;
      shapes.push(A.extruded(ring, z, 0.35, { owner: `pos.${id}.spike` }));
    }
    TICKETS.push(id);
    put({ name: `pos.${id}.spike`, layer: "back", at: [sx, sy, TOP], svg: spike, shapes });
    put({ name: `pos.${id}.dial`, layer: "back", at: [x + 13, -8, TOP], svg: dialSvg(`busy-${id}`, "api", [x + 13, -8], TOP + 2.4, 5.2), shapes: [A.cylinder(x + 13, -8, 6.6, TOP, 2.4)] });
  });
}

// ---------- the miss-rate lever: a selector over a half-dial on the counter ----------
export const LEVER_DATA = { c: LEVER, z: TOP + 1, from: rad(270), span: rad(-180), len: 11, w: 1.5, knob: 1.8 };
function lever() {
  const [cx, cy] = LEVER;
  const plate = [];
  for (let j = 0; j <= 24; j++) {
    const a = rad(90 + (180 * j) / 24);
    plate.push([cx + 13.6 * Math.sin(a), cy - 13.6 * Math.cos(a)]);
  }
  const t = k.radialTicks(cx, cy, 13, 20, 4, TOP + 1, [1.2, 2.4], P, LEVER_DATA.from, LEVER_DATA.span);
  const zero = k.lineOnTop([cx - 10, cy], [cx - 13, cy], TOP + 1, P);
  const svg =
    S(k.extrude(plate, TOP, 1, P, { bevel: 0.3 }), { tone: "lo" }) +
    L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(zero, { tone: "hi" }) +
    L(k.pathOf(Array.from({ length: 25 }, (_, j) => { const a = rad(90 + (180 * j) / 24); return at([cx + 13 * Math.sin(a), cy - 13 * Math.cos(a), TOP + 1]); })), { tone: "lo" }) +
    S(k.cylinder(cx, cy, 2.4, TOP + 1, 1.2, P, 20), { tone: "mid" }) +
    `<g data-ref="lever">${leverSvg(MISS)}</g>`;
  put({ name: "lever", layer: "back", at: [cx, cy, TOP], svg, shapes: [A.extruded(plate, TOP, 1), A.cylinder(cx, cy, 2.4, TOP + 1, 1.2), A.cylinder(cx, cy, 1.4, TOP + 2.2, 1.2)] });
}
function leverSvg(miss) {
  const { c: [cx, cy], len, w, knob } = LEVER_DATA;
  const a = LEVER_DATA.from + LEVER_DATA.span * miss;
  const d = [Math.sin(a), -Math.cos(a)];
  const n = [-d[1], d[0]];
  const ring = [[0, -w / 2], [len, -w / 2], [len, w / 2], [0, w / 2]].map(([s, t]) => [cx + d[0] * s + n[0] * t, cy + d[1] * s + n[1] * t]);
  const tip = [cx + d[0] * len, cy + d[1] * len];
  return S(k.extrude(ring, TOP + 2.2, 1.2, P), { tone: "hi", crease: "lo" }) + S(k.cylinder(cx, cy, 1.4, TOP + 2.2, 1.6, P, 16), { tone: "hi", crease: "lo" }) + S(k.cylinder(tip[0], tip[1], knob, TOP + 2.2, 3.4, P, 20, 0.3), { tone: "hi", crease: "lo" });
}

// ---------- the take-a-number dispenser: its dial is the load ----------
export const DISP_DATA = { c: DISP, z: 44.6, r0: 0.9, r1: 4.8, from: rad(-135), span: rad(270) };
function dispenser() {
  const [cx, cy] = DISP;
  const t = k.radialTicks(cx, cy, 5.6, 16, 2, 44.6, [0.8, 1.6], P, DISP_DATA.from, DISP_DATA.span);
  const capAt = DISP_DATA.from + DISP_DATA.span * (DB_CAP / RPS_MAX);
  const cap = k.lineOnTop([cx + Math.sin(capAt) * 3.8, cy - Math.cos(capAt) * 3.8], [cx + Math.sin(capAt) * 5.6, cy - Math.cos(capAt) * 5.6], 44.6, P);
  const tongue = { x: cx - 2.6, y: cy + 6.6, w: 5.2, d: 3.6, r: 0.3 };
  const svg =
    S(k.cylinder(cx, cy, 7, 0, 1.6, P, 32, 0.3), { tone: "lo" }) +
    S(k.cylinder(cx, cy, 1.8, 1.6, 32.4, P, 16), { tone: "mid", crease: "none" }) +
    S(k.cylinder(cx, cy, 3.4, 34, 1.4, P, 20), { tone: "lo" }) +
    S(k.extrude(k.roundedPlan(tongue, 2), 38.4, 0.4, P), { tone: "hi", crease: "none" }) +
    S(k.cylinder(cx, cy, 7, 35.4, 9.2, P, 40, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideArc(cx, cy, 7, 39.6, P, 32), { tone: "faint" }) }) +
    L(k.ring(cx, cy, 5.6, 44.6, P, 40), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(cap, { tone: "hi" }) +
    L(k.ring(cx, cy, 0.9, 44.6, P, 12), { tone: "mid" }) +
    `<path class="iso-line" data-tone="hi" data-free="end" data-ref="dispenser" d="${k.lineOnTop([cx, cy - 0.9], [cx, cy - 4.8], 44.6, P)}"/>`;
  put({ name: "dispenser", layer: "back", at: [cx, cy, 0], svg, shapes: [A.cylinder(cx, cy, 7, 0, 1.6), A.cylinder(cx, cy, 1.8, 1.6, 32.4), A.cylinder(cx, cy, 3.4, 34, 1.4), A.cylinder(cx, cy, 7, 35.4, 9.2), A.slab(tongue, 38.4, 0.4, { owner: "dispenser" })] });
}

// ---------- the stock loft: Postgres ----------
function loft() {
  const posts = [[-144, -90], [-30, -90], [-144, -48], [-30, -48]];
  for (const [x, y] of byDepth(posts)) put({ name: `loft.post.${x}.${y}`, layer: "back", at: [x, y, 0], svg: S(k.cylinder(x, y, 3.6, 0, 1.6, P, 20), { tone: "lo" }) + S(k.cylinder(x, y, 2.4, 1.6, LOFT_Z - 1.6, P, 20), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 2.4, 5, P, 12), { tone: "faint" }) }), shapes: [A.cylinder(x, y, 3.6, 0, 1.6), A.cylinder(x, y, 2.4, 1.6, LOFT_Z - 1.6)] });
  const deck = S(k.slabOf(LOFT, LOFT_Z, LOFT_TOP - LOFT_Z, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(LOFT, LOFT_Z + 1.6, P, 4), { tone: "faint" }) });
  const boards = [];
  for (let x = LOFT.x + 12; x < LOFT.x + LOFT.w - 4; x += 12) boards.push(segOn([x, LOFT.y, LOFT_TOP], [x, LOFT.y + LOFT.d, LOFT_TOP]));
  put({ name: "loft.deck", layer: "back", at: [LOFT.x + LOFT.w / 2, LOFT.y + LOFT.d / 2, LOFT_Z], svg: deck + L(boards.join(""), { tone: "faint" }), shapes: [A.slab(LOFT, LOFT_Z, LOFT_TOP - LOFT_Z)] });
  // a railing along the loft's open edge, stopping short of the shaft
  const RAIL = { x: -146, y: -46.6, w: 92, d: 1.8, r: 0.6 };
  let rail = "";
  const railShapes = [];
  for (let x = -144; x <= -56; x += 11) {
    rail += S(k.cylinder(x, -45.7, 0.7, LOFT_TOP, 8.4, P, 10), { tone: "mid", crease: "none" });
    railShapes.push(A.cylinder(x, -45.7, 0.7, LOFT_TOP, 8.4));
  }
  rail += S(k.slabOf(RAIL, LOFT_TOP + 8.4, 1.4, P, 2, 0.2), { tone: "hi", crease: "lo" });
  railShapes.push(A.slab(RAIL, LOFT_TOP + 8.4, 1.4));
  put({ name: "loft.rail", layer: "back", at: [-100, -45.7, LOFT_TOP], bias: 0.5, svg: rail, shapes: railShapes });
  // two shelving units of stock boxes
  for (const [index, x0] of [-142, -104].entries()) {
    const y0 = -92;
    const unit = { x: x0, y: y0, w: 34, d: 12 };
    let svg = "";
    const shapes = [];
    // the far side panel first, the near one (+x faces the viewer) after the shelves and boxes
    const sidePlan = (side) => ({ x: side, y: y0, w: 1.4, d: unit.d, r: 0.2 });
    const sideSvg = (side) => S(k.slabOf(sidePlan(side), LOFT_TOP, 32, P, 2), { tone: "mid", crease: "none" });
    svg += sideSvg(x0);
    shapes.push(A.slab(sidePlan(x0), LOFT_TOP, 32), A.slab(sidePlan(x0 + unit.w - 1.4), LOFT_TOP, 32));
    for (const z of [LOFT_TOP + 1, LOFT_TOP + 11, LOFT_TOP + 21, LOFT_TOP + 31]) {
      const plan = { x: x0 + 1.4, y: y0, w: unit.w - 2.8, d: unit.d, r: 0.2 };
      svg += S(k.slabOf(plan, z - 1, 1, P, 2), { tone: "lo", crease: "none" });
      shapes.push(A.slab(plan, z - 1, 1));
      if (z > LOFT_TOP + 30) continue;
      for (let b = 0; b < 3; b++) {
        if ((b + index + z) % 4 === 3) continue;
        const box = { x: x0 + 2.4 + b * 10.2, y: y0 + 1.5, w: 9, d: 9, r: 0.4 };
        const label = segOn([box.x + 2, box.y + box.d, z + 3.4], [box.x + 6.4, box.y + box.d, z + 3.4]);
        svg += S(k.slabOf(box, z, 7.2, P, 2, 0.25), { tone: "hi", crease: "lo", inner: L(label, { tone: "lo", free: true }) });
        shapes.push(A.slab(box, z, 7.2));
      }
    }
    svg += sideSvg(x0 + unit.w - 1.4);
    put({ name: `loft.shelf.${index}`, layer: "back", at: [x0 + unit.w / 2, y0 + unit.d / 2, LOFT_TOP], svg, shapes });
  }
  // the ledger desk: an open stock ledger and the loft's dial
  const legs = [[-62, -74], [-38, -74], [-62, -60], [-38, -60]];
  let desk = "";
  const deskShapes = [];
  for (const [x, y] of byDepth(legs)) {
    desk += S(k.cylinder(x, y, 0.9, LOFT_TOP, 13, P, 10), { tone: "mid", crease: "none" });
    deskShapes.push(A.cylinder(x, y, 0.9, LOFT_TOP, 13));
  }
  const DESK = { x: -64, y: -76, w: 28, d: 18, r: 1 };
  desk += S(k.slabOf(DESK, LOFT_TOP + 13, 1.6, P, 3, 0.4), { tone: "hi", crease: "lo" });
  deskShapes.push(A.slab(DESK, LOFT_TOP + 13, 1.6));
  const z = LOFT_TOP + 14.6;
  const pages = [{ x: -61, y: -73, w: 8, d: 11, r: 0.4 }, { x: -52.8, y: -73, w: 8, d: 11, r: 0.4 }];
  for (const pg of pages) {
    const rules = [2.4, 4.4, 6.4, 8.4].map((dy) => k.lineOnTop([pg.x + 1.2, pg.y + dy], [pg.x + pg.w - 1.4 - (dy % 3), pg.y + dy], z + 0.5, P)).join("");
    desk += S(k.slabOf(pg, z, 0.5, P, 2), { tone: "hi", crease: "none", inner: "" }) + L(rules, { tone: "lo", free: true });
    deskShapes.push(A.slab(pg, z, 0.5));
  }
  desk += dialSvg("stock", "db", [-41, -67], z + 2.4, 4.6);
  deskShapes.push(A.cylinder(-41, -67, 6, z, 2.4));
  put({ name: "loft.desk", layer: "back", at: [-50, -67, LOFT_TOP], svg: desk, shapes: deskShapes });
}

// ---------- the dumbwaiter: a shaft between the counter and the loft ----------
// the left post runs up past the loft and carries a jib with the pulley over the shaft; the right
// rail stops below the jib, so the car runs between them
function dumbwaiter() {
  const left = { x: -46.8, y: -36, w: 2, d: 2, r: 0.3 };
  const right = { x: -31.2, y: -36, w: 2, d: 2, r: 0.3 };
  const shoe = (x) => ({ x: x - 2.2, y: -37.2, w: 4.4, d: 4.4, r: 0.6 });
  const JIB = { x: -47.2, y: -36.2, w: 12, d: 2.4, r: 0.4 };
  const pulley = G.frameAlong([-38, -35.6, JIB_Z - 3.2], [0, 1, 0]);
  const post =
    S(k.slabOf(shoe(-45.8), 0, 1.6, P, 2), { tone: "lo" }) +
    S(k.slabOf(left, 1.6, JIB_Z - 1.6, P, 2), { tone: "mid", crease: "none" }) +
    S(k.slabOf(JIB, JIB_Z, 2.4, P, 2, 0.3), { tone: "mid", crease: "lo" }) +
    S(k.cylinder(-38, -34.8, 0.6, JIB_Z - 0.6, 0.6, P, 10), { tone: "mid" }) +
    S(G.disc(0, 1.6, 2.6, pulley, P), { tone: "hi", crease: "lo" }) + L(G.circleOf(pulley, 1.6, 1.6, P), { tone: "faint" }) + D([at(G.pointOf(pulley, 1.6, 0, 0))], { size: 0.45 });
  put({ name: "shaft.post", layer: "back", at: [-45.8, -35, 0], svg: post, shapes: [A.slab(shoe(-45.8), 0, 1.6), A.slab(left, 1.6, JIB_Z - 1.6), A.slab(JIB, JIB_Z, 2.4), A.cylinder(-38, -34.8, 0.6, JIB_Z - 0.6, 0.6), A.disc(pulley, 0, 1.6, 2.6)] });
  put({ name: "shaft.rail", layer: "back", at: [-30.2, -35, 0], svg: S(k.slabOf(shoe(-30.2), 0, 1.6, P, 2), { tone: "lo" }) + S(k.slabOf(right, 1.6, LOFT_TOP + CAR_H + 4 - 1.6, P, 2), { tone: "mid", crease: "none" }), shapes: [A.slab(shoe(-30.2), 0, 1.6), A.slab(right, 1.6, LOFT_TOP + CAR_H + 4 - 1.6)] });
  put({ name: "shaft.car", layer: "back", at: [-38, -35, TOP], svg: `<g data-ref="car">${carSvg(TOP, 0)}</g>`, shapes: [A.slab(CAR, TOP, CAR_H)] });
  put({ name: "shaft.rope", layer: "back", at: [-38, -34, JIB_Z - 6], bias: 0.2, svg: `<path class="iso-line" data-tone="mid" data-ref="rope" d="${ropeD(TOP)}"/>`, shapes: [A.tube([[-38, -34, TOP + CAR_H], [-38, -34, ROPE.top]], 0.3)] });
}
export const ROPE = { x: -38, y: -34.8, top: JIB_Z - 3.2 - 2.6 };
function ropeD(z) {
  return k.segment([ROPE.x, ROPE.y, z + CAR_H], [ROPE.x, ROPE.y, ROPE.top], P);
}
function carSvg(z, lamp) {
  const front = CAR.y + CAR.d;
  const door = k.pathOf(k.roundedPlan({ x: CAR.x + 2.4, y: z + 2.2, w: CAR.w - 4.8, d: CAR_H - 5, r: 0.8 }, 3).map(([x, zz]) => at([x, front, zz])), true);
  const eye = at([ROPE.x, ROPE.y, z + CAR_H]);
  const lampAt = at([CAR.x + CAR.w - 1.6, front, z + CAR_H - 1.8]);
  return S(k.slabOf(CAR, z, CAR_H, P, 3, 0.4), { tone: "mid", crease: "lo", inner: L(door, { tone: "lo" }) }) + D([eye], { size: 0.55, tone: "hi" }) + `<circle class="cx-lamp" cx="${lampAt[0].toFixed(2)}" cy="${lampAt[1].toFixed(2)}" r="${(0.9 * k.cameraOf(P).k).toFixed(2)}" style="opacity:${lamp.toFixed(3)}"/>`;
}

// ---------- the carousel: Redis, the one part that turns ----------
export const T = turning(P, { recorder: R });
const carousel = T.group("carousel", { turn: { pivot: C } });
const live = T.layer("carousel");
T.stack(["back", "carousel"]);
export const poses = () => Array.from({ length: 720 }, (_, i) => ({ carousel: i * 0.5 }));
function carouselParts() {
  const [cx, cy] = C;
  const H = { group: carousel, layer: live };
  const F = VERT(cx, cy);
  const UP = { o: [cx, cy, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };
  T.round({ name: "carousel.tray.0", ...H, F, s0: TOP + 1.5, s1: TOP + 2.9, r: 20, tone: "mid", crease: "lo", material: "steel", details: { bolts: [{ s: TOP + 2.9, r: 4.8, count: 6, size: 0.42, phase: 0.2, fade: [0.04, 0.42] }] } });
  const tier = (name, z0, z1, rIn, rOut, offset) => {
    for (let i = 0; i < 8; i++) {
      const a0 = rad(offset + i * 45 + 2.6);
      const a1 = rad(offset + (i + 1) * 45 - 2.6);
      const pts = [[rIn * Math.cos(a0), rIn * Math.sin(a0)], [rOut * Math.cos(a0), rOut * Math.sin(a0)], [rOut * Math.cos(a1), rOut * Math.sin(a1)], [rIn * Math.cos(a1), rIn * Math.sin(a1)]];
      const bin = T.prism({ name: `${name}.${i}`, ...H, F: UP, polygon: pts, s0: z0, s1: z1, steps: 2, bevel: 0.25, tone: "hi", crease: "lo", material: "gunmetal" });
      const am = (a0 + a1) / 2;
      const out = Math.cos((a1 - a0) / 2) * rOut;
      const o = [cx + out * Math.cos(am), cy + out * Math.sin(am), (z0 + z1) / 2];
      const tangent = [-Math.sin(am), Math.cos(am), 0];
      const hw = Math.min(2.6, rOut * Math.sin((a1 - a0) / 2) - 1.2);
      T.plane({ part: bin, o, u: tangent, v: [0, 0, 1], normal: [Math.cos(am), Math.sin(am), 0], svg: `<path class="iso-line" data-tone="mid" d="M${-hw} ${-1.3}L${hw} ${-1.3}L${hw} 1.3L${-hw} 1.3Z"/>` });
      const inner = rIn + 1.4;
      const outer = rOut * Math.cos((a1 - a0) / 2) - 1.4;
      const t0 = a0 + rad(2.2);
      const t1 = a1 - rad(2.2);
      const well = [[inner * Math.cos(t0), inner * Math.sin(t0)], [outer * Math.cos(t0), outer * Math.sin(t0)], [outer * Math.cos(t1), outer * Math.sin(t1)], [inner * Math.cos(t1), inner * Math.sin(t1)]];
      T.plane({ part: bin, o: [cx, cy, z1], u: [1, 0, 0], v: [0, 1, 0], svg: `<path class="iso-line" data-tone="lo" d="M${well.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join("L")}Z"/>` });
    }
  };
  tier("carousel.bin.lo", TOP + 2.9, TOP + 13.4, 5.6, 19.2, 0);
  T.round({ name: "carousel.post.0", ...H, F, s0: TOP + 2.9, s1: TOP + 13.4, r: 3.4, tone: "mid", material: "chrome" });
  T.round({ name: "carousel.tray.1", ...H, F, s0: TOP + 13.4, s1: TOP + 14.8, r: 18, tone: "mid", crease: "lo", material: "steel" });
  tier("carousel.bin.hi", TOP + 14.8, TOP + 24.4, 5.6, 17, 22.5);
  T.round({ name: "carousel.post.1", ...H, F, s0: TOP + 14.8, s1: TOP + 24.4, r: 3.4, tone: "mid", material: "chrome" });
  T.round({ name: "carousel.cap", ...H, F, s0: TOP + 24.4, s1: TOP + 25.6, r: 7, tone: "mid", crease: "lo", material: "steel" });
  const knob = T.round({ name: "carousel.knob", ...H, F, s0: TOP + 25.6, s1: TOP + 31, r: 2.4, tone: "hi", crease: "lo", material: "brass", details: { ribs: { s0: TOP + 25.6, s1: TOP + 31, count: 28, fade: [0.08, 0.5], tone: "lo" } } });
  T.plane({ part: knob, o: [cx, cy, TOP + 31], u: [1, 0, 0], v: [0, 1, 0], svg: `<path class="iso-line" data-tone="mid" d="M0.7 0L2.4 0"/><circle class="iso-line" data-tone="mid" r="0.7"/>` });
}

// ---------- build ----------
floor();
counter();
positions();
lever();
dispenser();
loft();
dumbwaiter();
carouselParts();
const { out, layerOf } = W.finish({ T, poses, verify });
if (argv.includes("--audit")) {
  A.auditOrExit(R, P);
  TA.orbitOrExit(T, R, P, {
    sweep: { at: (x) => ({ carousel: x }), from: 0, to: 360, frame: 0.3 },
    quick: argv.includes("--quick"),
    only: argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? null,
    log: argv.includes("--verbose") ? (text) => console.log(`  … ${text}`) : null,
  });
}

// ---------- page ----------
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const page = W.page({
  title: "Cache aside",
  fig: "Fig 5",
  hint: "Drag across · ← → load · ↑ ↓ miss rate",
  readout: `${fmt(PRESET.rps)} rps · ${Math.round(MISS * 100)}% miss · stock loft 6%`,
  keys: [
    { mark: "lit", label: "The dumbwaiter on a miss" },
    { mark: "raised", label: "Bin carousel: Redis, read on every request" },
    { mark: "flat", label: "Dials: utilization" },
  ],
  caption: `Every request turns the carousel; only a miss sends the dumbwaiter up to the stock loft. At the preset's ${fmt(PRESET.rps)} rps and ${Math.round(MISS * 100)}% miss, Postgres runs at 6%. With a cold cache every request makes the trip, and past ${fmt(DB_CAP)} rps the loft saturates, while the counter's two positions hold ${fmt(API_CAP)}. Numbers from the Workbench's own queueing engine running the Cache Aside preset.`,
  label: "A shop parts counter. Customers take a number at a dispenser in front, two service positions with call bells and busy dials work the counter, and a revolving bin carousel on the countertop holds the hot parts. A lever on the counter sets the miss rate, and every miss sends a dumbwaiter car up its shaft to a stock loft with shelving, a ledger desk and the loft's dial.",
  width: WIDTH,
  height: HEIGHT,
  stack: ["back", "carousel"],
  liveLayers: ["carousel"],
  layerOf,
  out,
  verify,
  css: readFileSync(join(HERE, "figure.css"), "utf8"),
  stageAttrs: { role: "slider", "aria-label": "Cache aside: drag across the figure or use the left and right arrow keys to set the load, up and down for the miss rate, Home for the preset", "aria-valuemin": 0, "aria-valuemax": RPS_MAX, "aria-valuenow": PRESET.rps, "aria-valuetext": `${fmt(PRESET.rps)} requests per second, ${Math.round(MISS * 100)} percent miss` },
  data: {
    preset: { nodes: PRESET.nodes, edges: PRESET.edges, rps: PRESET.rps },
    rpsMax: RPS_MAX,
    miss: MISS,
    needles: NEEDLES,
    lever: LEVER_DATA,
    dispenser: DISP_DATA,
    tickets: TICKETS,
    dumb: { ...DUMB, car: CAR, carH: CAR_H, rope: ROPE },
  },
  truthCode: TRUTH.code,
  live: readFileSync(join(HERE, "live.js"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `cache-aside${verify ? "-verify" : ""}${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${R.items.length} items · ${out.report.parts} live parts · ${out.report.layers.map((l) => `${l.name}: ${l.planar} planes, ${l.dynamic} dynamic`).join(" · ")} · build ${out.report.seconds.toFixed(1)} s`);
}
export { out, R };
