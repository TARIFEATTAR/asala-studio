# Best Bottles Image-Generation Pipeline Audit Plan

> **For agentic workers:** This is a read-only audit deliverable; do not modify application code, database data, storage objects, or generation history.

**Goal:** Produce an evidence-backed Markdown audit of the current Madison/Best Bottles image-generation pipeline, distinguishing implementation from documentation and identifying unverifiable facts.

**Architecture:** Inspect the current working tree, repository documentation, prompt/configuration modules, Supabase edge functions and migrations, local generation artifacts, and any available logs or sample outputs. Trace one representative SKU through the implemented path, then synthesize the findings into the requested twenty-section report with a text architecture diagram, failure analysis, recommendations, and evidence links.

**Tech Stack:** Vite/React/TypeScript; Supabase Edge Functions and Postgres; OpenAI image API; local filesystem artifacts; JSON/CSV manifests; ImageMagick or available image-inspection utilities.

## Global Constraints

- Preserve all existing user changes in the dirty working tree.
- Treat implementation and production records as stronger evidence than stale briefs or intended architecture.
- Do not expose API keys, tokens, signed URL secrets, or credentials.
- Do not mutate Supabase, storage, Shopify, image files, or application code.
- Mark unavailable production data as unverified instead of inferring it.
- Use current pixel contracts from `AGENTS.md` and `docs/product-image-system/pixel-contracts.md`.

---

### Task 1: Map the audit surface

**Files:**
- Read: `AGENTS.md`, `CLAUDE.md`, `docs/BEST-BOTTLES-IMAGE-PIPELINE-BRIEF.md`
- Read: prompt/configuration files, generation UI, Supabase functions, migrations, scripts, tests, manifests, and local output artifacts discovered with `rg --files`

- [x] Record the actual frontend entrypoint and generation controls.
- [x] Record backend functions, storage/database dependencies, and model calls.
- [x] Record prompt sources, reference-selection logic, post-processing, and validation.
- [x] Record all available generation history, logs, and representative image files without changing them.

### Task 2: Trace a representative generation

**Files:**
- Read: `supabase/functions/generate-madison-image/index.ts`
- Read: `src/hooks/useAssembledPromptGeneration.ts`
- Read: `src/lib/bestBottlesPromptPreflight.ts`
- Read: `src/config/bestBottlesCatalogCanon.ts`
- Read: `src/config/bestBottlesFamilyProfiles.ts`
- Read: generation persistence, reference validation, framing QA, rig/postprocess, and relevant migration files

- [x] Follow input selection, prompt assembly, reference packaging, model request, response handling, persistence, and retry behavior.
- [x] Capture exact identifiers and parameters from code; redact secrets.
- [x] Separate active code paths from deprecated paper-doll or historical paths.

### Task 3: Inspect data, storage, and history

**Files:**
- Read: Supabase migrations and generated-image/reference schema usage.
- Read: local JSON/CSV manifests, audit exports, batch records, and generation logs.
- Read: image metadata and representative successes/failures where local files exist.

- [x] Document schema relationships, reproducibility fields, and storage URLs/access behavior.
- [x] Quantify frequencies/cost/performance only where records support them.
- [x] Select up to five successes and five failures, with file paths and settings, or state when unavailable.

### Task 4: Write the durable audit report

**Files:**
- Create: `docs/best-bottles-image-generation-pipeline-audit-2026-07-14.md`

- [x] Use the user-requested twenty-section structure.
- [x] Include an architecture diagram, one end-to-end trace, model/prompt/reference/SKU/glass/compositing analysis, QA/failure tables, recommendations, and unanswered questions.
- [x] Cite repository paths and line numbers where practical; link local evidence files.
- [x] State confidence and verification status for claims based on code, docs, artifacts, or missing production access.

### Task 5: Verify the report

**Files:**
- Read: `docs/best-bottles-image-generation-pipeline-audit-2026-07-14.md`

- [x] Check every requested section is present.
- [x] Search the report for secrets, placeholders, unsupported claims, and stale architecture assertions.
- [x] Confirm only the plan and report were added/changed by this audit.
