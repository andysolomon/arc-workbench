// Fig 10 · Cache-miss Request. A pneumatic tube station for the Workbench's `cachemiss` sequence:
// seven stations in a row (User, Web App, API, Auth, Redis, Postgres, Trace) behind a glass tube.
// One lit capsule carries the request message by message, each hop taking its latency, so the 38 ms
// Postgres query is the long run; the fire-and-forget messages (the write-through and the span) go by
// a second, thinner tube and never hold the capsule. A stopwatch on the bench reads the trip's
// elapsed time. The timeline is the Workbench's own (timeline() in src/sim/paradigms.ts).
//
// The row is turned 28° on the bench. The kit's light is locked to the camera, so that is drawn as
// the camera's azimuth (72° − 28° = 44°) over an axis-aligned row: the same picture, simpler geometry.
//
//   node figures/cache-miss-request/build.mjs [--light] [--audit] [--out=dir]
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

// ---------- truth: the Workbench example and its timeline ----------
const TRUTH = await truth(join(HERE, "truth.ts"));
const EX = TRUTH.WB.EXAMPLES.sequence.find((e) => e.id === "cachemiss");
if (!EX) throw new Error("the cachemiss example is missing from src/paradigms/examples.ts");
const KINDS = TRUTH.WB.PARADIGMS.sequence.EDGES;
const pack = (tl) => ({
  total: tl.total,
  msgs: tl.msgs.map((m) => ({ seq: m.e.seq, from: m.e.from, to: m.e.to, kind: m.e.kind, label: m.e.label, start: m.start, end: m.end, lat: m.lat, async: !!KINDS[m.e.kind]?.nowait })),
});
export const MISS = pack(TRUTH.WB.timeline(EX.edges));
// the hit variant: the same document without the Postgres round trip and the write-through it causes
const DROP = new Set(["api>pg", "pg>api", "api>redis#9"]);
const hitEdges = EX.edges.filter((e) => !DROP.has(`${e.from}>${e.to}`) && !DROP.has(e.id)).map((e) => (e.from === "redis" && e.to === "api" ? { ...e, label: "hit" } : e));
export const HIT = pack(TRUTH.WB.timeline(hitEdges));
const slowest = MISS.msgs.filter((m) => !m.async).reduce((a, m) => (m.lat > a.lat ? m : a));
const nameOf = Object.fromEntries(EX.nodes.map((n) => [n.id, n.name]));

// ---------- camera and world ----------
const WIDTH = 640;
const HEIGHT = 470;
const ORDER = [...EX.nodes].sort((a, b) => a.x - b.x).map((n) => n.id);
const STATION_X = Object.fromEntries(ORDER.map((id, i) => [id, -132 + 44 * i]));
const MAIN = { y: 25, z: 20, r: 4.2 };
const SIDE = { y: 15, z: 37, r: 2.4 };
const BENCH = { x: -184, y: -40, w: 356, d: 128, r: 9 };
const HEIGHTS = { user: 20, web: 32, api: 34, auth: 30, redis: 30, pg: 34, trace: 24 };
const BLOWER = { c: [-170, MAIN.y], r: 8, h: 30 };
const END = { x: STATION_X.pg + 22, w: 8 };
const SIDE_FROM = STATION_X.api;
const SIDE_END = { x: STATION_X.trace + 20, w: 7 };
const WATCH = { c: [-112, 64], r: 15, z: 9 };

export const P = k.fitProjection([...k.boxCorners(BENCH, -17, 0), [STATION_X.api, 0, 40], [STATION_X.pg, 0, 40]], WIDTH, HEIGHT, { pad: 30, azimuth: 44, elevation: 34 });
const W = workshop({ P, theme, layers: ["back", "front"] });
const { R, at, S, L, D, VERT, put, byDepth } = W;
const V3 = G.viewOf(P);
const plan = (cx, cy, w, d, r = 1.4) => ({ x: cx - w / 2, y: cy - d / 2, w, d, r });

