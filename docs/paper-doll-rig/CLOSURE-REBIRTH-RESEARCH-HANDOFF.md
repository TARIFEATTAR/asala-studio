# Handoff — closure rebirth for the Best Bottles Paper-Doll Rig

**Date:** 2026-08-01 · **Repo:** `madison-app` · **Branch:** `codex/best-bottles-product-hub-pipeline` (all work uncommitted)

---

## The research question

**How do we produce N colourway variants of one physical closure such that every
variant is pixel-identical in silhouette, while the surface finishes differ
correctly (mirror chrome vs matte coating vs glossy black vs translucent)?**

This is the blocker. Everything else in the rig works.

---

## Why it matters — the architecture in one paragraph

The Paper-Doll Rig generates each bottle body **once**, then composites closures
onto it deterministically. A product page shows the same bottle in cap-on and
cap-off states and in many closure colourways. Those are layer swaps over one
body plate — not regenerations. **That only works if every closure in a family
occupies exactly the same silhouette.** If the silver cap and the gold cap are
different shapes, swapping colourways visibly changes the product. Design of
record: `docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md`.

---

## What is already locked and working — do not redo

**Five true-north body plates** (17-415 9ml Cylinder: clear, amber, cobalt,
frosted, swirl), SHA-frozen in `docs/paper-doll-rig/body-plate-registry.json`,
assets in `assets/paper-doll/body-plates/`. Verified mutually consistent:

| | spread across all five |
|---|---|
| neck silhouette width (mean over the 211px strip y=760–971) | 4px |
| centreline | 3px |
| mid-body width | 2px (363–365px) |

Because the necks agree, **one closure recipe seats on every colourway with no
per-bottle tuning** — frozen at `docs/paper-doll-rig/closure-placement-recipe.json`
(flush to body width 363px, seat y=1002, canvas 2080×2288, Bone `#F5F3EF`).
Proof composites: `outputs/paper-doll-plates/fit-proof/`.

---

## What failed

23 closures were regenerated via Gemini 3 Pro Image (`npm run paperdoll:regen-closures`),
each from its own source PSD. Individually they look good — correct chrome
mirror material, level camera, high resolution, no clipping. **Collectively they
are unusable.**

Measured across the ten roll-on over-caps:

- **aspect spread 71%** (0.563 – 0.964)
- **silhouette IoU vs the silver: as low as 0.3475**, against the spec gate of **≥0.985**

They are ten different caps, not one cap in ten finishes. Root cause: each
colourway was generated independently from its own PSD, so each invented its own
framing, distance and proportion. Nothing tied them together.

**The doctrine that works exists and was not applied here.** The five bodies
succeed because ONE clear plate was born and the others derived from it with the
clear as geometry authority. The closures skipped that step.

Outputs: `outputs/paper-doll-plates/cap-regen-sources/reborn/` (23 files).

---

## What has been proven to work

Deterministic tinting of one master. Same pixels, hue shifted — silhouette
identity guaranteed by construction, not gated after the fact.
`outputs/paper-doll-plates/cap-regen-sources/derived/_DERIVED.png` shows silver →
gold / copper / pink at **IoU 1.0000, $0**. Luminance drives the tint so every
reflection band boundary stays exactly where it was.

**This covers the chrome family only.** The open cases are below.

---

## The actual open problems

1. **Matte finishes cannot be tinted from a mirror.** A mirror shows sharp-edged
   reflected bands; a matte coating shows one soft diffuse gradient. Different
   reflection structure, not different hue. Candidate approaches: deterministic
   blur-and-compress of the master's bands; or gated generation using the master
   as geometry authority. Unproven either way.
2. **Glossy black and white** likewise change the tonal structure, not just hue.
3. **Rhinestone variants** (`SlDot`, `BlkDot`, `PnkDot`) carry per-stone
   placement that generation will not reproduce faithfully. Compositing stones
   onto the master is the likely answer.
4. **Master selection.** Everything inherits from it, so it is worth many
   generations to get one right. Current best candidate is the re-rolled chrome
   silver (aspect 0.66 vs source 0.684, top-arc 7.4%, clean frame) — not yet
   locked. Open question: master the mirror and derive matte, or master the
   matte and derive mirrors?
5. **Same problem, other part classes.** Sprayers (6), lotion pumps (3),
   translucent over-caps (2), roller balls (2) all need the same treatment.

