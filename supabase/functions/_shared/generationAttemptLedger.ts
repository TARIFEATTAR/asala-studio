type LedgerClient = { from: (table: string) => any };

export const GENERATION_ATTEMPTS_TABLE = "generation_attempts";
export const LEDGER_ERROR_MAX_CHARS = 2000;

export interface GenerationAttemptTracker {
  id: string | null;
  startedAtMs: number;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function estimateUnverifiedCostUsd(provider: string, model?: string | null): number | null {
  return provider === "openai" && model === "gpt-image-2" ? 0.42 : null;
}

export async function buildGenerationAttemptInsert(input: {
  organizationId: string;
  userId: string;
  lane: string;
  provider: string;
  model: string;
  endpoint: string | null;
  prompt: string;
  referenceSha256s: string[];
  requestParams?: Record<string, unknown>;
}) {
  return {
    organization_id: input.organizationId,
    user_id: input.userId,
    lane: input.lane,
    provider: input.provider,
    model: input.model,
    endpoint: input.endpoint,
    request_size: "2080x2288",
    request_resolution: "production",
    prompt_sha256: await sha256Hex(input.prompt),
    prompt_chars: input.prompt.length,
    reference_count: input.referenceSha256s.length,
    reference_sha256s: input.referenceSha256s,
    status: "pending",
    estimated_cost_usd: estimateUnverifiedCostUsd(input.provider, input.model),
    request_params: input.requestParams ?? null,
  };
}

export function buildGenerationAttemptCompletion(
  tracker: GenerationAttemptTracker,
  input: {
    status: "succeeded" | "failed";
    errorMessage?: string;
    outputUrl?: string;
    revisedPrompt?: string;
  },
  nowMs = Date.now(),
) {
  return {
    status: input.status,
    completed_at: new Date(nowMs).toISOString(),
    latency_ms: Math.max(0, Math.round(nowMs - tracker.startedAtMs)),
    ...(input.errorMessage ? { error_message: input.errorMessage.slice(0, LEDGER_ERROR_MAX_CHARS) } : {}),
    ...(input.outputUrl ? { output_url: input.outputUrl } : {}),
    ...(input.revisedPrompt ? { revised_prompt: input.revisedPrompt } : {}),
  };
}

export async function beginGenerationAttempt(
  client: LedgerClient,
  input: Parameters<typeof buildGenerationAttemptInsert>[0],
): Promise<GenerationAttemptTracker> {
  const tracker: GenerationAttemptTracker = { id: null, startedAtMs: Date.now() };
  try {
    const { data, error } = await client
      .from(GENERATION_ATTEMPTS_TABLE)
      .insert(await buildGenerationAttemptInsert(input))
      .select("id")
      .single();
    if (error) throw error;
    tracker.id = data?.id ?? null;
  } catch (error) {
    console.warn("[paper-doll generation ledger] begin failed:", error);
  }
  return tracker;
}

export async function completeGenerationAttempt(
  client: LedgerClient,
  tracker: GenerationAttemptTracker | null,
  input: Parameters<typeof buildGenerationAttemptCompletion>[1],
): Promise<void> {
  if (!tracker?.id) return;
  try {
    const { error } = await client
      .from(GENERATION_ATTEMPTS_TABLE)
      .update(buildGenerationAttemptCompletion(tracker, input))
      .eq("id", tracker.id);
    if (error) throw error;
  } catch (error) {
    console.warn("[paper-doll generation ledger] completion failed:", error);
  }
}
