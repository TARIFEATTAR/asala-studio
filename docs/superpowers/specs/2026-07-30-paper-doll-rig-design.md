# Paper-Doll Rig — design of record (2026-07-30)

**Status:** decided, pre-build. All art-direction and architecture decisions below are
locked (Jordan, 2026-07-30) unless explicitly reopened.
**Visual spec (same content, diagrams, and the canvas A/B decision record):**
https://claude.ai/code/artifact/d782ffe0-cb56-495a-9400-3c5a63536dc3
**Companion audit of the current rig:** `docs/audits/2026-07-30-madison-rig-external-technical-handoff.md`

## Thesis

Generate the body once. Every closure, glass color, cap state, sidecar view, and the
website swatch are deterministic composition on top of it. **The model never invents
the part; it only welds it.** The doctrine generalizes three mechanisms already shipped
in this repo: the deterministic cap splice (`src/lib/product-image/sidecarCapSplice.ts`),
the reviewed-mask edit lane (`supabase/functions/_shared/bestBottlesFilledHoverTwinContract.ts`),
and optical-material transfer (`src/config/bestBottlesVisualTarget.ts`).

## Locked decisions

| Decision | Value |
|---|---|
| Canvas | **Bone `#F5F3EF`** — owned, named, unchanged in code. Aesop-ivory `#FFFEF2`, white, and parchment `#EFE8D9` considered and not chosen (record in artifact §1). Body plates are *born* on Bone: clear glass shows the canvas through the bottle, so the canvas can never be remapped after the fact. |
| Shadow | **Ambient contact, no directional cast.** Peak ~20–25% opacity at contact, fading to zero within ~12–15% of bottle width, symmetric. Rig-painted, never model-owned → identical grounding across all ~3,000 images. |
| Light contract | One fixed key side, one large soft source, Bone environment, quiet speculars. Enforced at component intake (key side detectable from highlight rim). Perspective + light direction cannot be repaired downstream — gate at intake. |
| Registration | One coordinate frame per group in `geometry_spec`: canvas, px-per-mm, baseline Y, centerline X. Every layer exports full-canvas against it; composite at (0,0). **±2 px alpha-bounds gate** before any Sanity push. Enforced in Madison, never corrected on the website. |
| Color derivation | **Optical-material transfer only within identical canon geometry** (join on `canon_bodyHeightMm × canon_widthAxisMm`); different geometry gets its own true-north master. Swirl relief is geometry, not material → always own master. Data: 9 ml Cylinder = 70.0 mm (Clear/Amber/Cobalt) vs 74.0 mm (Frosted/Swirl) vs 106.0 mm (Tall) — swatch sets are defined by geometry, not capacity label. |

## Layer model

- SKU image = **body plate + an assembled STACK of component layers + shadow**,
  composited from canon mm. Stacks are 1–2 layers: bottle+bulb assembly (2-part),
  bottle+roller+overcap or bottle+sprayer+overcap (3-part). Every layer places
  against the BODY frame (mm from body top); layers composite bottom-up.
- **Cap states are layer subsets of one stack** (decided 2026-07-31): cap-on = all
  layers, cap-off = stack minus the overcap. Components land at identical pixel
  coordinates across states — that registration lock is what makes the website
  swatch seamless.
- **There is NO sidecar in this architecture** (Jordan, 2026-07-31): closures always
  seat ON the bottle; customers swatch through cap colorways. The engine's
  `detached` mode is retained only as a legacy export capability; the detached-cap
  drift-QA lane collapses entirely.
- Body plate = cap-off, neck visible, true-north, approved once per geometry × color.
- **Mount axis:** placement centers a component's declared `mountAxisXPx` (measured
  once at intake) on the bottle centerline — bbox-center is only the default for
  symmetric caps. Asymmetric assemblies (Empire bulb + tassel) REQUIRE the declared
  axis; centering their bounding box would misplace the collar.