---

## Hard constraints — violating any of these has already cost a rebuild

**Material doctrine.** The roll-on over-caps are **moulded phenolic plastic with
a vacuum-metallized chrome finish**. They are NOT aluminium. Using the words
*aluminium*, *anodised*, *brushed*, *machined* or *metal* in a prompt reliably
produces a milled aluminium part with a visible grain — wrong product. **Only the
roller BALL is ever steel.** Name the finish, never a metal.

**Mirror ≠ shiny metal.** Asking for a "continuous tonal wrap" yields a smooth
gradient, which reads as brushed metal. A mirror reflects the room as **distinct
vertical bands with crisp, sharp boundaries**. Both failures happened in
sequence; the prompt must target both.

**Light contract** (lifted verbatim from the locked body prompt): one large soft
key from the RIGHT, gentle fill from the left, seamless warm cream `#F5F3EF`
background, no horizon line, no cast shadow.

**Camera.** Dead level with the middle of the part. A level camera puts the
visible top face at **~6% of part width** (measured on the source PSD and the
frozen component). A visible top disc means the camera was raised. Gemini
defaults to a raised camera unless told explicitly and numerically.

**Resolution.** Master density is 22 px/mm (`MASTER_TARGET_PX_PER_MM`). All
original PSD sources measure **0.57–0.70×** — genuinely too small, which is why
regeneration was necessary at all. Reborn parts land 1600–3000px, comfortably
above the ~440px a 20mm cap needs, so every catalog use is a downsample.

**Two-image input.** Reference images must precede the text prompt. Image 1 =
the part (geometry authority), Image 2 = `_LIGHTING-REFERENCE-clear-plate.png`
(light/material authority). Without Image 2 the model invents its own studio.

