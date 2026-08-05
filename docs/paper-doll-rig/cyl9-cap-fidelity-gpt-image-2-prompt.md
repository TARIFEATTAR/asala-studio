# CYL-9ML roll-on over-cap — GPT Image 2 fidelity prompt

**Model:** `gpt-image-2` · **Mode:** image edit with references · **Size:** 2080×2288 (or 2:3 then normalize)

## Reference attachment order (do not reorder)

1. **Image 1 — GEOMETRY + PATTERN AUTHORITY.** The 2020 PSD designer-cutout cap layer.
   Supplies silhouette, proportions, camera angle, and dot pattern/positions.
2. **Image 2 — LIGHT + MATERIAL AUTHORITY.** Crop of the locked clear body plate
   (`_LIGHTING-REFERENCE-clear-plate.png`). Supplies key direction, softness, warmth, tone limits.

References go **before** the text. That ordering is what makes the model treat them as
things to preserve rather than things to reinterpret.

## Prompt

```
Re-render the closure in the first image at high resolution. This is a fidelity pass, not a
redesign: the part is already correct. Only the rendering quality changes.

GEOMETRY — LOCKED. Copy from the first image exactly; any deviation makes the output unusable:
- Silhouette and proportions: a straight-walled cylinder with a softly radiused top edge.
  Width-to-height ratio is 0.686. Do not slim, widen, taper, or round the body.
- The wall is dead straight from the top radius to the bottom cut. No bulge, no waist, no draft.
- The bottom edge is a clean horizontal cut — a shallow arc, not a deep curve, not a foot,
  not a flange, not a lip.
- The top corner radius is tight and even all the way around.
- Fill the frame the same way the first image does. Do not add margin or rescale the part.

CAMERA — DEAD LEVEL. This is a straight-on elevation view at the mid-height of the closure:
- The camera is NOT raised and does NOT look down. Match the first image's angle exactly.
- Because the camera is level, the top face is almost edge-on: you see only a shallow curved
  sliver whose depth is about 6% of the closure's width. It reads as a thin arc, not a surface.
- Do NOT render the top as a disc, an oval, or any wide ellipse. A visible top face means the
  camera was raised, and that is wrong.
- No perspective convergence: left and right walls stay parallel and vertical.

WHAT THIS PART IS MADE OF — this matters more than anything else here:
A moulded phenolic plastic closure with a metallized finish. It is NOT aluminium, NOT machined
metal, NOT anodised. There is no brushed grain, no machining marks, no directional metal
texture, and no knurling anywhere on it.

FIDELITY — what this pass is actually for:
- Resolve the surface cleanly at full resolution: smooth, continuous, injection-moulded.
- The top radius carries one clean, unbroken specular highlight that follows the curve.
- The silhouette edge is crisp and continuous — no fringing, no halo, no soft double edge,
  no stray pixels, no dust, no speckle, no scratches, no fingerprints, no debris.
- The surface is flawless: this is a new, unused production part photographed for a catalog.

{FINISH_BLOCK}

LIGHTING: one large soft key from the RIGHT, gentle fill from the left. Clean speculars —
soft-edged but genuinely bright. Match the second reference image exactly: same key direction,
same restraint, same warmth.

TONE LIMITS: nothing reaches pure black and nothing reaches paper white. The darkest zone stays
a deep warm grey; the brightest stays just short of white. Never clip either end.

BACKGROUND: seamless warm cream #F5F3EF. No horizon line, no props, no text, no reflection
beneath the part, no cast shadow, no contact shadow.

SHOW THE CLOSURE ALONE: no bottle, no neck, no glass, no roller, no threads, no packaging,
no hand, no label, no branding, no text of any kind.
```

## FINISH_BLOCK variants

**Mirror finishes** (SSLV, SGLD, MCPR, SBLK) — a mirror shows the room, not a soft gradient:

```
FINISH: {bright chrome-silver, a cool neutral mirror | bright chrome-gold, warm and luminous,
never brassy | bright chrome-copper, warm rose-copper | deep glossy black, wet and liquid}.
This is a mirror: it reflects the room as distinct vertical bands with CRISP, SHARP boundaries.
Reading across the cylinder there are separate, sharply divided vertical zones — a deep warm-grey
band where the surface turns away, a brilliant near-white band reflecting the softbox, a warm
cream zone reflecting the background, and another crisp dark band at the far turn. Hard edges
between them, sharp enough that you could almost make out shapes. Never a soft airbrushed blend.
```

**Matte finishes** (MSLV, MGLD, PKDT base, WHT):

```
FINISH: soft {matte silver | matte gold | matte pink | glossy white} — a smooth low-gloss
coating. One broad, soft, diffuse sheen down the lit side rather than a mirror reflection,
easing gently into mid-tones and a soft darker turn on the far side. Perfectly smooth and even
— soft and powdery in its light response, never grainy, textured, speckled or brushed. The full
range of mid-tones stays visible.
```

**Dotted caps** (SLDT, BKDT, PKDT) — append to the finish block:

```
Decorated with small recessed circular dimples in the same pattern, count, and positions as the
first image — same rows, same spacing, same placement. Each dimple is a shallow moulded
depression with a smooth mirror-shine surface inside that catches one small bright specular
glint. They are part of the moulded cap surface: NOT attached stones, NOT crystals, NOT
faceted gems, NOT drilled holes, NOT printed dots. Each one is clean and identical — no
smearing, no debris, no dark rings.
```

## Why the constraints are shaped this way

Every rule maps to an observed failure:

| Constraint | Failure it prevents |
|---|---|
| 0.686 ratio + straight wall | taper/bulge drift → mask stretch artifacts |
| 6% top arc + "not a disc" | raised camera → cap can't seat on a level-shot bottle |
| "phenolic, metallized, never aluminium" | milled-aluminium grain (documented 2026-08-01) |
| "recessed dimples, not crystals" | faceted rhinestones (wrong product, confirmed 2026-08-04) |
| explicit debris/dust/scratch negatives | the exact defects rejected in the 2020 photography |
| tone limits | clipped blacks/whites that break the family light contract |
| no cast/contact shadow | shadow is a composite-level contract, not baked per component |

## After generation

Output still goes through the deterministic path — the prompt never owns final geometry:

1. `normalizeMaterialIntoAuthority()` → bounded into `closure__17-415__rollon-overcap__v2__mask.png`
2. QA gate: `geometryLocked === true`, `minIoU === 1`, `mismatchedPixels === 0`
3. Register as component candidate → review → release cut

If the generated aspect ratio deviates more than ~5% from the mask, reject and regenerate
rather than letting the stretch absorb it.
