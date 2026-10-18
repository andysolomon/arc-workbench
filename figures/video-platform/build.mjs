// Fig 2 · Video Platform. The Workbench's `video` preset as a film lab and projection room on one
// long table. Viewers watch a screen; the projector on its cart answers 75% of screenings from the
// reels on its shelf (the Edge CDN), and the misses go down a cable to the projectionist's console
// (Playback API), which reads its schedule card rack (Redis manifests) and the card catalogue
// (Metadata DB). Uploads are exposed cans posted into an intake box (gateway + Upload Service):
// they pile in a can tray (the transcode queue) beside six developing tanks (the transcode
// workers), which develop slowly and file three prints per can into a flat-file vault (Object
// Storage). The catalogue's change log prints on a glass-dome ticker (CDC → video.events), and the
// tape runs past a tally counter (analytics), an index-card sorter (search) and a desk bell
// (notifications). Dials, cranks, the can pile and the bell are driven by the Workbench's own
// queueing engine, which this page runs live.
//
//   node figures/video-platform/build.mjs [--light] [--audit] [--out=dir]
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

// ---------- truth: the Workbench preset and engine ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const PRESET = TRUTH.WB.PRESETS.find((p) => p.id === "video");
if (!PRESET) throw new Error("the video preset is missing from src/paradigms/presets.ts");
const node = (id) => PRESET.nodes.find((n) => n.id === id);
const edge = (id) => PRESET.edges.find((e) => e.id === id);
const capOf = (n) => ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / n.ms;
const SHARE = edge("cl>gw").w;
const MISS = edge("cdn>play").w;
const RENDITIONS = edge("tw>s3").w;
const TW_CAP = capOf(node("tw"));
const TANKS = node("tw").inst;
export const RPS_MAX = 8000;
export const SHARE_MAX = 0.4;
// where the analytics pipeline tips over at the preset's upload share: utilization is linear in load
// below saturation, so a light probe of the engine finds it
const probe = (() => {
  const sim = TRUTH.WB.makeSim();
  sim.noise = 0;
  let m;
  for (let i = 0; i < 240; i++) m = TRUTH.WB.tick(sim, PRESET.nodes, PRESET.edges, 100, 0.25);
  return m;
})();
const AN_AT = 100 / probe.nodes.an.util;
if (TANKS !== 6) throw new Error(`the figure draws six developing tanks; the preset has ${TANKS} transcode workers`);

// ---------- camera and world ----------
const WIDTH = 640;
const HEIGHT = 372;
const BENCH = { x: -188, y: -108, w: 350, d: 164, r: 9 };
export const P = k.fitProjection(
  [...k.boxCorners(BENCH, -17, 0), [-150, 35, 60], [-150, 14, 62], [-176, -86, 47], [-124, -86, 47], [-4, -84, 25], [58, -4, 38], [-39, -80, 29]],
  WIDTH,
  HEIGHT,
  { pad: 28, azimuth: 66, elevation: 33 },
);
const W = workshop({ P, theme, layers: ["back"] });
const { R, at, S, L, D, put, rad } = W;
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const VERT = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const f3 = (n) => n.toFixed(3);
const pathOfLocal = (pts, closed = false) => pts.map(([u, v], i) => `${i ? "L" : "M"}${f3(u)} ${f3(v)}`).join("") + (closed ? "Z" : "");
const circleLocal = (cu, cv, r, steps = 40) => pathOfLocal(Array.from({ length: steps }, (_, i) => [cu + r * Math.cos((i / steps) * Math.PI * 2), cv + r * Math.sin((i / steps) * Math.PI * 2)]), true);
const roundRectLocal = (u0, v0, u1, v1, r = 1) => pathOfLocal(k.roundedPlan({ x: u0, y: v0, w: u1 - u0, d: v1 - v0, r }, 4), true);

// little builders that return markup and the true shapes, so each object is one item
const slab = (plan, z, h, style = {}, steps = 4, bevel = 0) => ({ svg: S(k.slabOf(plan, z, h, P, steps, bevel), style), shape: A.slab(plan, z, h) });
const cyl = (cx, cy, r, z, h, style = {}, steps = 40, bevel = 0) => ({ svg: S(k.cylinder(cx, cy, r, z, h, P, steps, bevel), style), shape: A.cylinder(cx, cy, r, z, h) });
const discAlong = (o, a, s0, s1, r, style = {}) => {
  const F = G.frameAlong(o, a);
  return { svg: S(G.disc(s0, s1, r, F, P), style), shape: A.disc(F, s0, s1, r), F };
};
const prismAlong = (F, polygon, s0, s1, style = {}) => ({ svg: S(G.prismOf(F, polygon, s0, s1, P), style), shape: A.prism(F, polygon, s0, s1) });
const item = (name, ref, parts, extra = "") => put({ name, layer: "back", at: ref, svg: parts.map((p) => p.svg).join("") + extra, shapes: parts.filter((p) => p.shape).map((p) => p.shape) });
const screwDots = (pts, z) => D(pts.map(([x, y]) => at([x, y, z])), { size: 0.42 });

