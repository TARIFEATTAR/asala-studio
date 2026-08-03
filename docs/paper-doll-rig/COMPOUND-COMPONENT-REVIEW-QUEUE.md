# Compound component review queue

This is a conservative audit queue, not an automatic plate-count expansion.
Every pump, sprayer, dropper, bulb/tassel system, and compound applicator lane
must be reviewed by physical responsibility before production plates are counted.

## Summary

- Catalog lanes requiring the gate: 20
- Source identities represented: 83
- Source-ready physical-review lanes: 15
- Source-incomplete lanes: 3
- Lanes with an explicit physical-review decision: 6
- Final reusable-plate delta: unresolved until responsibility review

| Lane type | Descriptor evidence | Identities | Source status | Audit status |
|---|---|---:|---|---|
| pump | pump :: 17-415 :: none :: Pump | 3 | local-authorities-require-reconciliation | shared-exterior-geometry-locked-compound-closed-swatch-and-body-context-gates-remain |
| sprayer | sprayer :: 17-415 :: Fine Mist Sprayer :: Spray | 6 | local-authorities-require-reconciliation | shared-exterior-geometry-locked-compound-closed-swatch-and-body-context-gates-remain |
| dropper | dropper :: 17-415 :: Dropper :: Dropper | 1 | source-incomplete | source-evidence-required-before-decomposition |
| sprayer | sprayer :: 13-415 :: Fine Mist Sprayer :: Spray | 11 | source-incomplete | source-evidence-required-before-decomposition |
| sprayer | sprayer :: 18-415 :: Fine Mist Sprayer :: Spray | 2 | source-incomplete | source-evidence-required-before-decomposition |
| bulb-sprayer | bulb-sprayer :: 18-415 :: Cap/Closure :: none | 1 | source-ready-physical-review | decomposition-audit-required |
| bulb-sprayer | bulb-sprayer :: 18-415 :: Fine Mist Sprayer :: Spray | 1 | source-ready-physical-review | decomposition-audit-required |
| bulb-sprayer | bulb-sprayer :: 18-415 :: none :: Spray | 2 | source-ready-physical-review | decomposition-audit-required |
| bulb-sprayer | bulb-sprayer :: unknown-neck :: N/A :: none | 1 | source-ready-physical-review | decomposition-audit-required |
| bulb-sprayer+sprayer | bulb-sprayer+sprayer :: 18-415 :: none :: Spray | 14 | source-ready-physical-review | split-for-physical-review |
| compound-applicator | cap :: 18-400 :: none :: Applicator | 1 | source-ready-physical-review | decomposition-audit-required |
| dropper | dropper :: 18-400 :: Dropper :: Dropper | 5 | source-ready-physical-review | decomposition-audit-required |
| dropper | dropper :: 18-400 :: none :: Dropper | 1 | source-ready-physical-review | decomposition-audit-required |
| dropper | dropper :: 18-415 :: Dropper :: Dropper | 3 | source-ready-physical-review | decomposition-audit-required |
| dropper | dropper :: 20-400 :: Dropper :: Dropper | 11 | source-ready-physical-review | quarantined-body-contextual-length |
| dropper | dropper :: 20-400 :: none :: Dropper | 1 | source-ready-physical-review | decomposition-audit-required |
| pump | pump :: 18-415 :: none :: Pump | 7 | source-ready-physical-review | quarantined-responsibility-decomposition |
| sprayer | sprayer :: 13-415 :: none :: Spray | 1 | source-ready-physical-review | decomposition-audit-required |
| sprayer | sprayer :: 15-415 :: Fine Mist Sprayer :: Spray | 5 | source-ready-physical-review | dimension-calibrated-authority-review-created-named-approval-required |
| sprayer | sprayer :: 18-415 :: none :: Spray | 6 | source-ready-physical-review | decomposition-audit-required |

## Counting rule

The source-backed master shot-list count is a baseline. Do not increase or decrease the reusable production-plate count until a reviewed responsibility map proves the final split.

The local 17-415 plastic and metal roller fitments are also covered by the
responsibility gate. Their housing and ball remain one exterior fitment when
they are not independently selectable; the roll-on overcap remains a separate
plate.

No item in this queue claims geometry lock, production eligibility, Current
Release mutation, or Sanity mutation.
