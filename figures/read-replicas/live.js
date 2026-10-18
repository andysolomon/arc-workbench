// Fig 7's own motion. The master stylus writes the page at a speed set by the engine's write rate
// (its api>pri edge); the linkage is rebuilt round it every frame, so the beam carries the copy
// styluses along and the same stroke grows on all three sheets. Each lamp's pool follows the reads
// its copy serves (the api>r1, api>r2 edges). ↑↓ set the write share: api>pri = share, each read
// edge = (1 − share) / 2.
const LINK = makeLinkage({ extrude, solidSvg, iso, pathOf, cylinder, ring, dotsSvg }, DATA.link, DATA.proj);
const PAGE = DATA.page;
const arm = document.querySelector('[data-ref="linkage"]');
const inks = [...document.querySelectorAll("[data-ink]")];
const pools = [...document.querySelectorAll("[data-pool]")];
const stage = document.querySelector(".bx-stage");
const knobEl = document.querySelector('[data-ref="loadknob"]');
const mixEl = document.querySelector('[data-ref="mix"]');
let ticked = DATA.share;
let pos = 0;
let fade = 1;
let turning = 0;
let drawnKey = "";
let inkKey = "";

// the page as projected points on the master sheet, once: the ink for a prefix is a slice of them
const PAPER_Z = DATA.link.z.tip[0];
const PROJECTED = PAGE.map(([u, v]) => iso([u, v, PAPER_Z], DATA.proj));
const inkOf = (n) => {
  let d = "";
  let open = false;
  for (let i = 0; i < n; i++) {
    const down = PAGE[i][2] && (i === 0 || PAGE[i - 1][2]);
    const [x, y] = PROJECTED[i];
    if (!PAGE[i][2]) {
      open = false;
      continue;
    }
    d += `${open && down ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    open = true;
  }
  return d;
};
const at = (s) => {
  const i = Math.min(PAGE.length - 1, Math.max(0, Math.floor(s)));
  const j = Math.min(PAGE.length - 1, i + 1);
  const f = Math.min(1, Math.max(0, s - i));
  return { H: [PAGE[i][0] + (PAGE[j][0] - PAGE[i][0]) * f, PAGE[i][1] + (PAGE[j][1] - PAGE[i][1]) * f], down: PAGE[i][2] && PAGE[j][2], index: i };
};
const pointer = (K, f) => {
  const a = K.from + Math.min(1, Math.max(0, f)) * K.span;
  return lineOnTop([K.c[0] + Math.sin(a) * K.r0, K.c[1] - Math.cos(a) * K.r0], [K.c[0] + Math.sin(a) * K.r1, K.c[1] - Math.cos(a) * K.r1], K.z, DATA.proj);
};
// the pen lifts a little between lines, and comes down again on the next
let lift = 0;
const paint = (c) => {
  const { H, index } = at(pos);
  const key = `${H[0].toFixed(2)},${H[1].toFixed(2)},${lift.toFixed(2)}`;
  if (key !== drawnKey) {
    arm.innerHTML = LINK.svg(H, lift);
    drawnKey = key;
  }
  const ink = inkOf(index + 1);
  if (ink !== inkKey) {
    for (const el of inks) el.setAttribute("d", ink);
    inkKey = ink;
  }
  stage.style.setProperty("--rr-ink", fade.toFixed(3));
  const reads = { r1: c.metrics?.edges?.["api>r1"] ?? 0, r2: c.metrics?.edges?.["api>r2"] ?? 0 };
  for (const el of pools) c.setVar(el, "--rr-read", Math.min(1, reads[el.dataset.pool] / 3000).toFixed(3));
  c.setAttr(knobEl, "d", pointer(DATA.loadKnob, c.load / DATA.loadMax));
  c.setAttr(mixEl, "d", pointer(DATA.mixKnob, c.shown.share));
};
const graphOf = (c) => {
  ticked = c.params.share;
  return {
    nodes: DATA.preset.nodes,
    edges: DATA.preset.edges.map((e) => (e.id === "api>pri" ? { ...e, w: c.params.share } : e.id === "api>r1" || e.id === "api>r2" ? { ...e, w: (1 - c.params.share) / 2 } : e)),
  };
};
// the tour: reads spread at the preset's 20% writes, then the mix tips toward writes and the copies,
// redrawing every write, saturate before the master does
const tourAt = (t) => {
  const s = t % 30;
  const load = s < 3 ? 1800 : s < 8 ? 1800 + 4000 * smooth(3, 8, s) : s < 22 ? 5800 : s < 27 ? 5800 - 4000 * smooth(22, 27, s) : 1800;
  const share = s < 11 ? 0.2 : s < 15 ? 0.2 + 0.6 * smooth(11, 15, s) : s < 22 ? 0.8 : s < 25 ? 0.8 - 0.6 * smooth(22, 25, s) : 0.2;
  return { load, share: Math.round(share * 20) / 20 };
};
benchFigure({
  graph: graphOf,
  load: { max: DATA.loadMax, home: DATA.preset.rps, step: 200, big: 1000, snap: 50 },
  params: [{ name: "share", value: DATA.share, min: 0, max: 1, step: 0.05, big: 0.25 }],
  tour: tourAt,
  alwaysMoving: true,
  readout: (c) => {
    const load = c.fmt(c.metrics?.sys?.rps ?? c.load);
    const mix = `${Math.round(ticked * 100)}% writes`;
    const errors = c.pct(c.metrics?.sys?.err ?? 0);
    const copies = Math.max(c.util("r1"), c.util("r2"));
    if (c.health("api") === "crit") return `${load} rps · API saturated · ${errors} errors`;
    if (c.health("pri") === "crit" && c.health("r1") === "crit") return `${load} rps · ${mix} · master and copies saturated`;
    if (c.health("r1") === "crit" || c.health("r2") === "crit") return `${load} rps · ${mix} · copies saturated`;
    if (c.stage.clientWidth < 420) return `${load} rps · master ${c.pct(c.util("pri"))} · copies ${c.pct(copies)}`;
    return `${load} rps · ${mix} · master ${c.pct(c.util("pri"))} · copies ${c.pct(copies)}`;
  },
  describe: (c) => `${c.fmt(c.target)} requests per second, ${Math.round(c.params.share * 100)} percent writes`,
  frame: (c, dt, calm) => {
    let moving = false;
    if (!calm) {
      // the stylus writes as fast as the writes arrive, slowed to be followed (1 unit of stroke per 25 writes)
      const writes = c.metrics?.edges?.["api>pri"] ?? 0;
      const speed = Math.min(70, writes / 25) / 0.5;
      if (turning > 0) {
        turning = Math.max(0, turning - dt);
        fade = Math.max(0, turning / 0.8);
        if (turning === 0) {
          pos = 0;
          fade = 1;
        }
        moving = true;
      } else if (speed > 0) {
        pos += speed * dt;
        if (pos >= PAGE.length - 1) {
          pos = PAGE.length - 1;
          turning = 0.8;
        }
        moving = true;
      }
      const { down } = at(pos);
      const target = down ? 0 : 0.9;
      lift += (target - lift) * (1 - Math.exp(-dt / 0.08));
      if (Math.abs(target - lift) < 1e-3) lift = target;
    }
    paint(c);
    return moving;
  },
});
