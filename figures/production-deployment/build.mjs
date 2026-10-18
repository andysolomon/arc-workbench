// Fig 1 · Production Deployment, as an airport terminal cut away with its roof off. Travellers come
// in at the west doors (the customers): self-service kiosks answer most of them (the global edge),
// the rest pass a queue barrier (the API gateway) that splits them evenly into two identical
// check-in halls behind a glazed partition (two availability zones inside the VPC). Each hall's
// three desks read the departures board (Redis) and write to the reservations ledger (PostgreSQL),
// and put every bag on the belt behind them (the event bus), which runs to the baggage hall where
// four handlers (the workers) can't keep up: the bags pile on the carousel while travellers keep
// flowing. The ledger sends copies by pneumatic tube to a small second terminal across the apron
// (the DR replica). Every lamp and pile is the Workbench's own queueing engine, run live.
//
//   node figures/production-deployment/build.mjs [--light] [--audit] [--out=dir]
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

// ---------- truth: the Workbench example and engine ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const EX = TRUTH.WB.EXAMPLES.architecture.find((e) => e.id === "prod");
if (!EX) throw new Error("the prod example is missing from src/paradigms/examples.ts");
const node = (id) => EX.nodes.find((n) => n.id === id);
const edge = (id) => EX.edges.find((e) => e.id === id);
const capOf = (n) => ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / n.ms;
const ORIGIN = edge("edge>gw").w;
const WRK_CAP = capOf(node("wrk"));
const DR_CAP = capOf(node("dr"));
const PG_CAP = capOf(node("pg"));
const HALL_CAP = capOf(node("apia"));
export const RPS_MAX = 20000;
const steadyAt = (rps, origin = ORIGIN) => {
  const edges = EX.edges.map((e) => (e.id === "edge>gw" ? { ...e, w: origin } : e));
  const sim = TRUTH.WB.makeSim();
  sim.noise = 0;
  let m;
  for (let i = 0; i < 240; i++) m = TRUTH.WB.tick(sim, EX.nodes, edges, rps, 0.25);
  return m;
};
const AT_PRESET = steadyAt(EX.rps);
// below saturation utilization is linear in load: a light probe with every traveller past the
// kiosks says which store tips over first, and where
const probeAll = steadyAt(100, 1);
const DR_TIPS = 100 / probeAll.nodes.dr.util;

// ---------- world: x east, y south (toward the viewer), z up ----------
const WIDTH = 640;
const HEIGHT = 420;
const PLINTH = { x: -150, y: -94, w: 290, d: 226, r: 4 };
const TERM = { x: -135, y: -80, w: 260, d: 150, r: 1.5 };
const FLOOR_Z = 2.5;
const WALL_Z = 34;
const STUB_Z = 9;
const DRB = { x: -66, y: 92, w: 58, d: 30, r: 1.2 };
const DR_WALL_Z = 17;

export const P = k.fitProjection([...k.boxCorners(PLINTH, -12, 0), ...k.boxCorners(TERM, 0, WALL_Z)], WIDTH, HEIGHT, { pad: 26, azimuth: 55, elevation: 42 });
const W = workshop({ P, theme, layers: ["back"] });
const { R, V, at, S, L, D, VERT, put, rad } = W;
const poly = (points) => k.pathOf(points.map(at), true);
// a closed rectangle drawn on a vertical face: y = const (south faces) or x = const (east faces)
const rectY = (y, x0, x1, z0, z1) => poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);
const rectX = (x, y0, y1, z0, z1) => poly([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]);
const slab = (plan, z, h, style = {}, steps = 2, bevel = 0) => S(k.slabOf(plan, z, h, P, steps, bevel), style);

// ---------- the model base: a plinth, the apron on it, and its markings ----------
function base() {
  const apron = k.insetPlan(PLINTH, 1.6);
  const plate = { x: PLINTH.x + PLINTH.w - 88, y: PLINTH.y + PLINTH.d, w: 70, d: 0.8, r: 0.3 };
  const rule = (z, to) => L(k.segment([plate.x + 4, plate.y + 0.8, z], [plate.x + to, plate.y + 0.8, z], P), { tone: "lo", free: true });
  const svg =
    slab(PLINTH, -12, 10.4, { tone: "lo" }, 4, 0.8) +
    slab(apron, -1.6, 1.6, { tone: "mid", crease: "lo" }, 4) +
    // a taxiway centreline from edge to edge, and an aircraft stand marked beside the DR terminal
    L(k.lineOnTop([apron.x, 84], [apron.x + apron.w, 84], 0, P), { tone: "lo" }) +
    L(k.planOutline({ x: 40, y: 92, w: 70, d: 32, r: 4 }, 0, P, 4), { tone: "lo" }) +
    L(k.lineOnTop([75, 92], [75, 124], 0, P), { tone: "faint" }) +
    slab(plate, -9.5, 7, { tone: "mid", crease: "none" }) + rule(-4, 46) + rule(-6, 58) + rule(-8, 30);
  put({ name: "stand.plinth", layer: "back", at: [0, 0, -12], bias: -500, svg, shapes: [A.slab(PLINTH, -12, 10.4, { ground: true }, 4), A.slab(apron, -1.6, 1.6, {}, 4), A.slab(plate, -9.5, 7)] });
}

