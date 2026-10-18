// The copying linkage of Fig 7, as plain geometry shared by the build (rest pose, recorded shapes)
// and the page (rebuilt every frame). An elbow drafting machine: a base plate clamped to the table's
// back edge, an upper parallelogram, an elbow plate, a lower parallelogram and a head plate. Two
// parallelograms in series keep the head from turning, so the long copy beam it carries only
// translates, and the three styluses on the beam draw the same stroke on the master and both copies.
// kit: { extrude, solidSvg, iso, pathOf, cylinder, ring, dotsSvg }; L: the dimensions from the build.
export function makeLinkage(kit, L, P) {
  const { extrude, solidSvg, iso, cylinder, ring, dotsSvg } = kit;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, s) => [a[0] * s, a[1] * s];
  const len = (a) => Math.hypot(a[0], a[1]);
  const rot = (a, t) => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
  const hull = (points) => {
    const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (const p of pts.reverse()) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
  };
  // the convex hull of circles of radius r round each point: bars (two points) and plates (three)
  const rounded = (points, r, steps = 10) => hull(points.flatMap((p) => Array.from({ length: steps * 2 }, (_, j) => add(p, [r * Math.cos((j / (steps * 2)) * Math.PI * 2), r * Math.sin((j / (steps * 2)) * Math.PI * 2)]))));
  const depth = (p) => p[0] * Math.cos((P.azimuth * Math.PI) / 180) + p[1] * Math.sin((P.azimuth * Math.PI) / 180);

  // two-link inverse kinematics, elbow to the right of the base: the head pivot K from the stylus H
  function solve(H) {
    const K = add(H, L.headBack);
    const d = sub(K, L.O);
    const dist = Math.min(len(d), 2 * L.arm - 1e-6);
    const phi = Math.acos(dist / (2 * L.arm));
    const E = add(L.O, mul(rot(mul(d, 1 / len(d)), -phi), L.arm));
    return { H, K, E };
  }

  // every solid at stylus position H, in paint order (bottom to top: the bands never interleave)
  function parts(H, lift = 0) {
    const { K, E } = solve(H);
    const { O, p, q, z } = L;
    const out = [];
    const holders = L.offsets.map((o) => [H[0] + o, H[1]]).sort((a, b) => depth(a) - depth(b));
    for (const c of holders) {
      out.push({ kind: "round", name: `link.collar.${c[0].toFixed(0)}`, c, r: 2.6, z: z.collar[0], h: z.collar[1] - z.collar[0], mat: "brass", tone: "mid" });
      out.push({ kind: "round", name: `link.rod.${c[0].toFixed(0)}`, c, r: 0.85, z: z.rod[0] + lift, h: z.rod[1] - z.rod[0] - lift, mat: "steel", tone: "hi" });
      out.push({ kind: "round", name: `link.tip.${c[0].toFixed(0)}`, c, r: 0.45, z: z.tip[0] + lift, h: z.tip[1] - z.tip[0], mat: "steel", tone: "hi", master: Math.abs(c[0] - H[0]) < 1e-6 });
    }
    out.push({ kind: "prism", name: "link.beam", ring: rounded([[H[0] + L.beam[0], H[1]], [H[0] + L.beam[1], H[1]]], L.beamW, 8), z: z.beam[0], h: z.beam[1] - z.beam[0], mat: "steel", tone: "hi" });
    out.push({ kind: "prism", name: "link.head", ring: rounded([K, add(K, q), [H[0] - 5, H[1]], [H[0] + 5, H[1]]], 2.6), z: z.head[0], h: z.head[1] - z.head[0], mat: "gunmetal", tone: "mid" });
    const lower = [[E, K], [add(E, q), add(K, q)]].sort((a, b) => depth(add(a[0], a[1])) - depth(add(b[0], b[1])));
    lower.forEach(([a, b], i) => out.push({ kind: "prism", name: `link.lower.${i}`, ring: rounded([a, b], L.barW), z: z.lower[0], h: z.lower[1] - z.lower[0], mat: "steel", tone: "hi", pins: [b] }));
    out.push({ kind: "prism", name: "link.elbow", ring: rounded([E, add(E, p), add(E, q)], 2.8), z: z.elbow[0], h: z.elbow[1] - z.elbow[0], mat: "gunmetal", tone: "mid", pins: [E, add(E, q)] });
    const upper = [[O, E], [add(O, p), add(E, p)]].sort((a, b) => depth(add(a[0], a[1])) - depth(add(b[0], b[1])));
    upper.forEach(([a, b], i) => out.push({ kind: "prism", name: `link.upper.${i}`, ring: rounded([a, b], L.barW), z: z.upper[0], h: z.upper[1] - z.upper[0], mat: "steel", tone: "hi", pins: [a, b] }));
    return out;
  }

  const pinsSvg = (pins, z) =>
    `<path class="iso-line" data-tone="lo" d="${pins.map((c) => ring(c[0], c[1], 1.15, z, P, 14)).join("")}"/>` + dotsSvg(pins.map((c) => iso([c[0], c[1], z], P)), { size: 0.45, tone: "mid" });
  function svg(H, lift = 0) {
    let out = "";
    for (const part of parts(H, lift)) {
      const paths = part.kind === "round" ? cylinder(part.c[0], part.c[1], part.r, part.z, part.h, P, part.r < 1 ? 12 : 20) : extrude(part.ring, part.z, part.h, P, { bevel: 0.3 });
      out += `<g data-mat="${part.mat}">${solidSvg(paths, { tone: part.tone, crease: "lo" })}</g>`;
      if (part.pins) out += pinsSvg(part.pins, part.z + part.h);
      // the beam is a drafting scale: ticks rooted on its front edge, a longer one every fifth
      if (part.name === "link.beam") {
        const zt = part.z + part.h;
        const y = H[1] + L.beamW - 0.15;
        let minor = "";
        let major = "";
        for (let i = 0, x = H[0] + L.beam[0] + 4; x <= H[0] + L.beam[1] - 4; i++, x += 4) {
          const seg = `M${iso([x, y, zt], P).map((v) => v.toFixed(2)).join(" ")}L${iso([x, y - (i % 5 ? 0.9 : 1.7), zt], P).map((v) => v.toFixed(2)).join(" ")}`;
          if (i % 5) minor += seg;
          else major += seg;
        }
        out += `<path class="iso-line" data-tone="lo" d="${minor}"/><path class="iso-line" data-tone="mid" d="${major}"/>`;
      }
      if (part.master) {
        const t = iso([part.c[0], part.c[1], part.z], P);
        out += `<circle class="rr-tip" cx="${t[0].toFixed(2)}" cy="${t[1].toFixed(2)}" r="${(0.75 * L.scale).toFixed(2)}"/>`;
      }
    }
    return out;
  }
  return { solve, parts, svg, rounded, hull };
}

