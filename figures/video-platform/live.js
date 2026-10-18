// Fig 2's own motion, all from the engine's latest tick:
// - the projector's reels turn with the screenings it serves from its shelf;
// - the screen's leader keeps counting down;
// - the developing tanks' cranks turn as hard as the workers are busy;
// - the cans in the tray are the transcode backlog on a log scale (three to a decade);
// - the ticker tape advances with the catalogue's change feed; the counter tallies analytics events;
// - the sorter's wheel turns with the index's load and the bell strikes with notifications;
// - the safelight lights while the backlog grows.
// The upload share is the clients' own mix, and it re-weights the viewers' two edges.
// Everything else is the shared bench runtime (figures/lib/bench-live.js).
const NODES = DATA.preset.nodes;
const BASE = DATA.preset.edges;
const withShare = (s) => BASE.map((e) => (e.id === "cl>gw" ? { ...e, w: s } : e.id === "cl>cdn" ? { ...e, w: 1 - s } : e));
let edgesFor = { s: null, edges: BASE };
const graph = (c) => {
  const s = Math.round(c.shown.share * 1000) / 1000;
  if (edgesFor.s !== s) edgesFor = { s, edges: withShare(s) };
  return { nodes: NODES, edges: edgesFor.edges };
};
// the live engine starts with an empty tray and fills it as you watch; the still frame (first paint
// under reduced motion) is one fresh minute of the engine at the chosen load
const DT = 0.25;
const live = WB.makeSim();
let acc = 0;
let ticked = { load: DATA.preset.rps, share: DATA.share };
const run = (sim, c) => {
  const g = graph(c);
  ticked = { load: c.load, share: edgesFor.s };
  return WB.tick(sim, g.nodes, g.edges, c.load, DT);
};
const engine = {
  advance(c, dt) {
    acc += dt;
    let m = c.metrics;
    while (acc >= DT) {
      m = run(live, c);
      acc -= DT;
    }
    return m;
  },
  steady(c) {
    const sim = c.calm ? WB.makeSim() : live;
    let m;
    for (let i = 0; i < 240; i++) m = run(sim, c);
    if (!c.calm) {
      for (const id of Object.keys(sim.q)) sim.q[id] = 0;
      m = run(sim, c);
    }
    return m;
  },
};
const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
const backlogOf = (c) => c.queue("tq");
const growthOf = (c) => {
  const a = c.metrics?.nodes.tq?.arr ?? 0;
  return backlogOf(c) > 0 || a > DATA.twCap ? a - DATA.twCap : 0;
};
const rateOf = (c, id) => c.metrics?.edges?.[id] ?? 0;
const arrOf = (c, id) => c.metrics?.nodes?.[id]?.arr ?? 0;
const TOUR = [[0, 2400, 0.15], [4, 2400, 0.15], [9, 2400, 0.4], [14, 6000, 0.4], [20, 6000, 0], [26, 2400, 0.15], [29, 2400, 0.15]];
const tourAt = (t) => {
  const s = t % TOUR[TOUR.length - 1][0];
  for (let i = 1; i < TOUR.length; i++) {
    const [t1, l1, s1] = TOUR[i];
    const [t0, l0, s0] = TOUR[i - 1];
    if (s <= t1) {
      const f = smooth(t0, t1, s);
      return { load: l0 + (l1 - l0) * f, share: s0 + (s1 - s0) * f };
    }
  }
  return { load: TOUR[0][1], share: TOUR[0][2] };
};
const $ = (sel) => document.querySelector(sel);
const reels = [$('[data-ref="reel0"]'), $('[data-ref="reel1"]')];
const cranks = [...document.querySelectorAll('[data-ref="crank"]')];
const cans = [...document.querySelectorAll(".vp-can")].sort((a, b) => Number(a.dataset.can) - Number(b.dataset.can));
const tapeEl = $('[data-ref="tape"]');
const sweepEl = $('[data-ref="sweep"]');
const countEl = $('[data-ref="count"]');
const tallyEl = $('[data-ref="tally"]');
const sorterEl = $('[data-ref="sorter"]');
const bellEl = $('[data-ref="bell"]');
const knobEl = $('[data-ref="knob"]');
const S = { reel: 0, crank: 0, tape: 0, sweep: 0, tally: 0, sorter: 0, bell: 0, cans: null, lamp: 0 };
const SCREEN = { cu: 24, cv: 16, r: 11 };
const wedge = (a) => {
  // the leader's sweep, from twelve o'clock clockwise to the angle a
  const n = Math.max(2, Math.ceil(a / 0.2));
  let d = `M${SCREEN.cu} ${SCREEN.cv}L${SCREEN.cu} ${SCREEN.cv - SCREEN.r}`;
  for (let i = 1; i <= n; i++) {
    const t = (a * i) / n;
    d += `L${(SCREEN.cu + SCREEN.r * Math.sin(t)).toFixed(3)} ${(SCREEN.cv - SCREEN.r * Math.cos(t)).toFixed(3)}`;
  }
  return d + "Z";
};
const pointer = (K, f) => {
  const a = K.from + Math.min(1, Math.max(0, f)) * K.span;
  return lineOnTop([K.c[0] + Math.sin(a) * K.r0, K.c[1] - Math.cos(a) * K.r0], [K.c[0] + Math.sin(a) * K.r1, K.c[1] - Math.cos(a) * K.r1], K.z, DATA.proj);
};
benchFigure({
  load: { max: DATA.rpsMax, home: DATA.preset.rps },
  params: [{ name: "share", value: DATA.share, min: 0, max: DATA.shareMax, step: 0.05 }],
  graph,
  engine,
  tour: tourAt,
  alwaysMoving: true,
  key: (c, event) => {
    if (event.key !== "Home") return false;
    c.target = DATA.preset.rps;
    c.params.share = DATA.share;
    return true;
  },
  readout: (c) => {
    // the load, the share and the backlog all come from the same engine tick
    const load = c.fmt(c.metrics?.sys?.rps ?? ticked.load);
    if (c.health("up") === "crit") return `${load} rps · intake saturated · ${c.pct(c.metrics?.sys?.err ?? 0)} errors`;
    const g = growthOf(c);
    const arrow = g > 0.5 ? " ↑" : backlogOf(c) > 0.5 ? " ↓" : "";
    return `${load} rps · ${Math.round(ticked.share * 100)}% uploads · ${short(backlogOf(c))} cans waiting${arrow}`;
  },
  describe: (c) => `${c.fmt(c.target)} requests per second, ${Math.round(c.params.share * 100)} percent uploads`,
  frame: (c, dt, calm) => {
    const step = calm ? 0 : dt;
    // screenings the projector serves from its own shelf: what reaches it, less what it passes on
    const served = Math.max(0, rateOf(c, "cl>cdn") - rateOf(c, "cdn>play"));
    S.reel += Math.min(400, served / 20) * step;
    reels.forEach((el, i) => c.setAttr(el, "transform", `rotate(${((i ? -1 : 1) * S.reel).toFixed(2)})`));
    // the leader runs at the film's own speed; the picture never waits for an upload
    S.sweep += Math.PI * 2 * step;
    const turns = Math.floor(S.sweep / (Math.PI * 2));
    c.setAttr(sweepEl, "d", wedge(S.sweep % (Math.PI * 2) || 0.001));
    if (countEl) {
      const n = String(8 - (turns % 7));
      if (countEl.textContent !== n) countEl.textContent = n;
    }
    // the tanks: every crank turns as hard as the transcode workers are busy
    S.crank += 240 * Math.min(1, c.util("tw")) * step;
    cranks.forEach((el, i) => c.setAttr(el, "transform", `rotate(${(S.crank + i * 47).toFixed(2)})`));
    // the tray: three cans a decade of backlog, filling level by level
    const v = 3 * Math.log10(1 + backlogOf(c));
    S.cans = calm || S.cans === null ? v : S.cans + (v - S.cans) * (1 - Math.exp(-dt / 0.25));
    cans.forEach((el, i) => c.setVar(el, "--vp-c", Math.max(0, Math.min(1, S.cans - i)).toFixed(3)));
    // the ticker tape and its readers
    S.tape = (S.tape + Math.min(60, rateOf(c, "meta>kafka") / 10) * step) % 2.6;
    c.setAttr(tapeEl, "transform", `translate(${S.tape.toFixed(3)} 0)`);
    S.tally += arrOf(c, "an") * step;
    if (tallyEl) {
      const t = String(Math.floor(S.tally) % 1e6).padStart(6, "0");
      if (tallyEl.textContent !== t) tallyEl.textContent = t;
    }
    S.sorter += Math.min(360, arrOf(c, "si") / 2) * step;
    c.setAttr(sorterEl, "transform", `rotate(${S.sorter.toFixed(2)})`);
    S.bell += Math.min(3, arrOf(c, "notif") / 300) * step;
    const f = S.bell % 1;
    const dip = calm ? 0 : 0.9 * smooth(0, 0.06, f) * (1 - smooth(0.06, 0.3, f));
    c.setAttr(bellEl, "transform", translateAlong(DATA.proj, [0, 0, -dip]));
    // the safelight: lit while the backlog grows
    const behind = growthOf(c) > 0.5 ? 1 : 0;
    S.lamp = calm ? behind : S.lamp + (behind - S.lamp) * (1 - Math.exp(-dt / 0.3));
    c.lamp("tw", S.lamp);
    c.setAttr(knobEl, "d", pointer(DATA.dial, c.load / DATA.rpsMax));
    return !calm;
  },
});