// ---------- the terminal: floor, the two far walls full height, the near walls cut low ----------
function shell() {
  const tiles = [];
  for (let x = TERM.x + 15; x < TERM.x + TERM.w; x += 15) tiles.push(k.lineOnTop([x, TERM.y], [x, TERM.y + TERM.d], FLOOR_Z, P));
  for (let y = TERM.y + 15; y < TERM.y + TERM.d; y += 15) tiles.push(k.lineOnTop([TERM.x, y], [TERM.x + TERM.w, y], FLOOR_Z, P));
  put({ name: "term.floor", layer: "back", at: [-15, -5, 0], bias: -300, svg: slab(TERM, 0, FLOOR_Z, { tone: "mid" }, 2, 0.4) + L(tiles.join(""), { tone: "faint" }), shapes: [A.slab(TERM, 0, FLOOR_Z, {}, 2)] });
  // north wall: a band of tall windows on its inner face
  const north = { x: TERM.x, y: TERM.y, w: TERM.w, d: 3, r: 0 };
  const windows = [];
  for (let x = TERM.x + 8; x + 14 < TERM.x + TERM.w - 4; x += 19) windows.push(rectY(TERM.y + 3, x, x + 14, 12, 30));
  put({ name: "term.wall.north", layer: "back", at: [-15, TERM.y, FLOOR_Z], bias: -200, svg: slab(north, FLOOR_Z, WALL_Z - FLOOR_Z, { tone: "mid", inner: L(windows.join(""), { tone: "lo" }) }), shapes: [A.slab(north, FLOOR_Z, WALL_Z - FLOOR_Z, {}, 2)] });
  // west wall: the entrance doors on its inner face, two sliding leaves and a transom
  const west = { x: TERM.x, y: TERM.y + 3, w: 3, d: TERM.d - 3, r: 0 };
  const doors = rectX(TERM.x + 3, -14, 0, FLOOR_Z, 22) + rectX(TERM.x + 3, 0, 14, FLOOR_Z, 22) + rectX(TERM.x + 3, -14, 14, 23.5, 28) + [-60, -42, 30, 48].map((y) => rectX(TERM.x + 3, y - 6, y + 6, 12, 30)).join("");
  put({ name: "term.wall.west", layer: "back", at: [TERM.x, 0, FLOOR_Z], bias: -200, svg: slab(west, FLOOR_Z, WALL_Z - FLOOR_Z, { tone: "mid", inner: L(doors, { tone: "lo" }) }), shapes: [A.slab(west, FLOOR_Z, WALL_Z - FLOOR_Z, {}, 2)] });
  // the near walls, cut low so the halls show: their tops are the section
  const south = { x: TERM.x + 3, y: TERM.y + TERM.d - 3, w: TERM.w - 3, d: 3, r: 0 };
  const east = { x: TERM.x + TERM.w - 3, y: TERM.y + 3, w: 3, d: TERM.d - 6, r: 0 };
  put({ name: "term.wall.south", layer: "back", at: [-15, TERM.y + TERM.d, FLOOR_Z], svg: slab(south, FLOOR_Z, STUB_Z - FLOOR_Z, { tone: "lo", crease: "lo" }), shapes: [A.slab(south, FLOOR_Z, STUB_Z - FLOOR_Z, {}, 2)] });
  put({ name: "term.wall.east", layer: "back", at: [TERM.x + TERM.w, 0, FLOOR_Z], svg: slab(east, FLOOR_Z, STUB_Z - FLOOR_Z, { tone: "lo", crease: "lo" }), shapes: [A.slab(east, FLOOR_Z, STUB_Z - FLOOR_Z, {}, 2)] });
}

// ---------- an andon tower: a post with five lamp segments, lit up to the node's utilization ----------
export const ANDONS = [];
function andon(id, x, y, { z0 = FLOOR_Z, post = 10, name = `andon.${id}`, bias = 0 } = {}) {
  const segH = 2.2;
  const r = 1.7;
  let svg = S(k.cylinder(x, y, 2.6, z0, 0.8, P, 20), { tone: "lo" }) + S(k.cylinder(x, y, 0.7, z0 + 0.8, post, P, 12), { tone: "mid", crease: "none" });
  const shapes = [A.cylinder(x, y, 2.6, z0, 0.8), A.cylinder(x, y, 0.7, z0 + 0.8, post)];
  let z = z0 + 0.8 + post;
  for (let i = 0; i < 5; i++) {
    const seg = k.cylinder(x, y, r, z, segH, P, 24);
    svg += S(seg, { tone: "lo", crease: "faint" }) + `<path class="pd-lamp" data-andon="${id}" data-seg="${i}" d="${seg.fill}"/>`;
    shapes.push(A.cylinder(x, y, r, z, segH));
    z += segH;
  }
  svg += S(k.cylinder(x, y, 1.2, z, 0.8, P, 16), { tone: "mid" });
  shapes.push(A.cylinder(x, y, 1.2, z, 0.8));
  ANDONS.push({ id, at: [x, y] });
  put({ name, layer: "back", at: [x, y, z0], bias, svg, shapes });
}

// ---------- a glazed partition along x = const: sill, mullions, head rail and panes ----------
function glazing(name, x, y0, y1, gaps = []) {
  const bay = 14;
  const sillZ = FLOOR_Z + 3;
  const headZ = 26;
  const inGap = (a, b) => gaps.some(([g0, g1]) => a < g1 && b > g0);
  const runs = [];
  let start = y0;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > start) runs.push([start, g0]);
    start = g1;
  }
  if (start < y1) runs.push([start, y1]);
  runs.forEach(([a, b], ri) => {
    const sill = { x: x - 1, y: a, w: 2, d: b - a, r: 0 };
    const head = { x: x - 0.8, y: a, w: 1.6, d: b - a, r: 0 };
    const count = Math.max(1, Math.round((b - a) / bay));
    const step = (b - a) / count;
    const posts = [];
    const panes = [];
    const shapes = [A.slab(sill, FLOOR_Z, sillZ - FLOOR_Z, {}, 2), A.slab(head, headZ, 1.4, {}, 2)];
    for (let i = 0; i <= count; i++) {
      const yy = Math.min(b - 0.6, Math.max(a + 0.6, a + i * step));
      const plan = { x: x - 0.6, y: yy - 0.6, w: 1.2, d: 1.2, r: 0 };
      posts.push(slab(plan, sillZ, headZ - sillZ, { tone: "mid", crease: "none" }));
      shapes.push(A.slab(plan, sillZ, headZ - sillZ, {}, 2));
      if (i < count && !inGap(a + i * step, a + (i + 1) * step)) panes.push(rectX(x, yy + 0.6, Math.min(b - 0.6, a + (i + 1) * step) - 0.6, sillZ, headZ));
    }
    const svg = slab(sill, FLOOR_Z, sillZ - FLOOR_Z, { tone: "lo" }) + `<path class="pd-glass" d="${panes.join("")}"/>` + L(panes.join(""), { tone: "faint" }) + posts.join("") + slab(head, headZ, 1.4, { tone: "mid", crease: "none" });
    put({ name: `${name}.${ri}`, layer: "back", at: [x, (a + b) / 2, FLOOR_Z], svg, shapes });
  });
}

