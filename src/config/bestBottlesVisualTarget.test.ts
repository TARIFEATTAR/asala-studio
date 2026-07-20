import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BEST_BOTTLES_VISUAL_TARGET_CANVAS_HEX,
  BEST_BOTTLES_VISUAL_TARGET_SURFACES,
  BEST_BOTTLES_VISUAL_TARGET_VERSION,
  applyBestBottlesVisualTargetPrompt,
  getBestBottlesVisualTargetMaterial,
  getBestBottlesVisualTargetReference,
  getBestBottlesVisualTargetSurface,
  getBestBottlesVisualTargetTags,
} from "./bestBottlesVisualTarget";

describe("bestBottlesVisualTarget", () => {
  it("selects the approved reference by body material", () => {
    assert.equal(getBestBottlesVisualTargetMaterial("opaque brushed/satin aluminum metal"), "aluminum");
    assert.equal(getBestBottlesVisualTargetMaterial("clear glass"), "glass");
    assert.equal(
      getBestBottlesVisualTargetReference("aluminium").imageId,
      BEST_BOTTLES_VISUAL_TARGET_SURFACES.aluminum.imageId,
    );
    assert.equal(
      getBestBottlesVisualTargetReference("clear_glass").imageId,
      BEST_BOTTLES_VISUAL_TARGET_SURFACES.clear.imageId,
    );
    assert.match(getBestBottlesVisualTargetReference("clear_glass").imageUrl, /^https:\/\/.+\.png$/);
  });

  it("maps every inferred glass surface to its own exemplar", () => {
    assert.equal(getBestBottlesVisualTargetSurface("amber_glass"), "amber");
    assert.equal(getBestBottlesVisualTargetSurface("cobalt_glass"), "cobalt");
    assert.equal(getBestBottlesVisualTargetSurface("green_glass"), "green");
    assert.equal(getBestBottlesVisualTargetSurface("swirl_glass"), "swirl");
    assert.equal(getBestBottlesVisualTargetSurface("frosted_glass"), "frosted");
    assert.equal(getBestBottlesVisualTargetSurface("clear_glass"), "clear");
    assert.equal(getBestBottlesVisualTargetSurface("brushed_aluminum"), "aluminum");
    for (const surface of ["amber", "cobalt", "green", "swirl", "frosted"] as const) {
      const ref = getBestBottlesVisualTargetReference(`${surface}_glass`);
      assert.equal(ref.surface, surface);
      assert.equal(ref.fallbackApplied, false);
    }
  });

  it("falls back to the clear exemplar for unmapped surfaces and records it", () => {
    for (const unmapped of ["white_plastic", "organza_fabric", "clear_molded_plastic", null]) {
      const ref = getBestBottlesVisualTargetReference(unmapped);
      assert.equal(ref.surface, "clear");
      assert.equal(ref.fallbackApplied, true);
    }
    assert.ok(
      getBestBottlesVisualTargetTags("white_plastic").includes("style-surface-fallback:clear"),
    );
    assert.ok(
      !getBestBottlesVisualTargetTags("amber_glass").includes("style-surface-fallback:clear"),
    );
  });

  it("appends the calibration block exactly once and preserves product authority", () => {
    const once = applyBestBottlesVisualTargetPrompt("BASE PROMPT", "clear_glass");
    const twice = applyBestBottlesVisualTargetPrompt(once, "clear_glass");
    assert.equal(twice, once);
    assert.match(once, new RegExp(`VISUAL CALIBRATION TARGET — ${BEST_BOTTLES_VISUAL_TARGET_VERSION}`));
    assert.match(
      once,
      new RegExp(`Secondary reference image ${BEST_BOTTLES_VISUAL_TARGET_SURFACES.clear.imageId} is STYLE-ONLY`),
    );
    assert.match(once, /primary Product Reference is the sole authority/);
    assert.match(once, /clear-glass wall definition/);
    assert.match(once, new RegExp(BEST_BOTTLES_VISUAL_TARGET_CANVAS_HEX));
    assert.match(once, /COMPOSITION SAFETY/);
    assert.match(once, /no detached cap, overcap, bottle, cylinder, accessory, duplicate/);
  });

  it("gives colored surfaces surface-specific style direction", () => {
    assert.match(applyBestBottlesVisualTargetPrompt("BASE", "amber_glass"), /warm amber transmitted depth/);
    assert.match(applyBestBottlesVisualTargetPrompt("BASE", "cobalt_glass"), /saturated cobalt transmitted color/);
    assert.match(applyBestBottlesVisualTargetPrompt("BASE", "green_glass"), /deep green transmitted color/);
    assert.match(applyBestBottlesVisualTargetPrompt("BASE", "swirl_glass"), /helical swirl relief/);
    assert.match(applyBestBottlesVisualTargetPrompt("BASE", "frosted_glass"), /satin frosted diffusion/);
  });

  it("patches composition safety into a legacy prompt without duplicating its calibration block", () => {
    const legacy = `BASE\nVISUAL CALIBRATION TARGET — ${BEST_BOTTLES_VISUAL_TARGET_VERSION}.`;
    const patched = applyBestBottlesVisualTargetPrompt(legacy, "clear_glass");
    assert.equal((patched.match(/VISUAL CALIBRATION TARGET/g) ?? []).length, 1);
    assert.match(patched, /COMPOSITION SAFETY/);
    assert.equal(applyBestBottlesVisualTargetPrompt(patched, "clear_glass"), patched);
  });

  it("preserves an authorized cap-right-sidecar instead of applying the assembled-only guard", () => {
    const prompt = applyBestBottlesVisualTargetPrompt(
      "BASE PROMPT",
      "clear_glass",
      "fitment-attached-cap-right-sidecar",
    );

    assert.match(prompt, /SIDECAR COMPOSITION SAFETY/);
    assert.match(prompt, /exactly one matching cap or overcap detached on camera-right/i);
    assert.match(prompt, /same shared baseline/i);
    assert.doesNotMatch(prompt, /no detached cap, overcap/i);
  });

  it("emits lineage tags for the selected target", () => {
    assert.deepEqual(getBestBottlesVisualTargetTags("aluminum"), [
      `visual-target:${BEST_BOTTLES_VISUAL_TARGET_VERSION}`,
      `style-reference-image:${BEST_BOTTLES_VISUAL_TARGET_SURFACES.aluminum.imageId}`,
      "material-profile:aluminum",
      "style-surface:aluminum",
    ]);
  });

  it("permits only opaque approved hash-locked style references", () => {
    for (const entry of Object.values(BEST_BOTTLES_VISUAL_TARGET_SURFACES)) {
      assert.equal(entry.role, "style-only");
      assert.match(entry.imageUrl, /^https:\/\/.+\.png$/);
      assert.doesNotMatch(entry.imageUrl, /paper-doll|background[-_ ]removed|transparent/i);
      assert.match(entry.exportSha256, /^[a-f0-9]{64}$/);
      assert.ok(entry.imageUrl.includes(entry.exportSha256));
    }
  });
});
