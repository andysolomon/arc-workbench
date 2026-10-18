// Fig 12's own motion. The Workbench's Markov token simulator (tickState) runs on the page, ten
// simulated minutes to a second. The traced ball is one of its runs: the plunger pushes a run into
// the simulator exactly as its arrivals are made, and the ball rolls each lane the run takes (the
// run's own `last` edge). Every run the simulator finishes is tallied by where it ended; the
// counters are those shares. Resting balls are the runs in flight in each state.
const NODES = DATA.preset.nodes;
const EDGES = DATA.preset.edges;
const EDGE = Object.fromEntries(EDGES.map((e) => [e.id, e]));
const TERMINAL = new Set(DATA.terminal);
const SLOW = 1 / 3;
const TICK = 0.25;
const jitter = () => 0.55 + Math.random() * 0.9;

// ---------- truth: the simulator, and a tally that sees every run it finishes ----------
const sim = WB.makeParadigmSim("state");
const tally = Object.fromEntries(DATA.terminal.map((id) => [id, 0]));
let finished = 0;
let clockAcc = 0;
const tickOnce = (rate) => {
  // the simulator pushes its arrivals onto sim.runs and drops finished runs from it; watching the
  // push catches runs that arrive and finish inside one tick, which a before/after diff would miss
  const before = sim.runs.slice();
  const born = [];
  const runs = sim.runs;
  runs.push = (...items) => (born.push(...items), Array.prototype.push.apply(runs, items));
  const m = WB.tickState(sim, NODES, EDGES, rate, TICK * SLOW);
  delete runs.push;
  const alive = new Set(sim.runs);
  for (const r of before.concat(born)) {
    if (alive.has(r) || !r.dead) continue;
    finished++;
    if (r.at in tally) tally[r.at]++;
  }
  return m;
};
let steadyLoad = null;
const engine = {
  advance(c, dt) {
    clockAcc += dt;
    let m = c.metrics;
    while (clockAcc >= TICK) {
      m = tickOnce(c.load);
      clockAcc -= TICK;
    }
    return m;
  },
  // the table filled at a constant rate: twenty simulated hours, once per load
  steady(c) {
    if (steadyLoad === c.load && c.metrics) return c.metrics;
    steadyLoad = c.load;
    let m = c.metrics;
    for (let i = 0; i < 480; i++) m = tickOnce(c.load);
    return m;
  },
};

// ---------- the traced ball ----------
const ballEl = document.querySelector('[data-ref="ball"]');
const ghostEl = document.querySelector('[data-ref="ghost"]');
let ghost = null;
const plungerEl = document.querySelector('[data-ref="plunger"]');
const rests = [...document.querySelectorAll("[data-rest]")];
const counters = Object.fromEntries(DATA.terminal.map((id) => [id, document.querySelector(`[data-counter="${id}"]`)]));
const origin = iso([0, 0, 0], DATA.proj);
const Z = DATA.top + DATA.ballR;
const place = (el, x, y) => {
  const p = iso([x, y, Z], DATA.proj);
  el.setAttribute("transform", `translate(${(p[0] - origin[0]).toFixed(2)} ${(p[1] - origin[1]).toFixed(2)})`);
};
const show = (el, alpha) => {
  if (alpha > 0.001) el.setAttribute("data-on", "");
  else el.removeAttribute("data-on");
  el.style.opacity = alpha.toFixed(3);
};
let ballAt = null;
let ballShown = 0;
const along = (pts, f) => {
  let total = 0;
  const lens = [];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let d = f * total;
  for (let i = 1; i < pts.length; i++) {
    if (d <= lens[i - 1] || i === pts.length - 1) {
      const t = Math.min(1, d / (lens[i - 1] || 1));
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, total];
    }
    d -= lens[i - 1];
  }
  return [...pts[pts.length - 1], total];
};
let traced = null;
let launchAt = -1;
let clock = 0;
let lastName = "queued";
const launch = () => {
  // a ball still on the table when the next is launched fades where it is, rather than vanishing
  if (traced && ballAt && ballShown > 0.01) ghost = { x: ballAt[0], y: ballAt[1], alpha: ballShown };
  const run = { at: "queued", left: (DATA.dwell.queued || 1) * jitter(), t: 0, hops: 0, last: null };
  sim.runs.push(run);
  traced = { run, hops: 0, at: "launch", queue: [{ lane: "launch", to: "queued" }], seg: null, fade: 0, drainedAt: -1 };
  launchAt = clock;
};
const follow = () => {
  if (!traced) return;
  const r = traced.run;
  if (r.hops > traced.hops) {
    const last = EDGE[r.last];
    if (last) {
      // a run that hopped twice in one tick: its first hop is the edge from where it was to the last one's start
      if (r.hops - traced.hops >= 2) {
        const from = traced.queue.length ? traced.queue[traced.queue.length - 1].to : traced.at;
        const mid = EDGES.find((e) => e.from === from && e.to === last.from);
        if (mid) traced.queue.push({ lane: mid.id, to: mid.to });
      }
      traced.queue.push({ lane: last.id, to: last.to });
    }
    traced.hops = r.hops;
  }
};
const states = Object.fromEntries(NODES.map((n) => [n.id, n.name]));