// ---------- kiosks: the global edge, at the entrance ----------
export const KIOSKS = [];
function kiosks() {
  [-52, -34, 26, 44].forEach((y, i) => {
    const x = -118;
    const ped = { x: x - 3.5, y: y - 3, w: 7, d: 6, r: 0.8 };
    const head = { x: x - 4, y: y - 3.6, w: 8, d: 7.2, r: 0.8 };
    const screen = rectX(x + 4, y - 2.6, y + 2.6, 15.6, 20.4);
    const glow = poly([[x + 4, y - 2.1, 16.1], [x + 4, y + 2.1, 16.1], [x + 4, y + 2.1, 19.9], [x + 4, y - 2.1, 19.9]]);
    const slot = rectX(x + 3.5, y - 1.6, y + 1.6, 11, 11.8);
    const svg =
      S(k.slabOf({ x: x - 4.5, y: y - 4, w: 9, d: 8, r: 1 }, FLOOR_Z, 0.8, P, 3), { tone: "lo" }) +
      slab(ped, FLOOR_Z + 0.8, 11.2, { tone: "mid", inner: L(slot, { tone: "lo" }) }, 3, 0.3) +
      slab(head, 14.5, 7, { tone: "hi", crease: "lo" }, 3, 0.4) +
      L(screen, { tone: "lo" }) + `<path class="pd-screen" data-kiosk="${i}" d="${glow}"/>`;
    KIOSKS.push({ y });
    put({ name: `kiosk.${i}`, layer: "back", at: [x, y, FLOOR_Z], svg, shapes: [A.slab({ x: x - 4.5, y: y - 4, w: 9, d: 8, r: 1 }, FLOOR_Z, 0.8, {}, 3), A.slab(ped, FLOOR_Z + 0.8, 11.2, {}, 3), A.slab(head, 14.5, 7, {}, 3)] });
  });
}

// ---------- the queue barrier: the API gateway, one queue that splits into two halls ----------
function barrier() {
  const posts = [[-104, -34], [-104, -18], [-104, 0], [-104, 18], [-104, 34], [-92, -34], [-92, -12], [-92, 12], [-92, 34], [-80, -24], [-80, 0], [-80, 24]];
  const top = FLOOR_Z + 9;
  posts.forEach(([x, y], i) => {
    const svg = S(k.cylinder(x, y, 1.9, FLOOR_Z, 0.6, P, 16), { tone: "lo" }) + S(k.cylinder(x, y, 0.55, FLOOR_Z + 0.6, top - FLOOR_Z - 0.6, P, 10), { tone: "mid", crease: "none" }) + S(k.cylinder(x, y, 0.9, top, 0.9, P, 12), { tone: "hi" });
    put({ name: `gw.post.${i}`, layer: "back", at: [x, y, FLOOR_Z], svg, shapes: [A.cylinder(x, y, 1.9, FLOOR_Z, 0.6), A.cylinder(x, y, 0.55, FLOOR_Z + 0.6, top - FLOOR_Z - 0.6), A.cylinder(x, y, 0.9, top, 0.9)] });
  });
  // the tension belts: post top to post top, so every belt ends on a post
  // each belt runs from cap rim to cap rim, so both ends land on a post's outline
  const belt = (a, b) => {
    const [ax, ay] = posts[a];
    const [bx, by] = posts[b];
    const len = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    return k.segment([ax + ux * 0.9, ay + uy * 0.9, top + 0.45], [bx - ux * 0.9, by - uy * 0.9, top + 0.45], P);
  };
  const belts = [[0, 1], [3, 4], [5, 6], [7, 8], [1, 6], [3, 7], [9, 10], [10, 11]].map(([a, b]) => belt(a, b)).join("");
  put({ name: "gw.belts", layer: "back", at: [-92, 0, top], bias: 0.5, svg: L(belts, { tone: "mid" }), shapes: [A.box([-104.5, -34.5, top], [-79.5, 34.5, top + 0.9])] });
  // the splitter: a sign blade on the centre post pointing both ways (a chevron each side)
  const sign = { x: -81, y: -6, w: 2, d: 12, r: 0.3 };
  const chev = (s) => poly([[-79, s * 1.5, 17], [-79, s * 4.5, 18.5], [-79, s * 1.5, 20]]);
  put({ name: "gw.sign", layer: "back", at: [-80, 0, 16], bias: 1, svg: slab(sign, top + 4, 7, { tone: "hi", crease: "lo" }) + S(k.cylinder(-80, 0, 0.4, top + 0.9, 3.1, P, 8), { tone: "mid" }) + L(chev(-1) + chev(1), { tone: "lo" }), shapes: [A.slab(sign, top + 4, 7, {}, 2), A.cylinder(-80, 0, 0.4, top + 0.9, 3.1)] });
}