// ---------- the stations ----------
export const LAMPS = {};
function station(id) {
  const x = STATION_X[id];
  const type = EX.nodes.find((n) => n.id === id).type;
  const H = HEIGHTS[id];
  let svg = "";
  const shapes = [];
  const block = (p, z, h, style = {}, steps = 4, bevel = 0.6) => {
    svg += S(k.slabOf(p, z, h, P, steps, bevel), { tone: "mid", ...style });
    shapes.push(A.slab(p, z, h));
  };
  const plinth = plan(x, 0, 26, 22, 2);
  block(plinth, 0, 3, { tone: "lo" }, 4, 0.4);
  const body = plan(x, 0, 22, 18);
  const front = 9;
  const face = (pts) => k.pathOf(pts.map(([u, z]) => at([x + u, front, z])), true);
  const slot = (u0, u1, z, h = 0.9) => {
    const pts = [];
    for (let j = 0; j <= 8; j++) pts.push([u1 + h * Math.sin((j / 8) * Math.PI), z + h * Math.cos((j / 8) * Math.PI)]);
    for (let j = 0; j <= 8; j++) pts.push([u0 - h * Math.sin((j / 8) * Math.PI), z - h * Math.cos((j / 8) * Math.PI)]);
    return face(pts);
  };
  const lampAt = [x + 7.5, front, H - 4];
  if (type === "db") {
    // Postgres: the family's drum, here without its gauge
    const F = VERT(x, 0);
    const bands = [0.3, 0.55, 0.8].map((f) => k.sideArc(x, 0, 11, 3 + (H - 3) * f, P, 48)).join("");
    svg += S(k.cylinder(x, 0, 12.4, 3, 1.4, P, 56, 0.3), { tone: "lo" }) + D(G.dotsOf(F, 4.4, 11.8, 12, P, { all: true, phase: 0.2 }), { size: 0.4 });
    shapes.push(A.cylinder(x, 0, 12.4, 3, 1.4));
    svg += S(k.cylinder(x, 0, 11, 4.4, H - 4.4, P, 72, 0.5), { tone: "hi", crease: "lo", inner: L(bands, { tone: "faint" }) }) + L(k.ring(x, 0, 8.4, H, P, 48), { tone: "faint" });
    shapes.push(A.cylinder(x, 0, 11, 4.4, H - 4.4));
  } else {
    const inner = L(k.sideSeam(body, H - 3.2, P, 4), { tone: "faint" });
    block(body, 3, H - 3, { inner }, 4, 0.8);
    // the receiving hatch on every station's front, then each kind's own fixture
    svg += L(face(k.roundedPlan({ x: -7, y: 6, w: 10, d: Math.min(12, H - 14), r: 1.4 }, 3)), { tone: "lo" });
    if (type === "client") {
      const screen = plan(x - 1, -3, 16, 4, 0.8);
      block(screen, H, 11, { tone: "hi", crease: "lo" }, 3, 0.4);
      svg += L(k.pathOf(k.roundedPlan({ x: x - 7.5, y: H + 2, w: 13, d: 7, r: 0.8 }, 3).map(([u, z]) => at([u, -1, z])), true), { tone: "lo" });
    } else if (type === "service") {
      svg += L([H - 9, H - 12, H - 15].map((z) => slot(2.6, 8, z)).join(""), { tone: "lo" });
    } else if (type === "api") {
      svg += L(k.ring(x, 0, 6.4, H, P, 36) + k.ring(x, 0, 4, H, P, 30) + k.ring(x, 0, 1.6, H, P, 16), { tone: "lo" });
    } else if (type === "auth") {
      const LF = G.frameAlong([x + 6.6, front, H - 13], [0, 1, 0]);
      svg += S(G.disc(0, 1.2, 2.6, LF, P), { tone: "hi", crease: "lo" }) + L(k.pathOf(k.roundedPlan({ x: -0.4, y: -1.3, w: 0.8, d: 2.2, r: 0.4 }, 2).map(([u, v]) => at(G.add3([x + 6.6, front + 1.2, H - 13], [u, 0, v]))), true), { tone: "lo" });
      shapes.push(A.disc(LF, 0, 1.2, 2.6));
    } else if (type === "cache") {
      const step = (H - 13) / 4;
      for (let i = 0; i < 4; i++) {
        const z0 = 5 + i * step;
        svg += L(face(k.roundedPlan({ x: 3.4, y: z0 + 0.5, w: 6.4, d: step - 1.4, r: 0.6 }, 2)), { tone: "lo" }) + D([at([x + 6.6, front, z0 + step / 2])], { size: 0.45 });
      }
    } else if (type === "external") {
      // the trace recorder: a paper roll on two cheeks
      for (const dx of [-7, 5.6]) block({ x: x + dx, y: -2, w: 1.4, d: 4, r: 0.3 }, H, 5, {}, 2, 0);
      const RF = G.frameOf([x - 5.6, 0, H + 4], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      svg += S(G.disc(0, 11.2, 3.2, RF, P), { tone: "hi", crease: "lo", inner: L([1.6, 9.6].map((s) => G.arcOf(RF, s, 3.2, P)).join(""), { tone: "faint" }) });
      shapes.push(A.disc(RF, 0, 11.2, 3.2));
    }
  }
  const LF = G.frameAlong(lampAt, [0, 1, 0]);
  const lampFront = type === "db" ? null : LF;
  if (lampFront) {
    const c = at(G.pointOf(LF, 1.3, 0, 0));
    svg += S(G.disc(0, 0.8, 2, LF, P), { tone: "lo" }) + S(G.disc(0.8, 1.3, 1.3, LF, P), { tone: "mid" }) + `<circle class="bx-lamp" data-lamp="${id}" data-node="${id}" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="${(1.1 * G.scaleOf(P)).toFixed(2)}"/>`;
    shapes.push(A.disc(LF, 0, 0.8, 2), A.disc(LF, 0.8, 1.3, 1.3));
  }
  put({ name: `st.${id}`, layer: "back", at: [x, 0, 0], svg, shapes });
}

// ---------- glass tubes: a back wall seen through, and a front of edges, a shine and couplings ----------
const silhouette = (r) => {
  const t = Math.atan2(-V3[1], V3[2]);
  return [t, t + Math.PI].map((a) => [r * Math.cos(a), r * Math.sin(a)]);
};
function glass(name, tube, x0, x1, couplings, { touch = [], from = x0 } = {}) {
  const [[ya, za], [yb, zb]] = silhouette(tube.r);
  const P3 = (x, dy, dz) => at([x, tube.y + dy, tube.z + dz]);
  const band = k.pathOf([P3(x0, ya, za), P3(x1, ya, za), P3(x1, yb, zb), P3(x0, yb, zb)], true);
  // the far half of the wall, seen through the glass, takes the shaded tone
  const back = `<path class="cm-glass" d="${band}"/>`;
  const halfArc = (x, from, to) => {
    const pts = [];
    for (let j = 0; j <= 16; j++) {
      const a = from + ((to - from) * j) / 16;
      pts.push(P3(x, tube.r * Math.cos(a), tube.r * Math.sin(a)));
    }
    return k.pathOf(pts);
  };
  const t0 = Math.atan2(za, ya);
  // the near half of a ring faces the viewer: the half whose normal has n·V > 0
  const nearFrom = t0;
  const nearTo = t0 + Math.PI;
  const mid = nearFrom + Math.PI / 2;
  const near = Math.cos(mid) * V3[1] + Math.sin(mid) * V3[2] > 0 ? [nearFrom, nearTo] : [nearTo, nearTo + Math.PI];
  const farArcs = couplings.map((x) => halfArc(x, near[1], near[1] + Math.PI)).join("");
  const nearArcs = couplings.map((x) => halfArc(x, near[0], near[1])).join("");
  const shine = (() => {
    const a = near[0] + (near[1] - near[0]) * 0.72;
    return k.pathOf([P3(x0, tube.r * 0.82 * Math.cos(a), tube.r * 0.82 * Math.sin(a)), P3(x1, tube.r * 0.82 * Math.cos(a), tube.r * 0.82 * Math.sin(a))]);
  })();
  const edges = k.pathOf([P3(x0, ya, za), P3(x1, ya, za)]) + k.pathOf([P3(x0, yb, zb), P3(x1, yb, zb)]);
  // the route runs from its mount; where a flange covers the start, the glass begins at the flange's face
  const points = [[x0, tube.y, tube.z], [x1, tube.y, tube.z]];
  R.route(name, [[from, tube.y, tube.z], [x1, tube.y, tube.z]], tube.r, { touch, gaps: from < x0 ? [[0, x0 - from]] : [] });
  // the glass carries its tube's shape for ordering only (the route above is the tube the audit checks)
  R.put({ name: `${name}.back`, layer: "back", at: [(x0 + x1) / 2, tube.y, tube.z], bias: W.LAYER_BIAS.back, svg: back + L(farArcs, { tone: "faint" }), route: name, chunk: 0, shapes: [A.tube(points, tube.r)] });
  R.put({ name: `${name}.front`, layer: "front", at: [(x0 + x1) / 2, tube.y + tube.r, tube.z], bias: W.LAYER_BIAS.front, svg: `<path class="cm-shine" d="${shine}"/>` + L(nearArcs, { tone: "mid" }) + L(edges, { tone: "mid" }), route: name, chunk: 1, shapes: [A.tube(points, tube.r)] });
}

// ---------- supports, the blower, the end stops ----------
function supports() {
  const cradle = (name, x, tube, postR) => {
    const top = tube.z - tube.r;
    const block = { x: x - 2.2, y: tube.y - 2.2, w: 4.4, d: 4.4, r: 0.6 };
    const svg = S(k.cylinder(x, tube.y, postR + 1.6, 0, 1.2, P, 24), { tone: "lo" }) + S(k.cylinder(x, tube.y, postR, 1.2, top - 2.4 - 1.2, P, 20), { tone: "mid", crease: "none" }) + S(k.slabOf(block, top - 2.4, 2.4, P, 2, 0.3), { tone: "hi", crease: "lo" });
    put({ name: `cradle.${name}`, layer: "back", at: [x, tube.y, 0], svg, shapes: [A.cylinder(x, tube.y, postR + 1.6, 0, 1.2), A.cylinder(x, tube.y, postR, 1.2, top - 3.6), A.slab(block, top - 2.4, 2.4)] });
  };
  ORDER.slice(0, 5).forEach((id, i) => cradle(`main.${i}`, STATION_X[id] + 22, MAIN, 1.5));
  ORDER.slice(2, 6).forEach((id, i) => cradle(`side.${i}`, STATION_X[id] + 22, SIDE, 1.1));
  // the blower that drives the line: a cabinet with its fan on top; the main tube leaves its flat side
  const [bx, by] = BLOWER.c;
  const cab = plan(bx, by, 2 * BLOWER.r, 2 * BLOWER.r + 2, 1.6);
  const fside = cab.x + cab.w;
  const vent = (z) => k.pathOf([[fside, by - 6, z + 0.8], [fside, by + 2, z + 0.8], [fside, by + 2, z - 0.8], [fside, by - 6, z - 0.8]].map(at), true);
  const blower =
    S(k.slabOf(cab, 0, BLOWER.h, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(cab, 3.2, P, 4), { tone: "faint" }) + L([7, 10, 27, 30].map(vent).join(""), { tone: "lo" }) }) +
    L(k.ring(bx, by, 6.4, BLOWER.h, P, 40) + k.ring(bx, by, 4.2, BLOWER.h, P, 32), { tone: "lo" }) + S(k.cylinder(bx, by, 2.2, BLOWER.h, 1.6, P, 20), { tone: "hi", crease: "lo" }) +
    D(k.corners(cab, 1.6).map(([cx, cy]) => at([cx, cy, BLOWER.h])), { size: 0.42 });
  // wider than the tube it drives, the blower is drawn over the glass where the tube leaves it
  put({ name: "blower", layer: "front", at: [bx, by, 0], svg: blower, shapes: [A.slab(cab, 0, BLOWER.h), A.cylinder(bx, by, 2.2, BLOWER.h, 1.6)] });
  const stop = (name, x, w, tube, h) => {
    const p = { x, y: tube.y - tube.r - 1.6, w, d: 2 * tube.r + 3.2, r: 1 };
    put({ name, layer: "front", at: [x + w / 2, tube.y, 0], svg: S(k.slabOf(p, 0, h, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(p, 3, P, 3), { tone: "faint" }) }) + D(k.corners(p, 1.6).map(([cx, cy]) => at([cx, cy, h])), { size: 0.4 }), shapes: [A.slab(p, 0, h)] });
  };
  stop("end.main", END.x, END.w, MAIN, MAIN.z + MAIN.r + 3);
  stop("end.side", SIDE_END.x, SIDE_END.w, SIDE, SIDE.z + SIDE.r + 3);
  // the fire-and-forget line leaves the API from a junction on its lid
  const j = { x: SIDE_FROM - 4.4, y: 4, w: 8.8, d: SIDE.y + SIDE.r + 1.6 - 4, r: 1 };
  const jz = HEIGHTS.api;
  const jh = SIDE.z + SIDE.r + 2 - jz;
  put({ name: "junction.api", layer: "front", at: [SIDE_FROM, 10, jz], svg: S(k.slabOf(j, jz, jh, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(j, jz + 1.6, P, 3), { tone: "faint" }) }) + D(k.corners(j, 1.5).map(([cx, cy]) => at([cx, cy, jz + jh])), { size: 0.4 }), shapes: [A.slab(j, jz, jh)] });
}

