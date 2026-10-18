// The shared bench: the parts every System designs figure is built from, so the set reads as one
// family at one scale. A bench on feet, a load generator (the clients) with its load knob, service
// boxes whose window glows with utilization, Postgres drums with a gauge, and conduits between
// ports. Every helper records its true shapes for the kit audit (figures/kit/audit.mjs).
//
//   const W = workshop({ P, theme, layers: ["back", "grille"] });
//   W.bench(PLAN, { label, ruler }); W.generator(GEN, { rpsMax, marks, portY });
//   const pod = W.box({ id: "s1", plan, ... }); W.database({ id: "db", plinth, ... });
//   W.conduit("pipe.a", [from, ..., to], n0, n1);
//   const { layerOf } = W.finish({ T, poses, verify });   // settle keys, prove the layer bands
//   W.page({ ... })                                        // the card, the stage, the inlined runtime
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import { glCamera } from "../kit/gl.mjs";
import { kitScript, glScript, turnScript } from "./inline.mjs";
import { TURN } from "../kit/turn.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PIPE_R = 2.2;
export const PIPE_Z = 8;
export const BOSS_R = 3.6;
export const BOSS_T = 1.4;
const rad = (deg) => (deg * Math.PI) / 180;

export function workshop({ P, theme = "dark", layers = ["back", "grille"], recorder }) {
  const LAYER_BIAS = Object.fromEntries(layers.map((name, i) => [name, i * 1000]));
  const R = recorder ?? A.recorder(P);
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const VERT = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  const poly = (points) => k.pathOf(points.map(at), true);
  // paint order is the layer stack, then the settled key inside a layer: the bias keeps the keys in
  // stack order, so the audit's depth check judges the order the page really paints
  const put = (item) => {
    if (!(item.layer in LAYER_BIAS)) throw new Error(`${item.name}: unknown layer ${item.layer}`);
    return R.put({ ...item, bias: (item.bias ?? 0) + LAYER_BIAS[item.layer], shapes: item.shapes.map((shape, i) => R.solid(Object.assign(shape, { name: shape.name ?? (i ? `${item.name}#${i + 1}` : item.name) }))) });
  };
  const WINDOWS = [];
  const LAMPS = [];
  const GAUGES = [];
  let KNOB = null;

  // ---------- ports ----------
  const bossSvg = (o, n, { tone = "mid", r = BOSS_R } = {}) => {
    const F = G.frameAlong(o, n);
    const facing = G.dot3(n, V) > 0.12;
    const face = facing ? L(G.circleOf(F, BOSS_T, r - 1.1, P), { tone: "faint" }) + D([at(G.pointOf(F, BOSS_T, 0, 0))], { size: 0.45, tone: "mid" }) : "";
    return S(G.disc(0, BOSS_T, r, F, P), { tone, crease: "lo" }) + face;
  };
  const bossShape = (name, o, n, owner, r = BOSS_R) => A.disc(G.frameAlong(o, n), 0, BOSS_T, r, { name, owner });

  // ---------- bench ----------
  function bench(BENCH, { h = 12, foot = 5, label = null, ruler = null } = {}) {
    for (const [x, y] of byDepth(k.corners(BENCH, 24))) {
      const z0 = -h - foot;
      const svg = S(k.cylinder(x, y, 7, z0, 1.6, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 5.4, z0 + 1.6, foot - 1.6, P, 28), { tone: "mid" });
      put({ name: `stand.foot.${x}.${y}`, layer: layers[0], at: [x, y, z0], svg, shapes: [A.cylinder(x, y, 7, z0, 1.6, { ground: true }), A.cylinder(x, y, 5.4, z0 + 1.6, foot - 1.6)] });
    }
    const screws = k.corners(BENCH, 9);
    const svg =
      S(k.slabOf(BENCH, -h, h, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BENCH, -h + 4, P, 8), { tone: "faint" }) }) +
      L(k.planOutline(k.insetPlan(BENCH, 5), 0, P), { tone: "lo" }) +
      L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }) +
      D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 });
    put({ name: "stand.bench", layer: layers[0], at: [0, 0, -h], bias: -400, svg, shapes: [A.slab(BENCH, -h, h, { ground: true })] });
    if (label) labelPlate(label);
    if (ruler) rulerStrip(ruler);
    return { halo: `<path class="iso-halo" d="${k.haloOf(BENCH, -h - foot, h, P)}"/>` };
  }
  function labelPlate(LABEL, { layer = layers[0], name = "stand.label" } = {}) {
    const rule = (y, from, to) => L(k.lineOnTop([LABEL.x + from, LABEL.y + y], [LABEL.x + Math.min(to, LABEL.w - 6), LABEL.y + y], 0.8, P), { tone: "lo", free: true });
    const svg =
      S(k.slabOf(LABEL, 0, 0.8, P, 4, 0.4), { tone: "lo" }) +
      L(k.planOutline(k.insetPlan(LABEL, 1.6), 0.8, P, 4), { tone: "faint" }) +
      rule(LABEL.d * 0.3, 7, LABEL.w * 0.62) + rule(LABEL.d * 0.48, 7, LABEL.w * 0.8) + rule(LABEL.d * 0.66, 7, LABEL.w * 0.46) +
      D([at([LABEL.x + 3.6, LABEL.y + LABEL.d / 2, 0.8]), at([LABEL.x + LABEL.w - 3.6, LABEL.y + LABEL.d / 2, 0.8])], { size: 0.45 });
    put({ name, layer, at: [LABEL.x + LABEL.w / 2, LABEL.y + LABEL.d / 2, 0], svg, shapes: [A.slab(LABEL, 0, 0.8)] });
  }
  function rulerStrip(STRIP, { layer = layers[0], name = "stand.ruler" } = {}) {
    const t = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 4.5, 5, STRIP.y + 0.6, 0.6, [2, 3.6], P);
    const svg = S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }) + L(k.lineOnTop([STRIP.x + 1.5, STRIP.y + 0.6], [STRIP.x + STRIP.w - 1.5, STRIP.y + 0.6], 0.6, P), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" });
    put({ name, layer, at: [STRIP.x + STRIP.w / 2, STRIP.y + STRIP.d / 2, 0], svg, shapes: [A.slab(STRIP, 0, 0.6)] });
  }

  // ---------- the load generator: the clients, and the knob that sets the load ----------
  // `marks` are loads worth a hi tick on its dial (a capacity the figure is about)
  function generator(GEN, { rpsMax, marks = [], layer = layers[0] } = {}) {
    const cx = GEN.x + GEN.w / 2;
    const cy = GEN.y + GEN.d / 2;
    for (const [x, y] of byDepth(k.corners(GEN, 5))) put({ name: `gen.foot.${x}.${y}`, layer, at: [x, y, 0], svg: S(k.cylinder(x, y, 2.6, 0, 2, P, 20), { tone: "lo" }), shapes: [A.cylinder(x, y, 2.6, 0, 2)] });
    const top = 20;
    const screws = k.corners(GEN, 3.6);
    const front = GEN.y + GEN.d;
    const slot = (x0, x1, z) => {
      const pts = [];
      for (let j = 0; j <= 8; j++) pts.push([x1 + 0.9 * Math.sin((j / 8) * Math.PI), front, z + 0.9 * Math.cos((j / 8) * Math.PI)]);
      for (let j = 0; j <= 8; j++) pts.push([x0 - 0.9 * Math.sin((j / 8) * Math.PI), front, z - 0.9 * Math.cos((j / 8) * Math.PI)]);
      return poly(pts);
    };
    const vents = [7, 10.5, 14].map((z) => slot(GEN.x + 8, GEN.x + 24, z)).join("");
    const body =
      S(k.slabOf(GEN, 2, top - 2, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(GEN, 6, P, 6), { tone: "faint" }) + L(vents, { tone: "lo" }) }) +
      L(screws.map(([x, y]) => k.ring(x, y, 1.6, top, P, 14)).join(""), { tone: "lo" }) +
      D(screws.map(([x, y]) => at([x, y, top])), { size: 0.45 });
    KNOB = { c: [cx, cy], r: 7.6, z: 28.6, from: rad(-135), span: rad(270), r0: 1.1, r1: 6.6, max: rpsMax };
    const t = k.radialTicks(cx, cy, 15.4, 40, 5, top + 0.6, [1.3, 2.7], P, KNOB.from, KNOB.span);
    const angleOf = (rps) => KNOB.from + (rps / rpsMax) * KNOB.span;
    const mark = (rps) => k.lineOnTop([cx + Math.sin(angleOf(rps)) * 11.8, cy - Math.cos(angleOf(rps)) * 11.8], [cx + Math.sin(angleOf(rps)) * 15.4, cy - Math.cos(angleOf(rps)) * 15.4], top + 0.6, P);
    const dial =
      S(k.cylinder(cx, cy, 16.6, top, 0.6, P, 64, 0.3), { tone: "lo" }) +
      L(k.ring(cx, cy, 15.4, top + 0.6, P, 72), { tone: "lo" }) +
      L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + marks.filter((m) => m > 0 && m <= rpsMax).map((m) => L(mark(m), { tone: "hi" })).join("");
    const knob =
      S(k.cylinder(cx, cy, 9.2, top + 0.6, 1.4, P, 48), { tone: "lo" }) +
      S(k.cylinder(cx, cy, KNOB.r, top + 2, KNOB.z - top - 2, P, 48, 0.5), { tone: "hi", crease: "lo", inner: L(k.knurl(cx, cy, KNOB.r, top + 2, KNOB.z, 44, P), { tone: "lo" }) }) +
      L(k.ring(cx, cy, 5.2, KNOB.z, P, 36), { tone: "faint" }) +
      L(k.ring(cx, cy, 1.1, KNOB.z, P, 14), { tone: "mid" }) +
      `<path class="iso-line" data-tone="hi" data-free="end" data-ref="knob" d="${k.lineOnTop([cx, cy - 1.1], [cx, cy - 6.6], KNOB.z, P)}"/>`;
    put({ name: "gen.body", layer, at: [cx, cy, 2], svg: body + dial + knob, shapes: [A.slab(GEN, 2, top - 2), A.cylinder(cx, cy, 16.6, top, 0.6), A.cylinder(cx, cy, 9.2, top + 0.6, 1.4), A.cylinder(cx, cy, KNOB.r, top + 2, KNOB.z - top - 2)] });
    return {
      knob: KNOB,
      right: (y = cy) => [GEN.x + GEN.w, y, PIPE_Z],
      front: (x = cx + 14) => [x, GEN.y + GEN.d, PIPE_Z],
    };
  }

  // ---------- a window into a hot box: a recess with heater rods, and its grille ----------
  const opening = (w) => k.roundedPlan({ x: w.x0, y: w.z0, w: w.x1 - w.x0, d: w.z1 - w.z0, r: w.r }, 4);
  let clipCount = 0;
  function recessSvg(w) {
    const F = ([x, z]) => at([x, w.yf, z]);
    const B = (x, z) => at([x, w.yb, z]);
    const clip = `bx-win-${theme}-${w.id}-${clipCount++}`;
    const hole = k.pathOf(opening(w).map(F), true);
    const back = k.pathOf([B(w.x0 - 4, w.z0 - 4), B(w.x1 + 4, w.z0 - 4), B(w.x1 + 4, w.z1 + 4), B(w.x0 - 4, w.z1 + 4)], true);
    const floor = k.pathOf([at([w.x0 - 4, w.yf, w.z0]), at([w.x1 + 4, w.yf, w.z0]), B(w.x1 + 4, w.z0), B(w.x0 - 4, w.z0)], true);
    const wall = k.pathOf([at([w.x0, w.yf, w.z0 - 4]), at([w.x0, w.yf, w.z1 + 4]), B(w.x0, w.z1 + 4), B(w.x0, w.z0 - 4)], true);
    const corners = k.pathOf([B(w.x0, w.z1 + 4), B(w.x0, w.z0), B(w.x1 + 4, w.z0)]);
    const rods = w.rods.map((z) => tubePieces([[w.x0, w.yr, z], [w.x1, w.yr, z]], w.rr, P, { maxLength: 400, caps: false }).map((piece) => tubeSvg(piece, { tone: "mid" })).join("")).join("");
    return `<defs><clipPath id="${clip}"><path d="${hole}"/></clipPath></defs><g clip-path="url(#${clip})" class="bx-cavity" data-window="${w.id}"><path class="iso-shade" data-shade="1" d="${back}"/><path class="bx-glow" d="${back}"/><path class="iso-top" d="${floor}"/><path class="iso-shade" data-shade="2" d="${wall}"/>${L(corners, { tone: "faint" })}<g class="bx-rods">${rods}</g></g>${L(hole, { tone: "lo" })}`;
  }
  function grille(w, name) {
    const plan = { x: w.x0 - 1.6, y: w.yf, w: w.x1 - w.x0 + 3.2, d: 1.3, r: 0.4 };
    const strip = (z0) => S(k.slabOf(plan, z0, 1.6, P, 2, 0.25), { tone: "hi", crease: "lo" });
    const bars = [];
    const count = Math.max(2, Math.round((w.x1 - w.x0) / 4.4));
    for (let i = 1; i < count; i++) {
      const x = w.x0 + ((w.x1 - w.x0) * i) / count;
      bars.push(S(k.slabOf({ x: x - 0.55, y: w.yf, w: 1.1, d: 0.9, r: 0.2 }, w.z0 - 0.6, w.z1 - w.z0 + 1.2, P, 2), { tone: "mid", crease: "none" }));
    }
    put({ name, layer: layers[layers.length - 1], at: [(w.x0 + w.x1) / 2, w.yf, (w.z0 + w.z1) / 2], svg: strip(w.z0 - 2.2) + bars.join("") + strip(w.z1 + 0.6), shapes: [A.slab(plan, w.z0 - 2.2, 1.6), A.slab(plan, w.z1 + 0.6, 1.6)] });
  }
  // windows face the viewer's side of the box: +y (front) is the only face supported
  const windowOf = (id, x0, x1, z0, z1, yf, rods) => ({ id, x0, x1, z0, z1, r: 2, yf, yb: yf - 3, rods, yr: yf - 1.7, rr: 0.85 });

  // ---------- a service box: one Workbench node, its window glows with that node's utilization ----------
  // plan: the floor plan (front face is y + d); top: lid height. Returns the box's port points.
  function box({ id, plan, top = 36, lamp = true, vents = true, lid = true, label = false, layer = layers[0], name = `box.${id}` }) {
    const cx = plan.x + plan.w / 2;
    const front = plan.y + plan.d;
    for (const y of [plan.y + 2.5, front - 7.5]) {
      const rail = { x: plan.x + 2, y, w: plan.w - 4, d: 5, r: 1 };
      put({ name: `${name}.rail.${y}`, layer, at: [cx, y + 2.5, 0], bias: -20, svg: S(k.slabOf(rail, 0, 3, P, 3, 0.3), { tone: "lo" }), shapes: [A.slab(rail, 0, 3)] });
    }
    const half = Math.min(13, plan.w / 2 - 6);
    const z0 = 16;
    const z1 = Math.min(30, top - 6);
    const span = z1 - z0;
    const w = windowOf(id, cx - half, cx + half, z0, z1, front, [z0 + span * 0.24, z0 + span * 0.5, z0 + span * 0.76]);
    WINDOWS.push(w);
    const side = plan.x + plan.w;
    const vent = (z) => {
      const pts = [];
      const ya = plan.y + plan.d * 0.68;
      const yb = plan.y + plan.d * 0.2;
      for (let j = 0; j <= 8; j++) pts.push([side, ya + 0.9 * Math.sin((j / 8) * Math.PI), z + 0.9 * Math.cos((j / 8) * Math.PI)]);
      for (let j = 0; j <= 8; j++) pts.push([side, yb - 0.9 * Math.sin((j / 8) * Math.PI), z - 0.9 * Math.cos((j / 8) * Math.PI)]);
      return poly(pts);
    };
    const lidPlan = k.insetPlan(plan, 2.4);
    const screws = k.corners(lidPlan, 2.6);
    const lampAt = [cx + half + 5, front, z1 + 2.6];
    const LF = G.frameAlong(lampAt, [0, 1, 0]);
    const cols = Math.max(3, Math.floor((lidPlan.w - 10) / 3.3) + 1);
    const rows = Math.max(2, Math.floor((lidPlan.d - 14) / 3.3) + 1);
    const gx = lidPlan.x + (lidPlan.w - (cols - 1) * 3.3) / 2;
    const gy = lidPlan.y + (lidPlan.d - (rows - 1) * 3.3) / 2;
    let svg =
      S(k.slabOf(plan, 3, top - 3, P, 6, 1.1), { tone: "mid", inner: L(k.sideSeam(plan, top - 3.6, P, 6), { tone: "faint" }) + (vents ? L([z0 + 2, z0 + 6, z0 + 10].filter((z) => z < top - 6).map(vent).join(""), { tone: "lo" }) : "") }) +
      recessSvg(w);
    const shapes = [A.slab(plan, 3, top - 3, { cut: [A.box([w.x0, w.yb, w.z0], [w.x1, w.yf + 0.01, w.z1])] })];
    if (lid) {
      svg += S(k.slabOf(lidPlan, top, 1.2, P, 6, 0.6), { tone: "hi", crease: "lo" }) + D(k.dotGrid(gx, gy, cols, rows, 3.3, top + 1.2, P), { size: 0.4, tone: "lo" }) + L(screws.map(([x, y]) => k.ring(x, y, 1.4, top + 1.2, P, 12)).join(""), { tone: "lo" }) + D(screws.map(([x, y]) => at([x, y, top + 1.2])), { size: 0.42 });
      shapes.push(A.slab(lidPlan, top, 1.2));
    }
    if (lamp && lampAt[0] + 2.3 < plan.x + plan.w - 1 && lampAt[2] + 2.3 < top - 0.5) {
      const index = LAMPS.length;
      LAMPS.push({ id, at: lampAt });
      const c = at(G.pointOf(LF, 1.5, 0, 0));
      svg += S(G.disc(0, 0.9, 2.3, LF, P), { tone: "lo" }) + S(G.disc(0.9, 1.5, 1.5, LF, P), { tone: "mid" }) + `<circle class="bx-lamp" data-lamp="${index}" data-node="${id}" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="${(1.25 * G.scaleOf(P)).toFixed(2)}"/>`;
      shapes.push(A.disc(LF, 0, 0.9, 2.3), A.disc(LF, 0.9, 1.5, 1.5));
    }
    if (label) {
      const plate = { x: plan.x + 3, y: front, w: Math.min(10, half - 2), d: 0.7, r: 0.2 };
      if (plate.x + plate.w < w.x0 - 1.5) {
        const rule = (z, to) => L(k.segment([plate.x + 1.4, plate.y + 0.7, z], [plate.x + to, plate.y + 0.7, z], P), { tone: "lo", free: true });
        svg += S(k.slabOf(plate, z0, 8, P, 2), { tone: "lo", crease: "none" }) + rule(z0 + 6, plate.w - 1.6) + rule(z0 + 3.8, plate.w - 2.6) + rule(z0 + 1.8, plate.w - 4);
        shapes.push(A.slab(plate, z0, 8));
      }
    }
    put({ name: `${name}.body`, layer, at: [cx, plan.y + plan.d / 2, 3], svg, shapes });
    grille(w, `${name}.grille`);
    return {
      back: (x = cx) => [x, plan.y, PIPE_Z],
      front: (x = cx) => [x, front, PIPE_Z],
      left: (y = plan.y + plan.d / 2) => [plan.x, y, PIPE_Z],
      right: (y = plan.y + plan.d / 2) => [plan.x + plan.w, y, PIPE_Z],
      window: w,
    };
  }

  // ---------- Postgres: a drum on a plinth, a gauge on top for its utilization ----------
  function database({ id, plinth, r = 17, plinthTop = 24, top = 50, gauge = true, layer = layers[0], name = `db.${id}`, window: hasWindow = true }) {
    const cx = plinth.x + plinth.w / 2;
    const cy = plinth.y + plinth.d / 2;
    const front = plinth.y + plinth.d;
    for (const y of [plinth.y + 2.5, front - 7.5]) {
      const rail = { x: plinth.x + 2, y, w: plinth.w - 4, d: 5, r: 1 };
      put({ name: `${name}.rail.${y}`, layer, at: [cx, y + 2.5, 0], bias: -20, svg: S(k.slabOf(rail, 0, 3, P, 3, 0.3), { tone: "lo" }), shapes: [A.slab(rail, 0, 3)] });
    }
    const half = Math.min(15, plinth.w / 2 - 12);
    const w = hasWindow ? windowOf(id, cx - half, cx + half, 8, Math.min(19, plinthTop - 5), front, [10.9, 13.5, 16.1].filter((z) => z < plinthTop - 6)) : null;
    if (w) WINDOWS.push(w);
    const screws = k.corners(plinth, 4);
    const plate = { x: cx + half + 4, y: front, w: Math.min(11, plinth.w / 2 - half - 6), d: 0.7, r: 0.2 };
    const rule = (z, to) => L(k.segment([plate.x + 1.6, plate.y + 0.7, z], [plate.x + to, plate.y + 0.7, z], P), { tone: "lo", free: true });
    let svg =
      S(k.slabOf(plinth, 3, plinthTop - 3, P, 6, 1.1), { tone: "mid", inner: L(k.sideSeam(plinth, plinthTop - 3, P, 6), { tone: "faint" }) }) +
      (w ? recessSvg(w) : "") +
      L(screws.map(([x, y]) => k.ring(x, y, 1.6, plinthTop, P, 14)).join(""), { tone: "lo" }) +
      D(screws.map(([x, y]) => at([x, y, plinthTop])), { size: 0.45 });
    const shapes = [A.slab(plinth, 3, plinthTop - 3, w ? { cut: [A.box([w.x0, w.yb, w.z0], [w.x1, w.yf + 0.01, w.z1])] } : {})];
    if (plate.w >= 6) {
      svg += S(k.slabOf(plate, 9, 8, P, 2), { tone: "lo", crease: "none" }) + rule(15, plate.w - 2.6) + rule(12.6, plate.w - 1.6) + rule(10.6, plate.w - 5);
      shapes.push(A.slab(plate, 9, 8));
    }
    put({ name: `${name}.plinth`, layer, at: [cx, cy, 3], svg, shapes });
    if (w) grille(w, `${name}.grille`);
    const F = VERT(cx, cy);
    const flange = S(k.cylinder(cx, cy, r + 2.4, plinthTop, 1.6, P, 72, 0.4), { tone: "lo" }) + D(G.dotsOf(F, plinthTop + 1.6, r + 1.2, 16, P, { all: true, phase: 0.2 }), { size: 0.42 });
    const bands = [0.27, 0.52, 0.77].map((f) => k.sideArc(cx, cy, r, plinthTop + 1.6 + (top - plinthTop - 1.6) * f, P, 64)).join("");
    const drum = S(k.cylinder(cx, cy, r, plinthTop + 1.6, top - plinthTop - 1.6, P, 96, 0.6), { tone: "hi", crease: "lo", inner: L(bands, { tone: "faint" }) });
    let dial = "";
    if (gauge) {
      const g = { id, c: [cx, cy], z: top, r: r - 3.8, r0: 1.5, from: rad(-135), span: rad(270), max: 1.4 };
      GAUGES.push(g);
      const rim = r - 1.6;
      const t = k.radialTicks(cx, cy, rim, 28, 4, top, [1.2, 2.5], P, g.from, g.span);
      const at100 = g.from + g.span / g.max;
      const full = k.lineOnTop([cx + Math.sin(at100) * (rim - 3.2), cy - Math.cos(at100) * (rim - 3.2)], [cx + Math.sin(at100) * rim, cy - Math.cos(at100) * rim], top, P);
      dial = L(k.ring(cx, cy, rim, top, P, 96), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(full, { tone: "hi" }) + L(k.ring(cx, cy, 1.5, top, P, 14), { tone: "mid" }) +
        `<path class="iso-line" data-tone="hi" data-free="end" data-gauge="${id}" d="${k.lineOnTop([cx, cy - 1.5], [cx, cy - g.r], top, P)}"/>`;
    }
    put({ name: `${name}.drum`, layer, at: [cx, cy, plinthTop], svg: flange + drum + dial, shapes: [A.cylinder(cx, cy, r + 2.4, plinthTop, 1.6), A.cylinder(cx, cy, r, plinthTop + 1.6, top - plinthTop - 1.6)] });
    return {
      back: (x = cx) => [x, plinth.y, PIPE_Z],
      front: (x = cx) => [x, front, PIPE_Z],
      left: (y = cy) => [plinth.x, y, PIPE_Z],
      right: (y = cy) => [plinth.x + plinth.w, y, PIPE_Z],
      top,
      center: [cx, cy],
      window: w,
    };
  }

  // ---------- conduits: requests from port to port, each end on a boss ----------
  function conduit(name, waypoints, n0, n1, { layer = layers[0], r = PIPE_R, bend = 9, tone = "mid" } = {}) {
    const points = G.fillet(waypoints, bend, 12, { P, tube: r });
    const total = G.pathLength(points);
    const gaps = [[0, BOSS_T], [total - BOSS_T, total]];
    R.route(name, points, r, { gaps });
    tubePieces(points, r, P, { maxLength: 14, gaps }).forEach((part, index) =>
      R.put({ name: `${name}:${index}`, at: part.mid, bias: LAYER_BIAS[layer], layer, svg: tubeSvg(part, { tone }), route: name, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
    );
    const bossR = Math.max(BOSS_R, r + 1.4);
    for (const [end, o, nrm] of [["0", waypoints[0], n0], ["1", waypoints[waypoints.length - 1], n1]]) {
      if (!nrm) continue;
      put({ name: `${name}.boss${end}`, layer, at: o, bias: 0.05, svg: bossSvg(o, nrm, { r: bossR }), shapes: [bossShape(`${name}.boss${end}`, o, nrm, name, bossR)] });
    }
    return { points, total };
  }

  // ---------- settle, then prove every item paints inside its layer's band ----------
  function finish({ T = null, poses = null, verify = false } = {}) {
    const out = T ? T.build({ statics: R.items, poses, verify }) : null;
    A.settle(R, P);
    for (const item of R.items) {
      const next = LAYER_BIAS[layers[layers.indexOf(item.layer) + 1]] ?? Infinity;
      if (!(item.key < next)) throw new Error(`${item.name} (${item.layer}) must paint after the next layer: settled key ${item.key.toFixed(1)} ≥ ${next}`);
    }
    const layerOf = (name) => R.items.filter((item) => item.layer === name).sort((a, b) => a.key - b.key).map((item) => item.svg);
    return { out, layerOf };
  }

  // ---------- the page: card, stage, inlined truth + kit + runtime + figure live code ----------
  // stack: the layers in paint order; "canvas" marks where the heat canvas goes, and a live layer
  // name (with `out`) where a turning group's svg goes. The first static layer carries the figure's
  // role="img" and label.
  function page({ title, fig, hint, readout, keys, caption, label, width, height, stack, layerOf, out = null, liveLayers = [], halo = "", stageClass = "", stageAttrs = {}, data, truthCode, live, css = "", pageWidth = 700, verify = false }) {
    const staticSvg = (list) => `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-layer" viewBox="0 0 ${width} ${height}" aria-hidden="true">${list.join("")}</svg>`;
    let first = true;
    const layersHtml = stack
      .map((name) => {
        if (name === "canvas") return `<canvas class="iso-layer bx-gl" aria-hidden="true"></canvas>`;
        if (out && liveLayers.includes(name)) return out.layerSvg(name, { width, height });
        const list = layerOf(name);
        if (first) {
          first = false;
          return k.figureSvg({ width, height, label, body: [halo, ...list] });
        }
        return staticSvg(list);
      })
      .join("");
    const attrs = Object.entries(stageAttrs).map(([key, value]) => ` ${key}="${String(value).replace(/"/g, "&quot;")}"`).join("");
    const stage = `<div class="iso-stage${out ? " iso-turn" : ""} bx-stage bx ${stageClass}" tabindex="0"${attrs}>${layersHtml}</div>`;
    const DATA = {
      ...data,
      turn: out?.data ?? null,
      proj: P,
      knob: KNOB,
      gauges: GAUGES,
      lamps: LAMPS,
      gl: { W: width, H: height, camera: glCamera(P), windows: WINDOWS },
    };
    // static brass, steel and copper parts ([data-mat]) need the material rules even without a turning group
    const CSS = (out?.css ?? TURN.materialCss()) + "\n" + readFileSync(join(HERE, "bench.css"), "utf8") + "\n" + css;
    const runtime = readFileSync(join(HERE, "bench-live.js"), "utf8");
    const body = k.plateHtml({ fig, title, hint, readout, keys, caption, body: `<style>${CSS}</style>${stage}` });
    const script = truthCode + kitScript() + (out ? turnScript() : "") + glScript() + (verify && out ? `window.__isoVerify = ${JSON.stringify(out.verify)};\n` : "") + `const DATA = ${JSON.stringify(DATA)};\n` + runtime + "\n" + live;
    return k.pageHtml({ title, theme, body, script, width: pageWidth });
  }

  return {
    P, R, V, at, S, L, D, VERT, byDepth, poly, put, rad, LAYER_BIAS, WINDOWS, LAMPS, GAUGES,
    bossSvg, bossShape, bench, labelPlate, rulerStrip, generator, box, database, conduit, recessSvg, grille, windowOf, finish, page,
    get knob() { return KNOB; },
  };
}