// ---------- the information desk and its arrivals lever: the load control ----------
export const LEVER = {};
function infoDesk() {
  const desk = { x: -128, y: 54, w: 24, d: 12, r: 1.2 };
  const top = 12;
  const slotPlan = { x: desk.x + 3, y: desk.y + 4.6, w: 20, d: 2.2, r: 1.1 };
  const t = k.topTicks(slotPlan.x + 1, slotPlan.x + slotPlan.w - 1, 2.25, 4, slotPlan.y + slotPlan.d + 0.4, top, [1, 1.8], P);
  const strip = { x: slotPlan.x, y: slotPlan.y + slotPlan.d + 0.4, w: slotPlan.w, d: 2.4, r: 0.4 };
  const svg =
    slab(desk, FLOOR_Z, top - FLOOR_Z, { tone: "mid", inner: L(k.sideSeam(desk, top - 2.4, P, 3), { tone: "faint" }) }, 3, 0.6) +
    L(k.planOutline(slotPlan, top, P, 4), { tone: "lo" }) +
    S(k.slabOf(strip, top, 0.3, P, 2), { tone: "lo", crease: "none" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" });
  put({ name: "info.desk", layer: "back", at: [desk.x + 13, desk.y + 6, FLOOR_Z], svg, shapes: [A.slab(desk, FLOOR_Z, top - FLOOR_Z, {}, 3), A.slab(strip, top, 0.3, {}, 2)] });
  // the lever, built at zero load and slid along the slot by the live code
  const x0 = slotPlan.x + 1.6;
  const y0 = slotPlan.y + slotPlan.d / 2;
  const knob = S(k.cylinder(x0, y0, 0.55, top, 4.4, P, 10), { tone: "mid", crease: "none" }) + S(G.sphereOf([x0, y0, top + 5.4], 1.5, P), { tone: "hi" });
  LEVER.span = slotPlan.w - 3.2;
  LEVER.from = [x0, y0];
  put({ name: "info.lever", layer: "back", at: [x0, y0, top], bias: 1, svg: `<g data-ref="lever">${knob}</g>`, shapes: [A.cylinder(x0, y0, 0.55, top, 4.4), A.ball([x0, y0, top + 5.4], 1.5)] });
}

// ---------- a check-in hall: three desks, a monitor on each, a bag scale onto the belt ----------
function hall(id, ys, lampY) {
  ys.forEach((y, i) => {
    const desk = { x: 0, y: y - 6, w: 11, d: 12, r: 1 };
    const scale = { x: 11.4, y: y - 3, w: 3.4, d: 6, r: 0.4 };
    const mon = { x: 3, y: y - 2.2, w: 2.2, d: 4.4, r: 0.3 };
    const svg =
      slab(desk, FLOOR_Z, 7.5, { tone: "mid", inner: L(k.sideSeam(desk, FLOOR_Z + 5.5, P, 2), { tone: "faint" }) }, 2, 0.4) +
      slab(scale, FLOOR_Z, 4, { tone: "lo" }, 2) +
      slab(mon, FLOOR_Z + 7.5, 4.4, { tone: "hi", crease: "lo" }, 2) +
      L(rectX(mon.x + mon.w, y - 1.6, y + 1.6, FLOOR_Z + 8.3, FLOOR_Z + 11.1), { tone: "lo" }) +
      `<circle class="pd-dot" data-desk="${id}" cx="${at([mon.x + mon.w, y, FLOOR_Z + 9.7])[0].toFixed(2)}" cy="${at([mon.x + mon.w, y, FLOOR_Z + 9.7])[1].toFixed(2)}" r="${(0.75 * G.scaleOf(P)).toFixed(2)}"/>`;
    put({ name: `hall.${id}.desk.${i}`, layer: "back", at: [5.5, y, FLOOR_Z], svg, shapes: [A.slab(desk, FLOOR_Z, 7.5, {}, 2), A.slab(scale, FLOOR_Z, 4, {}, 2), A.slab(mon, FLOOR_Z + 7.5, 4.4, {}, 2)] });
  });
  // a queue lane in front of each desk: four posts, two belts, and three luggage slots that stand
  // full as the hall gets busier (the travellers themselves are not drawn)
  const top = FLOOR_Z + 8;
  const belts = [];
  ys.forEach((y, i) => {
    for (const [px, py] of [[-20, y - 4], [-20, y + 4], [-4, y - 4], [-4, y + 4]]) {
      put({ name: `hall.${id}.post.${i}.${px}.${py}`, layer: "back", at: [px, py, FLOOR_Z], svg: S(k.cylinder(px, py, 1.6, FLOOR_Z, 0.5, P, 14), { tone: "lo" }) + S(k.cylinder(px, py, 0.45, FLOOR_Z + 0.5, top - FLOOR_Z - 0.5, P, 10), { tone: "mid", crease: "none" }) + S(k.cylinder(px, py, 0.75, top, 0.8, P, 12), { tone: "hi" }), shapes: [A.cylinder(px, py, 1.6, FLOOR_Z, 0.5), A.cylinder(px, py, 0.45, FLOOR_Z + 0.5, top - FLOOR_Z - 0.5), A.cylinder(px, py, 0.75, top, 0.8)] });
    }
    for (const py of [y - 4, y + 4]) belts.push(k.segment([-20 + 0.75, py, top + 0.4], [-4 - 0.75, py, top + 0.4], P));
    [-7, -11.5, -16].forEach((x, j) => {
      const bag = { x: x - 1.5, y: y - 1.1, w: 3, d: 2.2, r: 0.4 };
      const svg = `<g data-luggage="${id}" data-slot="${j}">${slab(bag, FLOOR_Z, 4.4, { tone: "mid", crease: "lo" }, 2, 0.2)}${S(k.cylinder(x, y, 0.3, FLOOR_Z + 4.4, 2.2, P, 8), { tone: "mid", crease: "none" })}</g>`;
      put({ name: `hall.${id}.luggage.${i}.${j}`, layer: "back", at: [x, y, FLOOR_Z], svg, shapes: [A.slab(bag, FLOOR_Z, 4.4, {}, 2), A.cylinder(x, y, 0.3, FLOOR_Z + 4.4, 2.2)] });
    });
  });
  put({ name: `hall.${id}.belts`, layer: "back", at: [-12, (ys[0] + ys[2]) / 2, top], bias: 0.5, svg: L(belts.join(""), { tone: "mid" }), shapes: [A.box([-20, ys[0] - 4.4, top], [-4, ys[2] + 4.4, top + 0.8])] });
  andon(id, -60, lampY, { name: `hall.${id}.andon` });
}

// ---------- the departures board: Redis, read by both halls, on the spine wall between them ----------
function spineAndBoard() {
  const spine = { x: -70, y: -4, w: 70, d: 3, r: 0 };
  const board = { x: -52, y: -1, w: 46, d: 1.4, r: 0.3 };
  const rows = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) rows.push(rectY(board.y + board.d, board.x + 3 + c * 21.5, board.x + 3 + c * 21.5 + 18.5, 11.2 + r * 2.4, 12.8 + r * 2.4));
  const svg = slab(spine, FLOOR_Z, 22 - FLOOR_Z, { tone: "mid", inner: L(k.sideSeam(spine, 20, P, 2), { tone: "faint" }) }) + slab(board, 9.5, 13, { tone: "lo", crease: "lo" }, 2, 0.3) + L(rows.join(""), { tone: "mid" }) + `<path class="pd-board" d="${rows.join("")}"/>`;
  put({ name: "board", layer: "back", at: [-35, -2.5, FLOOR_Z], svg, shapes: [A.slab(spine, FLOOR_Z, 22 - FLOOR_Z, {}, 2), A.slab(board, 9.5, 13, {}, 2)] });
}

// ---------- conveyors: the bag belts behind the desks, and the main belt to the baggage hall ----------
export const LANES = {};
function conveyor(name, plan, along, lane) {
  const top = 7;
  const rollers = [];
  if (along === "y") for (let y = plan.y + 2; y < plan.y + plan.d - 0.5; y += 3) rollers.push(k.lineOnTop([plan.x, y], [plan.x + plan.w, y], top, P));
  else for (let x = plan.x + 2; x < plan.x + plan.w - 0.5; x += 3) rollers.push(k.lineOnTop([x, plan.y], [x, plan.y + plan.d], top, P));
  const legs = [];
  const shapes = [A.slab(plan, top - 1.6, 1.6, {}, 2)];
  const stations = along === "y" ? [plan.y + 3, plan.y + plan.d - 3] : [plan.x + 3, plan.x + plan.w - 3];
  for (const s of stations) for (const side of [0, 1]) {
    const lp = along === "y" ? { x: side ? plan.x + plan.w - 1.6 : plan.x + 0.4, y: s - 0.6, w: 1.2, d: 1.2, r: 0 } : { x: s - 0.6, y: side ? plan.y + plan.d - 1.6 : plan.y + 0.4, w: 1.2, d: 1.2, r: 0 };
    legs.push(slab(lp, FLOOR_Z, top - 1.6 - FLOOR_Z, { tone: "lo", crease: "none" }));
    shapes.push(A.slab(lp, FLOOR_Z, top - 1.6 - FLOOR_Z, {}, 2));
  }
  put({ name, layer: "back", at: [plan.x + plan.w / 2, plan.y + plan.d / 2, FLOOR_Z], svg: legs.join("") + slab(plan, top - 1.6, 1.6, { tone: "lo", crease: "lo" }, 2, 0.3) + L(rollers.join(""), { tone: "faint" }), shapes });
  // the lane over the belt where bags ride: an empty group the live code fills, ordered as the
  // volume the bags occupy
  LANES[lane] = { plan, along, z: top };
  put({ name: `${name}.bags`, layer: "back", at: [plan.x + plan.w / 2, plan.y + plan.d / 2, top], bias: 0.2, svg: `<g data-bags="${lane}"></g>`, shapes: [A.box([plan.x + 0.5, plan.y + 0.5, top], [plan.x + plan.w - 0.5, plan.y + plan.d - 0.5, top + 3.4])] });
}

// ---------- the baggage hall: a low wall with a belt opening, the carousel, four handlers ----------
export const PILE = [];
const CAR = [86, -6];
const CAR_R = 20;
function baggageHall() {
  // low wall on the VPC's east edge, open where the main belt passes
  for (const [name, y0, y1] of [["n", TERM.y + 3, -9], ["s", 9, TERM.y + TERM.d - 3]]) {
    const w = { x: 44, y: y0, w: 2.4, d: y1 - y0, r: 0 };
    put({ name: `bag.wall.${name}`, layer: "back", at: [45, (y0 + y1) / 2, FLOOR_Z], svg: slab(w, FLOOR_Z, 13 - FLOOR_Z, { tone: "mid", inner: L(k.sideSeam(w, 10.5, P, 2), { tone: "faint" }) }), shapes: [A.slab(w, FLOOR_Z, 13 - FLOOR_Z, {}, 2)] });
  }
  // the carousel: a round bed, slats from hub to rim, a hub, and slots where the backlog piles
  const [cx, cy] = CAR;
  const bedTop = 8;
  const slats = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    slats.push(k.lineOnTop([cx + Math.cos(a) * 9, cy + Math.sin(a) * 9], [cx + Math.cos(a) * (CAR_R - 0.4), cy + Math.sin(a) * (CAR_R - 0.4)], bedTop, P));
  }
  const bag = (x, y, z, i) => {
    const plan = { x: x - 2.2, y: y - 1.6, w: 4.4, d: 3.2, r: 0.6 };
    PILE.push({ i });
    return `<g data-pile="${i}">${S(k.slabOf(plan, z, 3.2, P, 2, 0.3), { tone: "hi", crease: "lo" })}${L(k.lineOnTop([x - 1, y], [x + 1, y], z + 3.2, P), { tone: "lo", free: true })}</g>`;
  };
  // slots round the bed, in two layers: a bag is drawn after the bags it sits in front of
  const slots = [];
  for (let layer = 0; layer < 2; layer++) {
    const n = layer ? 9 : 14;
    for (let j = 0; j < n; j++) {
      const a = ((j + (layer ? 0.5 : 0)) / n) * Math.PI * 2 + 0.3;
      const r = layer ? 14.5 : 15.5;
      slots.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, z: bedTop + layer * 3.2, layer });
    }
  }
  const depth = (s) => G.dot3([s.x, s.y, s.z], V);
  const far = slots.filter((s) => G.dot3([s.x - cx, s.y - cy, 0], V) < 0).sort((p, q) => depth(p) - depth(q));
  const near = slots.filter((s) => G.dot3([s.x - cx, s.y - cy, 0], V) >= 0).sort((p, q) => depth(p) - depth(q));
  // pile order: the first bags to appear are the near low ones, so the pile grows from the front
  const order = [...near.filter((s) => !s.layer), ...far.filter((s) => !s.layer), ...near.filter((s) => s.layer), ...far.filter((s) => s.layer)];
  const index = new Map(order.map((s, i) => [s, i]));
  const svg =
    S(k.cylinder(cx, cy, CAR_R + 1.6, FLOOR_Z, 2, P, 72), { tone: "lo" }) +
    S(k.cylinder(cx, cy, CAR_R, FLOOR_Z + 2, bedTop - FLOOR_Z - 2, P, 96, 0.5), { tone: "mid", crease: "lo" }) +
    L(slats.join(""), { tone: "faint" }) +
    far.map((s) => bag(s.x, s.y, s.z, index.get(s))).join("") +
    S(k.cylinder(cx, cy, 8.4, bedTop, 7, P, 48, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideArc(cx, cy, 8.4, bedTop + 3.5, P, 32), { tone: "faint" }) }) +
    near.map((s) => bag(s.x, s.y, s.z, index.get(s))).join("") +
    // the backlog beacon on the hub: the one lit accent, on while bags arrive faster than they leave
    S(k.cylinder(cx, cy, 2.2, bedTop + 7, 1.2, P, 20), { tone: "mid" }) + S(G.sphereOf([cx, cy, bedTop + 8.2 + 1.9], 1.9, P), { tone: "hi" }) + `<circle class="pd-beacon" cx="${at([cx, cy, bedTop + 10.1])[0].toFixed(2)}" cy="${at([cx, cy, bedTop + 10.1])[1].toFixed(2)}" r="${(1.5 * G.scaleOf(P)).toFixed(2)}"/>`;
  put({ name: "carousel", layer: "back", at: [cx, cy, FLOOR_Z], svg, shapes: [A.cylinder(cx, cy, CAR_R + 1.6, FLOOR_Z, 2), A.cylinder(cx, cy, CAR_R, FLOOR_Z + 2, bedTop - FLOOR_Z - 2), A.cylinder(cx, cy, 8.4, bedTop, 7), A.cylinder(cx, cy, 2.2, bedTop + 7, 1.2), A.ball([cx, cy, bedTop + 10.1], 1.9)] });
  // four handlers' stations: a tug with a cab, each with a work lamp lit by the workers' load
  [[60, -50], [112, -36], [60, 34], [112, 28]].forEach(([x, y], i) => {
    const body = { x: x - 6, y: y - 3.5, w: 12, d: 7, r: 1 };
    const cab = { x: x - 6, y: y - 3.5, w: 5, d: 7, r: 1 };
    const wheels = [[x - 4, y - 3.5], [x + 4, y - 3.5], [x - 4, y + 3.5], [x + 4, y + 3.5]];
    let svg = "";
    const shapes = [];
    for (const [wx, wy] of wheels.filter(([, wy]) => wy < y)) {
      const WF = G.frameAlong([wx, wy - 0.9, FLOOR_Z + 1.6], [0, 1, 0]);
      svg += S(G.disc(-0.1, 1, 1.6, WF, P), { tone: "lo" });
      shapes.push(A.disc(WF, -0.1, 1, 1.6));
    }
    svg += slab(body, FLOOR_Z + 1.6, 3.4, { tone: "mid", crease: "lo" }, 3, 0.4) + slab(cab, FLOOR_Z + 5, 4.6, { tone: "hi", crease: "lo" }, 3, 0.3) + L(rectY(y + 3.5, x - 5.2, x - 1.8, FLOOR_Z + 6.2, FLOOR_Z + 8.8), { tone: "lo" });
    shapes.push(A.slab(body, FLOOR_Z + 1.6, 3.4, {}, 3), A.slab(cab, FLOOR_Z + 5, 4.6, {}, 3));
    for (const [wx, wy] of wheels.filter(([, wy]) => wy > y)) {
      const WF = G.frameAlong([wx, wy - 0.1, FLOOR_Z + 1.6], [0, 1, 0]);
      svg += S(G.disc(0, 1.1, 1.6, WF, P), { tone: "lo" }) + D([at(G.pointOf(WF, 1.1, 0, 0))], { size: 0.4 });
      shapes.push(A.disc(WF, 0, 1.1, 1.6));
    }
    const lamp = [x - 3.5, y, FLOOR_Z + 9.6];
    svg += S(k.cylinder(lamp[0], lamp[1], 0.9, FLOOR_Z + 9.6, 0.9, P, 12), { tone: "lo" }) + `<circle class="pd-dot" data-handler="${i}" cx="${at([lamp[0], lamp[1], FLOOR_Z + 11])[0].toFixed(2)}" cy="${at([lamp[0], lamp[1], FLOOR_Z + 11])[1].toFixed(2)}" r="${(0.9 * G.scaleOf(P)).toFixed(2)}"/>`;
    shapes.push(A.cylinder(lamp[0], lamp[1], 0.9, FLOOR_Z + 9.6, 0.9));
    put({ name: `handler.${i}`, layer: "back", at: [x, y, FLOOR_Z], svg, shapes });
  });
}

