// Fig 10's own motion: the Workbench timeline for the request, played at 8 ms of trip per second.
// The capsule rides each message the caller waits for, its speed set by that hop's latency; the
// fire-and-forget messages launch their own small capsules on the side line and never hold it.
const SPEED = 8;
const HOLD = 2.6;
let hit = false;
let paused = false;
let play = 0;
let seeded = false;
const trip = () => (hit ? DATA.hit : DATA.miss);
const lastEnd = () => Math.max(trip().total, ...trip().msgs.map((m) => m.end));
const X = DATA.stations;
const names = DATA.names;
const capsule = document.querySelector('[data-ref="capsule"]');
const sides = ["a", "b"].map((id) => document.querySelector(`[data-ref="side-${id}"]`));
const hand = document.querySelector('[data-ref="hand"]');
const lampIds = Object.keys(X);
const shownHand = { x: 0, v: 0 };
const sideOn = [{ x: 0, v: 0 }, { x: 0, v: 0 }];
// where the request is at time t: on the hop the caller is waiting for, or docked where it last arrived
const stateAt = (t) => {
  const sync = trip().msgs.filter((m) => !m.async);
  const active = sync.find((m) => t >= m.start && t < m.end);
  if (active) return { msg: active, x: X[active.from] + (X[active.to] - X[active.from]) * ((t - active.start) / Math.max(1e-6, active.end - active.start)) };
  const done = sync.filter((m) => m.end <= t).pop();
  return { msg: null, x: done ? X[done.to] : X[sync[0].from], done: !!done && t >= trip().total };
};
const paint = (c, dt, calm) => {
  const t = c.load;
  const s = stateAt(t);
  capsule.setAttribute("transform", translateAlong(DATA.proj, [s.x - DATA.home, 0, 0]));
  // a lamp shows who holds the request: the sender lets go as a hop starts, the receiver takes it as
  // it lands, and the stations it only passes stay dark
  const f = s.msg ? (t - s.msg.start) / Math.max(1e-6, s.msg.end - s.msg.start) : 1;
  for (const id of lampIds) {
    let on = 0;
    if (s.msg) on = id === s.msg.from ? 1 - smooth(0, 0.25, f) : id === s.msg.to ? smooth(0.75, 1, f) : 0;
    else on = Math.abs(s.x - X[id]) < 1 ? 1 : 0;
    c.lamp(id, on);
  }
  // the side line: each fire-and-forget message is a capsule launched at its start, docked at its end
  const asyncs = trip().msgs.filter((m) => m.async);
  let moving = false;
  sides.forEach((el, i) => {
    const m = asyncs[i];
    let x = DATA.sideFrom;
    let on = 0;
    if (m && t >= m.start) {
      x = X[m.from] + (X[m.to] - X[m.from]) * Math.min(1, (t - m.start) / Math.max(1e-6, m.end - m.start));
      on = 1;
    }
    if (m && t >= m.start && X[m.from] !== DATA.sideFrom) x = X[m.to];
    if (settle(sideOn[i], on, dt, 0.06, calm)) moving = true;
    el.setAttribute("transform", translateAlong(DATA.proj, [x - DATA.sideFrom, 0, 0]));
    el.style.setProperty("--cm-on", sideOn[i].x.toFixed(3));
  });
  // the stopwatch: one turn is 100 ms; it flies back to zero when the trip restarts
  if (settle(shownHand, t, dt, 0.05, calm)) moving = true;
  const a = (shownHand.x / DATA.dial.max) * Math.PI * 2;
  const [cx, cy] = DATA.dial.c;
  hand.setAttribute("d", lineOnTop([cx + Math.sin(a) * DATA.dial.r0, cy - Math.cos(a) * DATA.dial.r0], [cx + Math.sin(a) * DATA.dial.r1, cy - Math.cos(a) * DATA.dial.r1], DATA.dial.z, DATA.proj));
  return moving;
};
// the knob's range is the playing variant's timeline
const LOAD = { max: lastEnd(), min: 0, home: 0, step: 1, big: 10, snap: 0.1, unit: "ms" };
benchFigure({
  load: LOAD,
  engine: { advance: () => ({ nodes: {}, edges: {}, sys: {} }), steady: () => ({ nodes: {}, edges: {}, sys: {} }) },
  alwaysMoving: true,
  readout: (c) => {
    const t = c.load;
    const s = stateAt(t);
    const tail = hit ? " · hit" : "";
    if (s.msg) return `${Math.round(t)} ms · ${names[s.msg.from]} → ${names[s.msg.to]} · ${s.msg.lat} ms hop${tail}`;
    if (s.done) return `${trip().total} ms round trip · cache ${hit ? "hit" : "miss"}`;
    return `${Math.round(t)} ms${tail}`;
  },
  describe: (c) => {
    const s = stateAt(c.target);
    const what = s.msg ? `${names[s.msg.from]} sends ${s.msg.label} to ${names[s.msg.to]}` : s.done ? `the page has rendered after ${trip().total} milliseconds` : "the request is about to start";
    return `${Math.round(c.target)} milliseconds into the ${hit ? "cache-hit" : "cache-miss"} request: ${what}`;
  },
  key: (c, event) => {
    if (event.key === " ") {
      paused = !paused;
      play = c.target;
      event.preventDefault();
      return false;
    }
    if (event.key === "h" || event.key === "H") {
      hit = !hit;
      // the hit's timeline is shorter: keep the knob within it
      LOAD.max = lastEnd();
      c.target = Math.min(c.target, LOAD.max);
      play = c.target;
      return true;
    }
    return false;
  },
  frame: (c, dt, calm) => {
    const end = lastEnd();
    if (calm && !seeded) {
      // reduced motion: one still frame on the long hop
      const q = trip().msgs.find((m) => m.seq === 7) ?? trip().msgs[0];
      c.target = c.load = (q.start + q.end) / 2;
      seeded = true;
    }
    if (!calm && c.touring && !paused) {
      play += SPEED * dt;
      if (play > end + HOLD * SPEED) {
        play = 0;
        c.load = 0;
      }
      c.target = Math.min(play, end);
    } else if (!c.touring) play = c.target;
    if (c.target > end) c.target = end;
    return paint(c, dt, calm) || !paused;
  },
});
