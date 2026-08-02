import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildGenerationAttemptCompletion,
  buildGenerationAttemptInsert,
  estimateUnverifiedCostUsd,
  LEDGER_ERROR_MAX_CHARS,
  sha256Hex,
} from "./generationAttemptLedger.ts";

test("sha256Hex matches a known vector", async () => {
  // sha256("abc")
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("estimateUnverifiedCostUsd covers only gpt-image on openai", () => {
  assert.equal(estimateUnverifiedCostUsd("openai", "gpt-image-2"), 0.42);
  assert.equal(estimateUnverifiedCostUsd("openai", "gpt-image-1-mini"), 0.42);
  assert.equal(estimateUnverifiedCostUsd("openai", "dall-e-3"), null);
  assert.equal(estimateUnverifiedCostUsd("gemini", "gemini"), null);
  assert.equal(estimateUnverifiedCostUsd("freepik", "seedream-4"), null);
});

test("buildGenerationAttemptInsert fingerprints prompt and references", async () => {
  const row = await buildGenerationAttemptInsert({
    organizationId: "org-1",
    userId: "user-1",
    lane: "best-bottles-reference-locked",
    provider: "openai",
    model: "gpt-image-2",
    endpoint: "edits",
    requestSize: "2080x2288",
    requestResolution: "high",
    prompt: "abc",
    referenceFingerprintSources: ["ref-bytes-base64"],
    referenceUrls: ["https://example.com/ref.png"],
    graceSku: " GB-CYL-CLR-9ML-ROL-SGLD ",
    websiteSku: "GBCylClr9RollShnGl",
    seed: 12345,
    attemptNumber: 2.7,
  });

  assert.equal(row.status, "pending");
  assert.equal(row.provider, "openai");
  assert.equal(row.lane, "best-bottles-reference-locked");
  assert.equal(row.endpoint, "edits");
  assert.equal(row.request_size, "2080x2288");
  assert.equal(
    row.prompt_sha256,
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(row.prompt_chars, 3);
  assert.equal(row.reference_count, 1);
  assert.equal((row.reference_sha256s as string[]).length, 1);
  assert.match((row.reference_sha256s as string[])[0], /^[0-9a-f]{64}$/);
  assert.deepEqual(row.reference_urls, ["https://example.com/ref.png"]);
  // Whitespace trimmed; attempt number floored to an integer >= 1.
  assert.equal(row.grace_sku, "GB-CYL-CLR-9ML-ROL-SGLD");
  assert.equal(row.attempt_number, 2);
  assert.equal(row.seed, 12345);
  // The verified July-2026 average rides along for openai gpt-image.
  assert.equal(row.estimated_cost_usd, 0.42);
});

test("buildGenerationAttemptInsert normalizes empty optionals to null", async () => {
  const row = await buildGenerationAttemptInsert({
    lane: "darkroom",
    provider: "gemini",
    prompt: "hello",
  });

  assert.equal(row.model, null);
  assert.equal(row.endpoint, null);
  assert.equal(row.reference_count, 0);
  assert.equal(row.reference_sha256s, null);
  assert.equal(row.reference_urls, null);
  assert.equal(row.grace_sku, null);
  assert.equal(row.attempt_number, null);
  assert.equal(row.estimated_cost_usd, null);
});

test("buildGenerationAttemptCompletion records latency and truncates errors", () => {
  const tracker = { id: "row-1", startedAtMs: 1_000 };
  const patch = buildGenerationAttemptCompletion(
    tracker,
    { status: "failed", errorMessage: "x".repeat(LEDGER_ERROR_MAX_CHARS + 500) },
    4_500,
  );

  assert.equal(patch.status, "failed");
  assert.equal(patch.latency_ms, 3_500);
  assert.equal((patch.error_message as string).length, LEDGER_ERROR_MAX_CHARS);
  assert.equal(typeof patch.completed_at, "string");
});

test("buildGenerationAttemptCompletion links output and records fallback provider", () => {
  const tracker = { id: "row-2", startedAtMs: 10 };
  const patch = buildGenerationAttemptCompletion(
    tracker,
    {
      status: "succeeded",
      generatedImageId: "img-1",
      outputUrl: "https://example.com/out.png",
      revisedPrompt: "provider rewrote this",
      finalProvider: "gemini",
    },
    20,
  );

  assert.equal(patch.status, "succeeded");
  assert.equal(patch.generated_image_id, "img-1");
  assert.equal(patch.output_url, "https://example.com/out.png");
  assert.equal(patch.revised_prompt, "provider rewrote this");
  assert.equal(patch.provider, "gemini");
  // Absent optionals never appear in the patch (no accidental null overwrite).
  assert.equal("error_message" in patch, false);
  assert.equal("model" in patch, false);
});

test("clock skew can never produce negative latency", () => {
  const patch = buildGenerationAttemptCompletion(
    { id: "row-3", startedAtMs: 5_000 },
    { status: "succeeded" },
    4_000,
  );
  assert.equal(patch.latency_ms, 0);
});
