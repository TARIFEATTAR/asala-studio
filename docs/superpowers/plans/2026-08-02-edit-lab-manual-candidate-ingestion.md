# Edit Lab Manual Candidate Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Desktop and Image Library roller uploads produce traceable, correctly fitted Production Candidate Bench candidates without changing authority masks, active release membership, or Sanity.

**Architecture:** Extend the immutable manual asset reference with inert original-filename metadata and carry it through browser validation, Edge parsing, locked database JSON, repository parsing, and history UI. Replace threshold-based trimming with exact alpha-bound measurement, then uniformly contain the visible pixels inside the selected component authority bounds before the existing binary mask clamp.

**Tech Stack:** React 18, TypeScript 5.8, Zod 3, Supabase Edge Functions/Postgres JSONB, Node 20 test runner, Sharp 0.35.

## Global Constraints

- Preserve Desktop `File.name` exactly, including case, spaces, and extension; it is inert metadata and never controls a path.
- Private storage paths remain SHA-256 content-addressed.
- Desktop and Image Library use one manual-candidate queue contract.
- Fit every source pixel with alpha greater than zero into the selected component authority-mask bounds with one uniform contain scale.
- Do not stretch to the 2080×2288 release canvas.
- Authority masks remain binary and immutable.
- Plastic and metal roller jobs remain isolated by selected component ID.
- Candidate creation and approval do not change active release membership or publish to Sanity.
- Geometry lock is earned only by exact server-side mask-and-clamp verification.
- Preserve unrelated uncommitted work already present in the worktree.

---

### Task 1: Immutable manual upload provenance

**Files:**
- Modify: `src/lib/paperDoll/candidateJobContract.ts`
- Modify: `src/lib/paperDoll/candidateJobContract.test.ts`
- Modify: `supabase/functions/_shared/paperDollCandidateContract.ts`
- Modify: `supabase/functions/_shared/paperDollCandidateContract.test.ts`

**Interfaces:**
- Consumes: `PrivateAssetRefSchema` and content-addressed private object references.
- Produces: `ManualCandidateAssetRefSchema`, `ManualCandidateAssetRef`, `PaperDollManualAssetRef`, and parsed `manualOutput.originalFilename`.

- [ ] **Step 1: Write failing browser-contract tests**

Add a manual reference with `originalFilename: "17-415 Natural Roller FINAL.png"`; assert the parser returns that exact string. Assert missing names, empty names, control characters, path separators, and names longer than 255 code units fail.

- [ ] **Step 2: Run the browser-contract test and verify RED**

Run: `node --import tsx --test src/lib/paperDoll/candidateJobContract.test.ts`

Expected: FAIL because manual filename metadata is not required or retained.

- [ ] **Step 3: Add the shared manual-reference schema**

Define a filename schema that validates without trimming or rewriting:

```ts
const OriginalFilenameSchema = z.string()
  .min(1)
  .max(255)
  .refine((name) => !/[\u0000-\u001f\u007f]/.test(name))
  .refine((name) => !/[\\/]/.test(name));

export const ManualCandidateAssetRefSchema = PrivateAssetRefSchema.and(
  z.object({ originalFilename: OriginalFilenameSchema }),
);
```

Use it for request `manualOutput`, add nullable `manualOutput` to `CandidateJobRecordSchema`, and export the inferred type.

- [ ] **Step 4: Write failing Edge-parser tests**

Assert `parsePaperDollCandidateRequest` preserves the exact filename and rejects missing/control-character names.

- [ ] **Step 5: Run the Edge-parser test and verify RED**

Run: `node --import tsx --test supabase/functions/_shared/paperDollCandidateContract.test.ts`

Expected: FAIL because Edge intake currently strips metadata.

- [ ] **Step 6: Implement matching Edge validation**

Add `PaperDollManualAssetRef extends PaperDollPrivateAssetRef`; verify the normal asset identity first, validate `originalFilename`, and return the unmodified accepted value.

- [ ] **Step 7: Run both contract tests and verify GREEN**

