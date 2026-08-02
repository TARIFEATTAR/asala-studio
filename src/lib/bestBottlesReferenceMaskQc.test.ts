import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyBestBottlesReferenceSlot,
  evaluateBestBottlesAlphaMaskPixels,
  getBestBottlesMaskControlReadiness,
  getBestBottlesProductTruthReferenceIssue,
  isBestBottlesReferenceOverrideActive,
} from "./bestBottlesReferenceMaskQc";

function makePixels(width: number, height: number, alpha: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;
    pixels[i + 3] = alpha;
  }
  return pixels;
}

function paintAlpha(
  pixels: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  alpha: number,
) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      pixels[(y * width + x) * 4 + 3] = alpha;
    }
  }
}

describe("evaluateBestBottlesAlphaMaskPixels", () => {
  it("rejects a fully opaque flattened reference as a mask/control PNG", () => {
    const pixels = makePixels(100, 100, 255);

    const result = evaluateBestBottlesAlphaMaskPixels({ data: pixels, width: 100, height: 100 });

    assert.equal(result.passed, false);
    assert.match(result.reasons.join(" "), /transparency/i);
    assert.equal(result.foregroundPixelRatio, 1);
    assert.equal(result.transparentPixelRatio, 0);
  });

  it("accepts a transparent PNG with a meaningful foreground object", () => {
    const pixels = makePixels(100, 100, 0);
    paintAlpha(pixels, 100, 36, 12, 64, 94, 255);

    const result = evaluateBestBottlesAlphaMaskPixels({ data: pixels, width: 100, height: 100 });

    assert.equal(result.passed, true);
    assert.deepEqual(result.reasons, []);
    assert.ok(result.foregroundPixelRatio > 0.2);
    assert.ok(result.transparentPixelRatio > 0.7);
  });

  it("rejects a mask whose foreground is too sparse to control product bounds", () => {
    const pixels = makePixels(100, 100, 0);
    paintAlpha(pixels, 100, 50, 50, 52, 52, 255);

    const result = evaluateBestBottlesAlphaMaskPixels({ data: pixels, width: 100, height: 100 });

    assert.equal(result.passed, false);
    assert.match(result.reasons.join(" "), /foreground/i);
  });

  it("rejects extra disconnected foreground fragments while allowing two-object cap-off masks", () => {
    const pixels = makePixels(100, 100, 0);
    paintAlpha(pixels, 100, 45, 8, 58, 92, 255);
    paintAlpha(pixels, 100, 64, 60, 80, 92, 255);
    paintAlpha(pixels, 100, 12, 12, 22, 24, 255);

    const result = evaluateBestBottlesAlphaMaskPixels({ data: pixels, width: 100, height: 100 });

    assert.equal(result.passed, false);
    assert.equal(result.significantForegroundComponents, 3);
    assert.match(result.reasons.join(" "), /extra disconnected/i);
  });
});

describe("classifyBestBottlesReferenceSlot", () => {
  it("routes Alpha-QC-passing Cylinder references to the mask/control slot", () => {
    const slot = classifyBestBottlesReferenceSlot({
      isCylinderTwoSourcePilot: true,
      alphaMaskQc: {
        passed: true,
        reasons: [],
        foregroundPixelRatio: 0.24,
        transparentPixelRatio: 0.76,
        partialAlphaPixelRatio: 0.02,
        significantForegroundComponents: 1,
      },
    });

    assert.equal(slot, "mask-control");
  });

  it("keeps opaque Cylinder references in the product truth slot", () => {
    const slot = classifyBestBottlesReferenceSlot({
      isCylinderTwoSourcePilot: true,
      alphaMaskQc: {
        passed: false,
        reasons: ["Mask/control reference needs real transparency."],
        foregroundPixelRatio: 1,
        transparentPixelRatio: 0,
        partialAlphaPixelRatio: 0,
        significantForegroundComponents: 1,
      },
    });

    assert.equal(slot, "product-truth");
  });

  it("does not reroute transparent references outside the Cylinder two-source pilot", () => {
    const slot = classifyBestBottlesReferenceSlot({
      isCylinderTwoSourcePilot: false,
      alphaMaskQc: {
        passed: true,
        reasons: [],
        foregroundPixelRatio: 0.24,
        transparentPixelRatio: 0.76,
        partialAlphaPixelRatio: 0.02,
        significantForegroundComponents: 1,
      },
    });

    assert.equal(slot, "product-truth");
  });
});

