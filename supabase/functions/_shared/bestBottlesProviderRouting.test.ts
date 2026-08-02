import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveBestBottlesProductionResolution,
  shouldForceBestBottlesOpenAIProvider,
} from "./bestBottlesProviderRouting";

describe("Best Bottles provider routing", () => {
  it("forces OpenAI for reference-locked masters by default", () => {
    assert.equal(
      shouldForceBestBottlesOpenAIProvider({
        isBestBottlesReferenceLocked: true,
        allowBestBottlesProviderOverride: false,
      }),
      true,
    );
  });

  it("allows explicit comparison runs to use the requested non-OpenAI provider", () => {
    assert.equal(
      shouldForceBestBottlesOpenAIProvider({
        isBestBottlesReferenceLocked: true,
        allowBestBottlesProviderOverride: true,
      }),
      false,
    );
  });

  it("does not force OpenAI for non-Best-Bottles requests", () => {
    assert.equal(
      shouldForceBestBottlesOpenAIProvider({
        isBestBottlesReferenceLocked: false,
        allowBestBottlesProviderOverride: false,
      }),
      false,
    );
  });

  it("forces high OpenAI quality for Best Bottles reference-locked production requests", () => {
    assert.equal(
      resolveBestBottlesProductionResolution({
        isBestBottlesReferenceLocked: true,
        resolution: "standard",
      }),
      "high",
    );
    assert.equal(
      resolveBestBottlesProductionResolution({
        isBestBottlesReferenceLocked: true,
        resolution: undefined,
      }),
      "high",
    );
  });

  it("preserves requested resolution for non-Best-Bottles requests", () => {
    assert.equal(
      resolveBestBottlesProductionResolution({
        isBestBottlesReferenceLocked: false,
        resolution: "standard",
      }),
      "standard",
    );
  });
});
