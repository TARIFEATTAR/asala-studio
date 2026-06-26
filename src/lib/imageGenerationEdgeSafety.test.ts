import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getSupabaseFunctionErrorMessage,
  resolveEdgeSafeImageSettings,
} from "./imageGenerationEdgeSafety";

describe("resolveEdgeSafeImageSettings", () => {
  it("routes OpenAI reference edits through JPEG instead of PNG", () => {
    const settings = resolveEdgeSafeImageSettings({
      aiProvider: "openai-image-2",
      resolution: "high",
      outputFormat: "png",
      hasReferenceImages: true,
      surface: "darkroom",
    });

    assert.equal(settings.outputFormat, "jpeg");
    assert.equal(settings.resolution, "high");
    assert.equal(settings.adjusted, true);
    assert.deepEqual(settings.reasons, ["openai-reference-edit-jpeg"]);
  });

  it("keeps non-reference OpenAI generations on the requested PNG path", () => {
    const settings = resolveEdgeSafeImageSettings({
      aiProvider: "openai-image-2",
      resolution: "high",
      outputFormat: "png",
      hasReferenceImages: false,
      surface: "darkroom",
    });

    assert.equal(settings.outputFormat, "png");
    assert.equal(settings.resolution, "high");
    assert.equal(settings.adjusted, false);
  });

  it("caps Light Table reference edits to the standard worker path", () => {
    const settings = resolveEdgeSafeImageSettings({
      aiProvider: "gpt-image-2",
      resolution: "high",
      outputFormat: "png",
      hasReferenceImages: true,
      surface: "light-table",
    });

    assert.equal(settings.outputFormat, "jpeg");
    assert.equal(settings.resolution, "standard");
    assert.equal(settings.adjusted, true);
    assert.deepEqual(settings.reasons, [
      "openai-reference-edit-jpeg",
      "light-table-reference-edit-standard",
    ]);
  });
});

describe("getSupabaseFunctionErrorMessage", () => {
  it("turns opaque Edge Function failures into a useful operator message", async () => {
    const message = await getSupabaseFunctionErrorMessage({
      message: "Edge Function returned a non-2xx status code",
      context: { status: 546 },
    });

    assert.match(message, /Edge Function limit/i);
    assert.match(message, /Standard resolution/i);
  });

  it("uses structured Supabase error bodies when the function returns one", async () => {
    const message = await getSupabaseFunctionErrorMessage({
      message: "Edge Function returned a non-2xx status code",
      context: {
        status: 400,
        json: async () => ({ error: "Missing product context" }),
      },
    });

    assert.equal(message, "Missing product context");
  });
});
