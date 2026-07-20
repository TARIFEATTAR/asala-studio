# Best Bottles Cost and Time Audit

**Status date:** 2026-07-15  
**Repositories reviewed:**

- Best Bottles website: `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026`
- Madison Studio: `/Users/jordanrichter/Projects/Madison Studio/madison-app`
- Supabase project ref: `likkskifwsrvszxdvufw`

## Executive conclusion

An exact all-in dollar total cannot currently be recovered from the repositories or from the configured API key. The code contains usage estimates, but it does not contain a provider billing ledger. The live Supabase database contains image records and the live Storage API exposes current object sizes, but neither is an invoice.

The most defensible current readout is:

| Category | Current evidence | What it means |
|---|---:|---|
| Live `generated_images` records | **4,309** | Historical Madison image records, not necessarily 4,309 paid provider calls |
| Best Bottles-tagged image records | **3,329** | Rows matching the current prompt/tag identity heuristic |
| Best Bottles-tagged OpenAI rows | **2,247** | Candidate `gpt-image-2` rows; not a billing-confirmed request count |
| `generated-images` Storage footprint | **12,337 files / 16.901 GB** | Current generated-image objects visible through Supabase Storage |
| All Supabase Storage buckets | **17.064 GB** | Current project-wide object footprint |
| Saved local generation-report rows | **1,550** | 513 `ok`, 116 `qa-warning`, 888 `error`, 33 `skipped` |
| Cumulative saved generation time | **10.16 hours** | Sum of per-row `genTimeSec`; not human time or wall-clock elapsed time |
| Current material-pilot attempts | **1** | 130.989 seconds; estimated cost `$0.00`; actual cost is `null` |
| Exact provider dollars | **Not available** | Requires billing exports or an Admin usage key |

The important distinction is that the project has enough evidence to quantify usage, storage, attempts, and code-derived estimates, but not enough evidence to state “we have spent exactly `$X`.” That final number requires the provider billing systems.

## Cost-status legend

- **Verified usage:** directly observed in the live database, Storage API, or saved report artifacts.
- **Code-derived estimate:** calculated from a hard-coded rate in the application.
- **Usage-rate equivalent:** a mathematical storage-rate calculation that is useful for planning but is not an invoice.
- **Pending billing:** requires a provider dashboard export, invoice, or usage API response.

## Line-item cost ledger

### Image-generation providers

| Line item | Quantity currently evidenced | Rate/basis | Current subtotal | Confidence |
|---|---:|---|---:|---|
| OpenAI `gpt-image-2` candidate records | 2,247 Best Bottles-tagged rows; 2,359 OpenAI `gpt-image-2` rows across the full table | Current OpenAI pricing is token-based: text input + image input + image output. The actual amount varies with reference-image size, prompt tokens, output size, and quality. | **Pending** | Candidate row count only; not confirmed paid-call count |
| Gemini / fallback image records | 1,082 Best Bottles-tagged rows, including `gemini` and `gemini (fallback)` | Provider rate and actual usage were not stored in the row or available from the repository. | **Pending** | Candidate row count only |
| Freepik / fal.ai / background-processing records | 65 rows across the full Madison table were attributable to Freepik or `fal-ai/birefnet` in the live provider fields | No provider usage or invoice data is stored locally. Best Bottles attribution is not reliable enough to assign all 65 to this project. | **Pending** | Project-wide infrastructure count |
| Current material-pilot OpenAI attempt | 1 completed attempt | The pilot row records `estimated_cost_usd = 0`, `actual_cost_usd = null`, and a 130,989 ms duration. | **$0.00 recorded / actual unknown** | Verified row state, not verified billing |

OpenAI's current image-generation price must be calculated from the request's token usage rather than from a universal flat per-image amount. The formula is:

```text
actual request cost
= text input tokens × $5.00 / 1,000,000
+ image input tokens × $8.00 / 1,000,000
+ image output tokens × $30.00 / 1,000,000
```