- Component library keyed **`neckThreadSize × applicator × colorway`** (~100–200 unique
  parts catalog-wide; the same 17-415 cap serves every 17-415 bottle). Sourcing order:
  PSD layer extraction (Cowork alpha-preserving lane) → photograph → generate-once on
  Bone under the light contract. Approved components are **SHA-pinned and frozen** —
  model non-determinism is survived once per part, ever.
- Fitments are **not** regenerated per family: the fitment is lit by the studio, not by
  the bottle (phenolic caps are matte — near-zero environment reflection). Per-family
  component override exists as the escape hatch for true mirror finishes.

## Closure classes

| | Class A — external junction | Class B — internal continuation |
|---|---|---|
| Members | Screw caps, roll-on over-caps, closed fitments (~191/386 Cylinder rows) | Sprayers, pumps, bulbs (~134 rows). **Capped sprayers are still Class B** — the dip tube shows through clear glass in both cap states. |
| Finish | Deterministic composite + feathered blend + painted contact occlusion. **$0, no model call.** | Composite external hardware, then **one masked weld** (filled-twin reviewed-mask contract pattern): model may paint only inside the junction band + tube column. |
| Clamp | — | **Non-negotiable:** after the weld returns, restore original body-plate pixels byte-for-byte outside the feathered mask. Identity failure becomes architecturally impossible; the dip tube is drawn by the weld (length from canon body height), never a separate asset. |

## When gpt-image-2 runs (the three generative moments — all at asset birth)

1. **Plate birth** (once per geometry × color): raw PSD bottle photo → one
   reference-locked pass → premium glass born on Bone under the light contract →
   rig → QA → approve → **freeze**. For clear glass this is mandatory, not
   optional — a photographed clear bottle carries its old background inside the
   glass, so only generation can move it onto Bone. This is pilot Q1's subject.
   Colors sharing canon geometry derive via optical-material transfer instead.

   **Plate-birth input doctrine (2026-07-31, revised same day):** the original
   photographs are LOST (Jordan) — the estate is cutouts only, and the PSD
   scene-0 "composites" are just cutouts assembled on white. A clear bottle's
   appearance IS its environment; a cutout has the optics deleted (interior
   baked white, reflections gone), which is why generation from cutouts kept
   producing flat glass — no prompt recovers deleted information. Clear-glass
   plate-birth paths, in preference order:
   (a) **Parametric 3D body plates** (Cylinder family first): Blender glass
       render on a Bone environment, driven by canon mm — real optics
       manufactured synthetically, $0/render, one model → every size, perfect
       cross-size swatch-lock;
   (b) **One-time physical re-shoot** of bodies on a Bone sweep (photos are
       lost; the bottles are not) — one plate per geometry × color, ever;
   (c) **Cutout + optical donor**: cutout composited onto Bone deterministically
       as Image 1 (geometry authority) + the approved clear material plate as
       Image 2 (optical authority, optical-material transfer) — the plate
       donates the optics the cutout lost; needs to succeed only once per
       geometry × color. Dark glass (amber/cobalt) is far more forgiving —
       its interior barely shows; derive via material transfer as planned.
2. **The weld** (once per Class B fitment × body color, visible-tube colors only):
   masked, clamped, cropped to the welded layer → **freeze**.
3. **Component last-resort** (ideally zero): a closure with no usable PSD or photo.

**Cutouts get no beauty pass — ever.** They are photography harvest; their lighting
alignment is deterministic (Bone gray-card at compose, grain/sharpness match). If a
part's lighting clashes: better layer → mirror if symmetric → only then
regenerate-once. **Nothing downstream of freeze ever calls a model** — the UI
composites frozen pixels; a wrong-looking composite means fixing one part once,
never 3,000 images.

## Swatch-set unification — 17-415 9ml family (Jordan, 2026-08-01)

**Decision: all five colours share ONE swatch set at the Clear geometry.** Canon
splits the family (Clear/Amber/Cobalt 70x20; Frosted/Swirl 74x21), but the two
groups are virtually the same bottle to a customer, and the scale arch already
collapses them: 69% x 70/83 = 58.2% vs 69% x 74/87 = 58.7% canvas fill — a 0.5
point difference. Aspects agree too (3.50 vs 3.52).