// ---------- a face-up dial: one Workbench node's utilization, read by the shared runtime ----------
function dial(id, cx, cy, z, r) {
  const g = { id, c: [cx, cy], z, r: r - 2.3, r0: 0.9, from: rad(-135), span: rad(270), max: 1.4 };
  W.GAUGES.push(g);
  const rim = r - 0.6;
  const t = k.radialTicks(cx, cy, rim, 28, 4, z, [0.8, 1.6], P, g.from, g.span);
  const a100 = g.from + g.span / g.max;
  const full = k.lineOnTop([cx + Math.sin(a100) * (rim - 2), cy - Math.cos(a100) * (rim - 2)], [cx + Math.sin(a100) * rim, cy - Math.cos(a100) * rim], z, P);
  const face = cyl(cx, cy, r, z - 0.6, 0.6, { tone: "hi", crease: "lo" }, 48);
  return {
    svg: face.svg + L(k.ring(cx, cy, rim, z, P, 64), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(full, { tone: "hi" }) + L(k.ring(cx, cy, g.r0, z, P, 12), { tone: "mid" }) +
      `<path class="iso-line" data-tone="hi" data-free="end" data-gauge="${id}" d="${k.lineOnTop([cx, cy - g.r0], [cx, cy - g.r], z, P)}"/>`,
    shape: face.shape,
  };
}

// ---------- a cable between two ports, each end on a small boss ----------
const PORT_R = 2;
const PORT_T = 1;
function cable(name, waypoints, n0, n1, { r = 1, bend = 6 } = {}) {
  const points = G.fillet(waypoints, bend, 12, { P, tube: r });
  const total = G.pathLength(points);
  const gaps = [[0, PORT_T], [total - PORT_T, total]];
  R.route(name, points, r, { gaps });
  tubePieces(points, r, P, { maxLength: 12, gaps }).forEach((part, index) =>
    R.put({ name: `${name}:${index}`, at: part.mid, layer: "back", svg: tubeSvg(part, { tone: "mid" }), route: name, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
  );
  for (const [end, o, n] of [["0", waypoints[0], n0], ["1", waypoints[waypoints.length - 1], n1]]) {
    const F = G.frameAlong(o, n);
    const facing = G.dot3(n, V) > 0.12;
    const svg = S(G.disc(0, PORT_T, PORT_R, F, P), { tone: "mid", crease: "lo" }) + (facing ? D([at(G.pointOf(F, PORT_T, 0, 0))], { size: 0.4 }) : "");
    put({ name: `${name}.port${end}`, layer: "back", at: o, bias: 0.05, svg, shapes: [A.disc(F, 0, PORT_T, PORT_R, { name: `${name}.port${end}`, owner: name })] });
  }
}

// ---------- the screen: the viewers, and the dial for how many of them are asking ----------
const SCREEN = { x0: -174, x1: -126, y: -84, z0: 13, z1: 45 };
const SCREEN_C = [(SCREEN.x0 + SCREEN.x1) / 2, (SCREEN.z0 + SCREEN.z1) / 2];
function screen() {
  const parts = [];
  for (const x of [-168, -132]) {
    parts.push(cyl(x, -86, 3.2, 0, 1, { tone: "lo" }, 24));
    parts.push(cyl(x, -86, 1.2, 1, 10, { tone: "mid", crease: "none" }, 20));
  }
  parts.push(slab({ x: SCREEN.x0 - 2, y: -87, w: SCREEN.x1 - SCREEN.x0 + 4, d: 2, r: 0.6 }, 11, 36, { tone: "mid" }, 2, 0.4));
  parts.push(slab({ x: SCREEN.x0, y: -85, w: SCREEN.x1 - SCREEN.x0, d: 1, r: 0.3 }, SCREEN.z0, SCREEN.z1 - SCREEN.z0, { tone: "hi", crease: "lo" }, 2));
  // the picture: a film leader counting down, drawn in the screen's own plane
  const M = k.sideMatrix([SCREEN.x0, SCREEN.y], SCREEN.z1, P, "left");
  const w = SCREEN.x1 - SCREEN.x0;
  const h = SCREEN.z1 - SCREEN.z0;
  const cu = w / 2;
  const cv = h / 2;
  const clip = `vp-screen-${theme}`;
  const picture =
    `<g transform="${M}"><defs><clipPath id="${clip}"><path d="${roundRectLocal(2, 2, w - 2, h - 2, 0.6)}"/></clipPath></defs>` +
    `<g clip-path="url(#${clip})" class="vp-picture">` +
    `<path class="vp-frame" d="${roundRectLocal(2, 2, w - 2, h - 2, 0.6)}"/>` +
    `<path class="vp-sweep" data-ref="sweep" d=""/>` +
    `<path class="iso-line" data-tone="mid" d="${circleLocal(cu, cv, 11, 64)}"/>` +
    `<path class="iso-line" data-tone="lo" d="${circleLocal(cu, cv, 8.6, 56)}"/>` +
    `<path class="iso-line" data-tone="lo" d="M${f3(cu - 11)} ${f3(cv)}L${f3(cu + 11)} ${f3(cv)}M${f3(cu)} ${f3(cv - 11)}L${f3(cu)} ${f3(cv + 11)}"/>` +
    `<text class="vp-count" data-ref="count" x="${f3(cu)}" y="${f3(cv + 2.6)}" font-size="7.2" text-anchor="middle">8</text>` +
    `</g><path class="iso-line" data-tone="lo" d="${roundRectLocal(2, 2, w - 2, h - 2, 0.6)}"/></g>`;
  item("screen", [SCREEN_C[0], -86, 11], parts, picture);
  // the demand dial on its own box: how many viewers are asking, in requests a second
  const box = { x: -120, y: -100, w: 22, d: 18, r: 2.5 };
  const [cx, cy] = [box.x + box.w / 2, box.y + box.d / 2];
  const top = 9;
  const body = slab(box, 0, top, { tone: "mid", inner: L(k.sideSeam(box, 3, P, 4), { tone: "faint" }) }, 4, 0.6);
  const plate = cyl(cx, cy, 8.4, top, 0.5, { tone: "lo" }, 48);
  const ticks = k.radialTicks(cx, cy, 7.8, 40, 5, top + 0.5, [0.9, 1.8], P, rad(-135), rad(270));
  const knob = cyl(cx, cy, 3.6, top + 0.5, 4, { tone: "hi", crease: "lo", inner: L(k.knurl(cx, cy, 3.6, top + 0.5, top + 4.5, 28, P), { tone: "lo" }) }, 36, 0.3);
  const mark = (rps) => {
    const a = rad(-135) + (rps / RPS_MAX) * rad(270);
    return k.lineOnTop([cx + Math.sin(a) * 5.6, cy - Math.cos(a) * 5.6], [cx + Math.sin(a) * 7.8, cy - Math.cos(a) * 7.8], top + 0.5, P);
  };
  const dialSvg = L(k.ring(cx, cy, 7.8, top + 0.5, P, 56), { tone: "lo" }) + L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "mid" }) + L(mark(AN_AT), { tone: "hi" });
  const pointer = L(k.ring(cx, cy, 0.7, top + 4.5, P, 12), { tone: "mid" }) + `<path class="iso-line" data-tone="hi" data-free="end" data-ref="knob" d="${k.lineOnTop([cx, cy - 0.7], [cx, cy - 3.2], top + 4.5, P)}"/>`;
  const screws = k.corners(box, 2.2);
  put({ name: "demand", layer: "back", at: [cx, cy, 0], svg: body.svg + plate.svg + dialSvg + L(screws.map(([x, y]) => k.ring(x, y, 0.9, top, P, 10)).join(""), { tone: "lo" }) + screwDots(screws, top) + knob.svg + pointer, shapes: [body.shape, plate.shape, knob.shape] });
  return { knob: { c: [cx, cy], z: top + 4.5, from: rad(-135), span: rad(270), r0: 0.7, r1: 3.2, max: RPS_MAX } };
}

// ---------- the projector on its cart: the edge, serving from the reels on its shelf ----------
const TABLE = { x: -167, y: 6, w: 34, d: 46, r: 2 };
const BODY = { x: -163, y: 10, w: 26, d: 26, r: 3 };
const REELS = [{ y: 14, z: 52 }, { y: 35, z: 50 }];
const REEL_R = 9.6;
const REEL_X = -150;
function projector() {
  const parts = [];
  const legs = [[TABLE.x + 3, TABLE.y + 3], [TABLE.x + TABLE.w - 3, TABLE.y + 3], [TABLE.x + 3, TABLE.y + TABLE.d - 3], [TABLE.x + TABLE.w - 3, TABLE.y + TABLE.d - 3]];
  const SHELF = [4, 5.4];
  for (const [x, y] of legs) parts.push(cyl(x, y, 1.3, 0, SHELF[0], { tone: "lo", crease: "none" }, 20));
  parts.push(slab(k.insetPlan(TABLE, 1), SHELF[0], SHELF[1] - SHELF[0], { tone: "lo" }, 3, 0.3));
  for (const [x, y] of legs) parts.push(cyl(x, y, 1.3, SHELF[1], 14 - SHELF[1], { tone: "mid", crease: "none" }, 20));
  parts.push(slab(TABLE, 14, 2, { tone: "mid" }, 3, 0.5));
  // the edge's cache: a magazine rack of film cans standing on edge in front of the projector
  const RACK = { x: TABLE.x + 3, y: BODY.y + BODY.d + 3, w: TABLE.w - 6, d: 10, r: 0.8 };
  parts.push(slab(RACK, 16, 1, { tone: "lo" }, 2, 0.3));
  parts.push(slab({ x: RACK.x, y: RACK.y, w: 1.2, d: RACK.d, r: 0.3 }, 17, 9, { tone: "mid", crease: "none" }, 1));
  for (let i = 0; i < 5; i++) {
    const x = RACK.x + 4.6 + i * 4.6;
    const can = discAlong([x, RACK.y + RACK.d / 2, 17 + 4.6], [1, 0, 0], -0.9, 0.9, 4.6, { tone: "hi", crease: "lo" });
    parts.push(can);
    parts.push({ svg: L(G.circleOf(can.F, 0.9, 3, P), { tone: "faint" }) + D([at([x + 0.9, RACK.y + RACK.d / 2, 17 + 4.6])], { size: 0.36 }) });
  }
  parts.push(slab({ x: RACK.x + RACK.w - 1.2, y: RACK.y, w: 1.2, d: RACK.d, r: 0.3 }, 17, 9, { tone: "mid", crease: "none" }, 1));
  // lens barrel, out of the far end toward the screen
  const LF = G.frameAlong([REEL_X, BODY.y, 24], [0, -1, 0]);
  const LENS = [[0, 4.4], [1.6, 4.4], [1.6, 3.4], [8.5, 3.4], [8.5, 3.9], [10, 3.9]];
  parts.push({ svg: S(G.solidOf(LENS, LF, P), { tone: "mid", crease: "lo" }), shape: A.solid(LF, LENS) });
  const vents = [19, 21.5, 24].map((z) => {
    const pts = [];
    const f = BODY.x + BODY.w;
    for (let j = 0; j <= 8; j++) pts.push([f, BODY.y + 18 + 0.8 * Math.sin((j / 8) * Math.PI), z + 0.8 * Math.cos((j / 8) * Math.PI)]);
    for (let j = 0; j <= 8; j++) pts.push([f, BODY.y + 8 - 0.8 * Math.sin((j / 8) * Math.PI), z - 0.8 * Math.cos((j / 8) * Math.PI)]);
    return W.poly(pts);
  });
  parts.push(slab(BODY, 16, 14, { tone: "mid", inner: L(k.sideSeam(BODY, 27.5, P, 4), { tone: "faint" }) + L(vents.join(""), { tone: "lo" }) }, 4, 0.8));
  // film from the feed reel down into the gate, and up out of it to the take-up reel
  for (const [y0, z1] of [[REELS[0].y - 1, REELS[0].z - REEL_R + 0.4], [REELS[1].y - 1, REELS[1].z - REEL_R + 0.4]]) parts.push(slab({ x: REEL_X - 0.9, y: y0, w: 1.8, d: 2, r: 0.2 }, 30, z1 - 30, { tone: "lo", crease: "none" }, 2));
  // arms behind the reels, then the reels with their spokes on the face toward the viewer
  for (const r of REELS) parts.push(cyl(REEL_X - 2.4, r.y, 1.2, 30, r.z - 30, { tone: "mid", crease: "none" }, 16));
  REELS.forEach((r, i) => {
    const reel = discAlong([REEL_X, r.y, r.z], [1, 0, 0], -1.2, 1.2, REEL_R, { tone: "hi", crease: "lo" });
    parts.push(reel);
    // three spokes on the reel's face toward the viewer, turned by the live code, then the hub over them
    const M = k.sideMatrix([REEL_X + 1.2, r.y], r.z, P, "right");
    const lines = [0, 1, 2].map((j) => {
      const a = (j * 2 * Math.PI) / 3;
      return `M${f3(2.6 * Math.cos(a))} ${f3(2.6 * Math.sin(a))}L${f3(8.4 * Math.cos(a))} ${f3(8.4 * Math.sin(a))}`;
    }).join("");
    parts.push({ svg: `<g transform="${M}"><path class="iso-line" data-tone="lo" d="${circleLocal(0, 0, 8.4, 64)}"/><g data-ref="reel${i}"><path class="iso-line" data-tone="mid" d="${lines}"/></g></g>` });
    const hub = discAlong([REEL_X, r.y, r.z], [1, 0, 0], 1.2, 2, 2.6, { tone: "mid" });
    parts.push(hub);
    parts.push({ svg: D([at([REEL_X + 2, r.y, r.z])], { size: 0.45 }) });
  });
  // the lamp house beside the reels, vented
  const LX = REEL_X + 9;
  const LY = BODY.y + 18;
  const lamp = cyl(LX, LY, 4.5, 30, 10, { tone: "mid", crease: "lo", inner: L([33, 35.5, 38].map((z) => k.sideArc(LX, LY, 4.5, z, P, 24)).join(""), { tone: "lo" }) }, 32);
  parts.push(lamp, cyl(LX, LY, 5.6, 40, 1.4, { tone: "hi", crease: "lo" }, 32, 0.3));
  item("projector", [REEL_X, BODY.y + BODY.d / 2, 0], parts);
}

// ---------- the projectionist's console, its schedule card rack behind it ----------
const DESK = { x0: -118, x1: -78, yb: -30, yf: -6 };
function console_() {
  const F = { o: [DESK.x0, 0, 0], a: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] };
  const poly = [[DESK.yb, 0], [DESK.yf, 0], [DESK.yf, 7], [DESK.yf - 12, 15], [DESK.yb, 15]];
  const desk = prismAlong(F, poly, 0, DESK.x1 - DESK.x0, { tone: "mid", crease: "lo" });
  // four instance lamps on the sloped face, one per Playback API instance
  const lamps = [0, 1, 2, 3].map((i) => at([DESK.x0 + 10 + i * 6, DESK.yf - 6, 11]));
  const d = dial("play", DESK.x0 + 11, DESK.yb + 6, 15.6, 5);
  const lever = cyl(DESK.x1 - 10, DESK.yb + 6, 1, 15, 3, { tone: "mid" }, 16);
  const knobTop = cyl(DESK.x1 - 10, DESK.yb + 6, 1.8, 18, 1.4, { tone: "hi", crease: "lo" }, 20);
  item("console", [(DESK.x0 + DESK.x1) / 2, (DESK.yb + DESK.yf) / 2, 0], [desk, d, lever, knobTop], D(lamps, { size: 0.5, tone: "hi" }));
  // the rack of schedule cards: pigeonholes on the face toward the desk, cards standing in the top
  const rack = { x: DESK.x0 + 4, y: DESK.yb - 14, w: 32, d: 10, r: 1.4 };
  const holes = [];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) {
    const x0 = rack.x + 3 + c * 9.6;
    const z0 = 4 + r * 7.6;
    holes.push(W.poly([[x0, rack.y + rack.d, z0], [x0 + 7.4, rack.y + rack.d, z0], [x0 + 7.4, rack.y + rack.d, z0 + 5.6], [x0, rack.y + rack.d, z0 + 5.6]]));
  }
  const body = slab(rack, 0, 28, { tone: "mid", inner: L(holes.join(""), { tone: "lo" }) }, 3, 0.6);
  const cards = [0, 1, 2, 3].map((i) => slab({ x: rack.x + 3 + i * 7.4, y: rack.y + 3.5, w: 5, d: 0.6, r: 0.1 }, 28, 4.5, { tone: "hi", crease: "none" }, 1));
  item("cardrack", [rack.x + rack.w / 2, rack.y + rack.d / 2, 0], [body, ...cards]);
}

