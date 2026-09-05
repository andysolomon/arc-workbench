# 3D rendering diagnostic playbook

## Measurement fields

Keep these fields separate rather than collapsing them into “startup time”:

| Field | Meaning |
| --- | --- |
| `interactionStart` | Pointer/key event that begins the user-visible transition |
| `firstMeaningfulFrame` | First frame whose diagnostic signal proves the new scene is drawn |
| `interactionDuration` | Event Timing duration for the triggering interaction |
| `longTaskMax` / `longTaskTotal` | Long-task entries whose start is after the interaction |
| `taskDuration` / `scriptDuration` | Browser main-thread deltas over the transition window |
| `shaderKickoff` | Synchronous duration of the `compileAsync` call itself |
| `shaderReady` | Time from kickoff until the compile promise resolves |
| `firstRender` / `maxRender` | Synchronous `renderer.render` durations |
| `programsAdded` | Renderer program count after warmup minus count before it |
| `activeFps` / `pausedFrames` | Continuous work while active and after pause |

Capture the start offset of every phase and every long task. The relationship
between starts often matters more than a single duration:

- Long task overlaps `buildBodies`: inspect allocations, geometry construction,
  layout, and material setup.
- Long task overlaps synchronous shader kickoff: reduce material topology and
  compile scope.
- Long task starts at first render after readiness: investigate driver/GPU
  first-presentation work, texture/geometry upload, and staged visibility.
- Long tasks arrive with worker responses: inspect texture creation, mipmap
  generation, upload batching, and render invalidation coalescing.

## Three.js warmup scope

`WebGLRenderer.compileAsync(scene, camera)` calls `compile`, and `compile`
traverses the supplied object graph. Hidden descendants are still visited by
that material preparation traversal. For a view transition:

```ts
const activeRoot = mode === 'system' ? systemRoot : scene
const ready = renderer.compileAsync(activeRoot, camera, scene)
```

Use the third `targetScene` argument when the active root is a subtree and
lighting must be collected from the actual scene. Measure `renderer.info.programs`
before and after the call. A stable program-count budget catches accidental
material defines, shader variants, or whole-scene warmups.

Do not assume readiness means the entire first presentation is cheap. On some
browser/driver paths the long task can begin at the first render after the
promise resolves. Correlate timestamps and test on the target GPU/browser.

## Lazy opt-in layers

For labels or other default-off presentation layers, keep the data model cheap:

```ts
interface Node {
  label: THREE.Sprite | null
  labelName: string
}

if (showLabels && !node.label) {
  node.label = makeLabel(node.labelName)
  node.parent.add(node.label)
}
if (node.label) node.label.visible = showLabels
```

On rebuild, dispose optional maps/materials only when they exist. On rename,
update the existing texture if present; otherwise update only `labelName`. When
enabling the layer introduces a shader topology, warm that layer on the
explicit toggle path, not during the default transition.

## Worker and texture lifecycle

- Assign monotonically increasing request IDs and a generation/key for the
  scene state that requested them.
- Transfer the pixel buffer from the worker; reject responses with stale IDs,
  generations, or missing nodes.
- Dispose the old map before replacing it, while preserving shared photo-map
  ownership rules.
- Keep mapped placeholder shader defines stable so a bake result changes a map
  value rather than forcing a new shader variant.
- Measure both worker-response handling and the render after upload; the GPU
  upload may be visible only around presentation.

## Render-loop checklist

The loop should have explicit reasons to continue: animation, input, camera
settling, pending bake/compile, or a visual transition. Otherwise stop. Test
`document.hidden`, an offscreen `IntersectionObserver`, and a paused control
with both frame counters and task-duration deltas. DOM diagnostics should be
throttled and should not force a layout read/write cycle each frame.

## Reporting discipline

Report exact environment and individual samples. Use language such as:

> Program topology fell from 12 to 4 and label creation fell to zero. The
> initial long-task sample improved, but later hot-machine runs were noisier;
> the long task consistently began at first presentation, so the JavaScript
> compile call is not yet proven to be its full cause.

This distinction preserves useful evidence and prevents a benchmark label from
sending the next engineer toward page-load work when the measured interaction
is a view transition.
