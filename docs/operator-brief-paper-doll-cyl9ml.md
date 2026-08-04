# Internal Operator Brief — CYL-9ML Paper-Doll Handoff

## Mission
- Complete the CYL-9ML paper-doll architecture to a review-ready state in Madison and publish safely through Sanity + Best Bottles UI.

## Where everything lives

### Madison (Source of work)
- Repo: `/Users/jordanrichter/Projects/Madison Studio/madison-app`
- Paper-doll workbench and pipeline: use the existing routes under `best-bottles` and Studio compose interfaces.
- Planned workflow references are in `.claude/worktrees/codex-paper-doll-production/docs/superpowers/plans/...`

### Best Bottles CMS/Website
- Sanity project: `Best-Bottles-CMS`
- Sanity dataset: `production`
- Best Bottles deployed check URL:
  - `https://best-bottles-website.vercel.app/products/cylinder-9ml-17-415?view=build&paperDollPreview=1`

## What is done
- PR #59 (“Add safe Paper Doll draft-preview bridge”) merged.
- Deployment is healthy and paper-doll build route is available with preview params.
- CYL-9ML release draft exists and is ready:
  - Draft release: `paperDollRelease.CYL-9ML.1-3-0-complete-family-1`
  - Family draft: `drafts.d5291f24-f02b-4fb7-aa99-78c5f63d8c9d`
  - No release blockers reported in draft state.
- Main build architecture in Madison is in place; geometry is considered source-of-truth and paper-doll operations are managed by release/candidate state.

## What remains (next operator sequence)
1. Validate CYL-9ML on build page with preview query and logged-in studio session.
2. Confirm layer integrity and per-component placement/fitment visually.
3. Confirm release is still ready and no blockers are introduced.
4. Execute explicit publish action sequence per schema (draft/approved release → storefront readiness).
5. Run same pattern for next families only after CYL-9ML is explicitly approved.

## Known risks
- Legacy PDP routes can mask whether paper-doll architecture is rendering.
- Public-facing data remains intentionally separate until explicit publish path is executed.
- Do not bypass release lock flow with ad-hoc direct mutations.

## Operator notes
- Do not switch to full regeneration for geometry corrections; use rig-driven geometry and controlled composition/placement updates.
- Preserve current canonical paths, IDs, and draft/public separation.
- Use this brief as the minimum required handoff context before scaling to the rest of the cylinder catalog.
