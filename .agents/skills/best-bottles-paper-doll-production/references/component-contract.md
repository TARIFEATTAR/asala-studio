# Component contract

## Authority hierarchy

1. Verified CAD/Blender geometry calibrated to physical dimensions.
2. Approved clean photographic silhouette calibrated on real pixels.
3. Reference image as material evidence only.
4. Generated output as a mutable candidate only.

`geometryLocked=true` requires byte-identical alpha after the server-side authority-mask clamp. IoU alone is insufficient.

## Four boxes

| Box | Coordinate space | Purpose |
|---|---|---|
| `sourceBoundsPx` | original upload | Non-transparent/foreground pixels used from the preserved original file. |
| `editBoundsPx` | original upload | Operator-selected generation/in-paint region. |
| `authorityBoundsPx` | 2080×2288 plate | Immutable silhouette occupied bounds. |
| `placementBoundsPx` | 2080×2288 assembly | Uniform-scale transform fitted to a body family. |

Never stretch an upload to the canvas. Normalize its source bounds into the authority bounds, copy exact authority alpha, then place the resulting layer.

## Topology gate

Measure the actual object, not the image frame. Calibrate extraction per file and record the stable threshold range. Reject empty masks, frame masks, frame contact, clipping, and unexpected detached regions. Decorative stones remain stable interior pixels and do not expand the cap silhouette.

## Lifecycle states

`candidate → pixels-approved → family-fit-approved → placement-locked → released → sanity-draft → published`

`rejected` is terminal for that immutable candidate. History is append-only; create a new version for every correction.
