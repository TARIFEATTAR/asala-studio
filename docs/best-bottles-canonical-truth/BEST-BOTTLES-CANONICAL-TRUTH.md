# BEST BOTTLES — CANONICAL TRUTH SHEET

> **The single guiding reference for all Best Bottles image generation.**
> Built 2026-07-12 by reconciling four independent evidence lanes against each other,
> SKU by SKU, so that nothing in this document is taken for granted. Every number
> here has a provenance and a confidence; every known contradiction is either
> resolved with the resolution recorded, or listed as an open escalation.
>
> Companion data files (same folder):
> - **`best-bottles-master-truth.csv`** — one row per catalog variant (2,483 rows, all lanes + canonical values + provenance + conflict flags)
> - **`best-bottles-body-geometry.csv`** — one row per distinct physical glass body (118 bodies across 28 bottle families)

---

## 0. Verdict in one paragraph

The Convex `products` table is the right backbone (identity, SKUs, components, prices)
but its **measurements cannot be trusted row-by-row**: 839 of 2,483 SKUs carried at
least one wrong or unusable dimension, and only **10 of 2,474 live rows are marked
`verified:true`**. The **live bestbottles.com PDP spec tables are the numeric
authority** — they publish body height, with-cap height, and the correct horizontal
axes (`Item Diameter` for round bottles, `Item Width` + `Item Depth` for flat ones)
in mm with explicit ± tolerances, and they agree with Convex on ~84% of rows, which
is exactly what lets us isolate the ~16% that are wrong. The **48-page catalog PDF
contains zero linear dimensions** — it is the authority for *style, family naming,
materials, colorways, applicator mechanics, and visual identity*, not for numbers.
The repo's 10 manual measurement overrides were all re-confirmed. The canonical
values in the companion CSVs are the reconciliation of all of this, with 97% of
bottle rows at high confidence on both axes.

---

## 1. The four evidence lanes (and what each is allowed to assert)

