// The shared runtime for bench figures, inlined after the truth bundle (WB), the kit, the WebGL layer
// and (for 3D figures) TURN. A figure's live code calls benchFigure({...}) and adds only its own
// mechanism in `frame`. Expects the page's DATA (figures/lib/bench.mjs, page()).
//
// benchFigure({
//   load: { max, step = 200, big = 1000, home, unit = "rps", snap = 50 },  the knob on the load generator
//   params: [{ name, value, min, max, step, keys: [up, down] }],          a second control, if the figure has one
//   graph: (ctx) => ({ nodes, edges }),          the graph the queueing engine runs (params applied)
//   engine: { advance(ctx, dt), steady(ctx) },   another engine instead (each returns a Metrics)
//   heat: { windowId: nodeId },                  which node each window shows (default: same id)
//   tour: (t) => ({ load, ...params }),         the idle tour, in seconds
//   readout: (ctx) => text, describe: (ctx) => aria value text,
//   frame: (ctx, dt, calm) => moving,            the figure's own motion, every frame
//   turn: { follow },                            mount the 3D runtime when the page has a turning group
// })
function benchFigure(o) {
  const stage = document.querySelector(".bx-stage");
  const readout = document.querySelector("[data-readout]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const P = DATA.proj;
  const WINDOWS = DATA.gl.windows;
  const LIGHT = (stage.closest("[data-theme]")?.getAttribute("data-theme") ?? "dark") !== "dark" ? 1 : 0;
  const loadOf = o.load;
  const DT = 0.25;
  const ctx = {
    stage, P, DATA, LIGHT,
    load: loadOf.home ?? DATA.preset.rps,
    target: loadOf.home ?? DATA.preset.rps,
    params: Object.fromEntries((o.params ?? []).map((p) => [p.name, p.value])),
    shown: Object.fromEntries((o.params ?? []).map((p) => [p.name, p.value])),
    metrics: null,
    clock: 0,
    calm: still.matches,
    controller: null,
    touring: !still.matches,
  };
  // writes only when the value changed: a custom property set every frame restyles the whole stage
  const written = new WeakMap();
  const setVar = (el, name, value) => {
    if (!el) return;
    const seen = written.get(el) ?? {};
    if (seen[name] === value) return;
    seen[name] = value;
    written.set(el, seen);
    el.style.setProperty(name, value);
  };
  const setAttr = (el, name, value) => {
    if (!el) return;
    const seen = written.get(el) ?? {};
    if (seen['@' + name] === value) return;
    seen['@' + name] = value;
    written.set(el, seen);
    el.setAttribute(name, value);
  };
  ctx.setVar = setVar;
  ctx.setAttr = setAttr;
  // ---------- truth ----------
  const sim = WB.makeSim ? WB.makeSim() : null;
  let simClock = 0;
  const graph = () => (o.graph ? o.graph(ctx) : { nodes: DATA.preset.nodes, edges: DATA.preset.edges });
  const queueing = {
    advance(c, dt) {
      simClock += dt;
      let m = c.metrics;
      while (simClock >= DT) {
        const g = graph();
        m = WB.tick(sim, g.nodes, g.edges, c.load, DT, o.tickOptions ?? {});
        simClock -= DT;
      }
      return m;
    },
    // the state a constant load settles into, from a fresh sim each time (calling it every still
    // frame on the live sim would grow every queue without bound); the live sim continues from it,
    // retry pressure and queues both, so the first moving frame picks up where the still one was
    steady(c) {
      const g = graph();
      const fresh = WB.makeSim();
      fresh.noise = sim.noise;
      let m = c.metrics;
      for (let i = 0; i < 240; i++) m = WB.tick(fresh, g.nodes, g.edges, c.load, DT, o.tickOptions ?? {});
      sim.retry = { ...fresh.retry };
      sim.q = { ...fresh.q };
      return m;
    },
  };
  const engine = o.engine ?? queueing;
  ctx.util = (id) => ctx.metrics?.nodes[id]?.util ?? 0;
  ctx.health = (id) => ctx.metrics?.nodes[id]?.health ?? "ok";
  ctx.err = (id) => ctx.metrics?.nodes[id]?.err ?? 0;
  ctx.queue = (id) => ctx.metrics?.nodes[id]?.q ?? 0;
  ctx.fmt = (n) => Math.round(n).toLocaleString("en-US");
  ctx.pct = (u) => `${Math.round(Math.min(u, 1.4) * 100)}%`;

  // ---------- the ink table: one blackbody ramp for the shader and the fallback ----------
  const STOPS = [[560, [0.45, 0.09, 0.05]], [680, [0.56, 0.07, 0.04]], [780, [0.78, 0.1, 0.03]], [950, [0.95, 0.38, 0.06]], [1150, [1, 0.78, 0.12]], [1300, [1, 0.93, 0.78]]];
  const steelOf = (t) => {
    let c = STOPS[0][1];
    for (let i = 1; i < STOPS.length; i++) {
      const m = smooth(STOPS[i - 1][0], STOPS[i][0], t);
      c = c.map((v, j) => v + (STOPS[i][1][j] - v) * m);
    }
    return c;
  };
  const glowsOf = (t) => smooth(560, 820, t);
  const tempOf = (util) => 430 + 640 * Math.min(util, 1.4);
  const STOPS_GLSL = STOPS.map(([t, c], i) => (i ? `c=mix(c,vec3(${c.map((v) => v.toFixed(3)).join(",")}),smoothstep(${STOPS[i - 1][0].toFixed(1)},${t.toFixed(1)},t));` : `vec3 c=vec3(${c.map((v) => v.toFixed(3)).join(",")});`)).join("");
  const heatNode = (w) => (o.heat && o.heat[w.id]) || w.id;
  const heat = WINDOWS.map(() => ({ x: tempOf(0), v: 0 }));
  const first = { x: 0, v: 0 };
  const cavities = WINDOWS.map((w) => stage.querySelector(`[data-window="${w.id}"]`));
  const N = 8;
  if (WINDOWS.length > N) throw new Error(`benchFigure: at most ${N} heat windows`);
  const FRAGMENT = `
uniform float uLight;
uniform float uOn;
uniform float uTemp[${N}];
uniform vec4 uWinA[${N}];
uniform vec4 uWinB[${N}];
uniform vec4 uRods[${N}];
vec4 over(vec4 top,vec4 under){return top+under*(1.-top.a);}
vec4 inkFor(vec3 seen,float cover){vec3 absorbed=1.-seen;float a=max(max(absorbed.r,max(absorbed.g,absorbed.b)),cover);return vec4(vec3(a)-absorbed,a);}
vec3 steel(float t){${STOPS_GLSL}return c;}
float rrect(vec2 p,vec2 lo,vec2 hi,float r){vec2 c=(lo+hi)*.5;vec2 h=(hi-lo)*.5-r;vec2 q=abs(p-c)-h;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float px=pixelOf();
  vec3 V=towardViewer();
  vec3 n=normalize(cross(V,vec3(1.,0.,0.)));
  vec3 p0=rayOf(vb);
  vec4 ink=vec4(0.);
  for(int i=0;i<${N};i++){
    float t=uTemp[i];
    float lit=smoothstep(540.,820.,t);
    if(lit<=0.)continue;
    vec4 A=uWinA[i];
    vec4 B=uWinB[i];
    vec4 Z=uRods[i];
    vec3 pf=onWallY(vb,B.x);
    float open=1.-smoothstep(-.8*px,.8*px,rrect(pf.xz,vec2(A.x,A.z),vec2(A.y,A.w),Z.w));
    if(open<=0.)continue;
    vec3 pb=onWallY(vb,B.y);
    float rod=0.;
    float core=0.;
    float fall=0.;
    for(int j=0;j<3;j++){
      float zr=j==0?Z.x:(j==1?Z.y:Z.z);
      float d=abs(dot(p0-vec3(0.,B.z,zr),n));
      rod=max(rod,1.-smoothstep(B.w-.55*px,B.w+.55*px,d));
      core=max(core,1.-smoothstep(.15*B.w,.6*B.w,d));
      float dz=pb.z-zr;
      fall+=1./(1.+(dz*dz+1.7)/4.);
    }
    fall=min(fall,1.6)/1.6;
    float e=smoothstep(560.,1300.,t);
    float pale=core*smoothstep(1120.,1300.,t);
    vec3 body=mix(steel(t),vec3(1.,.95,.84),pale);
    vec3 warm=steel(t-140.);
    vec4 darkRod=vec4(tonemap(body*(.55+1.9*e),1.1),1.)*rod*lit;
    darkRod.a=max(darkRod.r,max(darkRod.g,darkRod.b));
    vec3 cav=tonemap(warm*(.18+.55*e)*fall,1.)*lit;
    vec4 darkCav=vec4(cav,max(cav.r,max(cav.g,cav.b)));
    vec4 lightRod=inkFor(mix(vec3(1.),body,lit),.94*lit)*rod;
    float ta=(.28+.42*e)*fall*lit;
    vec4 lightCav=vec4(warm*ta,ta);
    vec4 here=mix(over(darkRod,darkCav),over(lightRod,lightCav),uLight)*open;
    ink=over(here,ink);
  }
  ink*=uOn;
  ink.rgb=min(ink.rgb,vec3(ink.a));
  float m=ink.a;
  float noise=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  gl_FragColor=clamp(ink+vec4(noise)*smoothstep(0.,1.5/255.,m),0.,1.);
}`;
  const pack = (rows) => {
    const out = new Float32Array(N * 4);
    rows.forEach((row, i) => out.set(row, i * 4));
    return out;
  };
  const canvas = stage.querySelector(".bx-gl");
  const layer = canvas && WINDOWS.length
    ? glLayer({
        canvas,
        fragment: FRAGMENT,
        view: [DATA.gl.W, DATA.gl.H],
        camera: DATA.gl.camera,
        uniforms: ["uTemp", "uOn"],
        fixed: {
          uLight: LIGHT,
          uWinA: pack(WINDOWS.map((w) => [w.x0, w.x1, w.z0, w.z1])),
          uWinB: pack(WINDOWS.map((w) => [w.yf, w.yb, w.yr, w.rr])),
          uRods: pack(WINDOWS.map((w) => [w.rods[0] ?? -1e3, w.rods[1] ?? -1e3, w.rods[2] ?? -1e3, w.r])),
        },
      })
    : null;
  if (layer) stage.setAttribute("data-gl", "");
  const temps = new Float32Array(N);
  let drawnGl = "";
  const paintHeat = (time) => {
    const u = layer ? first.x : 0;
    setVar(stage, "--bx-fallback", Math.max(0, (1 - u) / (1 - u * 0.9 + 1e-6)).toFixed(3));
    WINDOWS.forEach((w, i) => {
      const t = heat[i].x;
      temps[i] = t;
      const c = steelOf(t).map((v) => Math.round(v * 255));
      setVar(cavities[i], "--bx-heat", `rgb(${c.join(" ")})`);
      setVar(cavities[i], "--bx-heat-a", glowsOf(t).toFixed(3));
    });
    if (!layer) return;
    const key = `${Array.from(temps, (t) => t.toFixed(1)).join(",")}|${u.toFixed(3)}`;
    if (key === drawnGl) return;
    drawnGl = key;
    layer.draw({ uTemp: temps, uOn: u }, time);
  };

  // ---------- dials: the load knob and each drum's gauge ----------
  const knob = stage.querySelector('[data-ref="knob"]');
  const gauges = (DATA.gauges ?? []).map((g) => ({ g, el: stage.querySelector(`[data-gauge="${g.id}"]`), s: { x: 0, v: 0 } }));
  const pointer = (c, z, from, span, f, r0, r1) => {
    const a = from + Math.min(1, Math.max(0, f)) * span;
    return lineOnTop([c[0] + Math.sin(a) * r0, c[1] - Math.cos(a) * r0], [c[0] + Math.sin(a) * r1, c[1] - Math.cos(a) * r1], z, P);
  };
  const paintDials = () => {
    const K = DATA.knob;
    if (K && knob) setAttr(knob, "d", pointer(K.c, K.z, K.from, K.span, ctx.load / loadOf.max, K.r0, K.r1));
    for (const { g, el, s } of gauges) setAttr(el, "d", pointer(g.c, g.z, g.from, g.span, s.x / g.max, g.r0, g.r));
  };
  const lamps = [...stage.querySelectorAll("[data-lamp]")];
  ctx.lamp = (idOrIndex, on) => {
    const el = typeof idOrIndex === "number" ? lamps[idOrIndex] : lamps.find((l) => l.dataset.node === idOrIndex);
    setVar(el, "--bx-on", Math.max(0, Math.min(1, on)).toFixed(3));
  };

  // ---------- readout and value text ----------
  const say = () => {
    const text = o.readout ? o.readout(ctx) : `${ctx.fmt(ctx.metrics?.sys?.rps ?? ctx.load)} ${loadOf.unit ?? "rps"}`;
    if (readout && readout.textContent !== text) readout.textContent = text;
  };
  const describe = () => {
    stage.setAttribute("aria-valuenow", String(Math.round(ctx.target)));
    stage.setAttribute("aria-valuetext", o.describe ? o.describe(ctx) : `${ctx.fmt(ctx.target)} ${loadOf.unit === "rps" || !loadOf.unit ? "requests per second" : loadOf.unit}`);
  };

  // ---------- 3D, when the page has a turning group ----------
  if (DATA.turn && typeof TURN !== "undefined") {
    let mounted = null;
    mounted = TURN.mount(stage, DATA.turn, {
      follow: o.turn?.follow,
      // a tool (turn-check, drive) has taken the pose: the figure's own motion waits until the
      // reader touches it again, so the two never fight over the groups
      onHold: () => {
        ctx.touring = false;
        ctx.held = true;
        clearTimeout(idle);
      },
      onFrame: (turned) => {
        if (mounted) o.turn?.onFrame?.(ctx, turned);
      },
    });
    ctx.controller = mounted;
  }

  // ---------- the loop ----------
  let frame = 0;
  let last = 0;
  let visible = false;
  let idle = 0;
  let drag = null;
  const hold = () => {
    ctx.touring = false;
    ctx.held = false;
    clearTimeout(idle);
    idle = setTimeout(() => {
      ctx.touring = !still.matches;
      run();
    }, 3600);
  };
  const applyTour = () => {
    const at = o.tour ? o.tour(ctx.clock) : null;
    if (!at) return;
    if (at.load !== undefined) ctx.target = at.load;
    for (const p of o.params ?? []) if (at[p.name] !== undefined) ctx.params[p.name] = at[p.name];
  };
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const calm = (ctx.calm = still.matches);
    if (calm) {
      ctx.touring = false;
      clearTimeout(idle);
    }
    if (ctx.touring) {
      ctx.clock += dt;
      applyTour();
    }
    ctx.load = calm ? ctx.target : ctx.load + (ctx.target - ctx.load) * (1 - Math.exp(-dt / 0.35));
    if (Math.abs(ctx.target - ctx.load) < 0.5) ctx.load = ctx.target;
    let moving = ctx.touring || ctx.load !== ctx.target || drag !== null;
    for (const p of o.params ?? []) {
      const was = ctx.shown[p.name];
      ctx.shown[p.name] = calm ? ctx.params[p.name] : was + (ctx.params[p.name] - was) * (1 - Math.exp(-dt / 0.3));
      if (Math.abs(ctx.shown[p.name] - ctx.params[p.name]) < (p.step ?? 1) * 1e-3) ctx.shown[p.name] = ctx.params[p.name];
      if (ctx.shown[p.name] !== ctx.params[p.name]) moving = true;
    }
    ctx.metrics = calm ? engine.steady(ctx) : engine.advance(ctx, dt);
    WINDOWS.forEach((w, i) => {
      if (settle(heat[i], tempOf(ctx.util(heatNode(w))), dt, 0.9, calm)) moving = true;
    });
    for (const { g, s } of gauges) if (settle(s, Math.min(ctx.util(g.id), g.max), dt, 0.35, calm)) moving = true;
    if (layer && settle(first, 1, dt, 0.6, calm)) moving = true;
    if (o.frame && !ctx.held && o.frame(ctx, dt, calm)) moving = true;
    if (o.alwaysMoving && !calm && !ctx.held) moving = true;
    paintDials();
    paintHeat(calm ? 0.8 : now / 1000);
    say();
    frame = visible && moving ? requestAnimationFrame(tick) : 0;
  }
  const run = () => {
    if (!frame && visible) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  };
  ctx.run = run;
  ctx.hold = hold;
  new IntersectionObserver(
    (entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) run();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    { rootMargin: "120px 0px" },
  ).observe(stage);
  still.addEventListener?.("change", run);

  // ---------- input: drag across sets the load; keys step it and the second control ----------
  const snap = loadOf.snap ?? 50;
  const clampLoad = (v) => Math.min(loadOf.max, Math.max(loadOf.min ?? 0, Math.round(v / snap) * snap));
  const loadAt = (event) => {
    const box = stage.getBoundingClientRect();
    const f = (event.clientX - box.left) / Math.max(1, box.width);
    return clampLoad(Math.min(1, Math.max(0, (f - 0.08) / 0.84)) * loadOf.max);
  };
  stage.addEventListener("pointerdown", (event) => {
    hold();
    drag = { id: event.pointerId, x: event.clientX, captured: false };
  });
  stage.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.captured && Math.abs(event.clientX - drag.x) > 4) {
      drag.captured = true;
      stage.setPointerCapture(event.pointerId);
      stage.setAttribute("data-drag", "");
    }
    if (!drag.captured) return;
    hold();
    ctx.target = loadAt(event);
    describe();
    run();
  });
  const release = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.captured && o.tap) o.tap(ctx, event);
    else if (!drag.captured) ctx.target = loadAt(event);
    drag = null;
    stage.removeAttribute("data-drag");
    try {
      stage.releasePointerCapture(event.pointerId);
    } catch {}
    describe();
    run();
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("keydown", (event) => {
    if (o.key && o.key(ctx, event)) {
      event.preventDefault();
      hold();
      describe();
      run();
      return;
    }
    const step = event.shiftKey ? loadOf.big ?? 1000 : loadOf.step ?? 200;
    let next = null;
    if (event.key === "ArrowRight") next = ctx.target + step;
    if (event.key === "ArrowLeft") next = ctx.target - step;
    if (event.key === "PageUp") next = ctx.target + (loadOf.big ?? 1000);
    if (event.key === "PageDown") next = ctx.target - (loadOf.big ?? 1000);
    if (event.key === "Home") next = loadOf.home ?? DATA.preset.rps;
    if (event.key === "End") next = loadOf.max;
    const p = (o.params ?? [])[0];
    if (p && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      const sign = event.key === "ArrowUp" ? 1 : -1;
      ctx.params[p.name] = Math.min(p.max, Math.max(p.min, Math.round((ctx.params[p.name] + sign * (event.shiftKey ? p.big ?? p.step * 5 : p.step)) / p.step) * p.step));
      event.preventDefault();
      hold();
      describe();
      run();
      return;
    }
    if (!p && (event.key === "ArrowUp" || event.key === "ArrowDown")) next = ctx.target + (event.key === "ArrowUp" ? step : -step);
    if (next === null) return;
    event.preventDefault();
    hold();
    ctx.target = clampLoad(next);
    describe();
    run();
  });

  // ---------- first paint: the steady state of the preset, drawn before anything moves ----------
  ctx.metrics = engine.steady(ctx);
  WINDOWS.forEach((w, i) => (heat[i].x = tempOf(ctx.util(heatNode(w)))));
  for (const { g, s } of gauges) s.x = Math.min(ctx.util(g.id), g.max);
  o.frame?.(ctx, 0, true);
  paintDials();
  paintHeat(0);
  say();
  describe();

  // ---------- embedded in the System designs page: no page chrome, report the height ----------
  if (/[?&]embed\b/.test(location.search)) {
    document.body.classList.add("iso-embed");
    document.documentElement.style.colorScheme = LIGHT ? "light" : "dark";
    try {
      const ground = parent.getComputedStyle(parent.document.body).backgroundColor;
      if (ground && parent !== window) document.body.style.setProperty("--anatomy-card", ground);
    } catch {}
    const pageEl = document.querySelector(".iso-page");
    const post = () => parent.postMessage({ type: "anatomy-figure-height", height: Math.ceil(pageEl.getBoundingClientRect().height) }, "*");
    new ResizeObserver(post).observe(pageEl);
    post();
  }
  return ctx;
}
