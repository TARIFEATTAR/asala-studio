# CYL-9ML production-candidate handoff

**Date:** 2026-08-03  
**Scope:** local candidate and visual-evidence preparation only  
**Production mutation status:** no named approvals, placement locks, Current Release changes, Sanity writes, or public publication

## Outcome

The complete CYL-9ML component set now exists as local, immutable candidates:

- 5 locked body plates;
- 23 component candidates;
- 115 component/body assemblies;
- 23 five-body lineups;
- 1 complete contact sheet;
- 23/23 exact authority-alpha matches;
- 0 mismatched alpha pixels.

The evidence manifest is:

`outputs/paper-doll-component-factory/CYL-9ML/production-candidate-review/family-fit-review.json`

The visual review sheet is:

`outputs/paper-doll-component-factory/CYL-9ML/production-candidate-review/contact-sheet.png`

The deterministic import handoff is:

`outputs/paper-doll-component-factory/CYL-9ML/candidate-import-bundle.json`

It selects exactly one current candidate for each of the 23 component variants,
uses the registered rhinestone replacements, and verifies candidate/layer SHA
evidence before writing the local bundle. Building it performs no remote write.

## Workbench persistence bridge

The Production Candidate Bench now reads organization-scoped component and
candidate rows from the private paper-doll ledger, creates time-limited signed
preview URLs, and mounts the newest candidate in Candidate Review and Family
Fit. Named pixel and family-fit approvals invoke the existing
`approve-paper-doll-candidate` Edge Function with immutable lifecycle and SHA
expectations. Browser access to the underlying tables remains read-only.

If the 23 local candidates have not yet been imported, the UI states that
condition explicitly instead of presenting an older Current Release asset as
the new candidate.

The import command is deliberately dry-run-only by default:

```bash
npm run paperdoll:cyl9-import-candidates
```

It reports the exact 23-candidate plan, 102 immutable storage objects, review
classes, and forbidden downstream mutations. A remote import is not implicit;
it requires all of the following in one named operator action:

```bash
npm run paperdoll:cyl9-import-candidates -- \
  --execute \
  --allow-remote-write \
  --confirmation CYL9-CANDIDATE-IMPORT \
  --organization-id <organization-uuid> \
  --requested-by <user-uuid>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be present only in the
server-side shell used for that explicit import. The command appends candidate
requests, attempts, candidate-status component versions, candidates, and
content-addressed private objects. Named Approve Pixels promotes only the exact
component version whose full-canvas SHA matches the reviewed candidate. It does
not approve pixels, lock placement, change Current Release, sync Sanity, or
publish publicly. This remote command has not been run during this milestone.

Family Fit now resolves the five displayed locked body hashes to the exact
approved `paper_doll_component_versions` UUIDs before enabling placement lock.
The lock endpoint is refresh-safe and reuses an existing identical locked
placement for later finish variants in the same geometry family. A new
placement version is appended only when the reviewed bounds, authority,
five-body versions, or adjustments differ.

## Review classes

| Class | Count | Required next decision |
|---|---:|---|
| Standard material candidate | 18 | Named visual pixel approval or rejection. |
| Registered rhinestone candidate | 3 | Confirm the eight deterministic stones and material appearance. Stone identity and position are no longer provider-controlled. |
| Translucent overcap | 2 | Review on Amber, Cobalt, Clear, Frosted, and Swirl. Do not auto-approve from isolated opacity or brightness. |

## Rhinestone correction

The first generated dotted candidates were not accepted as decoration truth. A deterministic post-process now:

1. starts from a stone-free material candidate;
2. uses the registered eight-stone layout;
3. writes permanent stone IDs, order, pixel centers, and sizes;
4. creates a new immutable candidate;
5. preserves the authority alpha exactly;
6. leaves the original GPT candidate in history as superseded evidence.

Material sources are:

- silver dotted → shiny-silver stone-free material;
- black dotted → glossy-black stone-free material;
- pink dotted → matte-silver stone-free material deterministically recolored to pink before decoration.

The registered-candidate index is:

`outputs/paper-doll-component-factory/CYL-9ML/registered-rhinestones/generation-index.json`

## Cost evidence

The planned sixteen GPT Image material requests were estimated at $6.88 for rounded output cost. The attempt ledger records 17 successful provider outputs and 2 outputs that completed generation but failed a later local gate, totaling 268,147 output tokens. At the recorded $30 per million output-token rate, that is an estimated $8.04 in output tokens, plus variable input cost. Two interrupted attempt records contain no usage and are not counted. This is an engineering estimate, not an invoice reconciliation.

## Verification

- 48/48 core paper-doll tests pass.
- 62/62 component-factory tests pass.
- 14/14 CYL-9ML cap-family tests pass.
- TypeScript `--noEmit` passes.
- Production build passes.
- Build retains pre-existing CSS syntax and bundle-size warnings; neither warning was introduced by the candidate scripts.

## Deliberately not implemented

The larger steering proposal was applied selectively. The following do not belong in this milestone:

- a new Studio shell;
- a parallel plate registry;
- universal liquid overlays;
- label or decoration schema expansion unrelated to the registered cap stones;
- universal integration/retouch layers;
- a claim that the repository already contains a complete CAD/Blender digital-twin library;
- public Sanity publication.

## Next lifecycle gate

The next action is human, named review in this order:

1. run the explicitly authorized private-ledger import;
2. review and approve/reject the 18 standard candidates;
3. review the 3 registered rhinestone candidates;
4. review the 2 translucent overcaps across all five bodies;
5. lock the 13 shared geometry-family placements only after candidate approval;
6. create one append-only release cut;
7. sync that exact cut to the named Sanity draft;
8. keep public publication as a separate named action.