describe("getBestBottlesMaskControlReadiness", () => {
  it("does not require a mask outside the Cylinder two-source pilot", () => {
    const readiness = getBestBottlesMaskControlReadiness({
      isCylinderTwoSourcePilot: false,
      maskReferenceUrl: null,
      isCheckingMaskQc: false,
      maskQcResult: null,
    });

    assert.equal(readiness.status, "not-required");
    assert.equal(readiness.issue, null);
  });

  it("does not require Cylinder mask/control after the transparent-mask workflow is retired", () => {
    const readiness = getBestBottlesMaskControlReadiness({
      isCylinderTwoSourcePilot: true,
      maskReferenceUrl: null,
      isCheckingMaskQc: false,
      maskQcResult: null,
    });

    assert.equal(readiness.status, "not-required");
    assert.equal(readiness.issue, null);
  });

  it("passes Cylinder generation when mask Alpha QC passed", () => {
    const readiness = getBestBottlesMaskControlReadiness({
      isCylinderTwoSourcePilot: true,
      maskReferenceUrl: "https://example.test/mask.png",
      isCheckingMaskQc: false,
      maskQcResult: {
        passed: true,
        reasons: [],
        foregroundPixelRatio: 0.22,
        transparentPixelRatio: 0.78,
        partialAlphaPixelRatio: 0.04,
        significantForegroundComponents: 1,
      },
    });

    assert.equal(readiness.status, "passed");
    assert.equal(readiness.issue, null);
  });
});

describe("getBestBottlesProductTruthReferenceIssue", () => {
  it("blocks a transparent mask/control PNG from being used as Cylinder product truth", () => {
    const issue = getBestBottlesProductTruthReferenceIssue({
      isCylinderTwoSourcePilot: true,
      referenceUrl: "https://example.test/transparent-mask.png",
      isCheckingReferenceQc: false,
      referenceAlphaMaskQc: {
        passed: true,
        reasons: [],
        foregroundPixelRatio: 0.21,
        transparentPixelRatio: 0.79,
        partialAlphaPixelRatio: 0.02,
        significantForegroundComponents: 1,
      },
    });

    assert.match(issue ?? "", /transparency|transparent/i);
  });

  it("allows opaque flattened Cylinder references as product truth", () => {
    const issue = getBestBottlesProductTruthReferenceIssue({
      isCylinderTwoSourcePilot: true,
      referenceUrl: "https://example.test/flattened.png",
      isCheckingReferenceQc: false,
      referenceAlphaMaskQc: {
        passed: false,
        reasons: ["Mask/control reference needs real transparency."],
        foregroundPixelRatio: 1,
        transparentPixelRatio: 0,
        partialAlphaPixelRatio: 0,
        significantForegroundComponents: 1,
      },
    });

    assert.equal(issue, null);
  });

  it("blocks a transparent product-truth reference even when the mask itself fails Alpha QC", () => {
    const issue = getBestBottlesProductTruthReferenceIssue({
      isCylinderTwoSourcePilot: true,
      referenceUrl: "https://example.test/ghost-cap-mask.png",
      isCheckingReferenceQc: false,
      referenceAlphaMaskQc: {
        passed: false,
        reasons: ["Mask/control reference contains extra disconnected foreground fragments."],
        foregroundPixelRatio: 0.21,
        transparentPixelRatio: 0.79,
        partialAlphaPixelRatio: 0.01,
        significantForegroundComponents: 3,
      },
    });

    assert.match(issue ?? "", /transparent/i);
  });
});

describe("isBestBottlesReferenceOverrideActive", () => {
  it("keeps manual reference overrides scoped to the selected SKU", () => {
    assert.equal(
      isBestBottlesReferenceOverrideActive({
        selectedKey: "GB-SPR-CLR-3ML-WHT",
        overrideKey: "GB-SPR-CLR-3ML-BLK",
      }),
      false,
    );

    assert.equal(
      isBestBottlesReferenceOverrideActive({
        selectedKey: "GB-SPR-CLR-3ML-WHT",
        overrideKey: "GB-SPR-CLR-3ML-WHT",
      }),
      true,
    );
  });
});
