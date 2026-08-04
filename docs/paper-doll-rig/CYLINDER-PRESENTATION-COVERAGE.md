# Cylinder paper-doll presentation coverage

**State:** runtime display-position contract implemented; asset production remains family-by-family

The Cylinder catalog must not be scaled by capacity alone. The reviewed applicator-curve evidence defines 18 distinct assembled-product positions across spray, roll-on, and reducer systems. Sixteen positions are source-backed and two classic 9 mL roll-on shells remain blocked for missing exact references.

Runtime source: `src/config/bestBottlesCylinderPresentation.ts`

Evidence source: `tmp/best-bottles-reference-production/cylinder-applicator-curves-v1/cylinder-applicator-curves-manifest.json`, SHA-256 `c2dbb366cb32fb09573df8627845065ae0a6c51e59efcedb41f23930439a954e`

## Coverage that must remain distinct

| Display position | Body height | Assembled height | Catalog target | State |
|---|---:|---:|---:|---|
| 3 mL spray | 37 mm | 54 mm | 56% | ready |
| 4 mL spray | 49 mm | 67 mm | 58% | ready |
| 5 mL 13-415 spray | 53 mm | 72 mm | 61% | ready |
| 9 mL regular spray | 70 mm | 96 mm | 69% | ready |
| 9 mL tall 13-415 spray | 106 mm | 111 mm | 71% | ready |
| 25 mL spray | 83 mm | 108 mm | 73.210526% | ready |
| 50 mL spray | 117 mm | 142 mm | 78% | ready |
| 100 mL spray | 154 mm | 195 mm | 79% | ready |
| 5 mL roll-on | 53 mm | 65 mm | 61% | ready |
| 9 mL classic 20 mm roll-on | 70 mm | 83 mm | none | blocked: exact reference missing |
| 9 mL classic 21 mm roll-on | 70 mm | 75 mm | none | blocked: exact reference missing |
| 9 mL regular roll-on | 74 mm | 87 mm | 69% | ready |
| 9 mL tall roll-on | 106 mm | 118 mm | 71% | ready |
| 28 mL big roll-on | 81 mm | 100 mm | 74% | ready |
| 50 mL big roll-on | 98 mm | 116 mm | 78% | ready |
| 25 mL reducer | 83 mm | 97 mm | 73.210526% | ready |
| 50 mL reducer | 117 mm | 131 mm | 78% | ready |
| 100 mL reducer | 154 mm | 184 mm | 79% | ready |

## Enforcement

The display key is resolved before the capacity fallback. A complete body-plus-component assembly receives one uniform post-assembly transform. Body, cap, fitment, tube, shadow, and integration pixels may never receive independent catalog-presentation scaling.

The 9 mL tall 13-415 sprayer therefore cannot silently inherit the regular 9 mL presentation target. Unknown and blocked display positions fail closed.

This contract establishes framing coverage, not asset completion. Every position still needs its own verified body authority, compatible component responsibilities, placement review, and named approval before release.
