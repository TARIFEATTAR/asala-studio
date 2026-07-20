import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMaterialPilotProviderRequest,
  executeMaterialPilotRenderer,
  type MaterialPilotReferencePayload,
} from "./bestBottlesMaterialPilotRenderer.ts";

const references: MaterialPilotReferencePayload[] = [
  {
    role: "sidecar-product-truth",
    data: "product-base64",
    mimeType: "image/png",
    sha256: "a".repeat(64),
  },
  {
    role: "material-calibration",
    data: "material-base64",
    mimeType: "image/png",
    sha256: "b".repeat(64),
  },
];

describe("material pilot provider request construction", () => {
  it("builds an exact opaque GPT Image 2 edit request", () => {
    const request = buildMaterialPilotProviderRequest({
      rendererId: "openai-gpt-image-2",
      prompt: "preserve exact product",
      references,
    });

    assert.deepEqual(request, {
      rendererId: "openai-gpt-image-2",
      provider: "openai",
      model: "gpt-image-2",
      endpoint: "/v1/images/edits",
      prompt: "preserve exact product",
      references,
      parameters: {
        size: "2080x2288",
        quality: "high",
        background: "opaque",
        outputFormat: "png",
        n: 1,
      },
    });
  });

  it("builds a fixed Nano Banana 2 request without a fallback chain", () => {
    const request = buildMaterialPilotProviderRequest({
      rendererId: "google-nano-banana-2",
      prompt: "preserve exact product",
      references,
    });

    assert.equal(request.provider, "google");
    assert.equal(request.model, "models/gemini-3.1-flash-image-preview");
    assert.equal(request.endpoint, ":generateContent");
    assert.deepEqual(request.parameters, {
      aspectRatio: "1:1",
      imageSize: "2K",
      responseModalities: ["IMAGE"],
    });
    assert.deepEqual(request.references.map((reference) => reference.role), [
      "sidecar-product-truth",
      "material-calibration",
    ]);
  });
});

describe("material pilot renderer execution", () => {
  it("does not fall back to another model after a provider failure", async () => {
    const calls: string[] = [];
    await assert.rejects(
      executeMaterialPilotRenderer(
        buildMaterialPilotProviderRequest({
          rendererId: "google-nano-banana-2",
          prompt: "preserve exact product",
          references,
        }),
        {
          openai: async () => {
            calls.push("openai");
            throw new Error("unexpected");
          },
          google: async (request) => {
            calls.push(request.model);
            throw new Error("quota");
          },
        },
      ),
      /quota/,
    );

    assert.deepEqual(calls, ["models/gemini-3.1-flash-image-preview"]);
  });
});