// ---------- the stopwatch on the bench ----------
export const DIAL = { c: WATCH.c, z: WATCH.z + 1.2, r0: 1.4, r1: WATCH.r - 3.4, from: 0, span: Math.PI * 2, max: 100 };
function stopwatch() {
  const [x, y] = WATCH.c;
  const top = WATCH.z;
  const t = k.radialTicks(x, y, WATCH.r - 1.8, 50, 5, top + 1.2, [1.1, 2.4], P);
  const mark = (ms, len, tone) => {
    const a = (ms / 100) * Math.PI * 2;
    return L(k.lineOnTop([x + Math.sin(a) * (WATCH.r - 1.8 - len), y - Math.cos(a) * (WATCH.r - 1.8 - len)], [x + Math.sin(a) * (WATCH.r - 1.8), y - Math.cos(a) * (WATCH.r - 1.8)], top + 1.2, P), { tone });
  };
  const svg =
    S(k.cylinder(x, y, WATCH.r + 2.4, 0, 2, P, 64, 0.3), { tone: "lo" }) +
    S(k.cylinder(x, y, WATCH.r, 2, top - 2, P, 80, 0.6), { tone: "hi", crease: "lo", inner: L(k.knurl(x, y, WATCH.r, 2, top, 72, P), { tone: "lo" }) }) +
    S(k.cylinder(x, y, WATCH.r - 1, top, 1.2, P, 72, 0.3), { tone: "mid" }) +
    L(k.ring(x, y, WATCH.r - 1.8, top + 1.2, P, 96), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + mark(MISS.total, 3.6, "hi") + mark(HIT.total, 3.6, "mid") +
    L(k.ring(x, y, 1.4, top + 1.2, P, 14), { tone: "mid" }) +
    `<path class="iso-line" data-tone="hi" data-free="end" data-ref="hand" d="${k.lineOnTop([x, y - 1.4], [x, y - (WATCH.r - 3.4)], top + 1.2, P)}"/>`;
  // the crown at twelve o'clock: a stem and a button out of the case, behind the dial
  const s0 = Math.sqrt(WATCH.r ** 2 - 1.3 ** 2);
  const CF = G.frameAlong([x, y - s0, 5.6], [0, -1, 0]);
  const crown = S(G.disc(0, 2.2, 1.3, CF, P), { tone: "mid" }) + S(G.disc(2.2, 3.8, 2.2, CF, P), { tone: "hi", crease: "lo" });
  put({ name: "watch.crown", layer: "front", at: [x, y - WATCH.r - 2, 5.6], svg: crown, shapes: [A.disc(CF, 0, 2.2, 1.3), A.disc(CF, 2.2, 3.8, 2.2)] });
  put({ name: "watch", layer: "front", at: [x, y, 0], bias: 1, svg, shapes: [A.cylinder(x, y, WATCH.r + 2.4, 0, 2), A.cylinder(x, y, WATCH.r, 2, top - 2), A.cylinder(x, y, WATCH.r - 1, top, 1.2)] });
}

// ---------- capsules: one lit request capsule in the main tube, two small ones on the side line ----------
const capsule = (cls, x, tube, r, len, tone, lit) => {
  const F = G.frameOf([x, tube.y, tube.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const h = len / 2;
  const prof = [[-h, 0]];
  for (let j = 1; j <= 6; j++) {
    const a = (j / 6) * (Math.PI / 2);
    prof.push([-h + r * (1 - Math.cos(a)), r * Math.sin(a), 1]);
  }
  for (let j = 6; j >= 1; j--) {
    const a = (j / 6) * (Math.PI / 2);
    prof.push([h - r * (1 - Math.cos(a)), r * Math.sin(a), 1]);
  }
  prof.push([h, 0]);
  return `<g class="${cls}">${S(G.solidOf(prof, F, P), { tone, crease: "lo", lit, inner: L(G.arcOf(F, 0, r, P), { tone: "faint" }) })}</g>`;
};
const HOME = STATION_X.user;
const CAPSULES =
  `<g data-ref="capsule">${capsule("cm-capsule", HOME, MAIN, 3, 10, "hi", true)}</g>` +
  ["a", "b"].map((id) => `<g data-ref="side-${id}" class="cm-side">${capsule("cm-capsule-side", SIDE_FROM, SIDE, 1.6, 6, "hi", false)}</g>`).join("");

// ---------- build ----------
const { halo } = W.bench(BENCH, { label: { x: 104, y: 52, w: 58, d: 22, r: 2 } });
W.rulerStrip({ x: -64, y: 74, w: 150, d: 7, r: 1 });
ORDER.forEach(station);
supports();
const couplings = ORDER.slice(0, 6).map((id) => STATION_X[id]);
glass("tube.main", MAIN, BLOWER.c[0] + BLOWER.r + 1.4, END.x, couplings, { touch: ["cradle.main*"], from: BLOWER.c[0] + BLOWER.r });
// the blower's outlet faces the viewer: a flange there, owned by the tube that leaves it
{
  const o = [BLOWER.c[0] + BLOWER.r, MAIN.y, MAIN.z];
  const r = MAIN.r + 1.6;
  put({ name: "tube.main.flange", layer: "back", at: o, bias: 0.05, svg: W.bossSvg(o, [1, 0, 0], { r }), shapes: [W.bossShape("tube.main.flange", o, [1, 0, 0], "tube.main", r)] });
}
glass("tube.side", SIDE, SIDE_FROM + 4.4, SIDE_END.x, [STATION_X.redis, STATION_X.trace], { touch: ["cradle.side*"] });
stopwatch();

const { layerOf } = W.finish({});
if (argv.includes("--audit")) A.auditOrExit(R, P);

// ---------- page ----------
const ms = (v) => `${Math.round(v)} ms`;
const page = W.page({
  title: "Cache-miss request",
  fig: "Fig 10",
  hint: "Drag · space play · H hit",
  readout: `0 ms · ${nameOf.user} → ${nameOf.web}`,
  keys: [
    { mark: "lit", label: "The request, one message at a time" },
    { mark: "raised", label: "Fire-and-forget: the write-through and the span" },
    { mark: "edge", label: "Stopwatch: the trip's elapsed time" },
  ],
  caption: `${MISS.msgs.length} messages, ${ms(MISS.total)} end to end, and only the ${MISS.msgs.length - MISS.msgs.filter((m) => m.async).length} the caller waits for count: ${nameOf[slowest.from]} → ${nameOf[slowest.to]} (${slowest.label}) alone is ${ms(slowest.lat)}, ${Math.round((slowest.lat / MISS.total) * 100)}% of the trip, and the write-through and the span add nothing. Press H for the same request on a cache hit: ${ms(HIT.total)}. The times are the Workbench's own timeline for the Cache-miss Request.`,
  label: "A pneumatic tube station on a bench: seven stations in a row, a user terminal, the web app, the API, an auth box with a lock, a Redis drawer cabinet, the Postgres drum and a trace recorder, behind a glass tube driven by a blower. A capsule carries the request from station to station; a thinner tube above carries the fire-and-forget messages. A stopwatch on the bench reads the elapsed time.",
  width: WIDTH,
  height: HEIGHT,
  stack: ["back", "capsules", "front"],
  layerOf: (name) => (name === "capsules" ? [CAPSULES] : layerOf(name)),
  halo,
  stageAttrs: { role: "slider", "aria-label": "Cache-miss request: drag across to move through the request's timeline, space to play or pause, H for the cache-hit variant", "aria-valuemin": 0, "aria-valuemax": Math.ceil(MISS.total), "aria-valuenow": 0, "aria-valuetext": "0 milliseconds" },
  data: {
    miss: MISS,
    hit: HIT,
    names: nameOf,
    stations: STATION_X,
    main: MAIN,
    side: SIDE,
    sideFrom: SIDE_FROM,
    home: HOME,
    dial: DIAL,
  },
  truthCode: TRUTH.code,
  live: readFileSync(join(HERE, "live.js"), "utf8"),
  css: readFileSync(join(HERE, "figure.css"), "utf8"),
});
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(outDir, { recursive: true });
  const name = `cache-miss-request${theme === "light" ? "-light" : ""}.html`;
  writeFileSync(join(outDir, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${R.items.length} items · ${R.solids.length} solids · miss ${MISS.total} ms · hit ${HIT.total} ms`);
}
