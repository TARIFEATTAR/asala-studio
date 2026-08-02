import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BEST_BOTTLES_PDP_CANVAS,
  buildPreserveSourceCanvasConstraints,
  normalizeImageCanvasSize,
  resolveGenerationCanvasMetadata,
  toCanvasAspectRatio,
} from "./imageCanvasMetadata";

describe("image canvas metadata", () => {
  it("builds an exact preserve-canvas contract from source dimensions", () => {
    const canvas = normalizeImageCanvasSize({ width: 2080, height: 2288 });

    assert.deepEqual(canvas, { width: 2080, height: 2288 });
    assert.equal(toCanvasAspectRatio(canvas), "10:11");
    assert.deepEqual(buildPreserveSourceCanvasConstraints(canvas), {
      preserveSourceCanvas: true,
      outputCanvas: { width: 2080, height: 2288 },
    });
  });

  it("rejects invalid canvas dimensions before they enter generation payloads", () => {
    assert.equal(normalizeImageCanvasSize({ width: 0, height: 2288 }), null);
    assert.equal(normalizeImageCanvasSize({ width: 2080, height: Number.NaN }), null);
    assert.equal(normalizeImageCanvasSize(null), null);
  });

  it("falls back to the Best Bottles PDP canvas when source dimensions are unavailable", () => {
    const resolved = resolveGenerationCanvasMetadata(
      { aspectRatio: null, imageConstraints: undefined, canvas: null },
      {
        prompt: "REFERENCE-LOCKED BEST BOTTLES LUXURY PRODUCT PHOTOGRAPHY V5.1.",
        libraryTags: ["brand:best-bottles", "role:product-image"],
        aspectRatio: "1:1",
      },
    );

    assert.deepEqual(BEST_BOTTLES_PDP_CANVAS, { width: 2080, height: 2288 });
    assert.equal(resolved.aspectRatio, "10:11");
    assert.deepEqual(resolved.canvas, { width: 2080, height: 2288 });
    assert.deepEqual(resolved.imageConstraints, {
      preserveSourceCanvas: true,
      outputCanvas: { width: 2080, height: 2288 },
    });
    assert.equal(resolved.canvasSource, "best-bottles-pdp-fallback");
  });

  it("keeps an actual readable source canvas ahead of the Best Bottles fallback", () => {
    const resolved = resolveGenerationCanvasMetadata(
      {
        aspectRatio: "16:9",
        imageConstraints: buildPreserveSourceCanvasConstraints({ width: 2048, height: 1152 }),
        canvas: { width: 2048, height: 1152 },
      },
      {
        prompt: "REFERENCE-LOCKED BEST BOTTLES LUXURY PRODUCT PHOTOGRAPHY V5.1.",
        libraryTags: ["brand:best-bottles", "role:product-image"],
      },
    );

    assert.equal(resolved.aspectRatio, "16:9");
    assert.deepEqual(resolved.canvas, { width: 2048, height: 1152 });
    assert.equal(resolved.canvasSource, "source-image");
  });

  it("does not force homepage hero images into the PDP canvas", () => {
    const resolved = resolveGenerationCanvasMetadata(
      { aspectRatio: null, imageConstraints: undefined, canvas: null },
      {
        prompt: "Best Bottles homepage hero image on stone slab.",
        libraryTags: ["brand:best-bottles", "source:darkroom-generated", "intended-use:homepage-hero"],
        aspectRatio: "16:9",
      },
    );

    assert.equal(resolved.aspectRatio, "16:9");
    assert.equal(resolved.imageConstraints, undefined);
    assert.equal(resolved.canvas, null);
    assert.equal(resolved.canvasSource, "context-aspect-ratio");
  });
});
