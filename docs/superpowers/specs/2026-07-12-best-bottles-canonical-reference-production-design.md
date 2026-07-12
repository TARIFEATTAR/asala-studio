# Best Bottles Canonical Reference Production Design

**Date:** 2026-07-12  
**Status:** Approved direction; pending written-spec review  
**Pilot family:** Cylinder  
**Prompt/shadow contract after reference approval:** `best-bottles-reference-locked-v6.1`

## Objective

Build a fail-closed, repeatable production lane that turns the original Best Bottles Photoshop archive into exact-SKU, reviewable, versioned generation references without AI reconstruction, destructive source edits, silent substitutions, or unverified cap-state assumptions.

The lane must establish what every source PSD actually depicts before it can influence Madison generation. It must separate source discovery, identity matching, visual-state review, export qualification, upload, promotion, generation, approval, and publication into independently auditable stages.

## Scope and current baseline

The first archive-wide pass covers:

- 4,493 original PSD files under the read-only Photoshop archive;
- 2,285 website SKUs in the current PSD coverage inventory;
- 2,483 rows in the canonical Madison truth snapshot;
- 1,724 existing flattened PNGs, which remain candidates rather than automatically approved references;
- every Best Bottles family, executed first as a complete Cylinder pilot and then repeated family by family.

The existing conservative filename inventory is an index, not a visual verdict. A filename, folder label, prior flattened export, live-site image, generated render, or database pointer cannot by itself approve identity, cap state, topology, or generation eligibility.

## Non-negotiable source rules

1. The original Photoshop archive is read-only. Record a SHA-256 before inspection and never alter the PSD.
2. Match by exact normalized website SKU first, exact Grace SKU second, and an explicit reviewed alias only when recorded in the alias ledger. Fuzzy or sibling-SKU matching is prohibited.
3. Visual state comes from the rendered PSD composite and layer evidence. Folder names such as `Capped` and `Uncapped` are triage hints only.
4. Reference production may crop white canvas and export the reviewed composite, but it may not redraw, reconstruct, recolor, rescale product geometry, synthesize missing pieces, or use generative AI.
5. Native source pixels and proportions are preserved. References are not forced onto Madison's 2080 x 2288 output canvas.
6. Approved reference exports must be opaque PNG, JPG, or WebP; total at least one megapixel; retain safe margins; show the reviewed product state; and carry exact provenance.
7. Measurement and geometry consumers use only the canonical truth columns and body geometry table. Raw flat-family diameter and copied Convex width/depth are prohibited.
8. Missing, contradictory, or ambiguous evidence remains blocked. No substitute product or inferred state may fill a gap.
9. No Convex writes occur in this repository.
10. Upload and live pipeline promotion are separate reviewed gates. Local auditing and export preparation do not authorize a remote pointer change.

## Cap-state and topology taxonomy

Every mapped PSD receives exactly one primary classification:

- `assembled-cap-on`: one complete sellable assembly with its closure or overcap installed;
- `cap-off-applicator-exposed`: the primary bottle remains assembled with the purchased applicator visible and the removable cap absent;
- `detached-cap-or-sidecar`: the primary product and one or more detached caps, bulbs, tassels, droppers, wands, or other pieces are visibly presented together;
- `component-only`: the composite contains a closure, applicator, accessory, or body component rather than one complete sellable SKU;
- `multi-product-layout`: the composite contains multiple alternative products, states, angles, or merchandising arrangements;
- `ambiguous-manual-review`: the rendered pixels or layer evidence cannot support a single safe classification;
- `blocked-identity-conflict`: the visual product conflicts with the mapped website SKU, Grace SKU, canonical family, material, capacity, closure, or topology.

A clear overcap installed on a sprayer or pump counts as `assembled-cap-on`. A clear cap beside the bottle counts as `detached-cap-or-sidecar`. The classifier never collapses those two states.

Machine analysis may assign a proposed classification and confidence, but only a recorded human review can set `capStateReviewStatus: approved`.

## Audit pipeline

### 1. Immutable inventory

For every PSD, record its absolute and archive-relative paths, bytes, SHA-256, dimensions, color mode, composite opacity, embedded scene/layer count, normalized filename tokens, and conservative SKU candidates.

Duplicate source bytes remain separate inventory rows but share a duplicate-group hash. Nothing is deleted or renamed.

### 2. Exact identity join

Join the source inventory to the canonical master truth using website SKU, then Grace SKU, then an explicitly reviewed alias. Record unmatched PSDs, ambiguous matches, canonical rows without PSDs, and one-to-many relationships without collapsing them.

### 3. Composite and layer evidence

Render a review-sized scene-0 composite and extract inspectable layer metadata. Compute foreground bounds, connected components, likely primary-product bounds, sidecar candidates, white-canvas coverage, clipping, and safe margins.

These measurements are triage signals. They may route a PSD to an obvious or ambiguous review queue but cannot approve a cap state automatically.

### 4. Review artifacts

Produce family- and cohort-scoped contact sheets plus a row-level JSON/CSV manifest. Each tile shows the rendered composite, website SKU, Grace SKU, family, capacity, source path token, proposed cap state, confidence, and review status.

