# Controlled Paper-Doll Release Cut and Sanity Draft Workflow

**Status:** Approved design
**Date:** 2026-08-02
**Initial scope:** CYL-9ML, five locked body plates, natural-plastic roller, mirror-chrome-ball roller, progressive Sanity draft synchronization

## Outcome

Add a controlled release-cut stage between approved paper-doll work and Sanity. A named release cut promotes explicitly selected approved component pixels plus their exact shared placement into a new immutable Current Release. The cut immediately queues those qualified layers for a Sanity draft, but it never makes them customer-facing. A later named publication action may expose only complete SKU assemblies. Missing components block only the SKUs that depend on them, not the entire family.

The initial release cut promotes the already approved natural-plastic and mirror-chrome-ball roller children together. Both retain a natural-plastic housing and share one exact authority-mask identity; the exposed roller sphere is the material distinction.

## Locked decisions

1. Current Release is selected by an explicit organization-and-family release head. The newest database row is never implicitly current.
2. Release history and release-cut history are append-only. No release membership is silently rewritten.
3. Release cuts may incrementally promote qualified components while the overall family remains `blocked`.
4. Sanity readiness is evaluated per assembly mapping/SKU, not by one family-wide all-or-nothing gate.
5. A named release cut writes Supabase release truth and queues a Sanity draft synchronization. It does not publish a Sanity document.
6. Public Sanity publication is a second named action with its own dry-run, approval, and ledger entry.
7. Candidate selection is explicit. Release Cut never selects a candidate because it is merely the newest approved version.
8. The existing five body plates and their component-version identities remain unchanged.
9. The canonical canvas is `2080x2288` with Bone `#F5F3EF`. The obsolete Sanity `2000x2200` defaults are removed from this path.
10. Sanity failures do not roll back a valid Supabase release cut. They create a visible, retryable failed synchronization record.
11. Browser roles retain read-only ledger access. All release and publication writes cross authenticated Edge Function boundaries and service-only database transactions.

## Why the existing path cannot be reused unchanged

The current Best Bottles uploader creates a `paperDollFamily` document and immediately writes it to the live document ID. Its schema defaults to `2000x2200`, does not carry release or component hashes, has no per-SKU readiness, and stores arbitrary per-layer offsets. That path cannot prove which approved pixels or placement produced the live document.

The current Supabase workbench RPC also chooses the newest family-release row. Registering another release row can therefore change the apparent Current Release without a named cut. The release-cut milestone must replace this implicit behavior with an explicit head pointer.

## Domain model

### Release head

`paper_doll_family_release_heads` contains exactly one current pointer per organization and family:

- `organization_id`
- `family_key`
- `release_id`
- `release_cut_id`
- `updated_at`

The table is mutable only through the service transaction that records a release cut. Authenticated clients receive organization-scoped read access only.

Existing families are backfilled deterministically to their currently selected release before the workbench RPC changes to head-first resolution. If no head exists during migration, the read boundary may temporarily use the previous newest-row rule only for the backfill operation; application reads fail closed afterward.

### Release cuts

`paper_doll_release_cuts` is append-only and records:

- source and resulting release IDs
- exact selected approved component-version IDs
- exact component image and authority-mask SHAs
- required shared-placement version IDs
- manifest SHA and canvas contract
- unchanged body component-version IDs
- named approver user ID and display name
- nonempty release note
- cut status and creation timestamp

The resulting release is a new immutable manifest and membership set. It clones unchanged memberships from the source release and replaces only the explicitly selected qualified versions.

### Sanity synchronization records

The existing `paper_doll_publish_runs` ledger is extended or wrapped by a queue-compatible record with these states:

- `queued`
- `running`
- `draft_synced`
- `failed`
- `public_dry_run`
- `published`
- `blocked`

Each run binds organization, release, release cut, destination, request hash, Sanity document ID, result, error, and timestamps. Retries create a new attempt or increment an explicitly recorded attempt sequence; they never erase the failed run.

## Release-cut contract

The server transaction accepts an expected Current Release ID, target release version, selected approved component versions, required placement IDs, named approver, and release note. It fails closed unless:

1. The expected release still equals the family release head.
2. Every selected version belongs to the organization and correct logical component.
3. Every selected version is an exact immutable approved child bound to its approval decision and passing blocking QA evidence.
4. Each placement-required component has an approved placement whose authority-mask SHA exactly matches that component.
5. The placement covers the same five explicit approved body component versions present in Current Release.
6. The canvas, family, slot, geometry family, variant key, image SHA, mask SHA, alpha bounds, mount axis, and seat line match the proposed manifest.
7. The target release version and manifest identity are new or exactly idempotent.
8. Per-SKU readiness is derived from exact assembly mappings and exact release memberships; it is not manually asserted.

On success, one transaction creates the target release and memberships, appends the cut, advances the release head, and queues the Sanity draft synchronization. It returns `sanityPublished: false`.

## Approved roller-pair contract

The initial cut uses the two existing immutable approved children:

- plastic: `02161d6f-fb7c-4b44-ba98-a61500181529`, image SHA `77c67191a8efa1808031c386b432244df6b78b91bdc4cdccc5a4658711f4edd5`
- metal: `e7a6636a-b2db-4bfe-bbb9-fde0458fe407`, image SHA `b6f4fae2fa74f8a4ae22f402ef9fc18abdf370fbdb7a1eb2569fb47a4145fcee`
- shared authority-mask SHA: `b815bcd76f39e5a54e7ff68a660c826755dd670dc7464a7d38f87103f87e70c6`

Both variants have a natural-plastic housing. The metal variant uses a mirror-chrome exposed roller sphere. The shared authority-mask identity permits one exact family placement to govern both variants, subject to the five-body assembly-context review and named placement lock.

## Candidate and Edit Lab behavior

Edit Lab gains an explicit candidate-history selector. Each row shows variant, version, filename, provider, image SHA prefix, approval, QA, and created time. Selecting a row controls the canvas and inspector; selection is never inferred from newest creation time alone.

An existing immutable approval is presented as a successful state, not as a disabled rejection: the selected variant shows `Pixels Approved` and offers `Open Family Fit`. Switching between Plastic and Metal resolves and displays each variant's own approval identity.

`New Plastic Candidate` and `New Metal Candidate` remain available after previous approvals. When the release ancestor is revoked but a clean approved geometry child exists, new material candidates use that clean child and its exact authority mask as their parent. The revoked release ancestor remains audit-only.

When a clean candidate is mounted, the large red ancestor error is replaced by a compact amber notice:

> Old release ancestor is audit-only. Clean geometry authority active.

The red blocker remains only when no clean eligible replacement exists or the selected candidate itself uses revoked authority.

## Workbench stages

### Edit Lab

- Upload or generate a new immutable candidate.
- Select exact candidate history.
- Compare source, candidate, and difference.
- Approve Pixels and retain every previous candidate as immutable history.

### Family Fit

- Opens for the explicitly selected approved candidate.
- Permits release-pixel X/Y translation and uniform scale only.
- Reuses an existing shared placement only when family, geometry key, canvas, and authority-mask SHA are exact.
- Displays all five body assemblies and the inherited placement ID.
- The roller-fit lineup validates the five bodies plus the selected roller only. It does not require an overcap until a complete SKU assembly is being evaluated.
- The lineup mounts the exact selected approved roller image and the same family transform shown on the Amber calibration subject, so the five previews cannot drift onto a different candidate or an identity transform.

### Release Cut

- Unlocks only when selected pixels and required placement are approved and exact.
- Displays source release versus proposed release, asset and SHA changes, unchanged bodies, per-SKU readiness delta, remaining blockers, approver, and release note.
- The primary action is `Cut Current Release & Queue Sanity Draft`.
- The confirmation explicitly states that no public Sanity document will change.

### Sanity Draft

- Displays queued, running, synced, or failed state.
- Supports an idempotent retry after failure.
- Shows the stable draft document ID, release ID, manifest SHA, asset count, eligible SKU count, and incomplete SKU count.

### Public Publish

- Requires a successful draft synchronization and a fresh dry-run diff.
- Requires a separate named approver and note.
- Publishes only readiness-qualified mappings and their approved layers.
- Is not performed by the release-cut transaction.

## Sanity document contract

The Best Bottles `paperDollFamily` schema is upgraded for a stable pair of IDs:

- draft: `drafts.paperDollFamily.CYL-9ML`
- public: `paperDollFamily.CYL-9ML`

The document carries:

- family key and display name
- `2080x2288` canvas and Bone background
- release ID, version, manifest SHA, release-cut ID, and synchronization timestamp
- layer order by assembly mode
- layer assets with stable keys, slot, variant key, source filename, Sanity image reference, component-version ID, image SHA, authority-mask SHA, material variant, geometry family, and placement reference
- assembly mappings with website SKU, Grace SKU, recipe, required variants, readiness state, and missing reasons
- publication state and named-publication evidence

Uploaded Sanity image assets use content identity and stable filenames. Draft synchronization is idempotent for the same release and manifest SHA.

The Best Bottles renderer consumes only the stable public document. It verifies that a requested assembly mapping is public-ready before composing it. Missing or incomplete mappings fail closed to the existing approved fallback image rather than silently omitting a layer.

## Progressive readiness

Family release status and SKU readiness are separate:

- A family may remain `blocked` because metal, cap, sprayer, or pump variants are incomplete.
- A plastic-roller SKU may be `assembly-ready` if its exact body, plastic roller, required closure layers, and placement are complete.
- Plastic- and metal-roller mappings become eligible independently when their required closure layers are present; both reuse the same exact roller placement.
- No missing component in one SKU blocks unrelated complete SKUs.

Sanity drafts may contain all currently released approved layers plus readiness metadata. Public publication exposes only the mappings that pass the per-SKU contract.

## Failure handling

- **Stale release head:** reject with a conflict and reload the diff.
- **Candidate drift:** reject before target release creation.
- **Placement mismatch:** return to Family Fit; never copy placement by visual similarity.
- **Sanity upload failure:** preserve the release cut, mark synchronization failed, and offer Retry Draft Sync.
- **Partial Sanity mutation:** retry by stable document and asset identity until the draft matches the recorded request SHA.
- **Public dry-run drift:** block public publication and require a new diff and named approval.
- **Expired private URLs:** retain the last complete canvas while signed URLs refresh.

## Security

- Authenticated browser clients have organization-scoped read access only.
- Edge Functions authenticate the user and perform organization-visible preflight reads under the user token.
- Service-role clients are created only inside Edge Functions and call narrowly granted service-only transactions.
- User-editable metadata is never used for authorization. The authenticated user ID is authoritative; display name is evidence only.
- New exposed tables enable RLS, revoke default grants, grant only organization-scoped reads to authenticated users, and reserve writes for the service role.
- No Sanity token or Supabase service credential reaches the browser.

## Test strategy

### Database and Edge contracts

- release head backfill and head-first reads
- stale-head conflict protection
- append-only cuts and dispositions
- exact approved-child and placement binding
- dual-variant approval and exact shared-mask binding
- idempotent target release and draft queue creation
- organization boundary and browser-write denial
- `sanityPublished: false` from every release-cut response

### Pixel and component tests

- exact shared authority mask across the approved plastic and metal children
- shared placement inheritance across both variants
- calibrated connected-component and opaque-white-junk gates

### Madison UI tests

- explicit candidate selection and dual approval status
- already-approved variants show `Pixels Approved` plus the Family Fit continuation instead of a disabled approval action
- new candidate creation after an earlier approval
- amber ancestor notice for clean authority
- red blocker when no clean authority exists
- roller-only Family Fit reports five-body coverage without requiring `SHN-SL` or another overcap
- Amber calibration and all five lineup previews consume the same selected candidate and placement transform
- Release Cut enablement and exact diff
- draft-sync retry without duplicate release cuts

### Best Bottles tests

- upgraded Sanity schema uses `2080x2288`
- draft and public IDs remain stable
- per-SKU readiness prevents incomplete composition
- public renderer reads no draft documents
- complete mappings render exact layer order and placement

### End-to-end verification

1. Resolve and display both existing approved roller children.
2. Confirm plastic and metal on all five body plates.
3. Lock or load their exact shared placement.
4. Run the release-cut dry diff for both selected versions.
5. Perform the named release cut.
6. Verify Current Release now resolves through the explicit head.
7. Verify the Sanity draft contains the exact release and asset hashes.
8. Verify the public Sanity document and storefront remain unchanged.

## Scope boundaries

This milestone builds the reusable release-cut, Sanity draft, and readiness foundations and proves them with the already approved CYL-9ML plastic and metal rollers. It does not approve missing caps, sprayers, pumps, translucent plastic, or other family assets. It does not publicly publish a Sanity document without the second named action. It does not redesign the existing Studio shell or allow silent production pixel nudging.