// ---------- the card catalogue: the metadata ----------
const CAT = { x: -56, y: -94, w: 34, d: 28, r: 2 };
const CAT_BODY = CAT;
function catalogue() {
  const parts = [];
  const front = CAT_BODY.y + CAT_BODY.d;
  parts.push(slab(CAT_BODY, 0, 26, { tone: "mid", inner: L(k.sideSeam(CAT_BODY, 3, P, 3), { tone: "faint" }) }, 3, 0.6));
  let fronts = "";
  for (let c = 0; c < 2; c++) for (let r = 0; r < 3; r++) {
    const plate = { x: CAT_BODY.x + 2 + c * 15, y: front, w: 13, d: 0.7, r: 0.5 };
    const z0 = 5 + r * 7;
    parts.push(slab(plate, z0, 6, { tone: "hi", crease: "lo" }, 2, 0.25));
    const hx = plate.x + plate.w / 2;
    const holder = W.poly([[hx - 3, front + 0.7, z0 + 4.8], [hx + 3, front + 0.7, z0 + 4.8], [hx + 3, front + 0.7, z0 + 3.2], [hx - 3, front + 0.7, z0 + 3.2]]);
    fronts += L(holder, { tone: "lo" });
    const pull = discAlong([hx, front + 0.7, z0 + 1.8], [0, 1, 0], 0, 0.9, 0.8, { tone: "mid" });
    parts.push({ svg: fronts + pull.svg, shape: pull.shape });
    fronts = "";
  }
  const top = { x: CAT.x - 0.5, y: CAT.y - 0.5, w: CAT.w + 1, d: CAT.d + 1, r: 2 };
  parts.push(slab(top, 26, 1.6, { tone: "hi", crease: "lo" }, 3, 0.4));
  parts.push(dial("meta", CAT.x + 17, CAT.y + 13, 28.2, 6));
  item("catalogue", [CAT.x + CAT.w / 2, CAT.y + CAT.d / 2, 0], parts);
}

