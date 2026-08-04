# Paper-Doll production asset plane

Status: code complete; database migrations not yet applied

Scope: read-only Madison release console, private Supabase assets, immutable ledger

Live Sanity publication: disabled

## System boundary

Git owns application code, migrations, validation rules, and synthetic tests. It
does not own PSD/PSB files, Blender scenes, raw generations, production PNGs,
masks, GLB/USDZ exports, or rendered catalogs.

Supabase owns the working asset plane:

- `paper-doll-sources` — private source files such as PSD, Blender, CAD and raw renders.
- `paper-doll-candidates` — private flattened previews, masks and QA candidates.
- `paper-doll-approved` — private, immutable release derivatives. Only trusted server code can write here.

Sanity remains the final catalog publication plane. This release does not add a
Sanity write path.

## Object contract

Every object is content addressed:

```text
<organization_id>/<family_key>/<asset_id>/<sha256>.<extension>
```

The database stores bucket, object path, SHA-256, MIME type, byte size,
dimensions, alpha bounds, mount axis, seat position, approval status, parent
version and provenance. It never stores a signed URL. Madison resolves private
objects to five-minute URLs at runtime.

Authenticated organization members may append objects to source and candidate
buckets. They receive no Storage update or delete policy. A visual adjustment
therefore produces a new object and component-version row rather than silently
overwriting a prior asset.

## Controlled rollout

1. Review and merge the deployment hardening before any other production work.
2. Start Docker and run the local migration suite:

   ```bash
   npx supabase start
   npx supabase test db --local supabase/tests/paper_doll_family_release_v1.sql
   npx supabase db lint --local
   ```

3. Apply the migrations to a non-production Supabase project and rerun the pgTAP test there.
4. Provision the three private buckets from a trusted terminal:

   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run paper-doll:storage:provision
   ```

   The command fails if any expected bucket already exists as public. Never use
   a `VITE_` variable for the service-role key.

5. Upload the five locked bottle plates without changing their bytes. Calculate
   SHA-256 before upload and use the digest in the object name and ledger row.
6. Register one CYL-9ML draft release and its component-version membership.
7. Open the product's existing Best Bottles Studio and select **Compose**. The
   release console should resolve all private previews without a new frontend build.
8. Verify baseline, mount axis, seat coordinates, approval state and recorded QA.
9. Keep Sanity publication disabled. A separate reviewed change must implement
   dry-run projection, named approval, and publication.

## Deployment behavior

Merges to `main` build the frontend only. Supabase Edge Functions are deployed
only through the manual **Deploy Approved Supabase Edge Functions** workflow.
That workflow requires a named function allowlist, production-environment
approval, default JWT verification, and fail-closed deployment.

## Current hold

The TypeScript tests, scoped lint, clean npm install, and Vite production build
pass.

The pgTAP migration test **has now run and passed** — 17 of 17 assertions, zero
failures — against a native PostgreSQL 16 cluster via
`supabase/tests/native-replay/run-native-replay.sh`, which stands in for
`supabase start` where no Docker daemon is available. Evidence:
`docs/paper-doll-rig/evidence/CYL-9ML-MIGRATION-GATE-VERIFICATION.md`.

The release ledger is therefore verified: six tables, RLS enabled, immutability
and tenancy contracts held, and no ledger write privilege granted to
`authenticated`.

Two conditions still gate production:

1. **Rollout step 3 is unchanged.** Apply the migrations to a non-production
   Supabase project and rerun the pgTAP test there. The native harness uses a
   bootstrap shim rather than the real platform images, so it proves migration
   consistency but does not exercise GoTrue, Realtime, or the storage API.
2. **The candidate-job chain cannot be rebuilt from this repository.**
   `public.generation_attempts` is referenced by a foreign key in
   `20260802052230_paper_doll_candidate_jobs.sql` but has no `CREATE TABLE`
   anywhere in the repo, so that migration and the four after it — candidate
   jobs, worker health, and approval — fail on any clean database. Add the
   missing migration before relying on a from-scratch rebuild.
