# Boston Round 20-400 Dropper Component Kit

**State:** reproducible source extraction and topology audit complete; no geometry lock, placement, release, or Sanity write

**Recipe:** `docs/paper-doll-rig/boston-round-dropper-20-400-component-kit-decomposition.json`

**Topology record:** `docs/paper-doll-rig/boston-round-dropper-20-400-source-topology-review.json`

## Responsibility split

The six catalog appearances do not require six complete product renders. They resolve into:

1. an exterior bulb-and-collar plate anchored to the 20-400 mount axis and seat;
2. a capacity-specific glass pipette welded from the mount centerline to the verified bottle interior;
3. optional neck contact/refraction derived deterministically in assembly context;
4. the Boston Round body plate, which never enters the dropper authority.

The exterior lane has two visible geometry cohorts that must not be collapsed merely because they share one product function:

- molded ribbed collar: black bulb/no trim and white bulb/no trim;
- smooth decorative trim collar: black/white bulbs with shiny gold or shiny silver trim.

Color and finish variants may share an authority only within a physically reviewed cohort. The bulb color does not justify a separate geometry system.

## Reproducible extraction

Run:

```bash
npm run paperdoll:boston-round-dropper-20-400-kit-review
```

The command verifies every source SHA-256, extracts 12 named scene responsibilities, preserves the source pixels, centers only the exterior review cutouts on the canonical `2080 × 2288` canvas, and emits contact sheets plus a review-only manifest. It never writes production plates.

The six exterior sources are visually useful, but they are not normalized authorities. At real-file alpha thresholds 1, 8, 16, 32, 64, and 128, their topology differs. Threshold 16 is recorded only as a comparison point—not as a global cleanup or approval rule.

- White/no trim is the cleanest ribbed-collar source candidate.
- Black/shiny gold is the cleanest smooth-trim source candidate after low-alpha edge speckles disappear.
- Black/no trim and white/shiny gold retain smaller detached artifacts.
- Both shiny-silver sources contain large opaque white polygonal junk below the collar and remain material references only.

The exact component areas and cutout hashes are retained in the machine-readable topology record.

## Pipette truth

The PSD labeled as the 60 mL white dropper is byte-identical to the 30 mL white source. Its extracted pipette cutout also has the same SHA-256 and the same `258 × 1803` bounds. This proves source reuse; it does not prove that the physical 30 mL and 60 mL pipettes have equal length.

Therefore the pipette is never a global reusable plate. The rig must calculate or render it per body cohort from verified seat and interior-depth measurements. The shared `258 × 305` upper segment is contact evidence only and cannot be stacked as an independent production part.

## Safe production path

```text
SHA-verified layered source
→ ribbed or smooth-trim physical cohort
→ named geometry authority
→ material reconstruction if required
→ exact authority-alpha clamp
→ capacity-specific pipette weld
→ assembly-context contact/refraction
→ per-cohort Family Fit
→ named release cut
```

No source cutout is production eligible today. The immediate geometry gate is to review one ribbed-collar profile and one smooth-trim profile, not to clean every legacy image independently. Current Release and Sanity remain untouched.
