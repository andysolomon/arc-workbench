---
name: arc-webgl-performance
description: >
  Profile and improve performance in browser applications with Three.js,
  WebGL, Canvas, or other continuously rendered 3D scenes. Use when adding or
  debugging scene construction, shader/material warmup, procedural generation,
  texture baking, orbit or camera transitions, animation loops, visibility and
  pause behavior, or performance budgets and CI benchmarks.
---

# 3D Web Performance

Use this skill to make rendering performance an acceptance criterion. Preserve
visual behavior while reducing main-thread work, GPU-driver stalls, shader
topology, texture uploads, and unnecessary steady-state rendering.

## Operating rules

- Inspect the renderer, scene graph, invalidation paths, worker boundaries, and
  benchmark harness before changing code.
- Preserve unrelated user changes. Use the project's package manager and test
  commands; prefer Bun when the project supports it.
- Do not call a full-scene shader warmup for a view transition. Three.js
  `compileAsync` traverses hidden descendants when given the whole scene; pass
  the smallest active `Object3D` subtree and the real target scene for lights.
- Treat opt-in layers as lazy resources. Do not create hidden canvas labels,
  sprites, geometries, textures, materials, or shader variants until enabled.
- Keep procedural pixel/noise loops in workers and transfer buffers. Cancel or
  ignore stale results, and dispose replaced textures and geometries explicitly.
- Keep value-only edits on existing materials. Avoid `needsUpdate` and shader
  topology changes unless the material definition actually changed.
- Never add an unconditional `requestAnimationFrame` loop. Render on demand
  while paused; suspend when the document is hidden or the canvas is offscreen;
  reduce passive animation cadence when product requirements allow it.
- Cap device-pixel resolution and provide adaptive quality for sustained slow
  frames. Avoid compositor-heavy effects such as backdrop blur over a live
  canvas.

## Required workflow

### 1. Define the measured interaction

Name the exact transition and metric window. A benchmark that stamps
`clickStart` on `pointerdown` measures work after that interaction, not page
startup. Record the trigger, first meaningful frame, long-task window, and
steady-state/paused windows separately.

Before editing, capture a same-browser baseline with repeated runs. Keep the
machine, viewport, device scale factor, CPU throttle, scene contents, and
browser launch mode constant. Use medians, but retain individual samples so
driver and shared-runner variance is visible.

### 2. Attribute before optimizing

Instrument the suspected path with `performance.mark`/`performance.measure`
around distinct phases:

- state regeneration and scene construction;
- geometry/material/ring/label creation;
- worker response handling and texture upload setup;
- shader warmup kickoff and readiness;
- first render and the largest later render;
- first meaningful frame and any GPU/program count diagnostics.

Also retain long-task start offsets relative to the interaction. Compare their
starts to the phase measures. A long task beginning at first render after
`compileAsync` readiness is evidence for first-presentation browser/driver
work, not proof that JavaScript shader kickoff is the culprit. Do not rename a
metric “startup” unless its window is page startup.

### 3. Reduce the highest-confidence cost

Prefer changes that reduce work without changing the scene’s visible result:

1. Exclude hidden scene branches from `compileAsync` and warm only active
   material topology.
2. Defer default-off resources, especially per-body canvas label textures and
   sprites. Create them on first enable, reuse while hidden, and dispose on
   rebuild.
3. Move deterministic procedural rasterization to a module worker. Transfer
   `ArrayBuffer`s; latest-wins cancellation must prevent stale uploads.
4. Reuse immutable geometry/material resources and share shader topology where
   possible. Keep per-instance colors, maps, and uniforms as values.
5. If first presentation still stalls, test staged visibility or resource
   uploads across frames. Measure whether the long-task maximum falls without
   making the transition feel incomplete.

Do not hide work from the benchmark by moving it to page startup or by
weakening budgets. If idle prewarming is chosen, measure its startup and idle
cost as a separate acceptance criterion.

### 4. Verify behavior and resource ownership

Run the project's typecheck, lint, unit tests, build, bundle-size checks, and
relevant Playwright/browser tests. For a 3D change, also verify:

- paused and hidden/offscreen frames stop as promised;
- no stale worker result changes the current scene;
- toggling an opt-in layer creates the expected geometry/triangles and hiding
  it removes draw work without leaking resources;
- renames and presentation-only edits do not rebuild baked maps;
- shader/program counts and first-render timing stay within the budget;
- console/page errors remain zero.

Run a one-sample smoke benchmark during iteration and a three-run median before
handoff. Compare before/after on the same environment. Treat a result as
unproven when the run-to-run spread is larger than the apparent improvement.

### 5. Keep guardrails with the feature

Store enforceable limits in the project’s performance-budget source of truth.
Include absolute limits for interaction, long tasks, task time, frame rate,
paused work, bundle size, errors, and any stable topology metric such as
transition-added shader programs. For hosted CI, use a documented runner
profile only when the hardware cannot meet developer-machine absolute limits;
retain a same-runner relative comparison with a noise floor.

Update the implementation plan, progress log, project agent guidance, and
performance results with the measured decision. Record both improvements and
limits: a lower program count with an unchanged noisy long task is useful
evidence, not permission to claim a complete fix.

## Reference playbook

For detailed attribution patterns, benchmark field suggestions, and Three.js
resource-lifecycle examples, read [diagnostic-playbook.md](references/diagnostic-playbook.md).
