# 17-415 closed dispenser assembly swatches

Status: source-calibrated review candidates; named five-body visual approval required.

## Approved architecture

Jordan Richter approved the open/closed swatch architecture on 2026-08-03.

- Open state: the already approved exposed sprayer or pump exterior plate.
- Closed state: the visible dispenser plus its translucent protective overcap baked into one compound plate.
- A standalone translucent-cap overlay is forbidden for the 17-415 spray and lotion lanes.
- Body plates remain independent and unchanged.
- Dip tubes and inserted plugs remain body-contextual responsibilities.

This avoids pretending that ordinary 2D alpha can reproduce refraction,
occlusion, internal reflections, and the mechanism visible through molded
translucent plastic.

## First calibrated review candidates

Two real catalog composites provide the initial closed-state evidence:

| Lane | Appearance | Source | Calibrated source bounds |
|---|---|---|---|
| Sprayer | shiny silver | `CAPPED-spray-shnsl.png` | x 236, y 327, 233 × 453 px |
| Lotion pump | matte silver | `CAPPED-lotion-mattsl.png` | x 230, y 322, 235 × 461 px |

Both were measured on their real source files, normalized to the approved
344 px exterior width, centered at x = 1041, seated at y = 1002, converted to
one connected full-canvas authority support, and mask-clamped. Source bottle
pixels below the calibrated seat are excluded.

Review evidence:

- `outputs/paper-doll-dispenser-17-415/closed-assembly-review-v1/manifest.json`
- `outputs/paper-doll-dispenser-17-415/closed-assembly-review-v1/review/sprayer-SSLV-closed-five-body.png`
- `outputs/paper-doll-dispenser-17-415/closed-assembly-review-v1/review/pump-MSLV-closed-five-body.png`

Rebuild with:

```bash
node --import tsx scripts/paper-doll/build-dispenser-17-415-closed-swatches.ts
```

## Remaining work and gates

After named approval of these two calibrated silhouettes:

1. Treat each approved closed silhouette as geometry authority for its lane.
2. Generate the remaining five sprayer appearances and two pump appearances as complete closed assemblies.
3. Mask-and-clamp every appearance to its lane authority.
4. Render all nine closed swatches across all five locked body plates.
5. Require named material and family-fit approval before geometry lock or release eligibility.

This review changes neither Current Release nor Sanity. It does not approve
dip tubes, inserted plugs, or public catalog publication.