// ---------- the ticker: the catalogue's change log, printed onto a tape ----------
const TICK = { x: -14, y: -94, w: 20, d: 20, r: 2 };
const TC = [-4, -84];
const TAPE = { y0: -85.5, y1: -82.5, z: 9, x0: TC[0] + 7, x1: 146 };
function ticker() {
  const plinth = slab(TICK, 0, 9, { tone: "mid", inner: L(k.sideSeam(TICK, 3, P, 3), { tone: "faint" }) }, 3, 0.6);
  const base = cyl(TC[0], TC[1], 7, 9, 2, { tone: "lo" }, 48, 0.3);
  const column = cyl(TC[0], TC[1], 2.6, 11, 5, { tone: "mid" }, 24);
  const wheel = discAlong([TC[0], TC[1], 18.6], [1, 0, 0], -0.8, 0.8, 2.6, { tone: "hi", crease: "lo" });
  const R0 = 6.4;
  const S0 = 11;
  const S1 = 17;
  const radius = (s) => (s <= S1 ? R0 : Math.sqrt(Math.max(0, R0 * R0 - (s - S1) ** 2)));
  const slope = (s) => (s <= S1 ? 0 : -(s - S1) / Math.max(0.05, radius(s)));
  const DOME = [[S0, R0], [S1, R0, 1]];
  for (let i = 1; i <= 24; i++) {
    const s = S1 + (R0 - 0.35) * Math.sin(((i / 24) * Math.PI) / 2);
    DOME.push([s, radius(s), 1]);
  }
  DOME.push([S1 + R0, 0]);
  const F = VERT(TC[0], TC[1]);
  // glass is a shell: record the hollow dome (out over the top, back down the inside), not a solid
  const WALL = 0.4;
  const shell = [[S0, R0], ...DOME.slice(1, -1).map(([sv, r]) => [sv, r]), [S1 + R0, 0], [S1 + R0 - WALL, 0], ...DOME.slice(1, -1).reverse().map(([sv, r]) => [sv - (sv > S1 ? WALL * ((sv - S1) / R0) : 0), Math.max(0, r - WALL)]), [S0, R0 - WALL]];
  const dome = { svg: `<g class="vp-glass">${S(G.solidOf(DOME, F, P, { smooth: { slope, radius } }), { tone: "hi", crease: "none" })}</g>`, shape: A.body(F, shell, { name: "ticker.dome" }) };
  const knob = cyl(TC[0], TC[1], 1.1, S1 + R0 - 0.1, 1.2, { tone: "mid" }, 16);
  item("ticker", [TC[0], TC[1], 0], [plinth, base, column, wheel, dome, knob]);
}
function tape() {
  // guide blocks carry the tape at the ticker's height; it winds onto a take-up spool at the far end
  for (const x of [12, 44, 81, 120]) item(`tape.guide.${x}`, [x, -84, 0], [slab({ x: x - 3, y: -87.5, w: 6, d: 7, r: 1 }, 0, TAPE.z, { tone: "lo", inner: L(k.sideSeam({ x: x - 3, y: -87.5, w: 6, d: 7, r: 1 }, 3, P, 3), { tone: "faint" }) }, 3, 0.4)]);
  const SX = TAPE.x1 + 4;
  const spool = [cyl(SX, -84, 5.4, 0, 1.2, { tone: "lo" }, 32), cyl(SX, -84, 4, 1.2, 12, { tone: "hi", crease: "lo", inner: L(k.sideArc(SX, -84, 4, TAPE.z + 0.2, P, 24), { tone: "lo" }) }, 32), cyl(SX, -84, 5.4, 13.2, 1, { tone: "mid", crease: "lo" }, 32)];
  item("tape.spool", [SX, -84, 0], spool);
  const plan = { x: TAPE.x0, y: TAPE.y0, w: TAPE.x1 - TAPE.x0, d: TAPE.y1 - TAPE.y0, r: 0 };
  const strip = slab(plan, TAPE.z, 0.25, { tone: "hi", crease: "none" }, 1);
  // printed marks on the tape's top, moved by the live code; each runs edge to edge
  const M = k.topMatrix([TAPE.x0, TAPE.y0], TAPE.z + 0.25, P);
  const w = TAPE.x1 - TAPE.x0;
  const clip = `vp-tape-${theme}`;
  let marks = "";
  for (let i = -1; i * 2.6 < w + 2.6; i++) marks += `M${f3(i * 2.6)} 0L${f3(i * 2.6 + 0.8)} ${f3(TAPE.y1 - TAPE.y0)}`;
  const markup = `<g transform="${M}"><defs><clipPath id="${clip}"><path d="M0 0L${f3(w)} 0L${f3(w)} ${f3(TAPE.y1 - TAPE.y0)}L0 ${f3(TAPE.y1 - TAPE.y0)}Z"/></clipPath></defs><g clip-path="url(#${clip})"><g data-ref="tape"><path class="iso-line" data-tone="lo" d="${marks}"/></g></g></g>`;
  put({ name: "tape.strip", layer: "back", at: [(TAPE.x0 + TAPE.x1) / 2, (TAPE.y0 + TAPE.y1) / 2, TAPE.z], svg: strip.svg + markup, shapes: [strip.shape] });
}