Consequences:
- All five plates derive from the locked Clear true north
  (`body__cylinder__9ml__clear__70.0x20.0mm`), so all five swatch-lock to each
  other and the PDP gets ONE seamless swatch instead of two sets.
- Frosted becomes a MATERIAL TRANSFER (diffuse instead of transparent) rather
  than needing its own true-north birth — one plate-birth cycle saved.
- **Swirl remains the exception**: its helical swirl is relief GEOMETRY, absent
  from the Clear plate, so it must be introduced rather than tinted. Built on
  v3's geometry and finish, but a different prompt shape.
- Accepted cost: Frosted/Swirl render ~5% narrower than their 21mm canon width,
  well inside the +/-8% aspect gate. Record as an approved merchandising
  exception on those entries — it is a decision, not drift.

## Dip-tube accounting (sprayers & lotion pumps)

The tube is the one part that can never be a normal layer: it sits *inside* the
bottle, visible *through* the refracting glass — a 2D layer painted over the body
reads as taped to the outside. Accounting:

- **Never a library asset.** The tube is drawn by the weld, inside a geometry-derived
  mask (collar-seat band + tube column: centerline ± tube radius, neck to near-base).
  Length derives from canon body height (auto-correct per size); diameter from the
  component spec (lotion pumps fatter). The prompt is constrained, not creative.
- **Baked into a body-contextualized fitment layer**: compose external hardware →
  weld → clamp → crop fitment + welded glass strip into ONE layer asset, keyed
  `componentId × bodyPlateId`, SHA-pinned, weld recipe as provenance. Safe to carry
  glass pixels *only because the body plate is frozen* — the strip lands over
  byte-identical glass forever.
- **Cap states still subset cleanly**: the overcap hides collar/actuator; the tube
  strip below its edge remains visible in cap-on — physically correct by layer order.
- **Visibility is color-dependent, and that cuts cost**: tube welds are needed where
  the tube is visible — clear (and light tints). Through dark amber/cobalt a tube is
  largely invisible, frosted shows a soft shadow at most → those fitment layers skip
  the weld entirely (pure Class A, $0). Reference photography decides per color at
  pilot; the ~1,200-weld worst case shrinks accordingly.

## Composite engine

Node + `sharp`, server-side (splice functions are already DOM-free) — no browser or
Playwright requirement. Steps: placement math from canon mm → harmonization
(**Bone as built-in gray card**: measure each layer's Bone region against `#F5F3EF`;
the deviation *is* that layer's exposure/WB error, corrected deterministically; plus
defringe vs Bone, sharpness + grain match) → class finish (A or B+weld+clamp) → floor
shadow painted last in the locked ambient-contact style → **recipe JSON** persisted
(component hashes, placement matrix, weld params, code commit) so any SKU re-renders
deterministically forever. Channel exports via recipes: Bone for the site,
pure marketplace-white for free.

## Render targets (one recipe, mm-based → any canvas)

1. **Shopify master** — 2080×2288 flat PNG → existing approval RPC → single-use Shopify
   authorization → Convex patch. Downstream unchanged.
2. **Sanity paper-doll** — 1000×1300 layers (1500×1300 wide for Empire bulb + tassel)
   + `geometry_spec`, via the existing `paper_doll_component` destination, each layer
   passing the ±2 px registration gate. Website swatches by swapping the body layer;
   fitment persists. Class B fitment layers ship pre-welded per body color.

## QA gates (automatic, before any human)

Assembled height vs `canon heightWithCap` (self-checking placement) · ΔRGB vs component
color truth · silhouette-IoU swatch-lock across a set's color plates · layer
registration vs `geometry_spec` (±2 px) · existing baseline / centerline / shadow
thresholds. Review unit = per-group contact sheet (body identical by construction;
humans judge closures only).

