# Best Bottles Cylinder Material Pilot V1

## Scope

This is an isolated, role-clean material-rendering benchmark for the Cylinder family. It preserves the existing canonical catalog truth, framing contract, human approval system, reconciliation records, and Shopify publishing guard.

Active renderers:

- `openai-gpt-image-2` → `gpt-image-2`
- `google-nano-banana-2` → `models/gemini-3.1-flash-image-preview`

Reserved but inactive:

- `higgsfield-future` → no endpoint or credentials; cannot be selected

The compiled cohort has eight products: four exact cap-on roles and four exact cap-off sidecar roles. Two attempts per product and renderer produce 32 planned attempts.

## Hard controls

- Cap-on and sidecar product-truth references are separate identity lanes.
- Every downloaded reference must match its recorded SHA-256 digest.
- The exact prompt and canonical truth payload must match their SHA-256 digests.
- Provider model identifiers are fixed and response model drift fails the attempt.
- There is no provider fallback.
- GPT Image 2 must return the exact 2080×2288 Bone canvas.
- Google output may only be symmetrically cropped and resized as a whole raster.
- Background fill, painting, extension, foreground matte, compositing, and repair are prohibited.
- Native Bone border QA reports/rejects drift; it never repairs pixels.
- Attempts are written before the provider call and retain raw and final hashes.
- The database forces `publish_eligible = false` and `background_mutated = false`.
- Benchmark outputs do not create production reconciliation or Shopify assignment records.
- Human review is required before results can inform a later production cutover.

## Files

- Renderer policy, role QA, Bone QA, and aggregation: `supabase/functions/_shared/bestBottlesMaterialPilot.ts`
- Provider-neutral request adapter: `supabase/functions/_shared/bestBottlesMaterialPilotRenderer.ts`
- Isolated execution endpoint: `supabase/functions/generate-bestbottles-material-pilot/index.ts`
- Telemetry and blinded-review migration: `supabase/migrations/20260715010000_best_bottles_material_pilot.sql`
- Cohort compiler: `scripts/best-bottles/cylinder-material-pilot.ts`
- Compile/execute/report CLI: `scripts/best-bottles/run-cylinder-material-pilot.ts`
- Compiled local manifest: `tmp/best-bottles-reference-production/cylinder-material-pilot-v1/manifest.json`

## Operating sequence

1. Apply the migration in the intended Supabase environment.
2. Deploy `generate-bestbottles-material-pilot` with the existing OpenAI and Gemini secrets.
3. Set a real, versioned price card. A zero cost remains visible as unpriced; the runner does not invent pricing.
4. Compile without network or model calls:

   `deno run --allow-read --allow-write scripts/best-bottles/run-cylinder-material-pilot.ts compile`

5. Execute only after environment and billing verification:

   `deno run --allow-read --allow-write --allow-env --allow-net scripts/best-bottles/run-cylinder-material-pilot.ts execute`

6. Review every attempt blind and write decisions to `best_bottles_material_pilot_reviews`.
7. Produce the durable comparison:

   `deno run --allow-read --allow-write --allow-env --allow-net scripts/best-bottles/run-cylinder-material-pilot.ts report`

The report returns approval rate, first-pass approval, native Bone pass rate, failure-reason counts, median and p90 duration, total estimated cost, and cost per approved image by renderer.

## Required execution environment

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_USER_ACCESS_TOKEN`
- `SUPABASE_ANON_KEY` (recommended)
- `BEST_BOTTLES_ORGANIZATION_ID`
- `OPENAI_API_KEY` in the Edge Function environment
- `GEMINI_API_KEY` in the Edge Function environment
- `PILOT_OPENAI_ESTIMATED_COST_USD`
- `PILOT_GOOGLE_ESTIMATED_COST_USD`
- `PILOT_PRICE_CARD_VERSION`

For reporting, set `BEST_BOTTLES_MATERIAL_PILOT_RUN_ID`.

## Deployment state

This change prepares local code, schema, tests, manifest, and the execution/reporting path. It does not apply the migration, deploy the function, spend model credits, approve images, or publish anything to Shopify.