| Lane | Snapshot used | Scope | Authoritative for | NOT authoritative for |
|---|---|---|---|---|
| **Live bestbottles.com** | Full crawl 2026-07-12 (2,683 URLs; 2,331 live product pages, 352 dead) | Per-SKU spec tables, mm ± tolerance | **All linear dimensions** (body H, with-cap H, diameter/width/depth), neck finish, live/retired status, price | Capacities (site's own info page: *"capacities listed … are approximate"*); the inch callouts on its `measured/` renders (see F15); "Item Depth" on round families (F16) |
| **Convex `products` table** | Live queries 2026-07-12 + same-morning full export (`tmp/best-bottles-convex-live-products.csv`, 2,474 rows) | Identity (graceSku/websiteSku/productId/productGroupId), components BOM, cap/trim colors, ballMaterial, assemblyType, weights, dataGrade, Shopify links | **Identity, taxonomy, componentry, materials metadata** | Row-level measurements until synced (839 SKUs corrected here); `widthMm`/`depthMm` (see §3); `family` granularity (F6) |
| **Catalog PDF** (`bestbottles-compressed (2).pdf`, 48 pp) | 2026 marketing catalog | Families, style names, colorways, applicator systems, material claims, photography style | **Visual identity, mechanics, materials, style vocabulary** | Any linear dimension (it contains none); exhaustive SKU coverage (it is curated) |
| **Madison repo data** | `catalog-lite.json` (2,483), `measurement-overrides.json` (10), `website-truth-status.json` (2026-07-11), `generation-readiness.json` (2026-07-12) | The app's operational join | **Join/identity plumbing, override history, readiness states** | Measurements beyond what the two lanes above assert |

### Precedence for any dimension (write this on the wall)

1. **Manual measurement override** (`public/data/best-bottles-measurement-overrides.json`) — human-verified against the site; all 10 re-confirmed in this audit.
2. **Live site PDP spec table** — nominal mm value (never the ± tolerance, never the inch callout).
3. **Catalog/Convex value confirmed by the site** (agreement within max(tolerance, 2mm)).
4. **Product-group consensus** — only to correct duplicate-lineage rows or fill gaps, and only when the site is silent.
5. A raw row value that survives none of the above is **flagged, never trusted**.

Majority vote inside Convex is **not** truth: for Circle 100 ml the Convex majority
said 100 mm and the six "outlier" rows saying 105 mm were right (site: 105 ±2 mm).

---

## 2. Units & measurement conventions

- **Millimeters, with tolerance.** Native spec format is `113 ±2 mm` (heights ±1–2 mm, diameters ±0.5–1 mm). Values without a ± are suspect: 129 bare-number rows exist in Convex, and 17 of them sit exactly on the ⅛-inch grid (79.4 = 3⅛″, 50.8 = 2″, 25.4 = 1″, 101.6 = 4″) — inch-era leftovers, all flagged `inch_conversion_artifact` in the master CSV.
- **`heightWithoutCap` = the glass body.** This is the *body constant* shared by every variant of a bottle. It is the number geometry/scale math must key on.
- **`heightWithCap` is variant-specific.** The same Grace 55 ml body (113 mm) ships as 117 (reducer), 124 (tall cap), 127 (leather cap), 135 (tassel bulb), 139 (spray/lotion pump), 141 (bulb sprayer) — with-cap height belongs to the *variant*, never the body.
- **Capacities are nominal.** The site itself calls them approximate; oz conversions drift in the copy ("1.85oz" vs "(1.86 oz)"); a handful of rows carry mislabeled capacities (e.g. one `LB-…-3ML` row on the 30 ml lotion body; Cylinder page saying 5.5 ml in the description and 5 ml in the spec). Capacity identifies the *size tier*; it is not a measurement.
- **Weights exist and are useful.** Convex `bottleWeightG` (e.g. Grace 55 ml = 93.79 g) is a physical sanity anchor for QA.
- **Component rows are a different lane.** Caps, sprayers, droppers, pumps, bags, boxes, tools use the same columns with different semantics, including a copy-paste plague of `93.8` in `heightWithoutCap` across ~80 component rows (F8). Never feed component-family rows into bottle geometry.

---

## 3. The axis model — the single biggest source of geometry pain

Every bottle has three axes: **H** (body height), **W** (widest face width), **D** (depth, front-to-back). Convex has ONE horizontal field (`diameter`), and its newer `widthMm`/`depthMm` columns are **programmatic copies of `diameter`** — verified live 2026-07-12: width == diameter in **all 1,488 populated rows** sampled, width ≠ depth in **zero** rows. They carry no independent information. The live site *does* publish the real axes: `Item Diameter` for round bottles (1,306 pages), `Item Width` (1,126) + `Item Depth` (868) for non-round ones.

Each family therefore has a declared **cross-section class** (encoded per-row as `axisSemantics` in the master CSV):

| Class | Meaning | Families |
|---|---|---|
| **round** | circular cross-section; W = D = diameter | Cylinder, Tall Cylinder, Boston Round, Round, Diva, Tulip, Atomizer, Vial, Cream Jar, Aluminum Bottle, Apothecary, Teardrop, Bell, Royal, Pillar, Lotion Bottle, Plastic Bottle |
| **square** | square cross-section; W = D = recorded width | Empire, Square, Sleek, Slim |
| **flat** | oblong cross-section; W ≠ D; **depth exists only on the live site** | Elegant, Circle, Rectangle, Diamond, Grace, Flair |
| **mixed** | per-shape (hearts, teardrop decoratives, tola, Eternal Flame, genie…) | Decorative, Unknown |
| **component** | geometry fields describe the component, not a bottle | Cap/Closure, Cap/Component, Roll-On Cap, Sprayer, Dropper, Lotion Pump, Gift Bag, Gift Box, Packaging Supply, Tool |

**Depth status after this audit:** 639 of 691 flat-family rows now carry a real depth
(`canon_secondAxisMm`, source `from-live-site(Item Depth)`). The one family still
blind on depth is **Diamond (60 ml, 45 variants)** — the site publishes W 39 mm but
no depth (the PDF shows a flat lattice-cut flask; depth visibly ≈ half its width, but
**no number is asserted**: it is on the physical-measurement worklist, §8).

Flat-family canonical cross-sections (site truth): Elegant 15 = 36×18 · 30 = 44×22 ·
60 = 54×27 · 100 = 61×30 · Circle 15 = 50×17 · 30 = 60×20 · 50 = 72×23 · 100 = 89×29 ·
Grace 55 = 52×30 · Flair 15 = 41×20 · Rectangle (footed) 10 = 29×19 · Diamond 60 = 39×?

⚠️ Two axis traps, now quarantined:
- **Boston Round's site "Item Depth" is NOT a depth** (30 ml page: Ø33 but "Depth 73" on a 78 mm body — it tracks ≈ shoulder height). Round families take depth = diameter, always; rows where the site said otherwise are flagged `site_depth_semantics_suspect`.
- **The `72/78 mm` ghost**: the old wrong Empire diameters (72/78) were fixed on Empire's primary rows but survived on its `-01` duplicate rows AND wholesale on **Sleek 50/100 ml** (true widths 28/35–36 mm). Same junk, different family. All corrected in canon; Convex still carries them (sync list, §8).

---

## 4. Canonical body geometry — 118 physical bodies, 28 families

The unit of geometric truth is the **body** (family × size × glass shell), not the
SKU: 2,483 sellable variants collapse onto 118 bodies. Full detail (incl. per-body
finish/applicator/variant rollups and raw-value histograms) is in
`best-bottles-body-geometry.csv`. Summary — canonical mm, site-confirmed unless noted;
`**?**` = depth unknown (escalated); a few residual same-size twin bodies are real
(e.g. two 9 ml roller shells) or single-row suspects retained deliberately with flags:

#### Aluminum Bottle
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 65 | 94 | 36 | 36 | 127–130 | 20-410 | 2 | Clear, White |
| 100 | 128 | 50 | 50 | 150 | 20-410 | 1 | Clear |
| 120 | 114 | 45 | 45 | 147 | 20-410 | 2 | Clear |
| 250 | 128 | 60 | 60 | 180 | 20-410 | 1 | Clear |
| 250 | 155 | 50 | 50 | — | 20-410 | 1 |  |
| 500 | 178 | 74 | 74 | 186 | 20-410 | 1 | Clear |

#### Apothecary
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 15 | 58 | 30 | 30 | 82 | Ground | 1 | Cobalt |
| 30 | 58 | 37 | 37 | 98 | Ground | 3 | Clear, Cobalt, Green |
| 118 | 52 | 27 | 27 | 77 | Ground | 1 | Clear |

#### Atomizer
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 5 | 76 | 18 | 18 | 81 | 13-415/13mm | 11 | Black, Clear, Cobalt, Pink |
| 5 | 92 | 15 | 15 | 104 | 10mm | 3 | Black, Clear |
| 10 | 82 | 23 | 23 | 89 | 17mm | 11 | Black, Clear, Cobalt, Green, Pink |

#### Bell
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 10 | 55 | 27 | 27 | 20–66 | 13-415 | 6 | Clear |

#### Boston Round
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 15 | 68 | 25 | 25 | 72–91 | 18-400 | 16 | Amber, Clear, Cobalt |
| 30 | 68 | 33 | 33 | 78 | 20-400 | 1 | Clear |
| 30 | 78 | 33 | 33 | 78–102 | 20-400 | 52 | Amber, Clear, Cobalt |
| 60 | 94 | 39 | 39 | 110–117 | 20-400 | 54 | Amber, Clear, Cobalt |

#### Circle
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 15 | 60 | 50 | 17 | 62–80 | 13-415 | 30 | Clear |
| 30 | 74 | 60 | 20 | 93–100 | 15-415 | 7 | Clear |
| 50 | 87 | 72 | 23 | 91–115 | 18-415/18-400 | 94 | Clear, Frosted |
| 100 | 105 | 89 | 29 | 109–136 | 18-415 | 87 | Clear, Frosted |

#### Cream Jar
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 3 | 18 | 35 | 35 | 50 | 20mm | 1 | Cobalt |
| 3 | 22 | 33 | 33 | 24 | 20mm | 1 | Clear |
| 5 | 16 | 31 | 31 | 18 | 27mm | 1 | Clear |
| 5 | 24 | 31 | 31 | 28 | 37mm/27mm | 3 | Amber |
| 15 | 26 | 55 | 55 | 29 | 37mm | 1 | Clear |
| 15 | 31 | 48 | 48 | 31 | 37mm | 1 | Clear |
| 20 | 34 | 55 | 55 | 29 | 40mm | 1 | White |
| 30 | 35 | 52 | 52 | 40 | 45mm | 4 | Amber, Frosted |
| 40 | 42 | 56 | 56 | 47 | 48/400 | 4 | Amber, Frosted |
| 60 | 51 | 59 | 59 | 57 | 58mm | 1 | Frosted |
| 63 | 51 | 59 | 59 | 57 | 58mm | 1 | White |

#### Cylinder
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 3 | 37 | 14 | 14 | 54 | 12mm | 2 | Clear |
| 4 | 49 | 14 | 14 | 67 | 12mm | 2 | Clear |
| 5 | 53 | 17 | 17 | 55–72 | 13-415 | 54 | Clear, Cobalt |
| 5 | 53 | 18 | 18 | 65 | 13-415 | 2 | Cobalt |
| 5 | 54 | 17 | 17 | 67 | 13-415 | 5 | Clear |
| 9 | 70 | 20 | 20 | 83–98 | 17-415 | 60 | Amber, Clear, Cobalt |
| 9 | 70 | 21 | 21 | 75 | 17-415 | 27 | Amber, Clear, Cobalt |
| 9 | 74 | 20 | 20 | 94 | 17-415 | 9 | Frosted |
| 9 | 74 | 21 | 21 | 75–98 | 17-415 | 51 | Clear, Frosted, Swirl |
| 9 | 79 | 20 | 20 | 50 | 18-400 | 1 | Clear |
| 9 | 79 | 21 | 21 | 47 | 18-400 | 1 | Clear |
| 9 | 106 | 18 | 18 | 88–126 | 13-415 | 60 | Clear, Frosted |
| 25 | 83 | 32 | 32 | 108–109 | 18-415 | 7 | Clear |
| 28 | 81 | 31 | 31 | 100 | 16mm | 4 | Clear |
| 30 | 51 | 42 | 42 | 71 | 18-415 | 2 | Clear |
| 50 | 98 | 37 | 37 | 116 | 16mm | 4 | Clear |
| 50 | 117 | 30 | 30 | 110 | 18-415 | 1 | Clear |
| 50 | 117 | 32 | 32 | 121–142 | 18-415 | 44 | Clear |
| 100 | 154 | 35 | 35 | 173–199 | 18-415 | 45 | Clear |
| 118 | 116 | 41 | 41 | 124 | — | 1 | Clear |
| 227 | 156 | 51 | 51 | 159 | — | 1 | Clear |
| 454 | 195 | 62 | 62 | 194 | — | 1 | Clear |

#### Decorative
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 3 | 42 | 18 |  | 53 | 14.3mm | 1 | Clear |
| 4 | 46 | 32 |  | 53 | 8mm | 2 | Frosted |
| 5 | 66 | 26 |  | 87 | 17.52mm | 1 | Clear |
| 6 | 48 | 22 |  | 59 | 14.3mm | 1 | Clear |
| 10 | 80 | 28 |  | 102 | 17.52mm | 1 | Clear |
| 32 | 77 | 42 |  | 105 | Ground | 2 | Clear, Cobalt |
| 35 | 43 | 63 |  | 82 | Ground | 1 | Cobalt |
| 35 | 44 | 63 |  | 80–81 | Ground | 2 | Clear, Green |
| 355 | 52 | 92 |  | 192 | Ground | 1 | Clear |

#### Diamond
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 60 | 88 | 39 | **?** | 92–115 | 18-415 | 45 | Clear |

#### Diva
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 30 | 81 | 43 | 43 | 85–109 | 18-415 | 36 | Clear |
| 46 | 88 | 49 | 49 | 113 | 18-415 | 2 | Clear, Frosted |
| 46 | 89 | 49 | 49 | 93–116 | 18-415 | 142 | Clear, Frosted |
| 100 | 113 | 64 | 64 | 117–140 | 18-415 | 45 | Clear |

#### Elegant
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 15 | 61 | 30 | **?** | 73 | 13-415 | 1 | Clear |
| 15 | 61 | 35 | 18 | 73–95 | 13-415 | 28 | Frosted |
| 15 | 61 | 36 | 18 | 63–80 | 13-415 | 57 | Clear |
| 30 | 75 | 44 | 22 | 93–100 | 15-415 | 14 | Clear, Frosted |
| 60 | 86 | 54 | 27 | 90–135 | 18-415 | 96 | Clear, Frosted |
| 60 | 87 | 54 | 27 | 110 | 18-415 | 3 | Clear, Frosted |
| 100 | 109 | 35 | **?** | 130 | 18-415 | 1 | Clear |
| 100 | 109 | 61 | 30 | 113–137 | 18-415 | 90 | Clear, Frosted |

#### Empire
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 50 | 88 | 37 | 37 | 93–121 | 18-415 | 49 | Clear |
| 100 | 107 | 46 | 46 | 110–139 | 18-415 | 46 | Clear |

#### Flair
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 15 | 56 | 41 | 20 | 58–77 | 13-415 | 30 | Clear |

#### Grace
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 55 | 113 | 52 | 30 | 115–141 | 18-415 | 45 | Clear |

#### Lotion Bottle
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 3 | 118 | 33 | 33 | 124 | snap | 1 | Clear |
| 30 | 118 | 33 | 33 | 124 | 18mm | 3 | Clear |

#### Pillar
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 9 | 57 | 20 | 20 | — | Size: GBPillar | 1 | Clear |
| 9 | 57 | 21 | 21 | 20 | 13-415/17-415 | 3 | Clear |

#### Plastic Bottle
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 10 | 94 | 24 | 24 | 75 | — | 1 | Clear |
| 30 | 68 | 24 | 24 | 82–85 | 13-415 | 3 | Clear |

#### Rectangle
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 9 | 47 | 24 | **?** | 64 | Ground | 3 | Clear |
| 10 | 50 | 29 | 19 | 63–71 | 13-415 | 30 | Clear |
| 10 | 101 | 17 | 17 | 106–121 | 13-415 | 30 | Clear |

#### Round
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 78 | 73 | 59 | 59 | 77–131 | 18-415 | 90 | Clear, Frosted |
| 128 | 83 | 69 | 69 | 87–135 | 18-415 | 93 | Clear, Frosted |
| 128 | 84 | 69 | 69 | 104 | 18-415 | 3 | Clear, Frosted |

#### Royal
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 13 | 56 | 17 | 17 | 62–69 | 13-415 | 3 | Clear |
| 13 | 56 | 44 | 44 | 58–76 | 13-415 | 26 | Clear |
| 14 | 64 | 44 | 44 | 92 | 11mm | 1 | Clear |

#### Sleek
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 5 | 45 | 17 | 17 | 50–64 | 13-415 | 29 | Clear |
| 5 | 45 | 18 | 18 | 47 | 13-415 | 1 | Clear |
| 8 | 66 | 17 | 17 | 62–86 | 13-415 | 30 | Clear |
| 30 | 98 | 28 | 28 | 102–171 | 18-415 | 40 | Clear |
| 50 | 139 | 28 | 28 | 143–171 | 18-415 | 46 | Clear |
| 100 | 149 | 35 | 35 | 189–198 | 18-415 | 8 | Clear |
| 100 | 149 | 36 | 36 | 178–199 | 18-415 | 38 | Clear |

#### Slim
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 30 | 87 | 30 | 30 | 91–115 | 18-415 | 39 | Clear |
| 50 | 121 | 30 | 30 | 110 | 18-415 | 1 | Clear |
| 50 | 121 | 31 | 31 | 112–147 | 18-415 | 44 | Clear |
| 100 | 154 | 35 | 35 | 180 | 18-415 | 6 | Clear |
| 100 | 154 | 37 | 37 | 145–197 | 18-415 | 39 | Clear |

#### Square
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 15 | 52 | 26 | 26 | 55–73 | 13-415 | 29 | Clear |

#### Tall Cylinder
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 9 | 106 | 18 | 18 | 109 | 13-415 | 1 | Clear |

#### Teardrop
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 9 | 43 | 20 | 20 | 68 | Ground | 3 | Clear, Cobalt, Green |

#### Tulip
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 5 | 45 | 23 | 23 | 47–72 | 13-415 | 30 | Amber |
| 6 | 45 | 23 | 23 | 50–73 | 13-415 | 30 | Clear |

#### Vial
| ml | body H | width | depth | with-cap | neck | variants | finishes |
|---:|---:|---:|---:|---|---|---:|---|
| 1 | 35 | 8 | 8 | 44 | Plug | 4 | Amber, Clear |
| 2 | 22 | 16 | 16 | 24 | 13-425 | 1 | Amber |
| 2 | 35 | 12 | 12 | 37 | 8-425 | 4 | Clear |
| 3 | 27 | 15 | 15 | 20 | 13-425 | 1 | Cobalt |
| 3 | 29 | 14 | 14 | 32–75 | 13-425 | 2 | Clear, Green |
| 4 | 45 | 15 | 15 | 45–63 | 13-425 | 12 | Clear |

Residual same-size oddities kept on purpose (all flagged in the CSVs): Boston Round
30 ml has a 1-variant 68 mm row (vs 52 variants at 78 mm) pending live re-check;
Royal 13 ml keeps 3 rows at width 17 (site says 44 — the 17 is depth-ish/stale);
Cream Jar small sizes have genuine multiple shells; Cylinder 9 ml legitimately has
several shells (70×20 classic roller, 74×21 frosted/swirl, 106×18 tall) plus two
inch-junk rows (79.4).

---

## 5. Materials & mechanics — what these bottles physically are

**Glass bodies.** Soda-lime glass; finishes: **Clear, Frosted (satin-etched), Amber,
Cobalt Blue, Black, Green**, plus textured **Swirl** (9 ml cylinder) and decorative
colored glass (Blue-Frost hearts, cobalt/green teardrops). Frosted = surface finish
on the same mold — geometry identical to its clear twin. Wall glass is thick and
optically present; round-glass volume behavior is codified in
`src/config/bestBottlesFamilyProfiles.ts` (`BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE`);
flat-faced families (Empire, Square, Rectangle, Sleek, Slim per its profile
assignments) deliberately omit the curvature cue.

**Caps are PHENOLIC (molded high-grade plastic), NEVER metal** — operator-confirmed
2026-07-04 and encoded in `BEST_BOTTLES_COMPONENT_MATERIAL_TARGETING_CUE`. Shiny
colorways (shiny gold/silver/black) are *genuinely mirror-bright and chrome-like*;
matte colorways read soft satin. The failure mode to prevent is describing caps as
"metal" in prompts (chrome-CGI cap disease) — and equally, dulling legitimately
shiny caps. Cap wardrobe from the PDF + site: shiny/matte gold, silver, black,
copper/rose, white, dotted & hearts/stars prints, **faux-leather wrapped caps**
(black / brown croc / tan snake with polished silver trim rings), tassel crown caps
(hearts line), gold dome **jewel-top tola caps** (red/blue/green cabochon), ribbed
black/white vial caps, and glass stoppers (see below).

**Roller balls: two real materials, both in the catalog.** Convex `ballMaterial`:
**Metal 240 rows / Plastic 236 rows** (blank = non-roller). The steel ball is
*genuinely polished steel*; the plastic ball is translucent-white. Either sits in a
**translucent plastic plug housing** on the neck — the housing is never metal, the
ball is never recolored to match the cap. PDF: steel balls headline the 5–15 ml
rectangular/tall-cylinder rollers and 28/50 ml cylinders; plastic balls headline the
classic 9 ml cylinder and Boston Round rollers — but both exist across lines; trust
`ballMaterial` per SKU.

**Applicator systems** (PDF mechanics + Convex `applicator`/`assemblyType`):
- **Roll-on** (plug + ball + over-cap) — 3-part
- **Fine-mist sprayer** (pump + dip tube + clear over-cap; 2/3/4 ml sample vials and up)
- **Perfume spray pump** (collared pump + tall over-cap)
- **Vintage/antique bulb sprayer** ± **tassel** (mesh-wrapped bulb: red, black, pink, ivory, lavender, silver, gold, purple, white; silver or gold ferrule; the tassel variant reduces with-cap height because the tall cap is replaced)
- **Lotion / treatment pump** incl. **over-the-cap (COCP)** style where a cowl hides the mechanism
- **Dropper** (black rubber bulb + glass pipette; collar colors white/black/silver/gold/rose-gold; 1-dram size is black-only)
- **Orifice reducer** (clear press-in plug for splash-on bottles) — the "Reducer" applicator
- **Glass wand / dabber** (9 ml vial with applicator; tola bottles)
- **Glass stoppers** — apothecary ball, **Eternal Flame** faceted spire, teardrop bulb; ground-glass necks; PDF warns stoppers loosen in transit (never ship filled)
- **Atomizer engine** inside **metal-shell atomizers** (the ONE genuinely metal-bodied line besides aluminum: anodized shells in pink, silver, gold, red, blue, green, black, prints; glass inner vial)
- **Aluminum bottles/cans**: brushed aluminum, screen-printable; sprayers, lotion pumps, or tear-off plug caps.

**Assembly taxonomy** (Convex): 2-part 1,221 · 3-part 795 · complete-set 62 ·
component 130. **Neck finishes** (site inventory): 18-415 (1,283) · 13-415 (523) ·
17-415 (164) · 20-400 (127) · 15-415 · 18-400 · 13-425 · 20-410 · 8-425 · ground-glass
(stopper bottles) · mm-spec jar lids (27–58 mm). The Convex `components[]` array is a
real per-product BOM (component SKUs, prices, images) — use it to know exactly which
cap/sprayer a variant ships with.

---

## 6. Visual identity & imagery rules

**Source photography (site + PDF)** — white background, straight-on front elevation,
soft even lighting, no props/hands/labels; **caps and applicators photographed
detached, standing beside the bottle** (the sidecar convention Madison inherited);
auxiliary views per SKU: `images/store/measured/<websiteSku>.gif` (dimension
callouts) and `images/store/depthview/<websiteSku>.gif` (¾ turn showing the depth
axis — the visual proof of §3).

**Madison rendering contract** (the overlay we impose on top of that identity —
already encoded in repo, cross-referenced here so this sheet is the one index):
- Background **Bone `#F5F3EF`** flat, never white/transparent/checkerboard (`src/config/imagePresets.ts`)
- Single soft key light **upper-front-left**; contact shadow **back-right ~2:00–2:30**, never directly beneath
- Canvas **2080×2288** (10:11 exact; both edges ×16 for gpt-image-2), catalog masters; framing per family via `src/config/bestBottlesFamilyProfiles.ts` (24 profiles + generic backstop; height-interpolated fill; sidecar `right-sidecar` placement)
- Exactly ONE product matching the reference identity; cap-state exactly `cap-on` / `cap-off` (cap-off = cap beside bottle)
- Round clear-glass families get the **volume cue** (interior half-tone deeper than canvas, deepening to the walls, perfectly smooth); flat-faced families must NOT get it
- Caps: phenolic per §5 — shiny stays mirror-bright, matte stays satin, steel ball stays steel, plug housing stays translucent
- Prompt path: vendored canon `src/config/bestBottlesCatalogCanon.ts` + family framing profile, assembled by `buildFinalPrompt()` in `src/lib/bestBottlesPromptPreflight.ts`

**Family silhouette vocabulary** (PDF-derived, for prompt language):
- **Cylinder** — straight circular column, flat shoulder, short threaded neck; 3–454 ml; the workhorse. **Tall Cylinder** — the 106×18 pencil version.
- **Boston Round** — rounded shoulder, short neck, pharmacy classic; amber/cobalt/clear.
- **Empire** — square-section column tapering gently wider toward the shoulder; flat faces.
- **Sleek / Slim** — narrow square-section towers (Sleek slightly squarer/taller at 50 ml: 139×28; Slim 121×31); PDF shows Sleek with black trims, Slim with gold.
- **Elegant** — flat rectangular flask, softly radiused corners, thick glass base.
- **Circle** — flat disc ("watch face") standing on a small foot; big round face, thin profile.
- **Round** — oblate sphere on a small base (78 ml: 73×Ø59; 128 ml: 83×Ø69).
- **Diva** — footed urn with vertical flutes/ribs, decorative collar ring; the vintage centerpiece (30/46/100 ml).
- **Grace** — tall oval/teardrop shouldered flask (113×52×30), the namesake of `grace_sku`.
- **Diamond** — flat flask with diamond lattice cut pattern (60 ml).
- **Tulip** — small waisted/tapered bud vase profile (45×23).
- **Flair** — small flared-silhouette flat bottle (56×41×20).
- **Royal** — small curvy hourglass flask (56×44).
- **Bell** — bell-shaped mini (55×27). **Pillar** — small round pillar (57×21).
- **Square** — cube-ish mini column (52×26). **Rectangle** — footed rectangular mini (50×29×19) and tall rectangular column (101×17) — two distinct site families collapsed under one Convex family (F6).
- **Apothecary** — pharmacy jar with ground-glass ball stopper; cobalt/clear/green. **Eternal Flame** — squat saucer with faceted flame spire stopper (35 ml). **Teardrop** — mini bulb-stopper decorative.
- **Atomizer** — slim metal-shell tube with sprayer under a pull-off shell cap. **Aluminum** — brushed metal cylinder, domed shoulder.
- **Vial** — sample tubes 1 ml–10 ml (plug or 8-425/13-425 threads). **Cream Jar** — squat wide-mouth glass/PP jars with inner liner disc + cap.
- **Decorative** — hearts (tassel/keychain caps), tola (curved-octagonal attar flask, jewel dome cap), genie/pear/marble shapes, tear drops.

---

## 7. Discrepancy ledger — every named finding from this audit

Status: ✅ resolved in canon · ⚠️ resolved-with-flag (verify on next physical pass) · 🔺 open escalation.

| # | Finding | Evidence | Status / canonical resolution |
|---|---|---|---|
| F1 | **Grace 55 ml matte-gold spray row** claimed body 90 ±1 (44 sibling rows: 113 ±2) | Convex live + site (113 ±2, W52, D30) | ✅ 113×52×30; single corrupted row |
| F2 | **Empire 72/78 mm ghost diameters** persist on 4 `-01` duplicate rows (primaries were fixed to 37/46) | Convex live 2026-07-12 | ✅ 50 ml = 88×37×37, 100 ml = 107×46×46 (site-confirmed); dup rows flagged |
| F3 | **Sleek 50/100 ml carry the same 72/78 junk** on ~76 rows | Site: 50 ml = 139×**28**, 100 ml = 149×**35–36** | ✅ corrected; biggest single-family width error |
| F4 | **Circle family wrong widths & height-mode inversion** — Convex width 78 (or 35) vs site 89 at 100 ml; Convex majority height 100 vs true 105 | Site spec tables | ✅ 15=60×50×17 · 30=74×60×20 · 50=87×72×23 · 100=105×89×29; *majority-vote hazard documented* |
| F5 | **Cylinder 9 ml roller heights**: 37 rows at 63 mm vs site 70/74 | Site (70 ±1 classic, 74 swirl/frosted) | ✅ two real shells: 70×20–21, 74×20–21 + tall 106×18 |
| F6 | **Convex "Rectangle" flattens two different site families** (Tall Rectangular 101×17 vs Footed Rectangular 50×29×19; Convex width 23 matched neither) | Site taxonomy (also: site splits Tall Cylinder ×62, Queen, Daisy that Convex merges/lacks) | ✅ both bodies in registry; ⚠️ family-mapping table recommended in Convex |
| F7 | **Round 78 ml page contradicts itself**: spec table 73×Ø59 vs its own measured render 84.64×Ø68.92 (labeled 78 ml/2 oz) | Site page + render fetched 2026-07-12 | ⚠️ canon = 73×59 (spec + Convex mode agree); 🔺 render conflict → physical measure |
| F8 | **Component `93.8` plague** — ~80 component rows (sprayers/droppers/caps) carry heightWithoutCap 93.8 junk; real component heights live in `heightWithCap`/site | Convex export | ✅ component lane excluded from bottle geometry; flagged |
| F9 | **Grace width 55 → 52** systematic on all 45 rows | Site 52 ±1 | ✅ corrected |
| F10 | **Tulip 5 ml polluted** with a 61×17 alien body (site tulip = 45×23 in both 5 ml amber and 6 ml clear) | Site | ✅ 45×23 canonical; alien rows corrected |
| F11 | **Royal 13 ml width 17 vs 44** (3 rows vs 26) | Site 44 | ⚠️ 44 canonical; the 17 looks like a stale depth-ish value |
| F12 | **17 inch-conversion artifacts** (79.4, 50.8, 25.4, 101.6 …) incl. Eternal Flame Ø25.4 vs site 63 | Grid analysis + site | ✅ corrected where site speaks; flagged `inch_conversion_artifact` |
| F13 | **352 dead site URLs**; **Queen & Daisy 100% dead**, Bell 30/34 dead; **162 Convex-only SKUs** vs 9 master-only | Crawl 2026-07-12 | ⚠️ retirement status recorded; decide catalog policy for dead-on-site SKUs |
| F14 | **Elegant width chaos** (Convex diameters 30/35/37/39/42.6/60/68/78 across sizes — different passes recorded different axes/junk) | Site W×D: 36×18 / 44×22 / 54×27 / 61×30 | ✅ corrected on 267 rows — largest sync-back family |
| F15 | **`measured/` render inch callouts are unreliable** (Elegant 30: mm callouts 74.65/44.32 match spec; inch callouts 2.52″/1.4″ match nothing) | Renders fetched 2026-07-12 | ✅ rule: renders are mm-only evidence, inches ignored |
| F16 | **Boston Round site "Item Depth" ≈ shoulder height, not an axis** (Ø33 with "depth 73" on a 78 body) | Site | ✅ quarantined (`site_depth_semantics_suspect`); round ⇒ D=Ø |
| F17 | **Aluminum 100 ml body height** = 127.8 (5.03″ artifact); site publishes only with-cap 150 | Both | ⚠️ 127.8 kept at medium confidence; on physical worklist |
| F18 | **Diamond 60 ml depth unknown** (45 variants) — site gives W 39 only | Site + PDF | 🔺 the one remaining depth hole; physical measure or depthview-render photogrammetry |
| F19 | **`widthMm`/`depthMm` in Convex are diameter copies** (width==diameter in 1,488/1,488 sampled live rows; width≠depth in 0) | Live Convex 2026-07-12 | ✅ documented; do not consume until real W/D are written back |
| F20 | **Duplicate-lineage rows systematically missed past fixes** (`-0N` graceSkus / 151 duplicate websiteSkus; 65 stale outlier values incl. F2, Boston Round 30 amber 60×28→78×33) | Cross-lane | ✅ dup-corrected in canon; root cause named for the sync migration |
| F21 | **168 site pages publish only with-cap height** (Apothecary, some Aluminum/Atomizer…) — naive scraping reads it as body height | Crawl | ✅ parser rule: body H = `Item Height without Cap` only |

Also normalized: master↔Convex drift is tiny (16 fields, mostly neck-thread fixes);
website-truth-status (identity lane) remains valid — its 205 `truth_conflict` /
85 `alias_exception` rows are taxonomy issues, orthogonal to measurements.

---

## 8. Verification protocol & the path to a verified catalog

**To verify any dimension, in order:**
1. **Live PDP spec table** (`Item Height without Cap` / `Item Diameter` or `Item Width`+`Item Depth`) — nominal mm.
2. **`measured/` + `depthview/` renders** for the SKU — mm callouts only (F15) — as corroboration and for axis disambiguation.
3. **Physical measurement** (calipers, record as `value ±tol mm`, note cap-state and axis) — the only lane that outranks the site; owned by the client/Cowork lane.
4. Write the result back to **Convex** (single writer: the Best-Bottles-Website repo holds the write token; Madison stays read-only) and flip `verified:true`.

**Sync-back worklist generated by this audit** (`conflict_flags` ≠ empty in the master CSV):
- **839 SKUs** need at least one Convex measurement correction — by family: Elegant 267, Sleek 167, Circle 94, Rectangle 63, Cylinder 48, Grace 45, Flair 30, Square 29, Slim 17, Tulip 14, Round 5, Empire 4, + component/packaging rows.
- **639 flat-family rows** should receive their first real `depthMm` (values already in the master CSV).
- The 10 existing manual overrides (`measurement_override_pending_convex_sync`) are re-confirmed — fold them into the same migration.
- Target state: `verified:true` moves from **10 → 2,3xx** as rows sync; `widthMm`/`depthMm` become real axes per §3 semantics.

**Physical-measurement escalations (the short list):** Diamond 60 ml depth (F18) ·
Round 78/128 ml spec-vs-render conflict (F7) · Aluminum 100 ml body height (F17) ·
Boston Round 30 ml lone 68 mm row · Royal 13 ml 17 mm rows (F11).

**Rules of engagement going forward**
- Image generation consumes **canonical values only** (`canon_*` columns), never raw `diameter` for flat families, never `widthMm`/`depthMm` from Convex until the sync lands.
- Any new SKU enters as `verified:false` until it passes the protocol above.
- Never resolve a conflict by majority vote alone (F4). Never ingest a site "Depth" for a round family (F16). Never trust a bare number on the ⅛-inch grid (F12).

---

## 9. Provenance & regeneration

Built 2026-07-12 from: full live-site crawl (2,683 URLs; raw HTML cached in the
session scratchpad under `website-scrape/products/`), live Convex queries
(`https://helpful-elephant-638.convex.cloud/api/query`, `products:getBySku` /
`products:getByFamily` / `products:listAll`; read-only, no auth needed) plus the
same-morning full export `tmp/best-bottles-convex-live-products.csv`, the Nemat
master catalog CSV (2026-04-10), `public/data/best-bottles-catalog-lite.json`
(2,483-row join), the 10 manual overrides, the 2026-07-11 website-truth identity
audit, the 2026-07-12 generation-readiness snapshot, and the 48-page catalog PDF
(`~/Downloads/bestbottles-compressed (2).pdf`).

Method: per-SKU join on `websiteSku` (site) and `graceSku` (Convex/master);
tolerance-aware comparison (agree ⇔ |Δ| ≤ max(±tol, 2 mm)); product-group×capacity
consensus for duplicate-lineage correction; ⅛-inch-grid artifact detection;
precedence per §1. The master CSV records, for every row, all raw lane values, the
canonical value, its source, its confidence, and every flag raised — so any number
in this document can be audited back to its evidence.

**SKU grammar** (identity keys): `graceSku` = `{GB|LB|AB|CJ|PB|CMP|PKG|ACC}-{FAMILY}-{COLOR}-{SIZE}-{APPLICATOR}-{CAP}[-T|-0N]`
(GB glass bottle, LB lotion bottle, AB aluminum, CJ cream jar, PB plastic, CMP component, PKG packaging, ACC accessory;
`-T` tall-cap variant; `-0N` duplicate-lineage suffix — treat with suspicion per F20). `websiteSku` = site "Item Name"
(e.g. `GBGrce55SpryMtGl`) — the join key to the live site. `productGroupId`/`productGroupSlug` = PDP grouping.
Identity record: `buildBestBottlesGenerationIdentity()` in `src/lib/bestBottlesGenerationIdentity.ts`.

---

*This sheet supersedes ad-hoc measurement lookups. If a value here disagrees with
what you see in Convex, this sheet is right until the Convex sync-back lands; if it
disagrees with a physical measurement, update this sheet and the master CSV in the
same change. Nothing else is canonical.*
