// A service with several instances in one chassis: one body, one window per instance, every window
// showing the same node's utilization (the instances share the load evenly). Built on the shared
// bench's own window, grille and lamp parts, so it matches figures/lib/bench.mjs box().
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { PIPE_Z } from "./bench.mjs";

export function chassis(W, { id, plan, count = 2, top = 36, lamp = true, name = `box.${id}` }) {
  const { P, at, S, L, D, put, poly } = W;
  const front = plan.y + plan.d;
  const cx = plan.x + plan.w / 2;
  // four corner feet: a long chassis stands on its corners, which leaves the front clear for ports
  for (const y of [plan.y + 2.5, front - 7.5]) for (const x of [plan.x + 2, plan.x + plan.w - 16]) {
    const foot = { x, y, w: 14, d: 5, r: 1 };
    put({ name: `${name}.foot.${x}.${y}`, layer: "back", at: [x + 7, y + 2.5, 0], bias: -20, svg: S(k.slabOf(foot, 0, 3, P, 3, 0.3), { tone: "lo" }), shapes: [A.slab(foot, 0, 3)] });
  }
  const bay = plan.w / count;
  const half = Math.min(13, bay / 2 - 6);
  const z0 = 16;
  const z1 = Math.min(30, top - 6);
  const span = z1 - z0;
  const windows = [];
  for (let i = 0; i < count; i++) {
    const wx = plan.x + bay * (i + 0.5) - 3;
    const w = W.windowOf(`${id}.${i + 1}`, wx - half, wx + half, z0, z1, front, [z0 + span * 0.24, z0 + span * 0.5, z0 + span * 0.76]);
    W.WINDOWS.push(w);
    windows.push(w);
  }
  const side = plan.x + plan.w;
  const vent = (z) => {
    const pts = [];
    const ya = plan.y + plan.d * 0.68;
    const yb = plan.y + plan.d * 0.2;
    for (let j = 0; j <= 8; j++) pts.push([side, ya + 0.9 * Math.sin((j / 8) * Math.PI), z + 0.9 * Math.cos((j / 8) * Math.PI)]);
    for (let j = 0; j <= 8; j++) pts.push([side, yb - 0.9 * Math.sin((j / 8) * Math.PI), z - 0.9 * Math.cos((j / 8) * Math.PI)]);
    return poly(pts);
  };
  // the seam between bays: a panel joint that runs the full front face, bottom to top
  const joints = [];
  for (let i = 1; i < count; i++) joints.push(k.segment([plan.x + bay * i, front, 3], [plan.x + bay * i, front, top], P));
  const lidPlan = k.insetPlan(plan, 2.4);
  const screws = k.corners(lidPlan, 2.6);
  const cols = Math.max(3, Math.floor((lidPlan.w - 10) / 3.3) + 1);
  const rows = Math.max(2, Math.floor((lidPlan.d - 14) / 3.3) + 1);
  const gx = lidPlan.x + (lidPlan.w - (cols - 1) * 3.3) / 2;
  const gy = lidPlan.y + (lidPlan.d - (rows - 1) * 3.3) / 2;
  const last = windows[windows.length - 1];
  const lampAt = [last.x1 + 5, front, z1 + 2.6];
  const LF = G.frameAlong(lampAt, [0, 1, 0]);
  const c = at(G.pointOf(LF, 1.5, 0, 0));
  if (lamp) W.LAMPS.push({ id, at: lampAt });
  const svg =
    S(k.slabOf(plan, 3, top - 3, P, 6, 1.1), { tone: "mid", inner: L(k.sideSeam(plan, top - 3.6, P, 6), { tone: "faint" }) + L(joints.join(""), { tone: "faint" }) + L([z0 + 2, z0 + 6, z0 + 10].map(vent).join(""), { tone: "lo" }) }) +
    windows.map((w) => W.recessSvg(w)).join("") +
    S(k.slabOf(lidPlan, top, 1.2, P, 6, 0.6), { tone: "hi", crease: "lo" }) +
    D(k.dotGrid(gx, gy, cols, rows, 3.3, top + 1.2, P), { size: 0.4, tone: "lo" }) +
    L(screws.map(([x, y]) => k.ring(x, y, 1.4, top + 1.2, P, 12)).join(""), { tone: "lo" }) +
    D(screws.map(([x, y]) => at([x, y, top + 1.2])), { size: 0.42 }) +
    (lamp ? S(G.disc(0, 0.9, 2.3, LF, P), { tone: "lo" }) + S(G.disc(0.9, 1.5, 1.5, LF, P), { tone: "mid" }) + `<circle class="bx-lamp" data-lamp="${W.LAMPS.length - 1}" data-node="${id}" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="${(1.25 * G.scaleOf(P)).toFixed(2)}"/>` : "");
  const shapes = [A.slab(plan, 3, top - 3, { cut: windows.map((w) => A.box([w.x0, w.yb, w.z0], [w.x1, w.yf + 0.01, w.z1])) }), A.slab(lidPlan, top, 1.2), ...(lamp ? [A.disc(LF, 0, 0.9, 2.3), A.disc(LF, 0.9, 1.5, 1.5)] : [])];
  put({ name: `${name}.body`, layer: "back", at: [cx, plan.y + plan.d / 2, 3], svg, shapes });
  windows.forEach((w, i) => W.grille(w, `${name}.grille.${i + 1}`));
  return {
    back: (x = cx) => [x, plan.y, PIPE_Z],
    front: (x = cx) => [x, front, PIPE_Z],
    left: (y = plan.y + plan.d / 2) => [plan.x, y, PIPE_Z],
    right: (y = plan.y + plan.d / 2) => [plan.x + plan.w, y, PIPE_Z],
    windows,
    heat: Object.fromEntries(windows.map((w) => [w.id, id])),
  };
}