// ---------- the readers on the tape: analytics, search and notifications ----------
function gate(name, x) {
  // a read head bridging the tape: the far cheek behind it, then the near cheek and the bar over it
  item(`${name}.back`, [x, -87.5, 0], [slab({ x: x - 1.6, y: -89, w: 3.2, d: 3, r: 0.5 }, 0, 12, { tone: "mid", crease: "none" }, 2)]);
  item(name, [x, -80.5, 0], [slab({ x: x - 1.6, y: -82, w: 3.2, d: 3, r: 0.5 }, 0, 12, { tone: "mid", crease: "none" }, 2), slab({ x: x - 1.6, y: -89, w: 3.2, d: 10, r: 0.5 }, 12, 1.6, { tone: "hi", crease: "lo" }, 2, 0.25)], screwDots([[x, -87.5], [x, -80.5]], 13.6));
}
const COUNTER = { x: 10, y: -78, w: 26, d: 17, r: 3 };
function counter() {
  const body = slab(COUNTER, 0, 13, { tone: "mid", inner: L(k.sideSeam(COUNTER, 3.4, P, 4), { tone: "faint" }) }, 4, 0.8);
  const top = slab(k.insetPlan(COUNTER, 1.6), 13, 1, { tone: "hi", crease: "lo" }, 4, 0.4);
  const d = dial("an", COUNTER.x + 9, COUNTER.y + 8.5, 14.6, 5.4);
  const button = cyl(COUNTER.x + 20, COUNTER.y + 8.5, 2, 14, 2.2, { tone: "hi", crease: "lo" }, 24, 0.3);
  // the count window on the front face: events counted, the machine's own digits
  const front = COUNTER.y + COUNTER.d;
  const M = k.sideMatrix([COUNTER.x + 4, front], 10, P, "left");
  const clip = `vp-count-${theme}`;
  const win = roundRectLocal(0, 0, 18, 6, 0.8);
  const digits = `<g transform="${M}"><defs><clipPath id="${clip}"><path d="${win}"/></clipPath></defs><path class="vp-window" d="${win}"/><g clip-path="url(#${clip})"><text class="vp-digits" data-ref="tally" x="9" y="4.6" font-size="4.6" text-anchor="middle">000000</text></g><path class="iso-line" data-tone="lo" d="${win}"/></g>`;
  item("counter", [COUNTER.x + 13, COUNTER.y + 8.5, 0], [body, top, d, button], digits);
}
const SORTER = { x: 50, y: -78, w: 28, d: 17, r: 1.5 };
function sorter() {
  const parts = [slab(SORTER, 0, 1.5, { tone: "lo" }, 2, 0.3)];
  const t = 1.2;
  parts.push(slab({ x: SORTER.x, y: SORTER.y, w: SORTER.w, d: t, r: 0.3 }, 1.5, 6, { tone: "mid" }, 1));
  parts.push(slab({ x: SORTER.x, y: SORTER.y + t, w: t, d: SORTER.d - 2 * t, r: 0.3 }, 1.5, 6, { tone: "mid" }, 1));
  for (let i = 0; i < 7; i++) parts.push(slab({ x: SORTER.x + 3 + i * 3.4, y: SORTER.y + 2.6, w: 0.6, d: 11.8, r: 0.1 }, 1.5, 8.6 + (i % 3) * 0.7, { tone: "hi", crease: "none" }, 1));
  parts.push(slab({ x: SORTER.x + SORTER.w - t, y: SORTER.y + t, w: t, d: SORTER.d - 2 * t, r: 0.3 }, 1.5, 6, { tone: "mid" }, 1));
  parts.push(slab({ x: SORTER.x, y: SORTER.y + SORTER.d - t, w: SORTER.w, d: t, r: 0.3 }, 1.5, 6, { tone: "mid" }, 1));
  // the feed wheel on the end wall, turned at the index's rate
  const c = [SORTER.x + SORTER.w, SORTER.y + SORTER.d / 2, 5];
  const wheel = discAlong(c, [1, 0, 0], 0, 1.4, 4, { tone: "hi", crease: "lo" });
  parts.push(wheel);
  const M = k.sideMatrix([c[0] + 1.4, c[1]], c[2], P, "right");
  const lines = [0, 1, 2, 3].map((j) => {
    const a = (j * Math.PI) / 2;
    return `M${f3(0.9 * Math.cos(a))} ${f3(0.9 * Math.sin(a))}L${f3(3.4 * Math.cos(a))} ${f3(3.4 * Math.sin(a))}`;
  }).join("");
  parts.push({ svg: `<g transform="${M}"><path class="iso-line" data-tone="lo" d="${circleLocal(0, 0, 3.4, 40)}"/><g data-ref="sorter"><path class="iso-line" data-tone="mid" d="${lines}"/></g><path class="iso-line" data-tone="mid" d="${circleLocal(0, 0, 0.9, 12)}"/></g>` });
  item("sorter", [SORTER.x + 14, SORTER.y + 8.5, 0], parts);
}
const BELL = [99, -69];
function bell() {
  const base = cyl(BELL[0], BELL[1], 7.4, 0, 2.6, { tone: "lo", crease: "lo" }, 48, 0.4);
  const C0 = 2.6;
  const RB = 6.4;
  const radius = (s) => Math.sqrt(Math.max(0, RB * RB - (s - C0) ** 2));
  const slope = (s) => -(s - C0) / Math.max(0.05, radius(s));
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const s = C0 + (RB - 0.25) * Math.sin(((i / 24) * Math.PI) / 2);
    prof.push([s, radius(s), i ? 1 : 0]);
  }
  prof.push([C0 + RB, 0]);
  const F = VERT(BELL[0], BELL[1]);
  const dome = { svg: `<g data-mat="brass">${S(G.solidOf(prof, F, P, { smooth: { slope, radius } }), { tone: "hi", crease: "none" })}</g>`, shape: A.solid(F, prof, { radius }) };
  // the plunger: its rim lands on the dome; the live code strikes it
  const PR = 0.7;
  const z0 = C0 + Math.sqrt(RB * RB - PR * PR);
  const plungerTop = z0 + 2;
  const knobR = 1.3;
  const kz = plungerTop + Math.sqrt(knobR * knobR - PR * PR);
  const plunger = cyl(BELL[0], BELL[1], PR, z0, 2, { tone: "mid", crease: "none" }, 16);
  const knob = { svg: S(G.sphereOf([BELL[0], BELL[1], kz], knobR, P), { tone: "hi" }), shape: A.ball([BELL[0], BELL[1], kz], knobR) };
  put({ name: "bell", layer: "back", at: [BELL[0], BELL[1], 0], svg: base.svg + dome.svg, shapes: [base.shape, dome.shape] });
  put({ name: "bell.plunger", layer: "back", at: [BELL[0], BELL[1], z0], bias: 0.2, svg: `<g data-ref="bell">${plunger.svg + knob.svg}</g>`, shapes: [plunger.shape, knob.shape] });
}

