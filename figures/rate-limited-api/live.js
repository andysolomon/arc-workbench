// Fig 8's own motion: the turnstile turns at the rate the limiter admits, the limit dial follows the
// limit, and the reject meter lights with the share turned away. The engine runs with the limiter's
// cap set to the limit. Everything else is the shared bench runtime (figures/lib/bench-live.js).
const TOUR = [[0, 2000, 900], [3, 2000, 900], [8, 6000, 900], [12, 6000, 900], [16, 6000, 6500], [21, 6000, 6500], [25, 6000, 900], [29, 2000, 900], [32, 2000, 900]];
const tourAt = (t) => {
  const s = t % TOUR[TOUR.length - 1][0];
  for (let i = 1; i < TOUR.length; i++) {
    const [t1, l1, m1] = TOUR[i];
    const [t0, l0, m0] = TOUR[i - 1];
    if (s <= t1) {
      const f = smooth(t0, t1, s);
      return { load: l0 + (l1 - l0) * f, limit: Math.round((m0 + (m1 - m0) * f) / 100) * 100 };
    }
  }
  return { load: TOUR[0][1], limit: TOUR[0][2] };
};
const dial = document.querySelector('[data-ref="limit"]');
const segs = [...document.querySelectorAll("[data-seg]")];
const nodes0 = DATA.preset.nodes;
let nodes = nodes0;
let built = null;
let angle = 0;
const shed = { x: 0, v: 0 };
benchFigure({
  load: { max: DATA.rpsMax, home: DATA.preset.rps },
  params: [{ name: "limit", value: DATA.limit, min: 100, max: DATA.limitMax, step: 100, big: 1000 }],
  heat: DATA.heat,
  turn: {},
  alwaysMoving: true,
  graph: (c) => {
    if (built !== c.params.limit) {
      built = c.params.limit;
      nodes = nodes0.map((n) => (n.id === "rl" ? { ...n, cap: c.params.limit } : n));
    }
    return { nodes, edges: DATA.preset.edges };
  },
  tour: (t) => tourAt(t),
  readout: (c) => {
    const load = c.fmt(c.metrics?.sys?.rps ?? c.load);
    const limit = `limit ${c.fmt(c.params.limit)}`;
    const away = `${c.pct(c.err("rl"))} turned away`;
    if (c.health("db") === "crit") return `${load} rps · ${limit} · db saturated · ${c.pct(c.metrics?.sys?.err ?? 0)} errors`;
    return `${load} rps · ${limit} · ${away} · db ${c.pct(c.util("db"))}`;
  },
  describe: (c) => `${c.fmt(c.target)} requests per second, limit ${c.fmt(c.params.limit)}`,
  frame: (c, dt, calm) => {
    const L = DATA.limitDial;
    const a = L.from + Math.min(1, Math.max(0, c.shown.limit / L.max)) * L.span;
    dial?.setAttribute("d", lineOnTop([L.c[0] + Math.sin(a) * L.r0, L.c[1] - Math.cos(a) * L.r0], [L.c[0] + Math.sin(a) * L.r1, L.c[1] - Math.cos(a) * L.r1], L.z, c.P));
    // the turnstile turns at the admitted rate: 1° a second for every 45 requests a second, as Fig 4's rotor
    const admitted = c.metrics?.edges?.["rl>api"] ?? 0;
    if (!calm) angle += (admitted / 45) * dt;
    c.controller?.set({ rotor: angle });
    const moving = settle(shed, c.err("rl"), dt, 0.3, calm);
    const lit = shed.x * segs.length;
    segs.forEach((el, i) => el.style.setProperty("--rl-on", Math.max(0, Math.min(1, lit - i)).toFixed(3)));
    return moving || !calm;
  },
});
