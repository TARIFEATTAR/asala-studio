---
name: best-bottles-paper-doll-production
description: Use when producing, reviewing, releasing, or publishing Best Bottles paper-doll component families, especially when closure geometry, material variants, bounding boxes, family fit, release cuts, or Sanity state must remain consistent.
---

# Best Bottles Paper-Doll Production

Produce interchangeable packaging layers from one measured geometry truth. Generation may change material pixels; only an exact authority-mask clamp earns `geometry locked`.

## Start

1. Read the family manifest and run `scripts/validate_family_manifest.ts <manifest>`.
2. Run `scripts/summarize_family_status.ts <manifest>` before choosing an action.
3. Read the reference matching the current stage:
   - geometry, boxes, lifecycle: `references/component-contract.md`
   - materials and provider routing: `references/material-doctrine.md`
   - release/Sanity actions: `references/release-and-sanity.md`

## Lifecycle

Advance one persisted state at a time:

`inventory → authority → candidate → Approve Pixels → Family Fit → Lock Shared Placement → release cut → Sanity draft → public publish`

- Inventory every real component and compatible locked body before generating.
- Calibrate thresholds on each real file. Reject empty, frame, frame-touching, clipped, or undeclared-island masks.
- Preserve source, edit, authority, and placement bounds as four separate records.
- Use Blender/CAD for dimensional geometry. Use GPT Image only for material pixels, then normalize and copy the authority alpha exactly.
- Review every candidate on every compatible body. Keep overrides versioned and explicit.
- Require a named approver and note at each approval boundary.
- Keep Current Release unchanged until an atomic, append-only release cut.
- Sync `drafts.<documentId>` first. Public publication is a separate named action for the same successful cut.

## Stop Conditions

Stop and report the exact blocker when:

- real authority evidence is missing;
- exact alpha mismatch is nonzero;
- a shared-family claim relies only on a label or visual resemblance;
- translucent material lacks five-body assembly review;
- rhinestone IDs or positions drift;
- a requested write lacks named approval;
- remote Supabase, Current Release, Sanity draft, or public mutation was not explicitly authorized.

Never call reference-anchored generation geometry locked. Never silently nudge production pixels. Never combine draft sync and public publication.

## CYL-9ML Commands

```bash
npm run paperdoll:calibrate-cyl9-authorities
npm run paperdoll:cyl9-batch -- --plan
npm run test:paperdoll:factory
```

Execute locally only after reviewing the plan:

```bash
npm run paperdoll:cyl9-batch -- --execute --confirmation CYL9-MATERIAL-BATCH
```