// the page the master stylus writes: three lines of cursive loops (a prolate cycloid with a slow
// swell, so no two loops are alike), and the pen-up moves between them. Points are master-tablet
// local [u, v, down] every ~0.5 units; `down` is 0 while the pen travels to the next line.
export function glyph({ u0 = -19, u1 = 19, lines = [-8.5, 0, 8.5], loops = 7, amp = 2.6, step = 0.5 } = {}) {
  const out = [];
  const lineAt = (vc, t, k) => {
    const swell = 1 + 0.22 * Math.sin(2 * Math.PI * (1.7 * t + 0.37 * k)) + 0.12 * Math.sin(2 * Math.PI * (4.3 * t + k));
    return [u0 + (u1 - u0) * t + amp * 0.95 * swell * Math.cos(2 * Math.PI * loops * t + Math.PI / 2), vc - amp * swell * Math.sin(2 * Math.PI * loops * t)];
  };
  const push = (p, down) => {
    const last = out[out.length - 1];
    if (!last) return out.push([p[0], p[1], down]);
    const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
    const n = Math.max(1, Math.ceil(d / step));
    for (let i = 1; i <= n; i++) out.push([last[0] + ((p[0] - last[0]) * i) / n, last[1] + ((p[1] - last[1]) * i) / n, down]);
  };
  lines.forEach((vc, k) => {
    const start = lineAt(vc, 0, k);
    if (out.length) push(start, 0);
    else out.push([start[0], start[1], 1]);
    for (let i = 1; i <= 600; i++) push(lineAt(vc, i / 600, k), 1);
  });
  return out;
}
