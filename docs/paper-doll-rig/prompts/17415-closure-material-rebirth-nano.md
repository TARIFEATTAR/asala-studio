# 17-415 closure rebirth — Nano Banana material pass

**Why this exists.** The harvested PSD closures fail on two measured counts:

| | measured | needed |
|---|---|---|
| Resolution | 290px across a 20mm cap = **14.5 px/mm**, 0.66× master | ≥22 px/mm |
| Tone | spans the full **0–255, clipped at both ends** | 26–244, clipping nowhere |

The light *direction* is already correct — the over-cap's key highlight sits at 75%
across, against 74–86% on the bodies. So this is not a relight. It is a **material +
resolution rebirth under the same light contract**, which is exactly the two-image
optical-transfer move that produced the five locked bodies.

Sources extracted to `outputs/paper-doll-plates/cap-regen-sources/` (19 closures).

---

## Inputs — attach BOTH images, in this order

1. **Image 1 — geometry authority:** the closure PNG from `cap-regen-sources/`
   (e.g. `CpRoll17-415ShnSl.png`). Its shape, proportions and camera angle are law.
2. **Image 2 — light and material authority:** `_LIGHTING-REFERENCE-clear-plate.png`.
   The closure must end up looking like it was photographed in *that* session.

Attaching Image 2 is what carries the bottles' lighting across. Without it the model
invents its own studio and the part will never sit right.

## Framing — read before generating

Ask for the **largest output the model offers**, portrait, with the closure filling
roughly 90% of the frame height and centered. We need ≥22 px/mm; at 20mm wide that
means the closure must span **at least 440px**, and more is strictly better since
every catalog use is then a downsample. These parts serve every bottle that takes a
17-415 neck, not just the 9ml — a part reborn too small has to be upscaled again on
the smaller bottles, which is the defect we are removing.

---

## PROMPT — shared preamble (use verbatim for every closure)

