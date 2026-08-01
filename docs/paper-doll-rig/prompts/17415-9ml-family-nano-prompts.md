# 17-415 9ml family — Nano Banana material prompts

Proven path (2026-08-01): Nano Banana material pass → deterministic registration
(`npm run paperdoll:normalize-plate`) → intake gates → approve. No GPT pass needed
when Nano's background is already near-Bone. Clear v3 cost $0 this way.

Canon splits this family into TWO swatch sets:
- **70×20 set**: Clear (TRUE NORTH, locked sha 9fd4cf0a50d4), Amber, Cobalt Blue
  → Amber/Cobalt are TRANSFERS from v3 (identical geometry → silhouette-locked).
- **74×21 set**: Frosted, Swirl → different body, need their OWN true north.
  Start from their own staged cutout; attach v3 as the quality/optics standard.

Inputs staged at: `outputs/paper-doll-plates/material-inputs/`

Gates after each: watermark removal → normalize-plate → rail detector
(peak mid-body gradient < 1.75) → born-on-Bone → aspect vs canon → swatch-lock
IoU ≥ 0.985 within a set.

---
## AMBER — transfer (attach INPUT-v3-clear-TRUE-NORTH.png)

Change ONLY the glass material of this bottle from clear to amber. Everything
else in the image stays exactly as it is.

IMMUTABLE — do not alter in any way:
The bottle's silhouette, outline, width, height, proportions, position on the
canvas, scale, neck width, thread rings, shoulder line, base shape, camera
angle, framing, and the seamless warm cream background. Do not move, resize,
re-center, re-crop, or re-proportion anything.

THE ONLY CHANGE — amber glass:
- Warm amber transmitted color with real tonal gradation: denser and darker
  through the thick base and the wall edges, lighter and more luminous where
  the glass thins at the shoulder, neck, and rim.
- Deep, saturated amber is the dominant identity of this bottle. Never
  desaturate, gray out, brown out, or wash the hue.
- The bottle is EMPTY — this is the color of the glass itself, never liquid,
  never a fill level, never a meniscus.
- The warm cream background transmits through the amber walls: the interior
  reads as deep glowing amber, never black, never opaque, never muddy.

KEEP THE OPTICS EXACTLY AS THEY ARE:
The same fire-polished, high-gloss brilliance. The same quiet transparent
mid-body with nothing happening across the center. The same single soft gleam
just inside each wall edge. The same tack-sharp rim, thread ridges, shoulder
step, and heavy base with its clean base ring. The same soft key from the
right. No new stripes, bands, rails, or hard vertical lines anywhere.

No cast shadow. No props, text, cap, or label.

---
## COBALT — transfer (attach INPUT-v3-clear-TRUE-NORTH.png)

Change ONLY the glass material of this bottle from clear to cobalt blue.
Everything else in the image stays exactly as it is.

IMMUTABLE — do not alter in any way:
The bottle's silhouette, outline, width, height, proportions, position on the
canvas, scale, neck width, thread rings, shoulder line, base shape, camera
angle, framing, and the seamless warm cream background. Do not move, resize,
re-center, re-crop, or re-proportion anything.

THE ONLY CHANGE — cobalt glass:
- Saturated cobalt blue transmitted color with real depth: dense, deep blue
  through the thick base and wall edges, with a luminous inner glow where the
  glass thins at the shoulder, neck, and rim.
- Deep, jewel-like cobalt is the dominant identity of this bottle. Never
  desaturate, never darken toward navy-black, never wash or shift the hue.
- The bottle is EMPTY — this is the color of the glass itself, never liquid,
  never a fill level, never a meniscus.
- The warm cream background transmits through the blue walls: the interior
  reads as deep luminous cobalt, never black, never opaque.

KEEP THE OPTICS EXACTLY AS THEY ARE:
The same fire-polished, high-gloss brilliance. The same quiet transparent
mid-body with nothing happening across the center. The same single soft gleam
just inside each wall edge. The same tack-sharp rim, thread ridges, shoulder
step, and heavy base with its clean base ring. The same soft key from the
right. No new stripes, bands, rails, or hard vertical lines anywhere.