Run: `node --import tsx --test src/lib/paperDoll/candidateJobContract.test.ts supabase/functions/_shared/paperDollCandidateContract.test.ts`

- [ ] **Step 8: Commit provenance**

```bash
git add src/lib/paperDoll/candidateJobContract.ts src/lib/paperDoll/candidateJobContract.test.ts supabase/functions/_shared/paperDollCandidateContract.ts supabase/functions/_shared/paperDollCandidateContract.test.ts
git commit -m "feat(paper-doll): preserve manual upload provenance"
```

### Task 2: Exact alpha-bounds authority placement

**Files:**
- Modify: `src/lib/paperDoll/candidateClamp.node.ts`
- Modify: `src/lib/paperDoll/candidateClamp.node.test.ts`
- Modify: `scripts/paper-doll/process-paper-doll-candidate.ts`

**Interfaces:**
- Consumes: `clampCandidate({ manualPlacement: true })`, uploaded bytes, exact authority mask, and exact edit mask.
- Produces: deterministic `authority-bounds-contain` normalization with `sourceVisibleBounds`, equal scales, and authority-clamped alpha.

- [ ] **Step 1: Write failing exact-alpha tests**

Create padded and tightly cropped copies of identical visible pixels and assert identical output. Add an edge pixel with alpha `1` and assert it expands `sourceVisibleBounds`. Assert a fully transparent upload rejects with `/no non-transparent pixels/i`. Use mismatched source/authority aspect ratios and assert equal scale axes and centered containment.

- [ ] **Step 2: Run clamp tests and verify RED**

Run: `node --import tsx --test src/lib/paperDoll/candidateClamp.node.test.ts`

Expected: FAIL because threshold-based `sharp.trim()` does not expose strict alpha bounds.

- [ ] **Step 3: Implement strict alpha scanning**

Decode once with `ensureAlpha().raw()`, scan `data[pixel * channels + 3] > 0`, reject empty alpha, extract the inclusive visible rectangle, and calculate:

```ts
const scale = Math.min(authorityWidth / visibleWidth, authorityHeight / visibleHeight);
const outputWidthPx = Math.max(1, Math.round(visibleWidth * scale));
const outputHeightPx = Math.max(1, Math.round(visibleHeight * scale));
```

Resize uniformly, center inside authority bounds, composite on a transparent release canvas, and record exact source-visible bounds.

- [ ] **Step 4: Prove mask and source inputs are not mutated**

Keep the binary authority gate before placement. Compare authority/source SHA-256 before and after the call and retain `maskSha256` from the original authority bytes.

- [ ] **Step 5: Keep worker routing manual-only**

Retain `manualPlacement: job.provider === "manual"` and pass normalization evidence unchanged into `p_output_metadata`.

- [ ] **Step 6: Run clamp tests and verify GREEN**

Run: `node --import tsx --test src/lib/paperDoll/candidateClamp.node.test.ts`

- [ ] **Step 7: Commit deterministic placement**

```bash
git add src/lib/paperDoll/candidateClamp.node.ts src/lib/paperDoll/candidateClamp.node.test.ts scripts/paper-doll/process-paper-doll-candidate.ts
git commit -m "fix(paper-doll): fit uploads to authority alpha bounds"
```

### Task 3: Unified bridge and immutable history UI

**Files:**
- Modify: `src/lib/paperDoll/candidateRepository.ts`
- Modify: `src/lib/paperDoll/candidateRepository.test.ts`
- Modify: `src/lib/paperDoll/libraryCandidateSource.ts`
- Modify: `src/lib/paperDoll/libraryCandidateSource.test.ts`
- Modify: `src/components/paper-doll/CandidateActionPanel.tsx`
- Modify: `src/components/paper-doll/RollonLineup.tsx`
- Modify: `src/components/paper-doll/rollonLineupModel.ts`
- Modify: `src/components/paper-doll/rollonLineupModel.test.ts`
- Preserve and include after review: `src/components/image-editor/ImageLibraryModal.tsx`
- Preserve and include after review: `src/components/paper-doll/ProductionCandidateWorkbench.tsx`
- Preserve and include after review: `src/components/paper-doll/candidatePreviewModel.ts`
- Preserve and include after review: `src/components/paper-doll/candidatePreviewModel.test.ts`