benchFigure({
  engine,
  load: { max: DATA.rateMax, home: DATA.preset.rps, unit: "runs/h", step: 20, big: 100, snap: 10 },
  alwaysMoving: true,
  key: (c, event) => {
    if (event.key === " " || event.key === "Enter") {
      launch();
      return true;
    }
    return false;
  },
  tap: () => launch(),
  readout: (c) => {
    // the rate, the count and the share all read the same tally at the same instant
    const done = finished ? `${c.fmt(finished)} done · completed ${((tally.completed / finished) * 100).toFixed(1)}%` : "warming up";
    return `${c.fmt(c.load)} runs/h · ${done}`;
  },
  describe: (c) => `${c.fmt(c.target)} runs per hour; the traced run is ${traced ? (TERMINAL.has(lastName) ? `finished: ${states[lastName]}` : `in ${states[lastName] ?? lastName}`) : "not launched"}`,
  frame: (c, dt, calm) => {
    clock += dt;
    if (!traced) launch();
    follow();
    // the plunger: pulled back as the run is launched, then let go
    const age = clock - launchAt;
    const pull = calm ? 0 : age < 0.22 ? smooth(0, 0.22, age) : Math.max(0, 1 - (age - 0.22) / 0.06);
    plungerEl?.setAttribute("transform", translateAlong(DATA.proj, [0, 4.2 * pull, 0]));
    // the ball: one lane at a time, in the order the run took them
    let x = 0;
    let y = 0;
    let lit = { [traced.at]: 1 };
    if (calm) {
      traced.queue = [];
      traced.seg = null;
      traced.at = traced.run.at;
      [x, y] = DATA.pockets[traced.at] ?? DATA.pockets.queued;
    } else {
      if (!traced.seg && traced.queue.length && (traced.at !== "launch" || age > 0.26)) {
        const next = traced.queue.shift();
        const pts = DATA.lanes[next.lane];
        traced.seg = { pts, to: next.to, t: 0, dur: Math.max(0.35, Math.min(1.1, along(pts, 1)[2] / 70)) };
      }
      if (traced.at === "launch" && !traced.seg) [x, y] = DATA.lanes.launch[0];
      else if (traced.seg) {
        const s = traced.seg;
        // catch up when the run is several lanes ahead of the ball
        s.t += dt * (1 + 0.6 * traced.queue.length);
        const f = Math.min(1, s.t / s.dur);
        const e = f * f * (3 - 2 * f);
        [x, y] = along(s.pts, e);
        lit = { [traced.at]: 1 - e, [s.to]: e };
        if (f >= 1) {
          traced.at = s.to;
          traced.seg = null;
        }
      } else [x, y] = DATA.pockets[traced.at] ?? DATA.pockets.queued;
    }
    lastName = traced.at === "launch" ? "queued" : traced.at;
    ballAt = [x, y];
    place(ballEl, x, y);
    // a ball that has dropped into a cup fades there, and the plunger launches the next run
    const drained = TERMINAL.has(traced.at) && !traced.seg && !traced.queue.length;
    if (drained && traced.drainedAt < 0) traced.drainedAt = clock;
    const sinceDrain = drained ? clock - traced.drainedAt : 0;
    // a new ball fades in on the plunger's tip; a drained one fades in its cup
    const born = calm ? 1 : smooth(0, 0.2, age);
    const shown = (drained ? Math.max(0, 1 - sinceDrain / 0.5) : 1) * born;
    ballShown = shown;
    show(ballEl, shown);
    if (ghost) {
      ghost.alpha = calm ? 0 : Math.max(0, ghost.alpha - dt / 0.3);
      place(ghostEl, ghost.x, ghost.y);
      show(ghostEl, ghost.alpha);
      if (ghost.alpha <= 0) ghost = null;
    }
    if (!calm && drained && sinceDrain > 1.2) launch();
    for (const n of NODES) c.lamp(n.id, (lit[n.id] ?? 0) * (TERMINAL.has(n.id) && drained ? shown : 1));
    // resting balls: the runs waiting in each state, one ball per DATA.perBall runs
    for (const el of rests) {
      const q = c.metrics?.nodes[el.dataset.rest]?.q ?? 0;
      const on = Number(el.dataset.i) < Math.min(6, Math.round(q / DATA.perBall));
      if (on !== el.hasAttribute("data-on")) on ? el.setAttribute("data-on", "") : el.removeAttribute("data-on");
    }
    // the counters: each outcome's share of every finished run
    for (const id of DATA.terminal) {
      const text = finished ? ((tally[id] / finished) * 100).toFixed(1) : "0.0";
      if (counters[id] && counters[id].textContent !== text) counters[id].textContent = text;
    }
    return !calm;
  },
});