// ---------- the vault: a flat-file cabinet of prints ----------
const VAULT = { x: -70, y: -2, w: 46, d: 34, r: 2 };
const VAULT_BODY = k.insetPlan(VAULT, 1);
function vault() {
  const parts = [slab(VAULT, 0, 2, { tone: "lo" }, 3, 0.3), slab(VAULT_BODY, 2, 25, { tone: "mid" }, 3, 0.6)];
  const front = VAULT_BODY.y + VAULT_BODY.d;
  let extra = "";
  for (let i = 0; i < 5; i++) {
    const z0 = 3.4 + i * 4.6;
    const plate = { x: VAULT_BODY.x + 2, y: front, w: VAULT_BODY.w - 4, d: 0.7, r: 0.4 };
    parts.push(slab(plate, z0, 3.8, { tone: "hi", crease: "lo" }, 2, 0.2));
    const cx = plate.x + plate.w / 2;
    parts.push(slab({ x: cx - 6, y: front + 0.7, w: 12, d: 0.8, r: 0.3 }, z0 + 1.1, 1.1, { tone: "mid", crease: "none" }, 2));
    extra += L(W.poly([[plate.x + 3, front + 0.7, z0 + 2.8], [plate.x + 9, front + 0.7, z0 + 2.8], [plate.x + 9, front + 0.7, z0 + 1.2], [plate.x + 3, front + 0.7, z0 + 1.2]]), { tone: "lo" });
  }
  const top = { x: VAULT.x - 0.5, y: VAULT.y - 0.5, w: VAULT.w + 1, d: VAULT.d + 1, r: 2 };
  parts.push(slab(top, 27, 1.6, { tone: "hi", crease: "lo" }, 3, 0.4));
  item("vault", [VAULT.x + VAULT.w / 2, VAULT.y + VAULT.d / 2, 0], parts, extra + L(k.sideSeam(VAULT_BODY, 24.6, P, 3), { tone: "faint" }));
}

