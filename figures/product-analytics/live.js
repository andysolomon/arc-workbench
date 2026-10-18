// Fig 11's own motion: the water works. Levels and flows come from the engine each tick: the
// windpump turns at the mobile app's rate, the filter's cells open with the model's instances, its
// inlet channel fills with the backlog and the reject sump with the dead letters. A WebGL layer
// moves every water surface at its own flow; each surface's near rim hides its near side, worked out
// along the pixel's ray, so the canvas can sit over the whole drawing. Everything else is the shared
// bench runtime (figures/lib/bench-live.js).
const RECOVER = DATA.mlRecover;
// the example falling behind; enough cells to recover from the retries; more load than they hold; back
const TOUR = [[0, 3500, 2], [5, 3500, 2], [6, 3500, RECOVER], [17, 3500, RECOVER], [23, 7000, RECOVER], [29, 7000, RECOVER], [31, 3500, 2], [35, 3500, 2]];
const tourAt = (t) => {
  const s = t % TOUR[TOUR.length - 1][0];
  for (let i = 1; i < TOUR.length; i++) {
    const [t1, v1, m1] = TOUR[i];
    const [t0, v0, m0] = TOUR[i - 1];
    if (s <= t1) return { load: v0 + (v1 - v0) * smooth(t0, t1, s), ml: s < t1 - 0.5 ? m0 : m1 };
  }
  return { load: TOUR[0][1], ml: TOUR[0][2] };
};
const QMAX = 50000;
const stageEl = document.querySelector(".bx-stage");
const PROJ = DATA.proj;
const kilo = (n) => (n >= 9950 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

// ---------- truth: one sim for the whole page ----------
// the first paint (the settled state: behind, the inlet full) and the live 4 Hz ticks continue each
// other; the backlog is the point of the figure, so it never resets
const engineSim = WB.makeSim();
let engineClock = 0;
const nodesFor = (c) => DATA.preset.nodes.map((n) => (n.id === "ml" ? { ...n, inst: Math.round(c.params.ml) } : n));
const OPTS = { includeAsync: true };
let settledFor = null;
const engine = {
  advance(c, dt) {
    engineClock += dt;
    let m = c.metrics;
    while (engineClock >= 0.25) {
      m = WB.tick(engineSim, nodesFor(c), DATA.preset.edges, c.load, 0.25, OPTS);
      engineClock -= 0.25;
    }
    settledFor = null;
    return m;
  },
  // a still frame settles once per input, so reduced motion doesn't keep ticking the backlog up
  steady(c) {
    const key = `${c.load}|${Math.round(c.params.ml)}`;
    if (settledFor && settledFor.key === key) return settledFor.m;
    let m = c.metrics;
    for (let i = 0; i < 240; i++) m = WB.tick(engineSim, nodesFor(c), DATA.preset.edges, c.load, 0.25, OPTS);
    settledFor = { key, m };
    return m;
  },
};

// ---------- the water bodies and what drives each one's flow ----------
const BODIES = DATA.water;
const N = 20;
if (BODIES.length > N) throw new Error(`at most ${N} water bodies`);
const rateOf = (c, id) => {
  const m = c.metrics;
  if (!m) return 0;
  const e = (key) => m.edges[key] ?? 0;
  const arr = (n) => m.nodes[n]?.arr ?? 0;
  if (id === "canal" || id === "intake") return e("web>edge");
  if (id === "dist") return e("edge>stream") + e("edge>gate");
  if (id === "lanes" || id === "fall") return arr("stream");
  if (id === "outlet") return e("stream>wh");
  if (id === "sump") return e("stream>dlq");
  if (id === "res") return arr("wh");
  if (id === "inlet") return e("feat>ml");
  if (id.startsWith("cell")) return Math.min(arr("ml"), (m.nodes.ml?.util ?? 0) > 0 ? arr("ml") / Math.max(1, m.nodes.ml.util) : 0);
  if (id === "trough" || id === "jet") return arr("dash");
  return 0;
};
const flowSpeed = BODIES.map(() => ({ x: 0, v: 0 }));
const offset = BODIES.map(() => 0);
const on = BODIES.map((b) => ({ x: b.cell === undefined ? 1 : 0, v: 0 }));
const level = { inlet: { x: 4, v: 0 }, sump: { x: 1.6, v: 0 } };
const inletIndex = BODIES.findIndex((b) => b.id === "inlet");
const sumpIndex = BODIES.findIndex((b) => b.id === "sump");
const troughIndex = BODIES.findIndex((b) => b.id === "trough");
const jet = BODIES.find((b) => b.id === "jet");

// ---------- WebGL: the water ----------
const LIGHT = (stageEl.closest("[data-theme]")?.getAttribute("data-theme") ?? "dark") !== "dark" ? 1 : 0;
const FRAGMENT = `
uniform float uLight;
uniform float uOn;
uniform vec4 uA[${N}];
uniform vec4 uB[${N}];
uniform vec4 uC[${N}];
uniform vec4 uLanes;
uniform vec4 uPost;
uniform float uPostBody;
vec4 over(vec4 top,vec4 under){return top+under*(1.-top.a);}
float sdRR(vec2 p,vec2 lo,vec2 hi,float r){vec2 c=(lo+hi)*.5;vec2 h=(hi-lo)*.5-r;vec2 q=abs(p-c)-h;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float inRect(vec2 p,vec4 A,float r,float s){return 1.-smoothstep(-s,s,sdRR(p,A.xy,A.zw,r));}
float segDist(vec2 c,vec2 a,vec2 b){vec2 ab=b-a;float t=clamp(dot(c-a,ab)/max(dot(ab,ab),1e-6),0.,1.);return length(c-a-ab*t);}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float px=pixelOf();
  float soft=.8*px;
  vec3 V=towardViewer();
  vec2 lean=V.xy/V.z;
  vec4 ink=vec4(0.);
  for(int i=0;i<${N};i++){
    vec4 A=uA[i];
    vec4 B=uB[i];
    vec4 C=uC[i];
    if(C.w<=0.)continue;
    float kind=B.z;
    float vis=0.;
    float u=0.;
    float v=0.;
    if(kind<2.5){
      vec3 p=onFloor(vb,B.x);
      vec2 q=p.xy+lean*max(0.,B.y-B.x);
      if(kind<.5){
        vis=inRect(p.xy,A,B.w,soft)*inRect(q,A,B.w,soft);
      }else if(kind<1.5){
        vis=(1.-smoothstep(-soft,soft,length(p.xy-A.xy)-A.z))*(1.-smoothstep(-soft,soft,length(q-A.xy)-A.z));
      }else{
        float lw=(A.w-A.y)/uLanes.x;
        float j=clamp(floor((p.y-A.y)/lw),0.,uLanes.x-1.);
        float far=A.y+j*lw+.18;
        float near=A.y+(j+1.)*lw-.18;
        float topY=j>=uLanes.x-1.?uLanes.z:uLanes.y;
        float qy=p.y+lean.y*max(0.,topY-B.x);
        vis=inRect(p.xy,A,0.,soft)*smoothstep(-soft,soft,p.y-far)*smoothstep(-soft,soft,near-qy);
      }
      // a post standing in the water hides the water behind it
      if(abs(float(i)-uPostBody)<.5){
        vec2 top=p.xy+lean*max(0.,uPost.w-B.x);
        vis*=smoothstep(uPost.z-soft,uPost.z+soft,segDist(uPost.xy,p.xy,top));
      }
      vec2 d=C.xy;
      vec2 n=vec2(-d.y,d.x);
      u=dot(p.xy,d)-C.z;
      v=dot(p.xy,n);
    }else if(kind<3.5){
      // a falling sheet on the plane x = A.x: y in [A.y, A.z], z in [B.x, B.y]; the chamber's front wall
      // (y = A.w, its top at B.w) hides the sheet's foot near the front
      vec3 p=onWallX(vb,A.x);
      float zTop=p.z+(A.w-p.y)*V.z/max(V.y,1e-4);
      vis=smoothstep(A.y-soft,A.y+soft,p.y)*(1.-smoothstep(A.z-soft,A.z+soft,p.y))*smoothstep(B.x-soft,B.x+soft,p.z)*(1.-smoothstep(B.y-soft,B.y+soft,p.z))*smoothstep(B.w-soft,B.w+soft,zTop);
      u=-p.z*1.6-C.z;
      v=p.y*1.4;
    }else{
      // the jet: a vertical cylinder; where the pixel's ray passes the axis closest, its height
      vec3 p0=rayOf(vb);
      vec2 h=normalize(V.xy);
      vec2 rel=A.xy-p0.xy;
      float t=dot(rel,V.xy)/dot(V.xy,V.xy);
      float dist=abs(rel.x*h.y-rel.y*h.x);
      float z=p0.z+t*V.z;
      vis=(1.-smoothstep(A.z-soft,A.z+soft,dist))*smoothstep(B.x-soft,B.x+soft,z)*(1.-smoothstep(B.y-soft,B.y+soft,z));
      u=-z*1.4-C.z;
      v=dist/A.z*3.;
    }
    if(vis<=0.)continue;
    // ripples stretched along the flow: long, soft glints and the troughs between them
    float n1=noise2(vec2(u*.2,v*.75));
    float n2=noise2(vec2(u*.55+3.1,v*1.7+7.3));
    float g=n1*.7+n2*.3;
    float glint=smoothstep(.6,.84,g);
    float dip=smoothstep(.6,.84,1.-g);
    vec3 hi=vec3(.6,.7,.76)*(.16*glint)+vec3(.02,.03,.035);
    vec4 dark=vec4(hi,max(hi.r,max(hi.g,hi.b)));
    vec4 lightHi=vec4(vec3(.97,.985,1.)*.36*glint,.36*glint);
    vec4 lightLo=vec4(vec3(.42,.52,.6)*.16*dip,.16*dip);
    vec4 here=mix(dark,over(lightHi,lightLo),uLight)*vis*C.w;
    ink=over(here,ink);
  }
  ink*=uOn;
  ink.rgb=min(ink.rgb,vec3(ink.a));
  float noise=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  gl_FragColor=clamp(ink+vec4(noise)*smoothstep(0.,1.5/255.,ink.a),0.,1.);
}`;
const packed = (rows) => {
  const out = new Float32Array(N * 4);
  rows.forEach((row, i) => out.set(row, i * 4));
  return out;
};
const geometry = packed(BODIES.map((b) => (b.kind === 1 || b.kind === 4 ? [b.x0, b.y0, b.r, 0] : b.kind === 3 ? [b.x0, b.y0, b.y1, b.frontY] : [b.x0, b.y0, b.x1, b.y1])));
const lanes = BODIES.find((b) => b.kind === 2);
const glCanvas = stageEl.querySelector(".bx-gl");
const water = glCanvas
  ? glLayer({
      canvas: glCanvas,
      fragment: FRAGMENT,
      view: [DATA.gl.W, DATA.gl.H],
      camera: DATA.gl.camera,
      uniforms: ["uB", "uC", "uOn"],
      fixed: {
        uLight: LIGHT,
        uA: geometry,
        uLanes: lanes ? [lanes.lanes, lanes.divTop, lanes.frontTop, 0] : [1, 0, 0, 0],
        uPost: jet ? [jet.x0, jet.y0, jet.r + 0.3, jet.top] : [0, 0, 0, 0],
        uPostBody: troughIndex,
      },
    })
  : null;
if (water) stageEl.setAttribute("data-water", "");
const first = { x: 0, v: 0 };
const uB = new Float32Array(N * 4);
const uC = new Float32Array(N * 4);
let drawnKey = "";
const paintWater = (time, moving) => {
  if (!water) return;
  BODIES.forEach((b, i) => {
    const z = i === inletIndex ? level.inlet.x : i === sumpIndex ? level.sump.x : b.kind === 3 ? b.z0 : b.z;
    const top = b.kind === 3 ? b.z1 : b.top;
    const extra = b.kind === 3 ? b.top : b.r;
    uB.set([z, top, b.kind, extra], i * 4);
    const [fx, fy] = b.flow;
    const len = Math.hypot(fx, fy) || 1;
    uC.set([fx / len, fy / len, offset[i], on[i].x], i * 4);
  });
  const key = moving ? `${time}` : `${Array.from(uB).join()}|${Array.from(uC, (v) => v.toFixed(3)).join()}|${first.x.toFixed(3)}`;
  if (key === drawnKey) return;
  drawnKey = key;
  water.draw({ uB, uC, uOn: first.x }, time);
};

// ---------- the parts that move ----------
const inletEl = stageEl.querySelector('[data-ref="inlet"]');
const sumpEl = stageEl.querySelector('[data-ref="sump"]');
const cellEls = [...stageEl.querySelectorAll("[data-cell]")];
const gateEls = [...stageEl.querySelectorAll("[data-gate]")];
const sailsEl = stageEl.querySelector('[data-ref="sails"]');
const fallEl = stageEl.querySelector(".pa-fall");
const jetEl = stageEl.querySelector(".pa-jet");
const levelPath = (plan, z) => pathOf(roundedPlan(plan, 3).map(([x, y]) => iso([x, y, z], PROJ)), true);
const inletBody = BODIES[inletIndex];
const sumpBody = BODIES[sumpIndex];
const inletPlan = { x: inletBody.x0, y: inletBody.y0, w: inletBody.x1 - inletBody.x0, d: inletBody.y1 - inletBody.y0, r: 0.3 };
const sumpPlan = { x: sumpBody.x0, y: sumpBody.y0, w: sumpBody.x1 - sumpBody.x0, d: sumpBody.y1 - sumpBody.y0, r: 0.4 };
const shownQ = { x: 0, v: 0 };
const shownSump = { x: 0, v: 0 };
const sails = { angle: 0, speed: { x: 0, v: 0 } };
let clockGl = 0;
benchFigure({
  engine,
  load: { max: DATA.rpsMax, home: DATA.preset.rps, unit: "events/s" },
  params: [{ name: "ml", value: DATA.mlInst, min: 1, max: DATA.cells, step: 1 }],
  alwaysMoving: true,
  tour: (t) => tourAt(t),
  readout: (c) => {
    // the load, the model's state and its backlog all come from the same engine tick
    const load = c.fmt(c.metrics?.sys?.rps ?? c.load);
    const inst = Math.round(c.params.ml);
    const q = c.queue("ml");
    const cells = `${inst} cell${inst === 1 ? "" : "s"}`;
    if (c.health("ml") === "crit") return `${load} events/s · ${cells} behind · backlog ${kilo(q)}`;
    if (q > 1) return `${load} events/s · ${cells} ${c.pct(c.util("ml"))} · draining ${kilo(q)}`;
    return `${load} events/s · ${cells} ${c.pct(c.util("ml"))} · no backlog`;
  },
  describe: (c) => `${c.fmt(c.target)} events per second, ${Math.round(c.params.ml)} filter cell${Math.round(c.params.ml) === 1 ? "" : "s"} in service`,
  frame: (c, dt, calm) => {
    let moving = !calm;
    // the inlet channel: the model's backlog, out of the engine's 50k ceiling
    if (settle(shownQ, Math.min(QMAX, c.queue("ml")), dt, 0.5, calm)) moving = true;
    level.inlet.x = DATA.inletZ[0] + (DATA.inletZ[1] - DATA.inletZ[0]) * Math.sqrt(Math.min(1, shownQ.x / QMAX));
    c.setAttr(inletEl, "d", levelPath(inletPlan, level.inlet.x));
    // the reject sump: dead letters piling up, on a log scale (it has no outlet)
    if (settle(shownSump, Math.log10(1 + c.queue("dlq")), dt, 0.6, calm)) moving = true;
    level.sump.x = 1.6 + Math.min(4.8, shownSump.x * 0.8);
    c.setAttr(sumpEl, "d", levelPath(sumpPlan, level.sump.x));
    // the cells in service, one per model instance: water over the sand, the gate raised
    const inst = Math.round(c.params.ml);
    BODIES.forEach((b, i) => {
      if (b.cell === undefined) return;
      if (settle(on[i], b.cell < inst ? 1 : 0, dt, 0.35, calm)) moving = true;
      c.setVar(cellEls[b.cell], "--pa-on", on[i].x.toFixed(3));
      c.setAttr(gateEls[b.cell], "transform", translateAlong(PROJ, [0, 0, 3.2 * on[i].x]));
    });
    // every surface moves at its own flow, slowed to something the eye can follow
    BODIES.forEach((b, i) => {
      if (settle(flowSpeed[i], Math.min(28, rateOf(c, b.id) / 60), dt, 0.6, calm)) moving = true;
      if (!calm) offset[i] = (offset[i] + flowSpeed[i].x * dt) % 4000;
    });
    // the windpump turns at the mobile app's rate
    if (settle(sails.speed, (c.metrics?.edges["mobile>edge"] ?? 0) / 8, dt, 0.8, calm)) moving = true;
    if (!calm) sails.angle = (sails.angle + sails.speed.x * dt) % 360;
    c.setAttr(sailsEl, "transform", `rotate(${sails.angle.toFixed(2)})`);
    // the weir sheet and the jet thin out with their flows
    c.setVar(fallEl, "--pa-fall", Math.min(1, rateOf(c, "fall") / 300).toFixed(3));
    c.setVar(jetEl, "opacity", Math.min(1, rateOf(c, "jet") / 40).toFixed(3));
    // first light fades in on the first ticks; only reduced motion starts it lit (the settled first
    // paint is calm too, and would otherwise light the water in one step)
    if (water && settle(first, 1, dt, 0.6, c.calm)) moving = true;
    clockGl += calm ? 0 : dt;
    paintWater(calm ? 0.8 : clockGl, !calm);
    c.lamp(0, c.health("ml") === "crit" ? 1 : 0);
    return moving;
  },
});