// ---------- the reservations ledger: PostgreSQL, a lectern with the open book ----------
function ledger() {
  const desk = { x: -46, y: 48, w: 18, d: 11, r: 1 };
  const top = 10;
  const x0 = desk.x + 2.5;
  const pageL = poly([[x0, 50.5, top], [x0 + 6.3, 50.5, top + 1.2], [x0 + 6.3, 57, top + 1.2], [x0, 57, top]]);
  const pageR = poly([[x0 + 6.7, 50.5, top + 1.2], [x0 + 13, 50.5, top], [x0 + 13, 57, top], [x0 + 6.7, 57, top + 1.2]]);
  const lines = [0, 1, 2, 3].map((i) => k.segment([x0 + 1, 52 + i * 1.3, top + 0.2], [x0 + 5.3, 52 + i * 1.3, top + 1], P)).join("");
  const riser = { x: -41, y: 59, w: 8, d: 3, r: 0.4 };
  const svg =
    slab(desk, FLOOR_Z, top - FLOOR_Z, { tone: "mid", inner: L(k.sideSeam(desk, top - 2.5, P, 2), { tone: "faint" }) }, 2, 0.5) +
    `<path class="iso-top" d="${pageL}${pageR}"/>` + L(pageL + pageR, { tone: "mid" }) + L(lines, { tone: "lo", free: true }) +
    slab(riser, FLOOR_Z, 17 - FLOOR_Z, { tone: "lo", crease: "lo" }, 2, 0.3);
  put({ name: "ledger", layer: "back", at: [-37, 54, FLOOR_Z], svg, shapes: [A.slab(desk, FLOOR_Z, top - FLOOR_Z, {}, 2), A.slab(riser, FLOOR_Z, 17 - FLOOR_Z, {}, 2)] });
  andon("pg", -54, 55, { name: "ledger.andon" });
}

