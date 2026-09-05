# Madison Writing AI switcher

Status: implemented locally; not deployed and database migration not applied.

Settings → Writing AI selects a provider, model, and connection for the organization. OpenAI / GPT-5 mini using the existing server OPENAI_API_KEY is the default. Google Gemini remains selectable. OpenRouter accepts only openrouter/free or model IDs ending in :free, and requests zero-priced input/output routes. There is no automatic fallback to another model or provider. Free-provider availability, quotas, and data terms still apply.

Owners/admins can change settings, test connections, and save a replacement key. Members can see the configuration. Custom keys are saved in Supabase Vault, with organization/provider references in the isolated writing_ai_private schema. Service-only RPCs resolve credentials after Edge authentication; the browser receives connection booleans, never saved keys. Selecting “Existing Madison connection” uses the appropriate server environment variable without deleting a saved custom key.

## Coverage

The request-local adapter covers Create, Multiply, Think Mode, marketplace assistance, copy enhancement, prompt refinement, content worksheet parsing, brand knowledge extraction/suggestions, brand consistency/health/DNA analysis, competitive intelligence, website/document scans, squad assignment, and DAM image descriptions/tags. Existing chat SSE delivery and content response shapes are preserved. Brand context and copy instructions stay in the existing functions.

Image generation providers, image keys, image models, and image dimensions are unchanged. DAM search embeddings remain on their existing OpenAI embeddings endpoint; the writing selector does not make embeddings or image generation free. The unreferenced legacy text helpers in _shared/aiProviders.ts and src/src/lib/madisonLLM.ts are not runtime entrypoints for these writing flows.

PDF scans use native file inputs with OpenAI/Gemini. OpenRouter PDF scans fail explicitly without a paid parser or paid-provider fallback. Image-capable requests require a compatible selected model. Model IDs can be entered manually; access and support are verified by Test connection and the provider at request time.

## Validation

- Production frontend build passed.
- 27 offline Deno tests passed: provider payloads, reasoning/text extraction, PDF handling, free-route enforcement, error redaction, token truncation, concurrent organization isolation, authentication and membership checks, custom-key isolation, settings permissions and metadata-only responses.
- Deno type checks passed for the new settings handler and Create, Multiply, Think Mode, marketplace assistance, copy enhancement, PDF scans, and DAM processing.
- Real OpenAI request succeeded with the existing local key: GPT-5 mini returned text through the new adapter.
- Browser test at 390px: settings save/reload, provider switch, key input clearing, no horizontal overflow. Desktop layout also inspected. Browser API responses were mocked; no production settings or client records were accessed.
- Repository-wide TypeScript checks remain blocked by pre-existing errors. The website-scan BrandProfile/siteCopy mismatches were reproduced against a clean HEAD export; they are not introduced by this change.
- The migration and SQL security assertions passed in an isolated Supabase Postgres 17.6 container with real Vault: encrypted storage, rotation, key preservation, RLS organization isolation, denial of direct writes and secret RPC access. Repeat with `bash scripts/writing-ai/test-database.sh`. No production database was touched.
- A second real OpenAI request returned valid structured JSON with three complete emails and respected the synthetic brand-language constraints.
- Gemini and OpenRouter live calls were not exercised; full application workflows still require staging/deployed smoke checks.

## Rollout

1. Review/apply only supabase/migrations/20260905000113_writing_ai_settings.sql to the intended staging database first. Do not push the repository’s unrelated pending migration history.
2. Verify Vault is enabled, owner/admin versus member access, cross-organization denial, custom-key save/rotation, and that authenticated/anon roles cannot execute the three secret RPCs or query the private schema.
3. Verify the intended Edge deployment already has OPENAI_API_KEY. Optional managed alternatives use GEMINI_API_KEY or OPENROUTER_API_KEY. Never put these keys in VITE variables.
4. Deploy writing-ai-settings and every function listed below together; shared module changes are bundled into each deployed function. The new settings endpoint performs its own user authentication (verify_jwt=false in config.toml).
5. Deploy the frontend and verify real Create, Multiply, Think Mode, settings persistence, PDF scan, member restrictions, and selected-provider failures. Confirm image generation still uses its existing provider.
6. Apply the reviewed migration and deployment to production only after approval and staging verification.

Affected Edge functions:

```
writing-ai-settings
analyze-amplify-fit
analyze-brand-consistency
analyze-brand-dna
analyze-brand-health
competitive-intelligence
enhance-copy
extract-brand-knowledge
generate-with-claude
marketplace-assistant
parse-content-worksheet
process-brand-document
process-dam-asset
refine-prompt-template
repurpose-content
scan-brand-document
scan-website
scan-website-enhanced
scrape-brand-website
suggest-brand-knowledge
think-mode-chat
```

Rollback: redeploy the previous frontend and affected function bundles. Leave the additive settings schema and encrypted keys in place; a rollback does not require deleting user keys or organization data.

## Sources

- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/docs/models/gpt-5-mini
- https://developers.openai.com/api/docs/guides/file-inputs
- https://supabase.com/docs/guides/database/vault
- https://ai.google.dev/gemini-api/docs/pricing
- https://openrouter.ai/docs/guides/routing/routers/free-router