> Re-photograph this closure as a real studio product photograph, matching the
> lighting and material quality of the second reference image.
>
> **WHAT THIS PART IS MADE OF — this matters more than anything else in this prompt:**
> This is a moulded phenolic plastic closure with a bright metallized chrome finish.
> It is NOT aluminium, NOT machined metal, NOT anodised. It is plastic that has been
> vacuum-metallized, so it is glassy and mirror-bright — there is no brushed grain,
> no machining marks, no directional metal texture anywhere on it.
>
> **WHAT IS WRONG WITH THE FIRST IMAGE:** the chrome collapses to pure black and
> pure white with almost nothing in between, so it reads as flat graphic shapes
> instead of a real object.
>
> **HOW THIS FINISH ACTUALLY READS — build the material this way:**
> - You are photographing a mirror inside a warm, softly-lit cream room, so what the
>   chrome shows is that room: a soft bright band where the key light reflects,
>   easing into warm mid-greys where it reflects the cream background, settling into
>   a gentler darker turn on the far side.
> - Nothing in that room is pure black and nothing is paper white, so the reflection
>   never reaches either. The darkest area stays a deep warm grey. The full range of
>   mid-tones stays visible.
> - The surface is perfectly smooth and glassy — wet-looking, liquid, high-gloss.
>   Reflections are crisp and continuous, never broken up by texture.
> - Crisply moulded top rim with one clean bright highlight along the edge.
> - Precise and expensive: a glossy chrome-finished moulding, not a dull satin metal
>   and not a hard graphic mirror.
>
> **LIGHTING:** one large soft key from the RIGHT, gentle fill from the left. Clean
> speculars — soft-edged but genuinely bright. Match the second reference image
> exactly: the same soft key direction, the same restraint, the same warmth.
>
> **MATERIAL AND MOOD:** premium apothecary product photography — polished luxury.
> Warm, precise, expensive, composed. Refined, never gaudy: no dramatic contrast,
> no blown hotspots, no coloured reflections, no rainbow dispersion, no plastic
> CGI sheen.
>
> **BACKGROUND:** seamless warm cream (#F5F3EF), no horizon line, no props, no
> text, no cast shadow, nothing beneath the closure.
>
> **KEEP EXACTLY AS SHOWN IN THE FIRST IMAGE:** the closure's silhouette,
> proportions, height-to-width ratio, the exact camera angle, and precisely how
> much of the top face is visible. Show the closure alone — no bottle, no neck, no
> glass. This is the correct part; only the material rendering and resolution change.

---

## PROMPT — per-colorway material block

Append **one** of these to the preamble, replacing nothing else.

Never use the words *aluminium*, *anodised*, *brushed*, *machined* or *metal* in these
lines. Every one of them pulls the model toward a milled aluminium part with a grain,
which is the failure this pass exists to correct. Name the **finish**, not a metal.

| file | append this line |
|---|---|
| `CpRoll17-415ShnSl` | **FINISH: bright chrome-silver — a cool neutral mirror finish, glassy and liquid-smooth.** |
| `CpRoll17-415MattSl` | **FINISH: soft matte silver — the same moulded closure with a smooth low-gloss silver coating; even and powdery-soft, with one broad diffuse sheen instead of a mirror reflection. Still perfectly smooth, with no grain or texture.** |
| `CpRoll17-415ShnGl` | **FINISH: bright chrome-gold — a warm yellow-gold mirror finish, luminous and rich, never brassy or orange.** |
| `CpRoll17-415MattGl` | **FINISH: soft matte gold — a smooth low-gloss warm gold coating with one broad diffuse sheen instead of a mirror reflection. Perfectly smooth, with no grain or texture.** |
| `CpRoll17-415ShnBlk` | **FINISH: glossy black — deep neutral black with a wet, liquid, high-gloss surface and a clean bright highlight along the top rim; the body stays readable, never a flat silhouette.** |
| `CpRoll17-415Cu` | **FINISH: bright chrome-copper — a warm rose-copper mirror finish, rich and luminous.** |
| `CpRoll17-415White` | **FINISH: smooth glossy white — clean neutral white with soft even shading that keeps the cylinder's roundness clearly readable.** |
| `CpRoll17-415SlDot` | **FINISH: bright chrome-silver mirror, set with small clear crystal rhinestones in the same pattern and positions as the first image — each stone crisp and faceted, catching one small bright glint.** |
| `CpRoll17-415BlkDot` | **FINISH: glossy black, set with small clear crystal rhinestones in the same pattern and positions as the first image — each stone crisp and faceted, catching one small bright glint.** |
| `CpRoll17-415PnkDot` | **FINISH: soft matte pink, set with small clear crystal rhinestones in the same pattern and positions as the first image — each stone crisp and faceted, catching one small bright glint.** |

**Sprayers and lotion pumps** (`Spry17-415*`, `Ltn17-415*`) use the same preamble
plus the matching colour line, with this appended:

> The white pump head and its collar are smooth matte white moulded plastic — clean,
> even, and slightly soft in the shading. The metal sleeve below it follows the
> colour line above. Keep the two materials clearly distinct.

---

## After generation — hand back to Madison

1. **Background removal.** Do NOT colour-key against Bone: the background is
   *reflected in the metal*, so keying by colour will punch holes in the part. Use an
   ML matte (fal.ai BiRefNet / RMBG, or Madison's own remove-background) which handles
   reflective surfaces.
2. **Drop the cutouts back** into `outputs/paper-doll-plates/cap-regen-sources/reborn/`.
3. Madison runs `npm run paperdoll:intake`, which gates each part on alpha coverage,
   edge halo vs a local neighbourhood, disjoint-region junk, key-side detectability
   and mm-resolution floor, then SHA-freezes it.
4. Anything that passes replaces the current component entry; the placement recipe in
   `closure-placement-recipe.json` is unchanged — flush to body width, seat y=1002.

**Note on tone harmonization.** `harmonizeToneRange()` stays in the engine as rung 1
of the lighting ladder for parts we never rebirth. Reborn parts should land on the
26–244 contract natively; if intake still measures clipping, harmonization is the
fallback rather than the fix.

---

## The four remaining parts — over-caps and rollers

Corrects an earlier call of mine: I said the spray and lotion over-caps were missing
from the estate. **They are not.** They are worn on the *capped* SKUs
(`17-415 Bottles/10. Clear (Capped)/GBCyl9Spry*`, `LBCyl9Ltn*`) and are translucent
frosted-plastic hoods, not metal. Both are now harvested. The two roller balls come
from the *uncapped* SKUs in the same family.

| file in `cap-regen-sources/` | part | source density |
|---|---|---|
| `OverCap17-415-Spray-Translucent.png` | spray over-cap | 0.57× master |
| `OverCap17-415-Lotion-Translucent.png` | lotion over-cap | 0.57× master |
| `RollerBall17-415-Metal.png` | metal roller ball | 0.70× master |
| `RollerBall17-415-Plastic.png` | plastic roller ball | 0.70× master |

Use the **same shared preamble** above, with these substitutions.

### Translucent over-caps (spray + lotion)

Replace the metal material block with:

> **HOW THIS PLASTIC ACTUALLY READS — build the material this way:**
> - Translucent frosted polypropylene: milky and light-diffusing, so the form is
>   read through soft internal glow rather than surface reflection.
> - The wall reads slightly denser where the cylinder turns away at each side, and
>   is at its most transparent through the middle, where the part behind it is
>   faintly and softly visible.
> - A soft broad sheen on the lit side — diffuse and wide, never a hard mirror
>   highlight. One gentle bright edge along the top dome where it catches the key.
> - Clean crisp silhouette. The frosting is smooth and even, never grainy, chalky
>   or speckled.

Append for lotion only:

> Keep the small circular moulding detail on the face exactly where the first image
> places it.

**Do not put a bottle behind these.** Generate the hood alone on Bone — the composite
engine handles what shows through.

### Roller balls

Replace the metal material block with:

> **THE PART:** a roller-ball fitment — a ball seated in a clear moulded plastic
> housing with a flanged collar at the base.
> - The housing is clear, precise, injection-moulded plastic: crisp edges, clean
>   internal structure, gently visible wall thickness.
> - The collar flange at the base stays sharply defined.
> - Show the fitment alone — no bottle, no neck, no glass beneath it.

Then append **one**:

| file | append |
|---|---|
| `RollerBall17-415-Metal` | **THE BALL: polished stainless steel — a real metal sphere with a bright compact specular highlight and a soft dark turn away from the key. Cool neutral steel, unmistakably metal.** |
| `RollerBall17-415-Plastic` | **THE BALL: frosted white polypropylene — a soft matte dome that diffuses light evenly, with no mirror highlight. Unmistakably plastic, not metal.** |

That metal-vs-plastic distinction is the one that has already gone wrong once — the
roll-on over-caps are phenolic plastic even in gold and silver colourways, and only
the roller ball is ever steel. Keep the two prompts strictly apart.

---

## Defect found while staging — re-harvest required

**`closure__17-415__metal-roller-ball__natural` is 72.8% opaque pure-white junk.**
The frozen 365×331 asset carries a large white patch welded to the roller; the
plastic sibling measures 0.0%. `countSignificantForegroundRegions` passed it because
the junk is *contiguous* with the part, so it reads as one region — a real gap in the
intake gate, and the same "threshold assumes a material" family of failure as the
others. The recropped 184×165 source in this folder replaces it. **Do not composite
the current frozen metal roller into anything shipped.**

Gate to add at intake: opaque-pure-white fraction, which would have caught this on
day one.

## One thing regeneration should NOT touch

**The dot/rhinestone caps carry per-stone placement.** Generation will not reproduce
stone positions faithfully. If catalog fidelity requires it, `SlDot`, `BlkDot` and
`PnkDot` should stay harvested cutouts and take tone harmonization instead.
