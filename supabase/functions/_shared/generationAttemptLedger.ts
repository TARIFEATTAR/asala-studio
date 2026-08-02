/**
 * Generation-attempt ledger — Paper-Doll Rig build task 0.
 * (docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md, "Build order" §0)
 *
 * One row per provider call, written BEFORE the call and completed after, so
 * cost / latency / retry / failure rates stop being unverifiable estimates
 * (2026-07-15 audit §16: "no verified per-image cost, latency distribution,
 * retry rate ... is available").
 *
 * Contract: NOTHING in this module may ever throw or block generation. Every
 * database interaction is wrapped; a ledger failure degrades to a console
 * warning and the generation proceeds exactly as before.
 *
 * Runtime-neutral on purpose (no Deno.* at module scope) so the pure builders
 * are testable under `tsx --test` alongside the other _shared suites.
 */

// Deliberately loose: accepts any supabase-js client (typed or untyped)
// without pinning a version. Runtime guards below carry the safety — every
// call is wrapped and a malformed response degrades to a console warning.
// deno-lint-ignore no-explicit-any
type LedgerClient = { from: (table: string) => any };

export const GENERATION_ATTEMPTS_TABLE = "generation_attempts";

/** Max stored error length — keeps provider HTML error pages out of the row. */
export const LEDGER_ERROR_MAX_CHARS = 2000;

export interface GenerationAttemptStartInput {
  organizationId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  /** e.g. "best-bottles-reference-locked" | "darkroom" */
  lane: string;
  provider: string;
  model?: string | null;
  /** "edits" | "generations" for OpenAI; null for providers without the split. */
  endpoint?: string | null;
  requestSize?: string | null;
  requestResolution?: string | null;
  prompt: string;
  /**
   * Raw base64 reference payloads. Only SHA-256 fingerprints are stored —
   * never the bytes. Fingerprints let a later run prove byte-identical inputs.
   */
  referenceFingerprintSources?: string[];
  referenceUrls?: string[];
  graceSku?: string | null;
  websiteSku?: string | null;
  productGroupSlug?: string | null;
  seed?: number | null;
  attemptNumber?: number | null;
  codeCommit?: string | null;
  requestParams?: Record<string, unknown> | null;
}

export interface GenerationAttemptTracker {
  id: string | null;
  startedAtMs: number;
}

export interface GenerationAttemptCompletionInput {
  status: "succeeded" | "failed";
  errorMessage?: string | null;
  generatedImageId?: string | null;
  outputUrl?: string | null;
  revisedPrompt?: string | null;
  /** Recorded when a fallback changed the provider/model mid-request. */
  finalProvider?: string | null;
  finalModel?: string | null;
}