**Background removal.** Gemini returns a *graded* background (measured 15 luma
darker at top than bottom) and sometimes adds ground lines, backdrop edges and
contact shadows the prompt forbade. Never colour-key these — they are mirrors,
and a colour key punches holes. Use ML matting (fal.ai BiRefNet/RMBG, or
Madison's remover). Watch that contact shadows do not end up inside the alpha.

---

## The recurring failure mode — read this before writing any QA

**Fixed thresholds that assume a material or a shape have produced confident
wrong answers five times in this work.** Every measurement gate must be
calibrated on real files spanning the actual material range.

| # | gate | how it failed |
|---|---|---|
| 1 | plate foreground detector | counted the contact shadow as bottle; would have shrunk every plate ~13%. Frosted's body signal (Δ15) is *weaker* than its own shadow (Δ22) — no intensity threshold separates them. Fixed with a run-length discriminator. |
| 2 | junction "gap" metric | counted Bone-coloured pixels as gaps; clear glass reads as canvas, so it measured transparency, not fit. |
| 3 | tone gate (p99 ceiling) | failed our own approved clear plate, whose specular legitimately reaches 253. Replaced with clipping **mass**: approved plates 0.01–1.94%, clipped PSD caps 15.3%, threshold 5%. |
| 4 | object detector (one-sided) | only caught pixels *darker* than background, so white sprayer heads on cream were invisible — measured the metal sleeve alone. |
| 5 | top-arc metric | anchored to global max width, but these caps flare at the base, so "widest row" landed near the bottom and the arc read 141.9%. Re-anchored to barrel width at 25% height. |

A sixth, worse case: the very first QA pass reported `top-arc 0.0% ✅, clip 0.2% ✅`
on a generation whose numbers were entirely garbage — the graded background made
the detector measure the whole **frame**, and because a 2:3 frame was requested,
the frame's aspect looked like a plausible cap aspect. **A clean-looking pass is
not evidence.** Verify that the detected object is not simply the frame.

**Most of this pain comes from measuring objects against a non-flat background.**
After ML matting, alpha defines the object exactly and these gates become
trivial. Consider matting *first*, then measuring.

---

## Also outstanding

**Defect:** `closure__17-415__metal-roller-ball__natural` (approved, SHA-frozen)
is **72.8% opaque pure-white junk** — a white patch fused to the roller. The
plastic sibling is 0.0%. `countSignificantForegroundRegions` passed it because
the junk is *contiguous* with the part. Do not ship it. Recropped source is at
`outputs/paper-doll-plates/cap-regen-sources/RollerBall17-415-Metal.png`. Add an
opaque-white-fraction check to intake.

**Measurement-lane flag:** canon says the 17-415 neck is 17mm, but every plate
and the source PSD measure the thread crest at 269px against a 363px/20mm body =
**14.8mm**. Sizing any closure off the neck imports this error — it built the cap
13% too small twice. Derive closure sizing from **body width**, never the neck.

**No spray or lotion over-cap in the closure library** — they exist only worn on
the capped SKUs (`17-415 Bottles/10. Clear (Capped)/GBCyl9Spry*`, `LBCyl9Ltn*`)
and are translucent frosted-plastic hoods. Already harvested.

---

## Where everything is

| | |
|---|---|
| PSD estate | `~/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources` |
| closure library | `20. Closures - Cap, Sprayers, Lotion pumps, etc` (folders 12/13/14 = 17-415) |
| extracted sources | `outputs/paper-doll-plates/cap-regen-sources/` (19 + 4) |
| reborn outputs | `outputs/paper-doll-plates/cap-regen-sources/reborn/` (23) |
| deterministic derivation proof | `outputs/paper-doll-plates/cap-regen-sources/derived/` |
| generation runner | `scripts/paper-doll/regenerate-closures.ts` |
| prompt pack | `docs/paper-doll-rig/prompts/17415-closure-material-rebirth-nano.md` |
| composite engine | `src/lib/paperDoll/compositeEngine.ts` |
| QA gates | `src/lib/paperDoll/qaGates.ts` (incl. `plateSilhouette`, swatch-lock IoU) |
| registries | `docs/paper-doll-rig/{component,body-plate,welded-layer}-registry.json` |

**Commands**

```bash
npm run paperdoll:regen-closures -- --only <part>   # single, --size 2K|4K
npm run paperdoll:regen-closures                    # all 23
npm run paperdoll:intake                            # gate + SHA-freeze a cutout
npm run test:paperdoll                              # 44 tests, all passing
```

`GEMINI_API_KEY` is set in `.env`, `.env.local`, and Supabase secrets. Model chain:
`gemini-3-pro-image-preview` → `3.1-flash-image-preview` → `2.5-flash-image`.

**Economics:** verified $0.42/request on OpenAI gpt-image-2 (the old $0.095 UI
constant was 4.4× low). Whole-catalog target was ~$1,000; paper-doll estimated
$600–700 worst case. Deterministic derivation is $0 and is why the master-based
approach matters economically as well as architecturally.

---

## Implementation update — 2026-08-02

The CYL-9ML Production Candidate Bench now enforces this lifecycle in code:

1. **Approve Pixels** creates and resolves an immutable approved child whose
   image SHA, authority-mask SHA, alpha bounds, QA evidence, and named decision
   all agree.
2. **Family Fit** remains disabled until that exact child exists. It mounts the
   approved child and permits only release-pixel X/Y translation plus uniform
   scale across the five explicit body plates.
3. **Lock Shared Placement** writes one append-only placement version, five
   assembly-context reviews, and one named approval. The key is
   `CYL-9ML + fitment__roller-ball__17-415__v1 + exact authority-mask SHA +
   2080×2288 canvas`.
4. **Current Release** is the user-facing name for the internal read-only
   `release-lock` mode. It never adopts pixel approvals or placement locks by
   implication.
5. A later **release cut** and later **Sanity dry-run / named publication** are
   separate milestones. Neither occurs in the pixel-approval or placement-lock
   transactions.

The placement ledger is implemented by migration
`20260802211000_paper_doll_shared_placements.sql`, read through
`get_paper_doll_family_placement`, and written only through the authenticated
`lock-paper-doll-placement` Edge boundary into the service-only
`lock_paper_doll_shared_placement` transaction. Browser roles have
organization-scoped reads and no direct writes.

The five body plates remain unchanged. There are no per-body offsets. Moving a
loaded lock creates visible **Draft changes** and requires a new immutable named
lock; refreshing reloads the latest exact-mask placement and displays the same
placement ID on all five lineup cells.

Still separate and not implied complete:

- reusable proposed-geometry intake and compatibility mapping for vintage
  bulbs, tassel bulbs, pumps, sprayers, and other new silhouettes;
- release-candidate assembly and explicit release cut;
- Sanity dry-run diff, named publication approval, publication transaction,
  and append-only publication events.