// ---------- the darkroom sink with six developing tanks, and the safelight over it ----------
const SINK = { x: -16, y: 0, w: 70, d: 44, r: 2 };
export const TANK_AT = [[0, 12], [19, 12], [38, 12], [0, 31], [19, 31], [38, 31]];
const TANK_TOP = 18;
function sink() {
  const t = 1.5;
  const h = 6;
  const walls = (side) => {
    if (side === "back") return slab({ x: SINK.x, y: SINK.y, w: SINK.w, d: t, r: 0.4 }, 2, h, { tone: "mid" }, 1, 0.2);
    if (side === "left") return slab({ x: SINK.x, y: SINK.y + t, w: t, d: SINK.d - 2 * t, r: 0.4 }, 2, h, { tone: "mid" }, 1, 0.2);
    if (side === "right") return slab({ x: SINK.x + SINK.w - t, y: SINK.y + t, w: t, d: SINK.d - 2 * t, r: 0.4 }, 2, h, { tone: "mid" }, 1, 0.2);
    return slab({ x: SINK.x, y: SINK.y + SINK.d - t, w: SINK.w, d: t, r: 0.4 }, 2, h, { tone: "mid" }, 1, 0.2);
  };
  item("sink.base", [SINK.x + SINK.w / 2, SINK.y + SINK.d / 2, 0], [slab(SINK, 0, 2, { tone: "lo" }, 3, 0.3)], D([at([SINK.x + SINK.w - 8, SINK.y + 8, 2])], { size: 0.5 }) + L(k.ring(SINK.x + SINK.w - 8, SINK.y + 8, 1.6, 2, P, 16), { tone: "lo" }));
  item("sink.back", [SINK.x + SINK.w / 2, SINK.y, 2], [walls("back")]);
  item("sink.left", [SINK.x, SINK.y + SINK.d / 2, 2], [walls("left")]);
  item("sink.right", [SINK.x + SINK.w, SINK.y + SINK.d / 2, 2], [walls("right")]);
  item("sink.front", [SINK.x + SINK.w / 2, SINK.y + SINK.d, 2], [walls("front")]);
  let cranks = "";
  TANK_AT.forEach(([x, y], i) => {
    const body = cyl(x, y, 5.5, 2, 12, { tone: "mid", crease: "lo", inner: L([5.5, 9, 12.5].map((z) => k.sideArc(x, y, 5.5, z, P, 28)).join(""), { tone: "faint" }) }, 40);
    const lid = cyl(x, y, 6.2, 14, 2.4, { tone: "hi", crease: "lo", inner: L(k.knurl(x, y, 6.2, 14, 16.4, 36, P), { tone: "lo" }) }, 40, 0.3);
    const funnel = cyl(x, y, 2.2, 16.4, 1.6, { tone: "mid", crease: "lo" }, 24);
    // the agitator crank on top: a bar and a handle, turned by the live code as the tank works
    const M = k.topMatrix([x, y], TANK_TOP, P);
    cranks = `<g transform="${M}"><g data-ref="crank" data-i="${i}"><path class="vp-bar" d="${roundRectLocal(-0.9, -0.9, 4.6, 0.9, 0.8)}"/><path class="iso-line" data-tone="mid" d="${roundRectLocal(-0.9, -0.9, 4.6, 0.9, 0.8)}"/><path class="iso-line" data-tone="hi" d="${circleLocal(3.8, 0, 0.6, 12)}"/></g></g>`;
    item(`tank.${i}`, [x, y, 2], [body, lid, funnel], cranks);
  });
  // the safelight: a post behind the sink, an arm over it, and a lamp that lights while the tanks fall behind
  const PY = -4;
  const post = [cyl(58, PY, 3.4, 0, 1.2, { tone: "lo" }, 24), cyl(58, PY, 1.4, 1.2, 34.8, { tone: "mid", crease: "none" }, 20)];
  const arm = slab({ x: 30, y: PY - 1.2, w: 26.6, d: 2.4, r: 0.6 }, 36, 1.6, { tone: "mid" }, 2, 0.3);
  const head = discAlong([31.5, PY, 32.8], [0, 1, 0], -3.4, 3.4, 3.2, { tone: "mid", crease: "lo" });
  const lens = discAlong([31.5, PY + 3.4, 32.8], [0, 1, 0], 0, 0.6, 2.4, { tone: "hi", crease: "lo" });
  const c = at([31.5, PY + 4, 32.8]);
  W.LAMPS.push({ id: "tw", at: [31.5, PY + 4, 32.8] });
  item("safelight", [44, PY, 30], [...post, arm, head, lens], `<circle class="bx-lamp" data-lamp="0" data-node="tw" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="${(1.7 * KS).toFixed(2)}"/>`);
}
// a short chute of developed prints from the sink's wall down into the vault's lowest drawer
function printChute() {
  const o = [SINK.x, 18, 8];
  const end = [VAULT_BODY.x + VAULT_BODY.w, 18, 3.6];
  const a = G.unit3(G.sub3(end, o));
  const u = [0, 1, 0];
  const F = { o, a, u, v: G.cross3(a, u) };
  const len = G.len3(G.sub3(end, o));
  item("chute.prints", [(o[0] + end[0]) / 2, 18, 6], [prismAlong(F, [[-4, 0], [4, 0], [4, 0.8], [-4, 0.8]], 0, len, { tone: "hi", crease: "lo" })]);
}

// ---------- the can tray: the transcode queue, three cans to a decade of backlog ----------
const TRAY = { x: 62, y: 10, w: 34, d: 30, r: 2 };
export const CAN_STACKS = [[70.5, 19], [86, 19], [78, 32]];
const CAN_LEVELS = 5;
const CAN_H = 2;
function canTray() {
  const t = 1.2;
  const h = 4.5;
  item("tray.base", [TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d / 2, 0], [slab(TRAY, 0, 1.5, { tone: "lo" }, 3, 0.3)]);
  item("tray.back", [TRAY.x + TRAY.w / 2, TRAY.y, 1.5], [slab({ x: TRAY.x, y: TRAY.y, w: TRAY.w, d: t, r: 0.3 }, 1.5, h, { tone: "mid" }, 1)]);
  item("tray.left", [TRAY.x, TRAY.y + TRAY.d / 2, 1.5], [slab({ x: TRAY.x, y: TRAY.y + t, w: t, d: TRAY.d - 2 * t, r: 0.3 }, 1.5, h, { tone: "mid" }, 1)]);
  item("tray.right", [TRAY.x + TRAY.w, TRAY.y + TRAY.d / 2, 1.5], [slab({ x: TRAY.x + TRAY.w - t, y: TRAY.y + t, w: t, d: TRAY.d - 2 * t, r: 0.3 }, 1.5, h, { tone: "mid" }, 1)]);
  item("tray.front", [TRAY.x + TRAY.w / 2, TRAY.y + TRAY.d, 1.5], [slab({ x: TRAY.x, y: TRAY.y + TRAY.d - t, w: TRAY.w, d: t, r: 0.3 }, 1.5, h, { tone: "mid" }, 1)]);
  // every can is drawn; the live code sets how much of each shows, filling level by level
  const order = [];
  for (let level = 0; level < CAN_LEVELS; level++) CAN_STACKS.forEach((_, s) => order.push([s, level]));
  CAN_STACKS.forEach(([x, y], s) => {
    let svg = "";
    const shapes = [];
    for (let level = 0; level < CAN_LEVELS; level++) {
      const z = 1.5 + level * CAN_H;
      const index = order.findIndex(([ss, ll]) => ss === s && ll === level);
      const can = cyl(x, y, 5.2, z, CAN_H, { tone: "hi", crease: "lo" }, 40, 0.3);
      svg += `<g class="vp-can" data-can="${index}">${can.svg}${L(k.ring(x, y, 3.4, z + CAN_H, P, 32), { tone: "lo" })}${D([at([x, y, z + CAN_H])], { size: 0.36 })}</g>`;
      shapes.push(can.shape);
    }
    put({ name: `tray.cans.${s}`, layer: "back", at: [x, y, 1.5], svg, shapes });
  });
  return order.length;
}