export async function sha256Hex(input: string): Promise<string | null> {
  try {
    const bytes = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/**
 * Verified org-average cost per request: July 2026 OpenAI billing showed
 * $235.10 across 560 requests (~$0.42/request; image key alone $231.17/537
 * ≈ $0.43). Replaces the old $0.095 UI constant, which real billing proved
 * ~4.4× too low. Still an AVERAGE — 2080×2288 quality=high masters sit above
 * it (output tokens scale with pixels); per-size truth comes from joining
 * ledger rows to billing periods. Null when no estimate exists.
 */
export function estimateUnverifiedCostUsd(
  provider: string,
  model?: string | null,
): number | null {
  if (provider === "openai" && (model ?? "").startsWith("gpt-image")) {
    return 0.42;
  }
  return null;
}

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function buildGenerationAttemptInsert(
  input: GenerationAttemptStartInput,
): Promise<Record<string, unknown>> {
  const referenceShas: string[] = [];
  for (const source of input.referenceFingerprintSources ?? []) {
    const sha = await sha256Hex(source);
    if (sha) referenceShas.push(sha);
  }

  return {
    organization_id: input.organizationId ?? null,
    user_id: input.userId ?? null,
    session_id: cleanText(input.sessionId),
    lane: input.lane,
    provider: input.provider,
    model: cleanText(input.model),
    endpoint: cleanText(input.endpoint),
    request_size: cleanText(input.requestSize),
    request_resolution: cleanText(input.requestResolution),
    prompt_sha256: await sha256Hex(input.prompt),
    prompt_chars: input.prompt.length,
    reference_count: input.referenceFingerprintSources?.length ?? 0,
    reference_sha256s: referenceShas.length ? referenceShas : null,
    reference_urls: input.referenceUrls?.length ? input.referenceUrls : null,
    grace_sku: cleanText(input.graceSku),
    website_sku: cleanText(input.websiteSku),
    product_group_slug: cleanText(input.productGroupSlug),
    seed: typeof input.seed === "number" && Number.isFinite(input.seed) ? input.seed : null,
    attempt_number:
      typeof input.attemptNumber === "number" && Number.isFinite(input.attemptNumber)
        ? Math.max(1, Math.floor(input.attemptNumber))
        : null,
    status: "pending",
    estimated_cost_usd: estimateUnverifiedCostUsd(input.provider, input.model),
    code_commit: cleanText(input.codeCommit),
    request_params: input.requestParams ?? null,
  };
}

export function buildGenerationAttemptCompletion(
  tracker: GenerationAttemptTracker,
  input: GenerationAttemptCompletionInput,
  nowMs: number = Date.now(),
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    status: input.status,
    completed_at: new Date(nowMs).toISOString(),
    latency_ms: Math.max(0, Math.round(nowMs - tracker.startedAtMs)),
  };
  if (input.errorMessage != null) {
    patch.error_message = String(input.errorMessage).slice(0, LEDGER_ERROR_MAX_CHARS);
  }
  if (input.generatedImageId) patch.generated_image_id = input.generatedImageId;
  if (input.outputUrl) patch.output_url = input.outputUrl;
  if (input.revisedPrompt) patch.revised_prompt = input.revisedPrompt;
  if (input.finalProvider) patch.provider = input.finalProvider;
  if (input.finalModel) patch.model = input.finalModel;
  return patch;
}

/** Insert the pending row. Never throws; returns a tracker whose id is null on failure. */
export async function beginGenerationAttempt(
  client: LedgerClient,
  input: GenerationAttemptStartInput,
): Promise<GenerationAttemptTracker> {
  const tracker: GenerationAttemptTracker = { id: null, startedAtMs: Date.now() };
  try {
    const record = await buildGenerationAttemptInsert(input);
    const { data, error } = await client
      .from(GENERATION_ATTEMPTS_TABLE)
      .insert(record)
      .select("id")
      .single();
    if (error) {
      console.warn(
        "[generation-attempts] insert failed (non-blocking):",
        error.message ?? String(error),
      );
    } else {
      tracker.id = data?.id ?? null;
    }
  } catch (e) {
    console.warn(
      "[generation-attempts] begin failed (non-blocking):",
      e instanceof Error ? e.message : String(e),
    );
  }
  return tracker;
}

/** Complete the row. Never throws; no-ops when the begin insert didn't land. */
export async function completeGenerationAttempt(
  client: LedgerClient,
  tracker: GenerationAttemptTracker | null,
  input: GenerationAttemptCompletionInput,
): Promise<void> {
  if (!tracker?.id) return;
  try {
    const { error } = await client
      .from(GENERATION_ATTEMPTS_TABLE)
      .update(buildGenerationAttemptCompletion(tracker, input))
      .eq("id", tracker.id);
    if (error) {
      console.warn(
        "[generation-attempts] completion failed (non-blocking):",
        error.message ?? String(error),
      );
    }
  } catch (e) {
    console.warn(
      "[generation-attempts] complete failed (non-blocking):",
      e instanceof Error ? e.message : String(e),
    );
  }
}
