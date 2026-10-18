// Fig 6's own motion: the up and down keys switch worker cartridges on (the engine runs the Workers
// node with that many instances), and the tickets on the rail and the depth needle follow the
// engine's queue depth on a log scale. Everything else is the shared bench runtime.
const BAYS = DATA.bays;
const LOG_MAX = Math.log10(1 + DATA.depth.max);
const heat = { api: "api", db: "db" };
for (let i = 0; i < BAYS; i++) heat[`w${i}`] = "off";
const tickets = [...document.querySelectorAll("[data-ticket]")];
const powers = [...document.querySelectorAll("[data-power]")];
const depthEl = document.querySelector('[data-ref="depth"]');
const power = Array.from({ length: BAYS }, () => ({ x: 0, v: 0 }));
const shown = { x: 0, v: 0 };
let lastMetrics = null;
let lastQ = 0;
let trend = 0;
// the tour: the preset's 3 workers fall behind, 6 drain the rail, a burst past 6 workers' 800 refills it
const tourAt = (t) => {
  const s = t % 36;
  const load = s < 22 ? 600 : s < 24 ? 600 + 600 * smooth(22, 24, s) : s < 28 ? 1200 : s < 30 ? 1200 - 600 * smooth(28, 30, s) : 600;
  const workers = s < 10 ? 3 : s < 32 ? 6 : 3;
  return { load, workers };
};
const depthPointer = (f) => {
  const g = DATA.depth;
  const a = g.from + Math.min(1, Math.max(0, f)) * g.span;
  return lineOnTop([g.c[0] + Math.sin(a) * g.r0, g.c[1] - Math.cos(a) * g.r0], [g.c[0] + Math.sin(a) * g.r, g.c[1] - Math.cos(a) * g.r], g.z, DATA.proj);
};
// the queueing engine at 4 Hz like the simulate lens; an overloaded queue has no steady state, so the
// first paint (and each still frame under reduced motion) runs a short stretch of time instead
const sim = WB.makeSim();
let acc = 0;
// the worker count the last tick ran with, so the readout's words and numbers share one instant
let ticked = DATA.workers;
const graphOf = (c) => ({ nodes: DATA.preset.nodes.map((n) => (n.id === "w" ? { ...n, inst: c.params.workers } : n)), edges: DATA.preset.edges });
const engine = {
  advance(c, dt) {
    acc += dt;
    let m = c.metrics;
    while (acc >= 0.25) {
      const g = graphOf(c);
      m = WB.tick(sim, g.nodes, g.edges, c.load, 0.25);
      ticked = c.params.workers;
      acc -= 0.25;
    }
    return m;
  },
  // a still frame is a fixed stretch of time from a fresh sim, so it doesn't grow with every input;
  // the live sim takes over from it
  steady(c) {
    const fresh = WB.makeSim();
    fresh.noise = sim.noise;
    let m = c.metrics;
    const g = graphOf(c);
    for (let i = 0; i < (c.calm ? 40 : 8); i++) m = WB.tick(fresh, g.nodes, g.edges, c.load, 0.25);
    sim.q = { ...fresh.q };
    sim.retry = { ...fresh.retry };
    ticked = c.params.workers;
    return m;
  },
};
benchFigure({
  engine,
  load: { max: DATA.loadMax, home: DATA.preset.rps, step: 50, big: 250, snap: 10, unit: "jobs/s" },
  params: [{ name: "workers", value: DATA.workers, min: 1, max: BAYS, step: 1, big: 1 }],
  heat,
  tour: tourAt,
  readout: (c) => {
    const m = c.metrics;
    const load = c.fmt(m?.sys?.rps ?? c.load);
    const on = `${ticked} worker${ticked === 1 ? "" : "s"}`;
    const q = c.queue("q");
    if (q < 1) return `${load} jobs/s · ${on} · queue empty · ${c.pct(c.util("w"))} busy`;
    return `${load} jobs/s · ${on} · ${c.fmt(q)} queued, ${trend > 0 ? "growing" : "draining"}`;
  },
  describe: (c) => `${c.fmt(c.target)} jobs per second, ${c.params.workers} of ${BAYS} workers on`,
  frame: (c, dt, calm) => {
    let moving = false;
    if (c.metrics !== lastMetrics) {
      const q = c.queue("q");
      trend = q - lastQ;
      lastQ = q;
      lastMetrics = c.metrics;
    }
    for (let i = 0; i < BAYS; i++) {
      const on = i < c.params.workers;
      heat[`w${i}`] = on ? "w" : "off";
      if (settle(power[i], on ? 1 : 0, dt, 0.18, calm)) moving = true;
      powers[i]?.style.setProperty("--aw-on", power[i].x.toFixed(3));
    }
    const f = Math.log10(1 + c.queue("q")) / LOG_MAX;
    if (settle(shown, f, dt, 0.3, calm)) moving = true;
    const n = shown.x * tickets.length;
    // the oldest ticket hangs at the workers' end of the rail; the rail fills back toward the ingest API
    tickets.forEach((el) => {
      const slot = Number(el.dataset.ticket);
      const rank = tickets.length - 1 - slot;
      el.style.setProperty("--aw-show", Math.min(1, Math.max(0, n - rank)).toFixed(3));
    });
    depthEl?.setAttribute("d", depthPointer(shown.x));
    return moving;
  },
});