## Economics (verified 2026-07-31 against real July billing)

**Real cost: ~$0.42 per request** — July 2026 OpenAI org billing was $235.10 across
560 requests ($231.17/537 ≈ $0.43 on the image key alone). The old $0.095 UI constant
was **~4.4× too low**; 95% of spend is image *output* tokens, which scale with canvas
size, so 2080×2288 masters sit **above** the average (per-size truth now accumulates
in `generation_attempts`).

At the verified average:

- **Full regeneration (old plan): ~4,600 renders ≈ $1,900+ — over the $1,000 budget.**
  The unverified constant had been hiding this.
- **Paper-doll, weld-heavy worst case: ~1,400–1,600 calls ≈ $600–700** — inside budget.
- **Paper-doll, if the assembled-crown splice passes review: ~300–600 calls ≈ $130–250.**

Wall clock unchanged: ~10–25 h vs 62–96 h. Task 0 (attempt ledger + billing pull)
completed and deployed 2026-07-31; `estimated_cost_usd` in the ledger now carries the
verified $0.42 average.

## Pilot — must pass before scaling

Scope: `cylinder-9ml-clear` + amber/cobalt · one body plate · three closures
(screw cap, roller ball, fine-mist sprayer).

- **Q1 · Material** — does optical-material transfer (clear → amber/cobalt on the
  70 mm body, silhouette clamped) survive review against the canon glass language?
- **Q2 · Weld** — does the clamped weld seat a sprayer invisibly on clear *and* cobalt,
  tube reading refracted, body pixels bit-identical outside the mask?
- **Q3 · Swatch** — do set-A layers pushed through `paper_doll_component` swatch
  seamlessly in the real configurator (zero silhouette jump, fitment persists)?

Also test in-pilot: the "assembled-crown splice" shortcut for Class B (crop shoulder-up
incl. tube strip from an assembled reference — $0 if it survives review; weld remains
the default).

## Build order

0. **Attempt ledger** (migration + edge-function insert: model, ref/prompt hashes,
   latency, attempts, cost) + pull one month of real OpenAI billing.
1. Component intake CLI + registries (closure library, body plates) for the pilot parts.
2. Composite engine: port `sidecarCapSplice` math to `sharp`; placement, harmonization,
   occlusion + shadow painters.
3. Weld lane: clone the filled-twin mask contract; neck-band + tube-column mask
   generator from rig bounds + canon geometry; the clamp.
4. QA gates + registration + recipe persistence.
5. Pilot renders → contact sheet → review → Q1–Q3 verdicts.
6. Sanity push + live swatch check.

The existing full-regeneration lane remains as fallback for shapes that fail composite
QA — it stops being the default path, not an available one.

## UI posture

**The pilot is UI-free** — stages 0–5 are CLI + server-side; review happens on
generated contact sheets. UI work begins only after the pilot passes, and it is an
**upgrade of the existing paper-doll surface, not a new build**:
`src/components/darkroom/ComponentsTabPanel.tsx` (V1 slot grid: 1 body + N fitments
per cohort, PSD upload, approve → `paper-doll-component` library role, backed by
`src/lib/paperDollAssets.ts`, with a composite preview on the pipeline shape-group
view). Post-pilot deltas: re-key inventory to the catalog-wide
`neckThreadSize × applicator × colorway` closure library; flip sourcing to
PSD-first/generate-last with SHA-pin freeze + light-contract checks at approve;
surface registration/gray-card/swatch-lock QA as evidence chips; add per-group
contact-sheet review; finish the V1's admitted "NOT YET" writeback as the
Sanity `paper_doll_component` push + recipe views. The weld-mask review clones the
filled-twin dialog. Approval spine (approved-keep, guarded RPCs, single-use Shopify
auth, tracker) is lane-agnostic and unchanged; the Dark Room masters tab remains the
fallback lane's UI.

## Asset estate & task-1 status (recon + build 2026-07-31)