// ---------- the records room (audit archive) and the operations desk (observability) ----------
export const DIALS = {};
function dial(id, c, z, r, { count = 16, every = 4, from = rad(-120), span = rad(240) } = {}) {
  const t = k.radialTicks(c[0], c[1], r, count, every, z, [Math.max(0.6, r * 0.13), Math.max(1.2, r * 0.26)], P, from, span);
  DIALS[id] = { c, z, from, span, r0: Math.max(0.6, r * 0.14), r1: r * 0.8 };
  return L(k.ring(c[0], c[1], r, z, P, 48), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(k.ring(c[0], c[1], DIALS[id].r0, z, P, 12), { tone: "mid" }) +
    `<path class="iso-line" data-tone="hi" data-free="end" data-dial="${id}" d="${k.lineOnTop([c[0], c[1] - DIALS[id].r0], [c[0], c[1] - DIALS[id].r1], z, P)}"/>`;
}
function offices() {
  // the records room in the north-east corner: walls cut low on the near side, three cabinets
  const wWall = { x: 92, y: TERM.y + 3, w: 2.4, d: 22, r: 0 };
  const sWall = { x: 92, y: TERM.y + 25, w: TERM.x + TERM.w - 3 - 92, d: 2.4, r: 0 };
  put({ name: "records.wall.w", layer: "back", at: [93, TERM.y + 14, FLOOR_Z], svg: slab(wWall, FLOOR_Z, 22 - FLOOR_Z, { tone: "mid" }), shapes: [A.slab(wWall, FLOOR_Z, 22 - FLOOR_Z, {}, 2)] });
  put({ name: "records.wall.s", layer: "back", at: [107, TERM.y + 26, FLOOR_Z], svg: slab(sWall, FLOOR_Z, 7 - FLOOR_Z, { tone: "lo", crease: "lo" }) + L(rectY(sWall.y + sWall.d, 98, 106, FLOOR_Z, 6.6), { tone: "faint" }), shapes: [A.slab(sWall, FLOOR_Z, 7 - FLOOR_Z, {}, 2)] });
  [96, 105, 114].forEach((x, i) => {
    const cab = { x, y: TERM.y + 5, w: 7.5, d: 8, r: 0.4 };
    const drawers = [0, 1, 2, 3].map((j) => rectY(cab.y + cab.d, x + 1, x + 6.5, FLOOR_Z + 1.4 + j * 3.6, FLOOR_Z + 4.2 + j * 3.6)).join("");
    put({ name: `records.cab.${i}`, layer: "back", at: [x + 3.75, cab.y + 4, FLOOR_Z], svg: slab(cab, FLOOR_Z, 15, { tone: "mid", crease: "lo", inner: L(drawers, { tone: "lo" }) }, 2, 0.4), shapes: [A.slab(cab, FLOOR_Z, 15, {}, 2)] });
  });
  // the operations desk: a console with a telemetry dial, in the baggage hall's south-east corner
  const con = { x: 98, y: 50, w: 20, d: 12, r: 1 };
  const svg = slab(con, FLOOR_Z, 9 - FLOOR_Z, { tone: "mid", inner: L(k.sideSeam(con, 7, P, 2), { tone: "faint" }) }, 2, 0.5) + dial("obs", [108, 56], 9, 4.6) + slab({ x: 100, y: 51, w: 3, d: 10, r: 0.3 }, 9, 5, { tone: "hi", crease: "lo" }, 2) + L(rectX(103, 52.5, 59.5, 10.2, 13.2), { tone: "lo" });
  put({ name: "ops.desk", layer: "back", at: [108, 56, FLOOR_Z], svg, shapes: [A.slab(con, FLOOR_Z, 9 - FLOOR_Z, {}, 2), A.slab({ x: 100, y: 51, w: 3, d: 10, r: 0.3 }, 9, 5, {}, 2)] });
}

// ---------- the DR terminal across the apron, and the tube that carries ledger copies to it ----------
function drTerminal() {
  const floor = { ...DRB };
  const north = { x: DRB.x, y: DRB.y, w: DRB.w, d: 2.4, r: 0 };
  const west = { x: DRB.x, y: DRB.y + 2.4, w: 2.4, d: DRB.d - 2.4, r: 0 };
  const south = { x: DRB.x + 2.4, y: DRB.y + DRB.d - 2.4, w: DRB.w - 2.4, d: 2.4, r: 0 };
  const east = { x: DRB.x + DRB.w - 2.4, y: DRB.y + 2.4, w: 2.4, d: DRB.d - 4.8, r: 0 };
  const windows = [];
  for (let x = DRB.x + 6; x + 9 < DRB.x + DRB.w - 4; x += 13) windows.push(rectY(DRB.y + 2.4, x, x + 9, 8, 17));
  put({ name: "dr.floor", layer: "back", at: [DRB.x + DRB.w / 2, DRB.y + DRB.d / 2, 0], bias: -100, svg: slab(floor, 0, 2, { tone: "mid" }, 2, 0.3), shapes: [A.slab(floor, 0, 2, {}, 2)] });
  put({ name: "dr.wall.n", layer: "back", at: [DRB.x + DRB.w / 2, DRB.y, 2], bias: -50, svg: slab(north, 2, DR_WALL_Z - 2, { tone: "mid", inner: L(windows.join(""), { tone: "lo" }) }), shapes: [A.slab(north, 2, DR_WALL_Z - 2, {}, 2)] });
  put({ name: "dr.wall.w", layer: "back", at: [DRB.x, DRB.y + DRB.d / 2, 2], bias: -50, svg: slab(west, 2, DR_WALL_Z - 2, { tone: "mid" }), shapes: [A.slab(west, 2, DR_WALL_Z - 2, {}, 2)] });
  put({ name: "dr.wall.s", layer: "back", at: [DRB.x + DRB.w / 2, DRB.y + DRB.d, 2], svg: slab(south, 2, 6 - 2, { tone: "lo", crease: "lo" }), shapes: [A.slab(south, 2, 4, {}, 2)] });
  put({ name: "dr.wall.e", layer: "back", at: [DRB.x + DRB.w, DRB.y + DRB.d / 2, 2], svg: slab(east, 2, 6 - 2, { tone: "lo", crease: "lo" }), shapes: [A.slab(east, 2, 4, {}, 2)] });
  // the DR ledger: a smaller lectern and its book, its own andon tower
  const desk = { x: -50, y: 102, w: 16, d: 10, r: 1 };
  const page = poly([[-48, 104, 9], [-36, 104, 9], [-36, 110, 9], [-48, 110, 9]]);
  put({ name: "dr.ledger", layer: "back", at: [-42, 107, 2], svg: slab(desk, 2, 7, { tone: "mid" }, 2, 0.4) + `<path class="iso-top" d="${page}"/>` + L(page + k.lineOnTop([-42, 104], [-42, 110], 9, P), { tone: "mid" }), shapes: [A.slab(desk, 2, 7, {}, 2)] });
  andon("dr", -24, 106, { z0: 2, name: "dr.andon" });
  // the pneumatic tube: from the ledger's riser, south over the cut wall, to a boss on the DR north wall
  W.conduit("tube.wal", [[-37, 62, 14], [-37, DRB.y, 14]], [0, 1, 0], [0, -1, 0], { r: 1.6 });
}

base();
shell();
kiosks();
barrier();
infoDesk();
glazing("vpc.west", -72, TERM.y + 3, TERM.y + TERM.d - 3, [[-26, -14], [14, 26]]);
spineAndBoard();
hall("apia", [-64, -46, -28], -64);
hall("apib", [18, 36, 54], 10);
conveyor("belt.a", { x: 15, y: -70, w: 7, d: 66, r: 0.4 }, "y", "a");
conveyor("belt.b", { x: 15, y: 4, w: 7, d: 58, r: 0.4 }, "y", "b");
conveyor("belt.main", { x: 15, y: -4, w: 49, d: 8, r: 0.4 }, "x", "main");
glazing("vpc.east", 42, TERM.y + 3, TERM.y + TERM.d - 3, [[-9, 9]]);
baggageHall();
ledger();
offices();
drTerminal();

const { layerOf } = W.finish();
if (argv.includes("--audit")) A.auditOrExit(R, P);

// ---------- page ----------
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const busArr = AT_PRESET.nodes.bus.arr;
const halls = AT_PRESET.nodes.apia.arr;
const css = `
.pd-lamp{fill:var(--anatomy-hi);stroke:none;opacity:var(--pd-on,0)}
.pd-dot{fill:var(--anatomy-hi);stroke:none;opacity:var(--pd-on,.08)}
.pd-screen{fill:var(--anatomy-hi);stroke:none;opacity:var(--pd-on,.1)}
.pd-board{fill:var(--anatomy-mid);stroke:none;opacity:.35}
.pd-glass{fill:var(--anatomy-faint);stroke:none;opacity:.28}
.iso[data-theme="light"] .pd-glass{opacity:.42}
.pd-beacon{fill:var(--anatomy-lit);stroke:none;opacity:var(--pd-on,0)}
`;
const page = W.page({
  title: "Production deployment",
  fig: "Fig 1",
  hint: "Drag across · ← → travellers · ↑ ↓ kiosks",
  readout: `${fmt(EX.rps)} rps · kiosks ${Math.round((1 - ORIGIN) * 100)}% · ${Math.round(AT_PRESET.sys.p50)} ms · bags +${fmt(busArr - WRK_CAP)}/s`,
  keys: [
    { mark: "lit", label: "Bags arriving faster than the handlers clear them" },
    { mark: "raised", label: "Lamp towers: each hall, the ledger and the DR copy" },
    { mark: "edge", label: "Glazed partition: the private VPC" },
  ],
  caption: `At the example's ${fmt(EX.rps)} rps the kiosks answer ${Math.round((1 - ORIGIN) * 100)}% of travellers; each hall checks in ${fmt(halls)} a second against the ${fmt(HALL_CAP)} its three desks can serve. Every desk puts bags on the belt: ${fmt(busArr)} a second reach four handlers who clear ${fmt(WRK_CAP)}, so the carousel fills while travellers keep moving at ${Math.round(AT_PRESET.sys.p50)} ms. Send everyone past the kiosks and the DR copy, the smallest store (${fmt(DR_CAP)} against the ledger's ${fmt(PG_CAP)}), saturates first, at ${fmt(DR_TIPS)} rps. The numbers come from the Workbench's own queueing engine running the Production Deployment example.`,
  label: "A production deployment as an airport terminal with its roof off. Travellers come in at the west doors; four self-service kiosks answer most of them, and the rest pass a queue barrier that splits them into two identical check-in halls behind a glazed partition. Each hall has three desks that read the departures board on the wall between them and record bookings in the reservations ledger, and every desk puts bags on a belt that runs to the baggage hall, where four handlers' tugs work round a carousel on which the bags pile up. A pneumatic tube carries ledger copies across the apron to a small second terminal. Lamp towers show how busy each hall, the ledger and the copy are.",
  width: WIDTH,
  height: HEIGHT,
  stack: ["back"],
  layerOf,
  css,
  stageAttrs: { role: "slider", "aria-label": "Production deployment: drag across the figure or use the left and right arrow keys to set how many travellers arrive, up and down for the share the kiosks answer, Home for the example's values", "aria-valuemin": 0, "aria-valuemax": RPS_MAX, "aria-valuenow": EX.rps, "aria-valuetext": `${EX.rps} requests per second` },
  data: { preset: { nodes: EX.nodes, edges: EX.edges, rps: EX.rps }, rpsMax: RPS_MAX, origin: ORIGIN, wrkCap: WRK_CAP, dials: DIALS, andons: ANDONS, kiosks: KIOSKS.length, lever: LEVER, lanes: LANES, pile: PILE.length, car: CAR, carR: CAR_R },
  truthCode: TRUTH.code,
  live: readFileSync(join(HERE, "live.js"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `production-deployment${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${R.items.length} items · ${R.solids.length} solids · ${R.tubes.length} tube runs · DR tips at ${fmt(DR_TIPS)} rps`);
}
export { R };
