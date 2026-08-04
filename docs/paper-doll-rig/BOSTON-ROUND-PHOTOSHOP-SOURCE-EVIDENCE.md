# Boston Round Photoshop source evidence

**State:** read-only archive inventory and byte-identity findings; no extracted asset is production eligible, geometry locked, placed, released, or published

Archive reviewed:

`Best-Bottles-Original-Photoshop-Sources/Boston Rnd Bottles 20-400 (1oz and 2oz) + 18-400 half oz`

The archive supports a small physical plate program, but it also contains reused files, older aliases, inconsistent framing, and complete-product composites. Filename labels and byte identity are evidence only. They do not establish neck compatibility or geometry authority.

## Standalone dropper sources

The six catalog appearances are:

- black bulb, no decorative trim;
- black bulb, shiny gold trim;
- black bulb, shiny silver trim;
- white bulb, no decorative trim;
- white bulb, shiny gold trim;
- white bulb, shiny silver trim.

Every standard standalone dropper PSD contains a full-canvas composite plus separate transparent scenes for the glass pipette and the exterior bulb/collar responsibility. The pipette must remain body-contextual until its length and seat are verified against each bottle size. It must not be merged permanently into a reusable exterior dropper plate.

### Exact PSD duplicate groups

| Appearance | SHA-256 | Files with identical bytes | Safe conclusion |
|---|---|---|---|
| white, no trim | `07c0a388a4d16cd0afd1c14fbb9daae9414e25f67b83a36e1473c54c9b1ef011` | 18-400 15 mL; 20-400 30 mL; 20-400 60 mL | the archive reused one source file across all three labels |
| black, no trim | `6de19ac345d3e9da15a8bc97bee2a50529d195064b76c12e028f8497b2f8d849` | 18-400 15 mL; 20-400 30 mL; 20-400 60 mL | the archive reused one source file across all three labels |
| black, shiny gold trim | `3cfa4cbf88942ccfa5ffcbeaddd8e863fad1becb7ec6c03014ecf8959c1b088a` | 18-400 15 mL; 20-400 30 mL; 20-400 60 mL | the archive reused one source file across all three labels |
| white, shiny gold trim | `82c5613797169aab8f481904dbb1d096f6075eb3d51940414943d8afb3dc898e` | 18-400 15 mL; 20-400 30 mL; 20-400 60 mL | the archive reused one source file across all three labels |
| white, shiny silver trim | `cd6c7421ab796ff87f3a8a4165bff517a33c4eda1be3b143a90f5fac3363cb6d` | 18-400 15 mL; 20-400 30 mL; 20-400 60 mL | the archive reused one source file across all three labels |
| black, shiny silver trim, 20-400 | `c4595742d254f6c626e5aeac6eaa0c88972fe7aa01b0727801974ce9feacdf73` | 20-400 30 mL; 20-400 60 mL | the two 20-400 size labels share one source file |

The 18-400 black/silver file is a separate `6000 × 4000` composition with SHA-256 `3d5ef24d1f5f9166d31481084660e9bd80af1a79aba132c05017d462600b816b`. Its composite is framed at a radically different scale and cannot be substituted for the 20-400 source without review.

Three unnumbered PSDs (`Black Dropper Gold cap..psd`, `White Dropper Gold cap..psd`, and `White dropper and silver cap..psd`) are retained as supplemental source evidence only. They are not counted as additional catalog appearances.

### Required dropper decomposition

| Responsibility | Plate policy |
|---|---|
| bulb + collar / decorative trim | reusable exterior candidate, exact alpha authority required |
| glass pipette | internal delivery; body-contextual weld per capacity and bottle interior |
| bottle pixels | body plate only; never included in dropper authority |
| contact/refraction at the neck | integration evidence only unless a deterministic family-specific seam proves necessary |

## Standalone cap sources

### Short black cap

Four files labeled as 18-400 15 mL, 20-400 30 mL, and 20-400 60 mL all have identical bytes:

`e45c696fde888dd70737855c64b72622faba14530ef76162e583b71689e36ac0`

This proves archive reuse. It does not prove that one physical cap fits both 18-400 and 20-400. Keep the two neck-compatibility lanes separate until dimensions or assembly evidence establish otherwise.

### Tall 20-400 roller overcaps

The archive contains six finish sources:

