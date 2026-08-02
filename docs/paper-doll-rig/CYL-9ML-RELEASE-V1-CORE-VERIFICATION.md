# CYL-9ML Release v1 Core Verification

**Verified:** 2026-08-01  
**Branch:** `codex/best-bottles-product-hub-pipeline`  
**Verdict:** `CORE_VALID_WITH_RESEARCH_BLOCK`

This is the completed core beneath the future Madison visual workbench, Sanity
publisher, storefront compositor, interactive 3D, and AR surfaces. It is not a
claim that those consumer surfaces or the entire Best Bottles catalog are
finished.

## Architecture decision proved by the trial

The geometry authority is a parametric Blender mesh, not a generated image and
not one finish chosen as a raster master. Mirror chrome, matte white, glossy
black, and translucent-frosted are shader/material variants rendered through
one mesh, camera, placement recipe, and alpha pipeline. The opaque variants have
an exact binary silhouette match (`IoU 1.0000`) and share one exported geometry
mask.

This resolves the mirror-vs-matte master question: neither raster finish should
own geometry. The 3D mesh owns geometry. Mirror colourways may still use
deterministic tone derivation where appropriate, but finish changes use separate
physically based materials on the shared mesh.

The translucent-frosted cap is deliberately blocked until it is evaluated in
assembled bottle context. It cannot be approved from an isolated transparent
layer. Rhinestone closures are not part of this trial; they should use fixed
instanced stones or a locked UV/decal map on the same mesh so per-stone placement
is deterministic.

## Release evidence

- Family: `CYL-9ML`
- Release: `1.0.0-draft.1`
- Schema: `1`
- Canvas: `2080 × 2288`, Bone `#F5F3EF`
- Source commit: `77c94950ac06f99b635abb12c7f079265cc258ea`
- Renderer provenance: `blender-shared-mesh:over_cap`
- Canonical manifest SHA-256: `ae63771148024b24230fd77d7a5518082062a1b717df13f2152ba3ebdbbc4755`
- Assets: 5 frozen bodies + 4 cap materials
- Approved assembly mappings: 15 (5 bodies × 3 opaque caps)
- Shared closure geometry-mask SHA-256: `e1dc76144a875c0a7aadd236f9fbbbb78744a6874904d757186a9a98927b17d9`

### Frozen body bytes

| Variant | SHA-256 |
|---|---|
| Clear (`CLR`) | `97cfe967a4ab02ba4de51c07416c80df54244adf8dfab95406a36f4fe90e933f` |
| Amber (`AMB`) | `c84db213449da4ef6afbcb67fad0da5811ae937c3c9c1234be801cb473ea31c3` |
| Cobalt (`BLU`) | `87804d45a242795aaecf10d677ad469b22803e2f2476421ffbce5d4d944f148c` |
| Frosted (`FRS`) | `c844fb9f3a6ffb467daa02d17cb2378b659fc2e0be166f13073bb7b4f8422956` |
| Swirl (`SWL`) | `c2b67ee9151dc89d44d3a8d65a112b908bb84a2c833ba0bcf643b16586371e68` |

All five hashes match the frozen body registry. Their source files were copied
byte-for-byte; none were regenerated.

### Closure material bytes

| Variant | Material | Approval | SHA-256 |
|---|---|---|---|
| `SHN-SL` | mirror chrome on moulded phenolic plastic | approved | `29158b4670595bca0a965a8a9750b4bde258de722b69a64d2e8a789adeb7ad9e` |
| `WHT` | matte white coating | approved | `10cd55c82ad7d1eea4c62df60144e008251e8cbb1d4221d9f3f73bf860fcf73b` |
| `SHN-BLK` | glossy black coating | approved | `07b8c08e4a08bdbd386498b2bab788a80126d524bf3fa6fc85dd99149ce9c1ef` |
| `TRNS-FRS` | translucent-frosted plastic | blocked | `fdc2521c5d07db007b0e7524b57f02b48f004d286124d0d0373e3888525ebd37` |

Expected blockers, and no others:

```text
assembly_context_required:closure__17-415__rollon-overcap__trns-frs@fdc2521c5d07
blocking_gate_blocked:translucent-assembly-context
```

## Database verification

Supabase CLI: `2.111.0`.

The 2026-04-28 Supabase table-exposure change is handled explicitly: each of the
six new tables grants `SELECT` to `authenticated`, grants server access to
`service_role`, grants nothing to `anon`, and has organization-scoped RLS.
Authenticated write policies do not exist.

The migration was applied from a clean database in an isolated local Supabase
harness with the real `organizations`, `organization_members`, and
`is_organization_member` prerequisites represented. Results:

```text
supabase db reset --local          PASS
supabase test db --local           PASS — Files=1, Tests=12
supabase db lint --local           PASS — No schema errors found
supabase db advisors --local       PASS — No issues found
```

The 12 transactional assertions cover all six tables, RLS, read-only grants,
organization-bound composite foreign keys, duplicate identities, approved
component immutability, append-only QA, ready/published release immutability,
and the complete 5-body/4-cap fixture transaction.

A reset against the repository's entire active migration folder is independently
blocked before this migration: `20250101000000_create_brand_scans.sql` references
`public.organizations` before that relation exists. The ledger migration itself
applies and tests cleanly. No remote Supabase project was linked, reset, migrated,
or otherwise changed.

## Application verification

Exact commands and outcomes:

```text
npx tsx --test \
  src/lib/paperDoll/releaseContract.test.ts \
  src/lib/paperDoll/releaseValidator.test.ts \
  src/lib/paperDoll/cyl9FamilyRelease.test.ts \
  scripts/paper-doll/verify-family-release.test.ts
PASS — 17/17

npm run test:paperdoll
PASS — 48/48

npx tsc --noEmit
PASS

npm run paperdoll:build-cyl9-release -- \
  --output outputs/paper-doll-family-releases/CYL-9ML/1.0.0-draft.1
EXIT 2 — expected translucent assembly-context block only

npm run paperdoll:verify-release -- \
  --manifest outputs/paper-doll-family-releases/CYL-9ML/1.0.0-draft.1/manifest.json \
  --validation outputs/paper-doll-family-releases/CYL-9ML/1.0.0-draft.1/validation.json \
  --database-status passed
EXIT 2 — CORE_VALID_WITH_RESEARCH_BLOCK
```

The verifier recomputes all asset and geometry-mask hashes, recomputes validation
from the manifest, compares it with saved validation evidence, checks the exact
five-body and three-opaque-material identities, and fails with exit `1` on any
unexpected blocker or drift. Exit `2` is reserved for the represented
translucent research block.

## Honest boundary and next plan

Ready for the Madison visual workbench plan:

- release contract, canonical hashing, fail-closed resolver, and validator;
- deterministic CYL-9ML bundle export using the five existing body plates;
- shared-geometry closure material proof;
- immutable organization-scoped Supabase ledger;
- one-command release verification.

Not yet built in this core plan:

- Madison visual assembly canvas and catalog/filter UI;
- Sanity `paperDollFamily` schema and dry-run publisher;
- storefront swatch compositor and interactive 3D/AR delivery;
- translucent assembled-context material tuning;
- rhinestone instancing/UV implementation;
- remaining closure families, pumps, sprayers, and rollers.

Independent live defect: the currently frozen metal roller-ball asset still has
72.8% opaque white junk and must not ship. This trial does not silently approve
or repair it.