- **PSD sources:** `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources/`
  — organized by thread size. Closures live in `20. Closures - Cap, Sprayers, Lotion
  pumps, etc/`, keyed exactly as the registry ("17. 13-415 Caps", "18. 13-415
  Sprayers", "19./24. 13-415 Roll on", "25. 13-415 Metal Roll on").
- **Bottle PSDs carry separated scenes** (body / applicator / detached cap); the
  per-variant scene maps are recorded in `tmp/isolate-clear-cylinder-9ml-four-layers.py`
  (2026-07-11 pilot, 4 SKUs incl. sprayer + both roll-ons + lotion pump).
- **Cowork isolation outputs:** `~/Desktop/AI-OS/07 Outputs/best-bottles/2026-07-11-*`
  — exported flattened (`-alpha off` onto white), so they FAIL closure intake by
  design. Work order: re-export the same scenes **alpha-preserving** for the pilot
  parts.
- **Canon note:** Cylinder 9 ml Clear spans SIX geometries (70×20 standard · 70×21 ·
  74×21 · 79.4×20 · 79.4×21 · 106×18 tall). Pilot body = **70.0 × 20.0 mm**; the
  intake CLI refuses ambiguous joins and requires explicit `--height-mm/--width-mm`.
- **Task 1 shipped:** registry lib `src/lib/paperDoll/componentRegistry.ts` (11 tests)
  + intake CLI `scripts/paper-doll/intake-component.ts`
  (`npm run paperdoll:intake`, `npm run test:paperdoll`). Registries live at
  `docs/paper-doll-rig/{component,body-plate}-registry.json`; entries are SHA-pinned,
  `pending-review` → `--approve <id> --by <reviewer>` freezes them. Gates verified
  live: geometry-ambiguity, born-on-Bone (ΔRGB ring), alpha-preserving cutout,
  resolution floor, key-side detection, edge-halo defringe proxy.
- **Task 2 shipped (2026-07-31):** composite engine `src/lib/paperDoll/compositeEngine.ts`
  (13 tests) + compose CLI `scripts/paper-doll/compose.ts`
  (`npm run paperdoll:compose`). Pure-buffer core (no DOM/Playwright): geometry spec
  derived from the plate (px-per-mm, baseline, centerline), Bone gray-card gain
  (clamped ±12%), premultiplied bilinear resample, mm-solved placement (assembled +
  detached), bottom-feather, contact-occlusion band, locked ambient-contact shadow
  painter (peak-at-contact plateau → fade within the 13% margin), assembled-height QA
  (±2%), recipe JSON sidecar with registry SHA verification. Smoke-verified on
  synthetic fixtures: placement exact to ≤1px, height QA Δ −0.13%, **byte-identical
  output across repeat runs**. v1 deferrals noted in the module header: component-side
  photometric gain (explicit param only), grain/sharpness match, rig-grade foreground
  detector. **Stacks + mount axis added same day** (25 tests): `--stack file.json`
  composes multi-layer assemblies bottom-up (occlusion on the outermost seam only);
  cap-on/cap-off verified as subsets of one stack with identical fitment coordinates;
  `mountAxisXPx` regression-tested against the asymmetric-assembly case.
- **Tasks 3–6 shipped (2026-07-31, 39 tests total):**
  - **Task 3 — weld lane**: `src/lib/paperDoll/weldLane.ts` + `npm run paperdoll:weld`.
    Geometry-derived mask (collar band + tube column, feathered), data-constrained
    prompt, the CLAMP (hostile-provider tested: solid-magenta weld → outside pixels
    byte-identical), tube-presence QA (`expectTube:false` for dark glass), welded
    fitment-layer extraction → `welded-layer-registry.json` (SHA-pinned, weld recipe
    as provenance). Provider call behind `--call` (~$0.42), ledger-tracked
    (lane `paper-doll-weld`); `--welded` runs the deterministic path on any
    existing result; `--mask-only` for review.
  - **Task 4 — QA gates**: `src/lib/paperDoll/qaGates.ts` — registration gate
    (±2 px alpha-bounds vs geometry_spec), swatch-lock (pairwise silhouette IoU
    ≥ 0.985 across a set's color plates), color-truth (ΔRGB vs intake truth; the
    splice-era copper drift of 36 fails by construction). Assembled-height gate in
    the engine.
  - **Task 5 — pilot harness**: `npm run paperdoll:pilot` — readiness report against
    the real registries (all five pilot parts currently missing → alpha exports are
    the blocker) + `--synthetic` full-chain proof: fixtures → 4 composes (3 colors +
    cap-off subset) → swatch-lock (IoU 1.0000) → weld lane (simulated provider,
    clamp+QA+extraction) → doll export + registration → contact sheet at
    `outputs/paper-doll-pilot/contact-sheet.html`. Q1–Q3 real verdicts and their
    exact blockers are enumerated in `outputs/paper-doll-pilot/readiness.md`.
  - **Task 6 — doll export**: `npm run paperdoll:export-doll` — one shared
    scale+translate transform projects every layer from the master frame onto the
    1000×1300 doll canvas (1500×1300 via `--canvas`), registration-gated per layer,
    manifest carries doll `geometry_spec` + `paper_doll_component` metadata
    (`familySlug`, `role`). Push path documented in the manifest: upload → 
    `push-sanity-placement {action:'publish', dryRun:true}` → live; nothing pushes
    below a full registration pass. The export surfaced and fixed a real engine bug
    (compositeOver now blends destination alpha — transparent-canvas layers).

## Pilot family CLOSED — 17-415 9ml Cylinder (2026-08-01)

Five true-north bodies locked (`clear`, `amber`, `cobalt`, `frosted`, `swirl`), each
born on Bone, material-locked through Nano Banana, then given one shared GPT-Image-2
shadow pass. SHAs frozen in `body-plate-registry.json`.

**The architecture is proven, not asserted.** Measured across all five plates over the
211px neck strip `y=760..971`:

| | spread |
|---|---|
| neck-silhouette width, mean over the strip | 4px |
| neck-silhouette width, worst single row | 12px (4.8% of the 250px neck) |
| centerline | 3px |
| neck top / shoulder onset | 4px |
| mid-body width | 2px (363–365px) |

Because the necks agree, **one closure recipe seats on every colorway with zero
per-bottle tuning** — that invariance is what makes cap states a layer subset instead
of a regeneration. The recipe is frozen at
`docs/paper-doll-rig/closure-placement-recipe.json`; proof composites at
`outputs/paper-doll-plates/fit-proof/`.

Two findings worth carrying forward:

1. **Below `y=971` the shoulder flare diverges by up to 84px.** That is real
   per-colorway glass (clear 254 vs cobalt 338), not a registration error. No shared
   closure skirt may descend past that line.
2. **A closure must be sized from its own outer diameter, never flush to the thread
   crest.** Scaling the over-cap to exactly 269px left the bottle's thread nubs
   peeking past the cap silhouette on all five plates. Sizing by
   `capOD_mm / crest_mm × crest_px` (19.5/17.0 → 309px, 15% overhang) closes it.

Two measurement traps were also cleared here, both instances of the recurring
"fixed threshold assumes a material" failure:
- The foreground detector counted the contact shadow as part of the bottle and would
  have shrunk every plate ~13%. No intensity threshold separates them — frosted's body
  signal (Δ~15) is *weaker* than its own shadow (Δ~22). Run length is the only
  discriminator; `detectPlateForegroundBounds` now takes `minRunFraction`
  (`--min-run-frac 0.4`).
- A junction "gap" metric that counts Bone-colored pixels measures *transparency*, not
  fit — clear glass reads as canvas. Silhouette profile comparison is the valid gate.

## Non-goals

No SD/ComfyUI/ControlNet rebuild (locks silhouette, not identity; foreign ops stack).
No fine-tune/LoRA. No per-family fitment regeneration. Aesop imagery is direction
only — it never enters the pipeline as a reference input.
