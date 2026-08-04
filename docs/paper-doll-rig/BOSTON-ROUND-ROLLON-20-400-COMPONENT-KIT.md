# Boston Round 20-400 Roll-On Component Kit

**State:** local source and material review only; no geometry lock, family placement, release, or Sanity write

**Recipe:** `docs/paper-doll-rig/boston-round-rollon-20-400-component-kit-decomposition.json`

**Normalization record:** `docs/paper-doll-rig/boston-round-rollon-20-400-normalization-review.json`

## Closed responsibility set

The 30 mL and 60 mL Boston Round roll-on products use the same three physical responsibilities:

1. one 20-400 roller fitment, with a natural-plastic or mirror-metal ball;
2. one independently removable 23 × 35 mm tall overcap in six finishes;
3. a body-specific neck contact and placement relationship.

The overcap geometry is not duplicated here. This kit points back to the existing dimension-calibrated profile in `tall-rollon-cap-20-400-family-recipe.json`. Its six local variants already share exact alpha, but named geometry, material, and family-placement approval remain outstanding.

## Real-file topology calibration

The SHA-verified Photoshop source `10GBBS~1.PSD` separates the plastic fitment, metal fitment, body, and overcap into independent scenes. Extraction is reproducible with:

```bash
npm run paperdoll:boston-round-rollon-20-400-kit-review
```

The extracted plastic fitment initially measured 22 connected alpha regions. One 25,267 px object is the fitment; the other 21 regions are detached 2–9 px artifacts totaling 134 px. Removing exactly that calibrated artifact set produces one non-frame-touching review silhouette at `210 × 166 px` on the 2080 × 2288 canvas.

The extracted metal scene measured six alpha regions, but its 44,334 px main region contains a large opaque white polygon joined to the fitment. Island removal cannot repair attached contamination. It remains material and reconstruction evidence only.

The clean Photoshop-derived plastic silhouette is still a review candidate, not authority: its old top profile is visibly faceted and may not represent the physical spherical roller correctly. It must not be promoted merely because its topology is clean.

## GPT material reconstruction trial

Two raw material candidates were generated from the normalized review reference:

- natural translucent-white plastic ball and housing;
- the same natural plastic housing with only the exposed ball reconstructed as mirror chrome.

The calibrated raw foreground boxes differ by one pixel before normalization (`917 × 768` plastic and `918 × 769` metal). That is useful evidence that the generated pair is visually close, but it also proves that reference-anchored generation is not geometry locked.

The candidates are retained under:

`outputs/paper-doll-component-authority-reviews/boston-round-rollon-20-400/roller-fitment-v1/raw-gpt-candidates/`

They may supply material pixels only after one reviewed geometry mask is selected. The final pipeline must normalize the generated source bounds, copy the authority alpha byte-for-byte, and then apply the family placement transform.

## Production loop

```text
SHA-verified layered source
→ calibrated source bounds
→ reviewed physical silhouette / parametric mask
→ GPT material reconstruction
→ exact authority-alpha clamp
→ 30 mL and 60 mL family placement review
→ deterministic neck contact and shadow
→ named approval
→ append-only release cut
```

The shadow is not part of the GPT plate. It remains a deterministic assembly-context effect so material regeneration cannot move the baseline, change the footprint, or introduce inconsistent catalog lighting.

## Immediate gate

The small parametric roller housing and sphere now exist as a reproducible local review candidate. They are calibrated from the verified 33 mm Boston Round body and the Photoshop assembly pixel profile; they are not mislabeled as supplier CAD. Plastic and metal Blender references clamp to one exact mask with pairwise alpha IoU 1.0000 and zero mismatched alpha pixels.

Review [BOSTON-ROUND-ROLLER-20-400-PARAMETRIC-REVIEW.md](./BOSTON-ROUND-ROLLER-20-400-PARAMETRIC-REVIEW.md) and name the physical profile approver before promoting the mask. GPT Image 2 jobs are prepared for natural plastic and mirror-chrome ball material reconstruction, but paid execution remains intentionally unauthorized. Generation itself never earns the lock.

After authority selection, placement must be reviewed separately on 30 mL and 60 mL bodies. Amber, clear, and cobalt appearances inherit the capacity-level placement only after their body geometry is proven identical.