// ---------- the intake: exposed cans are posted in, recorded, and slid to the tray ----------
const INTAKE = { x: 104, y: 8, w: 34, d: 32, r: 3 };
function intake() {
  const top = 22;
  const front = INTAKE.y + INTAKE.d;
  const body = slab(INTAKE, 0, top, { tone: "mid", inner: L(k.sideSeam(INTAKE, 4, P, 4), { tone: "faint" }) }, 4, 0.8);
  const lid = slab(k.insetPlan(INTAKE, 1.6), top, 1.4, { tone: "hi", crease: "lo" }, 4, 0.5);
  const slotPlan = { x: INTAKE.x + 5, y: INTAKE.y + 7, w: 14, d: 4, r: 1.6 };
  const flap = slab({ x: slotPlan.x - 0.8, y: slotPlan.y - 2.2, w: slotPlan.w + 1.6, d: 2, r: 0.4 }, top + 1.4, 0.8, { tone: "mid", crease: "lo" }, 2, 0.2);
  const d = dial("up", INTAKE.x + 25, INTAKE.y + 20, top + 2, 5.4);
  const door = W.poly([[INTAKE.x + 5, front, 3.5], [INTAKE.x + 22, front, 3.5], [INTAKE.x + 22, front, 15], [INTAKE.x + 5, front, 15]]);
  const hinge = slab({ x: INTAKE.x + 24, y: front, w: 4.6, d: 0.7, r: 0.2 }, 9, 3, { tone: "lo", crease: "none" }, 1);
  const screws = k.corners(k.insetPlan(INTAKE, 1.6), 2.2);
  item(
    "intake",
    [INTAKE.x + INTAKE.w / 2, INTAKE.y + INTAKE.d / 2, 0],
    [body, lid, flap, d, hinge],
    L(k.planOutline(slotPlan, top + 1.4, P, 3), { tone: "lo" }) + L(door, { tone: "lo" }) + D([at([INTAKE.x + 18, front, 9.3])], { size: 0.5 }) + L(screws.map(([x, y]) => k.ring(x, y, 1, top + 1.4, P, 10)).join(""), { tone: "lo" }) + screwDots(screws, top + 1.4),
  );
  // the slide from the intake's left face down onto the tray's right wall
  const o = [INTAKE.x, 25, 9];
  const end = [TRAY.x + TRAY.w, 25, 6];
  const a = G.unit3(G.sub3(end, o));
  const F = { o, a, u: [0, 1, 0], v: G.cross3(a, [0, 1, 0]) };
  item("chute.cans", [100, 25, 7.5], [prismAlong(F, [[-4.5, 0], [4.5, 0], [4.5, 0.8], [-4.5, 0.8]], 0, G.len3(G.sub3(end, o)), { tone: "hi", crease: "lo" })]);
}

// ---------- build ----------
const { halo } = W.bench(BENCH, { label: { x: 120, y: 43, w: 32, d: 9, r: 1.5 }, ruler: { x: -124, y: 46, w: 96, d: 6, r: 1 } });
const demand = screen();
projector();
console_();
catalogue();
ticker();
tape();
gate("gate.an", COUNTER.x + 13);
gate("gate.si", SORTER.x + 14);
gate("gate.notif", BELL[0]);
counter();
sorter();
bell();
vault();
sink();
printChute();
const CANS = canTray();
intake();
const X = [1, 0, 0];
const NX = [-1, 0, 0];
const Y = [0, 1, 0];
const NY = [0, -1, 0];
// a miss leaves the projector's side for the console; the console asks the catalogue; the catalogue
// feeds the ticker; the intake records every can in the catalogue
cable("cable.miss", [[BODY.x + BODY.w, BODY.y + 4, 23], [TABLE.x + TABLE.w + 5, BODY.y + 4, 23], [TABLE.x + TABLE.w + 5, BODY.y + 4, 3.5], [DESK.x0 + 6, BODY.y + 4, 3.5], [DESK.x0 + 6, DESK.yf, 3.5]], X, Y);
cable("cable.select", [[DESK.x1, -18, 7], [-66, -18, 7], [-66, -80, 7], [CAT_BODY.x, -80, 7]], X, NX);
cable("cable.cdc", [[CAT_BODY.x + CAT_BODY.w, -88, 7], [TICK.x, -88, 7]], X, NX);
cable("cable.insert", [[121, INTAKE.y, 2.6], [121, -50, 2.6], [-30, -50, 2.6], [-30, CAT_BODY.y + CAT_BODY.d, 2.6]], NY, Y);

const { layerOf } = W.finish();
if (argv.includes("--audit")) A.auditOrExit(R, P);

// ---------- page ----------
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const page = W.page({
  title: "Video platform",
  fig: "Fig 2",
  hint: "Drag across · ← → load · ↑ ↓ uploads",
  readout: `${fmt(PRESET.rps)} rps · ${Math.round(SHARE * 100)}% uploads · 0 cans waiting`,
  keys: [
    { mark: "lit", label: "Safelight: the developing tanks are behind" },
    { mark: "raised", label: "Cans in the tray: the transcode backlog, three to a decade" },
    { mark: "flat", label: "Dials: utilization" },
  ],
  caption: `The projector serves ${Math.round((1 - MISS) * 100)}% of screenings from the reels on its shelf, so the console stays cool and the picture never waits. Uploads are ${Math.round(SHARE * 100)}% of traffic and every can goes into the tray, but the six tanks develop only ${TW_CAP.toFixed(1)} a second, ${RENDITIONS} prints each: at the preset's ${fmt(PRESET.rps)} rps the pile grows by about ${fmt(PRESET.rps * SHARE - TW_CAP)} a second, off every viewer's path. The analytics counter on the ticker tape is the next to tip over, at about ${fmt(AN_AT)} rps. The numbers come from the Workbench's own queueing engine running the Video Platform preset.`,
  label: "A film lab and projection room on one long table. At the left a projector on a cart beams at a small screen; spare reels stand on the cart's shelf, and a cable runs from the projector to the projectionist's console, which has a rack of schedule cards behind it and a cable to a card catalogue. At the back the catalogue's change log prints on a glass-dome ticker whose tape runs past a tally counter, an index-card sorter and a desk bell to a take-up spool. At the front an intake box takes exposed film cans down a slide into a tray where they pile up beside a sink of six developing tanks under a safelight, and developed prints slide into a flat-file vault.",
  width: WIDTH,
  height: HEIGHT,
  stack: ["back"],
  layerOf,
  halo,
  stageAttrs: { role: "slider", "aria-label": "Video platform: drag across the figure or use the left and right arrow keys to set the load, up and down for the share of uploads, Home for the preset", "aria-valuemin": 0, "aria-valuemax": RPS_MAX, "aria-valuenow": PRESET.rps, "aria-valuetext": `${PRESET.rps} requests per second, ${Math.round(SHARE * 100)} percent uploads` },
  data: { preset: { nodes: PRESET.nodes, edges: PRESET.edges, rps: PRESET.rps }, rpsMax: RPS_MAX, share: SHARE, shareMax: SHARE_MAX, twCap: TW_CAP, miss: MISS, cans: CANS, dial: demand.knob },
  truthCode: TRUTH.code,
  css: readFileSync(join(HERE, "figure.css"), "utf8"),
  live: readFileSync(join(HERE, "live.js"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `video-platform${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${R.items.length} items · ${R.solids.length} solids · ${R.tubes.length} tube runs`);
}
export { R };
