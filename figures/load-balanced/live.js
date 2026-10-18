// Fig 1's own motion: the rotor turns in proportion to the load, and the lamp of the pod whose
// segment the brush is on lights. Everything else is the shared bench runtime (figures/lib/bench-live.js).
const TOUR = [[0, 900], [3, 900], [9, 6000], [13, 6000], [17, 7600], [20, 7600], [26, 900], [30, 900]];
const tourAt = (t) => {
  const s = t % TOUR[TOUR.length - 1][0];
  for (let i = 1; i < TOUR.length; i++) {
    const [t1, v1] = TOUR[i];
    const [t0, v0] = TOUR[i - 1];
    if (s <= t1) return v0 + (v1 - v0) * smooth(t0, t1, s);
  }
  return TOUR[0][1];
};
const SOFT = 3.5;
const PODS = ["s1", "s2", "s3"];
let angle = 0;
const brushAngle = (c) => {
  const p = c.controller.anchor("rotor", DATA.brush).world;
  const deg = (Math.atan2(p[1] - DATA.pivot[1], p[0] - DATA.pivot[0]) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
};
const paintLamps = (c) => {
  const phi = brushAngle(c);
  for (const seg of DATA.segments) {
    let a = phi;
    while (a < seg.from) a += 360;
    while (a >= seg.from + 360) a -= 360;
    c.lamp(seg.node, smooth(seg.from, seg.from + SOFT, a) * (1 - smooth(seg.to - SOFT, seg.to, a)));
  }
};
benchFigure({
  load: { max: DATA.rpsMax, home: DATA.preset.rps },
  turn: { onFrame: (c) => paintLamps(c) },
  alwaysMoving: true,
  tour: (t) => ({ load: tourAt(t) }),
  readout: (c) => {
    // the load and the shares beside it come from the same engine tick
    const load = c.fmt(c.metrics?.sys?.rps ?? c.load);
    const errors = c.pct(c.metrics?.sys?.err ?? 0);
    if (PODS.some((id) => c.health(id) === "crit")) return `${load} rps · pods and db saturated · ${errors} errors`;
    if (c.health("db") === "crit") return `${load} rps · db saturated · ${errors} errors`;
    return `${load} rps · pods ${c.pct(Math.max(...PODS.map(c.util)))} · db ${c.pct(c.util("db"))}`;
  },
  frame: (c, dt, calm) => {
    if (!calm) angle += (c.load / 45) * dt;
    c.controller?.set({ rotor: angle });
    return !calm;
  },
});