The current master lane uses `gpt-image-2`, a 2080 × 2288 output, high quality, and one or two reference images. The repository does not persist the input/output token usage needed to apply that formula retrospectively. See [OpenAI API pricing](https://developers.openai.com/api/docs/pricing) and the [OpenAI image-generation guide](https://developers.openai.com/api/docs/guides/image-generation).

### Code-derived image cost estimates

These are useful for understanding what the application would have displayed, but they are not actual API spend:

| Estimator | Quantity/basis | Implied amount | Why it is not authoritative |
|---|---:|---:|---|
| Madison UI `gpt-image-2` heuristic, “high” tier | 2,193 Best Bottles rows × `$0.25` | **$548.25** | Flat display rate based on description text such as “Director Mode” or “Pro Photography”; no token usage or invoice linkage |
| Madison UI `gpt-image-2` heuristic, standard tier | 54 Best Bottles rows × `$0.095` | **$5.13** | Same issue; it is a UI heuristic, not provider billing |
| Madison UI heuristic, all Best Bottles-tagged rows | 3,329 rows, including non-OpenAI rows assigned the fallback `$0.095` rate | **$656.17** | It assigns a default rate to other providers and therefore must not be called actual spend |
| Local CLI estimate | 513 `ok` rows × hard-coded `$0.04` | **$20.52** | `scripts/local-generate.ts` prints `$0.04 × successful jobs`; it does not distinguish current model pricing, provider, retries, or token usage |

The two code estimates should not be added together. They describe different report populations and different historical assumptions.

### Supabase storage and platform costs

| Line item | Current usage | Rate/basis | Usage-rate equivalent | Exact billed amount |
|---|---:|---|---:|---:|
| `generated-images` bucket | 16,900,878,023 bytes / approximately 16.901 GB decimal | 12,337 objects; public bucket | If a 1 GB allowance applied, 15.901 GB over allowance × `$0.0213/GB-month` ≈ **$0.3387/month** | Pending plan/invoice |
| All Supabase buckets | 17,063,750,971 bytes / approximately 17.064 GB decimal | Includes generated images, reference images, DAM assets, and brand documents | If a 1 GB allowance applied, 16.064 GB over allowance × `$0.0213/GB-month` ≈ **$0.3422/month** | Pending plan/invoice |
| Supabase Pro base plan, if applicable | Plan not verified | Supabase documents a `$25/month` Pro base price and 100 GB included file storage | **$25/month base + $0 incremental storage at current footprint**, if this project is on Pro | Pending plan/invoice |
| Supabase bandwidth/egress | Not available | Generated images are publicly addressable; traffic may create bandwidth charges | **Not calculable from the repository** | Pending usage export |
| Supabase database, functions, and compute | Not isolated by feature | No project billing statement or usage export was available | **Not calculable from the repository** | Pending usage export |

The storage-rate equivalents use the current Supabase Storage rate of `$0.00002919 per GB-hour`, approximately `$0.0213 per GB-month`, and the plan quotas documented by Supabase. They are not a claim about the plan currently attached to this project. See [Supabase Storage pricing](https://supabase.com/docs/guides/storage/pricing) and [Supabase pricing](https://supabase.com/pricing).

Generated-image storage is currently about **99.05%** of all visible Supabase Storage bytes. Storage itself is unlikely to be the largest project cost; image-provider calls, engineering time, and public-image bandwidth are the larger unknowns.

### Other project/platform costs not recoverable from code

The repositories do not contain reliable billing totals for Shopify, Sanity, Vercel/hosting, Convex, Resend, monitoring, domain services, Google/Gemini, Freepik, fal.ai, Higgsfield, or other connected services. These need to be added from invoices or usage exports if the requested number is intended to be a true all-in project cost.

## Time and effort ledger

### What can be measured from the repositories

| Time category | Evidence | Measured value | Interpretation |
|---|---|---:|---|
| Best Bottles website code activity | Git history from initial repository commit through latest reviewed commit | 276 commits from 2026-02-22 through 2026-07-12, roughly 4.5 months of calendar span | Activity volume and elapsed calendar time, not person-hours |
| Madison Best Bottles factory work | 91 commits explicitly labeled Best Bottles from 2026-06-19 through 2026-07-12, with pipeline planning beginning 2026-06-08 | Approximately 5 weeks of factory work visible in Git | Includes implementation, tests, documentation, and agent-assisted commits; not person-hours |
| Local provider/output runtime | 1,550 saved report rows | 36,563.8 cumulative seconds = **10.16 hours** | Sum of recorded per-job durations; 7.75 hours were `ok`, 2.41 hours were `qa-warning` |
| Local successful outputs | 513 `ok` rows plus 116 `qa-warning` rows | 629 output-producing rows | Not necessarily unique products; reports include experiments, retries, and repeated SKUs |
| Local failed attempts | 888 `error` rows, including 887 billing-hard-limit errors in the checked-in report artifacts | 888 failed rows | The hard-limit errors show that the API budget constraint directly blocked planned batches; failed requests are not assumed to be billed |
| Live material pilot runtime | 1 Supabase attempt | 130.989 seconds | A single measured external attempt; not a full-batch runtime |
| Human engineering/review time | No time tracker, worklog, or meeting ledger in either repo | **Unknown** | Cannot be honestly inferred from commit count or lines changed |

The 10.16 hours is a useful lower-bound on serialized provider/output runtime represented in the saved local reports. It is not the total time spent by people. It also is not wall-clock elapsed time because batches may have run concurrently, and it excludes planning, data reconciliation, visual review, debugging, waiting, deployment, client communication, and unrecorded attempts.

### Why Git cannot provide an exact labor total

Git can show when commits were authored and how much code changed. It cannot show:

- time spent thinking, reviewing, or testing without committing;
- time spent waiting for image APIs or manually evaluating outputs;
- work performed in chat, meetings, or local files that were never committed;
- whether several commits were one continuous work session or separate sessions;
- how much of a commit was generated, edited, reviewed, or reworked by a person;
- labor from collaborators whose changes were squashed or committed under a shared author identity.

Therefore, any statement such as “we spent 200 engineering hours” would be invented unless it is reconciled to time-tracking, calendar, issue, or session records.

## Why the current image-generation cost is difficult to reconstruct

The image factory is materially different from a one-off image request:

1. One product identity can have multiple roles: cap-on, cap-off, sidecar, family reference, and final PDP asset.
2. A single identity may be attempted multiple times across models, prompts, framing rigs, and QA revisions.
3. Failed API requests, provider retries, QA rejects, human rejects, and published images are different lifecycle events.
4. A database row can represent an imported, derivative, fallback, or generated image; the row count is not automatically a provider request count.
5. Current legacy rows do not contain the provider usage tokens, invoice ID, request ID, retry lineage, or a durable cost basis needed for retrospective billing.
6. Storage charges depend on object retention and traffic, not only on the number of images created.

This is why a one-off image can often be costed from one receipt, while an image factory needs an attempt ledger and a provider billing reconciliation.

## Current accounting gaps

The repositories show the following gaps in the historical cost record:

- `generated_images` does not contain a complete per-generation `actual_cost_usd` and token-usage ledger.
- Legacy generation records do not consistently contain provider request IDs or response usage metadata.
- The local CLI records `genTimeSec` but not the complete provider/model/usage/cost tuple.
- The Madison UI cost meter uses flat heuristics that predate or simplify current provider pricing.
- The new material-pilot schema has `estimated_cost_usd`, `actual_cost_usd`, `usage_evidence`, `provider_request_id`, and `duration_ms`, but its current live attempt has an estimated cost of zero and an unset actual cost.
- Supabase Storage object sizes are measurable, but the project's billing plan, storage allowance, bandwidth, and invoice period are not present in the codebase.
- There is no time ledger that converts engineering, review, or client-approval work into hours and dollars.

## What is required to produce the exact final dollar total

The following source records are required. They should be exported rather than pasted as secrets into chat:

1. **OpenAI:** organization/project usage and cost export for 2025-11-21 through 2026-07-15, filtered to image models and the relevant project/API key. The configured key was tested read-only and returned HTTP 403 because it lacks the `api.usage.read` scope; an Admin-capable export is required.
2. **Gemini/Google:** AI Studio or Google Cloud billing/usage export covering the same period and models.
3. **Freepik, fal.ai, Higgsfield, and other image services:** invoices or usage exports for all accounts used by the Madison image lanes.
4. **Supabase:** organization invoice, plan, project usage, Storage bytes, database/compute usage, function usage, bandwidth/egress, and billing start date for project `likkskifwsrvszxdvufw`.
5. **Commerce and hosting:** Shopify, Sanity, Vercel/hosting, Convex, email, analytics, monitoring, domain, and any other subscription invoices if the result must be all-in.
6. **Labor:** time-tracking export, calendar/session log, project-management history, or an agreed reconstruction with hourly rates and role ownership.

Once those records exist, the final total should be reconciled by month and by image lifecycle:

```text
total project cost
= provider API spend
+ storage and bandwidth
+ hosting/platform subscriptions
+ engineering and production labor
+ review/approval labor
+ unrecovered miscellaneous expenses
```

The image portion should separately report:

```text
attempts -> provider successes -> QA passes -> human approvals -> published PDP assets
```

That prevents a retry or rejected image from disappearing inside a single “images generated” number.

## Recommended accounting change before the next paid batch

Before another catalog-scale run, make every attempt write a durable cost record with:

- product identity and asset role;
- run ID, attempt ID, retry lineage, and batch ID;
- provider, model, snapshot, quality, size, and reference count;
- provider request ID;
- input/output token usage or provider-native usage units;
- versioned price-card ID and calculated estimated cost;
- actual billed cost when available;
- request start/end time and total duration;
- raw output, QA result, human decision, and publication result;
- code version, prompt hash, reference hash, and catalog-truth hash.

The current pilot schema is the right direction, but zero-valued price cards must be treated as `unpriced`, not as `$0.00` spend. The next release should also add a cost-status field such as `unknown`, `estimated`, `actual`, or `reconciled` so that the dashboard cannot present an estimate as an invoice.

## Bottom line

The current repositories support a precise usage and effort statement, but not an exact all-in dollar statement:

- **At least 10.16 cumulative hours of generation runtime are represented in saved local reports.**
- **The live project currently stores 16.901 GB of generated-image objects and 17.064 GB across all Supabase buckets.**
- **The code's visible image-cost heuristics range from `$20.52` for the saved local `ok` rows to `$656.17` for the current Best Bottles UI heuristic population; neither is actual spend.**
- **The actual OpenAI, Gemini, other-provider, Supabase, and labor totals remain pending billing and time records.**

Any client-facing financial statement should use the pending-billing language until those exports are reconciled.