Review batches remain small enough to inspect at useful resolution. A reviewer can approve the proposed state, select a different taxonomy value, or block the row with a reason.

### 5. Export qualification

A PSD becomes export-qualified only when all required identity and state fields are approved:

- exact SKU lineage;
- correct family, body material, capacity, applicator, cap/closure, and visible topology;
- approved primary cap-state classification;
- one coherent intended product presentation;
- safe, unclipped primary-product bounds;
- source hash unchanged since review.

When multiple states are legitimately present for one SKU, each approved state receives a separate versioned reference record. A cap-on reference never authorizes cap-off generation, and vice versa.

### 6. Versioned native-resolution export

Export a new opaque source-faithful file using the canonical filename pattern:

```text
{graceSku}__{websiteSku}__{state}__vNNN.png
```

Never overwrite an earlier version. The export record includes source PSD path/hash, export path/hash, pixel dimensions, opacity, primary bounds, full foreground bounds, sidecars, state, topology, reviewer, review time, and qualification result.

The first controlled export is the exact 3 ml black sprayer cap-on composite from `GBSpry3mlClBlk..psd`. It becomes a new version rather than replacing the detached-cap `v001` evidence.

### 7. Upload staging and promotion

After the local review manifest is approved, upload the exact export bytes to a versioned object path without overwriting earlier objects. Verify remote bytes against the local SHA-256.

Promote only the reviewed SKU/state record to `flattened-product-truth`. The promotion writes complete provenance metadata and is reversible to the previous pointer. Existing evidence remains retained unless separately approved for deletion.

No bulk remote promotion occurs merely because a file passed machine checks.

## State machine

Each reference candidate moves through these states:

```text
inventoried
  -> identity-matched
  -> composite-rendered
  -> machine-triaged
  -> human-reviewed
  -> export-qualified
  -> exported-local
  -> upload-verified
  -> promoted-flattened-product-truth
```

At any stage it may move to `blocked`, with a durable reason and supporting evidence. Later evidence may create a new review decision; it never rewrites the historical decision silently.

## Required artifacts

The audit and production lane emits:

- immutable PSD source inventory JSON/CSV;
- canonical SKU join report;
- cap-state and topology review manifest;
- family/cohort contact sheets;
- ambiguous and blocked worklists;
- approved local export manifest;
- versioned opaque reference exports;
- upload verification manifest;
- promotion plan and rollback manifest;
- coverage report by family, SKU, cap state, topology, and readiness stage.

Every artifact records its input hashes and tool/version lineage so it can be reproduced and compared after source or catalog changes.

## Cylinder rollout

1. Complete the archive-wide read-only PSD classification audit.
2. Review and qualify Cylinder cohorts, beginning with the exact 3 ml black sprayer and the already-reviewed clear 9 ml set.
3. Produce versioned local opaque references for approved Cylinder states.
4. Review the complete Cylinder promotion manifest before any remote writes.
5. Implement the complete generation lock for terminal jobs.
6. Promote reviewed references and rerun strict Cylinder readiness.
7. Complete and visually approve the 75-type Cylinder lineup and comparative scale curve.
8. Apply the V6.1 prompt and shadow contract across eligible Cylinder targets.
9. Run controlled batch generation, automated QA, human approval, and separately authorized publication.
10. Repeat the qualified workflow family by family.

Batch generation remains available for nonterminal SKUs. Approved, Shopify-pushed, and synced jobs are excluded in the Studio, batch preflight, execution handler, and server-side provider gate.

## Validation and failure behavior

Automated checks must prove:

1. source PSD hashes do not change;
2. exact identity joins are unique or explicitly reviewed;
3. every review row has one allowed classification;
4. no machine-only decision becomes approved;
5. export bytes are opaque, source-faithful, at least one megapixel, and safely framed;
6. cap-on and cap-off records remain distinct;
7. detached components and multi-product layouts retain explicit topology;
8. every export carries source and output hashes plus primary bounds;
9. version numbers are monotonic and earlier evidence is not overwritten;
10. uploaded bytes match local bytes;
11. promotion is limited to approved records and has a rollback pointer;
12. missing or conflicting identities remain blocked;
13. generation cannot consume an unapproved or terminal record;
14. no Convex, Shopify, or publication mutation occurs during audit and local export preparation.

Failures are row-scoped and fail closed. One ambiguous PSD does not stop unrelated reviewed exports, but it cannot enter generation, calibration, or publication.

## Success criteria

The canonical reference-production pass is complete for a family when:

- every sellable target has either an approved reference state or an explicit evidence blocker;
- every approved reference has exact identity, cap-state, topology, source hash, export hash, dimensions, bounds, and review lineage;
- strict generation readiness contains no manual-source matches disguised as eligible references;
- the family calibration/lineup assets use only approved actual products;
- controlled batch generation can run without substitutions or terminal-job orphans;
- publication remains a separate explicit approval after image QA.

The system targets scalable, repeatable production with fail-closed QA. It does not claim that a generative provider will be perfect on every attempt; instead, nonconforming outputs are automatically rejected and never published.