| Finish | SHA-256 | Transparent scene size |
|---|---|---:|
| matte silver | `7286107c13906e3a031ad4f28216472771649522b404ed2316d356953799065b` | 293 × 432 |
| matte gold | `740a943a9c710815ee79952637b4dc3b472b4b07e8bb10907446a395ec9651c4` | 310 × 460 |
| shiny gold | `7618c8136dc2a5b5429c052eaa9f3e7fc700f7b4f43652bda6178dc747cfbdb3` | 304 × 458 |
| shiny black | `c5a75b3ffca8a750215fdeaf1af28cefc532f85784dfa91457f11649c73867e1` | 365 × 483 |
| matte black | `e33829a95b53be66549f88f48157a9b57783b71efd2a68010f400119d3addbac` | 294 × 469 |
| shiny silver | `da375e806481f771fd9ee7f3e3f012417eabbcb510bace27382f7ff2fa1bb0f9` | 300 × 437 |

The differing transparent bounds mean these six source images are not already geometry locked. They are material references and review candidates for one measured 20-400 overcap geometry. The final production variants must share one approved authority mask and pass exact alpha clamp verification.

## Catalog boundary established

- 15 mL / 18-400: short cap and dropper only; no roller family is evidenced.
- 30 mL / 20-400: short cap, six dropper appearances, plastic roller, metal roller, and six roller-overcap finishes.
- 60 mL / 20-400: the same responsibility categories as 30 mL, with capacity-specific body and internal-delivery placement.
- 123 catalog rows collapse to nine body appearance lanes plus a small reusable component set; they do not require 123 independent renders.

## Roller assembly decomposition finding

The review-only kit is now registered in `boston-round-rollon-20-400-component-kit-decomposition.json`. Its reproducible extraction, calibrated topology results, and GPT material trial are documented in `BOSTON-ROUND-ROLLON-20-400-COMPONENT-KIT.md`.

The 30 mL amber roll-on PSD `10GBBS~1.PSD` proves that the archive separates the assembly into distinct scenes:

| Scene | Observed responsibility | Disposition |
|---:|---|---|
| 2 | metal roller ball and housing candidate | source evidence only; contaminated by large opaque white polygonal pixels around the fitment |
| 3 | amber body and neck context | body/reference only; never part of a roller plate |
| 4 | natural plastic roller fitment candidate | independently extractable candidate; clean authority still required |
| 5 | matte-gold tall overcap | material/reference candidate on the 20-400 overcap lane |

The metal and plastic fitment scenes repeat at similar source dimensions throughout the roll-on archive, but pixel hashes are not identical. Similar scene bounds therefore do not earn a shared geometry claim. The next safe step is to select one clean geometry source or measured render, build one approved mask, and clamp both metal and plastic material variants to that authority where physical geometry is proven identical.

## Dropper decomposition finding

The review-only dropper kit is registered in `boston-round-dropper-20-400-component-kit-decomposition.json` and documented in `BOSTON-ROUND-DROPPER-20-400-COMPONENT-KIT.md`. Its SHA-verified extraction produces six exterior appearances, two labeled capacity pipettes, and four repeated upper-contact references without promoting any source pixels.

Real-file topology analysis confirms two exterior geometry cohorts: ribbed molded collars and smooth decorative trim collars. The shiny-silver sources contain large detached opaque white polygons; smaller source-specific artifacts remain in black/no-trim and white/shiny-gold. No fixed island threshold is used as an approval rule.

The 30 mL and nominal 60 mL pipette cutouts are byte-identical (`e152a3587a5b8ff2e080fda664ac6c786e6022591489bbd6f64d9d2c368f904a`). The archive therefore cannot establish a 60 mL physical pipette length. Capacity-correct pipettes remain body-contextual.

## Next review gates

1. Review one ribbed-collar and one smooth-trim dropper geometry profile; do not promote contaminated silver sources.
2. Confirm 30 mL and 60 mL pipette seat and interior-depth measurements.
3. Review the shared parametric roller profile and the accepted plastic-v2 / positive-metal-v1 material candidates.
4. Reuse the existing dimension-calibrated 20-400 roller-overcap geometry candidate and clamp all six materials only after named profile review; do not create a duplicate cap system.
5. Calibrate placement separately for 15, 30, and 60 mL bodies.
6. Promote nothing until named pixel, geometry, placement, and assembly-context approvals pass.