No cast shadow. No props, text, cap, or label.

---
## FROSTED — own true north (attach INPUT-frosted-9ml-74mm.png, and
## INPUT-v3-clear-TRUE-NORTH.png as the quality standard)

Re-render this frosted glass bottle as a real studio product photograph. The
first image is the correct product and position. The second image is the
QUALITY STANDARD — match its studio lighting, background, crispness of
structural detail, and overall level of finish, but never copy its clear-glass
transparency or its shape.

KEEP EXACTLY AS SHOWN in the first image:
Silhouette, proportions, height, width, neck width, thread rings, shoulder
line, base shape, position on the canvas, and scale. Do not move, resize,
re-center, or re-proportion anything.

FROSTED GLASS MATERIAL — this is the change:
- Acid-etched, sandblasted frosted glass: the surface DIFFUSES light. The
  bottle is softly translucent and milky, never transparent and never opaque.
- No sharp mirror reflections. Specular highlights are broad, soft, and gentle
  — light spreads across the surface instead of forming a crisp gleam.
- Luminous, velvety, expensive-looking: the glass glows softly where the light
  falls and deepens gently toward the wall edges, with a smooth continuous
  falloff. No stripes, bands, rails, or hard vertical lines anywhere.
- The background is NOT visible through the bottle — the frosting hides it.
  The interior reads as soft warm milky white, never gray, never dirty, never
  a painted flat fill.
- The bottle is EMPTY. No liquid, no fill level, no meniscus.
- Keep crisp structural definition where the object has real form: the rim,
  each thread ridge, the shoulder step, and the heavier base — these read
  sharper than the diffuse body walls.

LIGHTING: one large soft key from the RIGHT, gentle fill from the left.
BACKGROUND: seamless warm cream (#F5F3EF), no horizon line, props, text, or
cast shadow. No cap, no label.

---
## SWIRL — own true north (attach INPUT-swirl-9ml-74mm.png, and
## INPUT-v3-clear-TRUE-NORTH.png as the quality standard)

Re-render this swirl glass bottle as a real studio product photograph. The
first image is the correct product, its swirl pattern, and its position. The
second image is the QUALITY STANDARD — match its studio lighting, background,
crispness of structural detail, and overall level of finish, but never copy
its plain clear-glass body or its shape.

KEEP EXACTLY AS SHOWN in the first image:
Silhouette, proportions, height, width, neck width, thread rings, shoulder
line, base shape, position on the canvas, scale, and — critically — the
SWIRL PATTERN: its helical direction, pitch, and placement are the identity of
this bottle. Do not redesign, straighten, re-space, or restyle the swirl.

SWIRL GLASS MATERIAL — this is the change:
- Fire-polished clear glass formed with a raised helical swirl relief. The
  swirl is GEOMETRY, not a printed pattern: it is a physical ridge in the
  glass, so light catches along the raised crests and refracts between them.
- Denser swirl sections read more saturated and optically deep; thinner
  sections read more transparent. Render that variation — never a uniform,
  flat, or evenly-stamped pattern.
- Crisp specular highlights ride ALONG the raised swirl crests, following the
  helix. Between the ridges the glass stays quiet and transparent, showing the
  warm background with gentle refraction.
- High-gloss and brilliant, never chalky or matte. No liquid, no fill level.
- Keep tack-sharp definition at the rim, thread ridges, shoulder step, and the
  heavy base with its clean base ring.
- No barcode-like straight vertical stripes, painted rails, or hard vertical
  lines — the only linear structure in this bottle is the helical swirl itself.

LIGHTING: one large soft key from the RIGHT, gentle fill from the left.
BACKGROUND: seamless warm cream (#F5F3EF), no horizon line, props, text, or
cast shadow. No cap, no label.