**Interfaces:**
- Consumes: `ManualCandidateAssetRef`, a browser `File`, selected component identity, and workbench RPC rows.
- Produces: `uploadManualCandidateSource(...)`, parsed `job.manualOutput`, a shared Desktop/Library queue path, filenames in immutable history, and a selected-candidate preview across all five locked body plates.

- [ ] **Step 1: Write failing repository tests**

Assert `uploadManualCandidateSource` returns the exact filename while its storage path ends in `/<sha256>.png` and contains no original filename. Assert `loadCandidateWorkbench` parses `manual_output_ref.originalFilename` for queued, failed, and ready jobs.

- [ ] **Step 2: Run repository tests and verify RED**

Run: `node --import tsx --test src/lib/paperDoll/candidateRepository.test.ts`

- [ ] **Step 3: Implement the repository bridge**

Keep `uploadCandidateSource` for masks. Add a wrapper that parses `{ ...uploaded, originalFilename }` with `ManualCandidateAssetRefSchema`. Parse `job.manual_output_ref` into `CandidateJobRecord.manualOutput`.

- [ ] **Step 4: Test Image Library File behavior**

Prove the downloaded image becomes a `File` consumed by the same queue path. Preserve its supplied name; if it has no usable extension, append the verified response content-type extension without changing the supplied stem.

- [ ] **Step 5: Update CandidateActionPanel**

Call `uploadManualCandidateSource` with `manualFile.name`. Keep Desktop and Image Library calling the same `queue(file)`. Show `manualOutput.originalFilename` in immutable history and preserve the rule that a newer queued attempt does not displace a ready candidate.

- [ ] **Step 6: Preview the selected roller candidate across all five bodies**

Write a failing `rollonLineupModel` test proving a candidate image override replaces only the selected roller variant and appears in all five lineup items. Add an optional candidate roller image to the lineup selection, use the currently selected roller's variant key instead of defaulting silently to plastic, and pass the ready candidate URL from `ProductionCandidateWorkbench`. This is preview-only and must not write release membership.

- [ ] **Step 7: Run focused bridge tests and verify GREEN**

Run: `node --import tsx --test src/lib/paperDoll/candidateRepository.test.ts src/lib/paperDoll/libraryCandidateSource.test.ts src/components/paper-doll/candidatePreviewModel.test.ts src/components/paper-doll/rollonLineupModel.test.ts`

- [ ] **Step 8: Commit the bridge**

Stage only the reviewed bridge and preview files, then commit with `fix(paper-doll): connect manual candidates to Edit Lab`.

### Task 4: Safety verification and pull request

**Files:**
- Verify: all files changed by Tasks 1–3
- Verify: `supabase/functions/generate-paper-doll-candidate/index.ts`
- Verify: `supabase/functions/approve-paper-doll-candidate/index.ts`

**Interfaces:**
- Consumes: the complete manual candidate ingestion flow.
- Produces: a verified branch and ready GitHub pull request.

- [ ] **Step 1: Run the Paper Doll suite**

Run: `npm run test:paper-doll-production`

- [ ] **Step 2: Run static and build verification**

Run `npx tsc --noEmit`, then `npm run build`. Record exact repository-wide pre-existing failures if any and rerun focused checks for changed files.

- [ ] **Step 3: Audit mutation boundaries**

Search candidate upload, queue, worker, and approval code for `paper_doll_releases`, `paper_doll_release_assets`, and `sanity`. Confirm candidate ingestion has no such write.

- [ ] **Step 4: Review the complete diff**

Run `git diff --check`, `git status --short`, and scoped `git diff HEAD -- ...`. Confirm filenames never become paths and plastic/metal remain keyed by selected component ID.

- [ ] **Step 5: Push and open the PR**

Push `codex/paper-doll-production-asset-plane`, determine the remote base, and create a ready PR describing filename provenance, exact-alpha placement, tests, and the explicit no-authority/no-release/no-Sanity mutation boundary.
