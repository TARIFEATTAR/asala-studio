import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BEST_BOTTLES_VISUAL_TARGET_CANVAS_HEX,
  BEST_BOTTLES_VISUAL_TARGET_SURFACES,
  BEST_BOTTLES_VISUAL_TARGET_VERSION,
  applyBestBottlesVisualTargetPrompt,
  applyResolvedBestBottlesVisualTargetPrompt,
  getBestBottlesVisualTargetBindingIssue,
  getBestBottlesVisualTargetMaterial,
  getBestBottlesProductReferenceDescription,
  getBestBottlesVisualTargetReference,
  getBestBottlesVisualTargetSurface,
  getBestBottlesVisualTargetTags,
  resolveBestBottlesVisualTargetBinding,
} from "./bestBottlesVisualTarget";
import { KEEP_MATERIAL, PRESERVE, STUDIO_DIRECTION } from "./bestBottlesCatalogCanon";

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

  it("binds amber and cobalt to the isolated v3 glass-only test candidates", () => {
    assert.equal(
      BEST_BOTTLES_VISUAL_TARGET_SURFACES.amber.exportSha256,
      "e3d46bd038749a139b9840d1d7d539a9b854198176fb4c6b3664ebd545d7aca7",
    );
    assert.match(
      BEST_BOTTLES_VISUAL_TARGET_SURFACES.amber.imageUrl,
      /visual-target-candidates\/amber\/v3\/amber-material-plate__/,
    );
    assert.equal(
      BEST_BOTTLES_VISUAL_TARGET_SURFACES.cobalt.exportSha256,
      "81d0b658b9c46c2403dc3cf102d573aa667e1bcd7bd33773d70e6643a9167f80",
    );
    assert.match(
      BEST_BOTTLES_VISUAL_TARGET_SURFACES.cobalt.imageUrl,
      /visual-target-candidates\/cobalt\/v3\/cobalt-material-plate__/,
    );
  });

  it("forbids transferring the material plate slab geometry into the product", () => {
    for (const material of ["amber_glass", "cobalt_glass"]) {
      const prompt = applyBestBottlesVisualTargetPrompt("BASE", material);
      assert.match(prompt, /material plate/i);
      assert.match(prompt, /slab silhouette/i);
      assert.match(prompt, /outline, corners, top edge/i);
      assert.match(prompt, /primary Product Reference is the sole authority/i);
    }
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
      `style-reference-sha256:${BEST_BOTTLES_VISUAL_TARGET_SURFACES.aluminum.exportSha256}`,
      "style-transfer:style",
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

  it("resolves one amber binding for its URL, prompt, tags, surface, and hash", () => {
    const binding = resolveBestBottlesVisualTargetBinding(
      "glass",
      { color: "Amber", graceSku: "GB-CYL-AMB-9ML-SPR-BLK" },
      "assembled",
    );

    assert.equal(binding.reference.surface, "amber");
    assert.equal(binding.reference.imageUrl, BEST_BOTTLES_VISUAL_TARGET_SURFACES.amber.imageUrl);
    assert.equal(binding.reference.exportSha256, BEST_BOTTLES_VISUAL_TARGET_SURFACES.amber.exportSha256);
    assert.match(binding.promptBlock, new RegExp(binding.reference.imageId));
    assert.match(binding.promptBlock, /glass-body hue, transmitted color, density/i);
    assert.match(binding.promptBlock, /do not copy hardware or closure colors/i);
    assert.doesNotMatch(binding.promptBlock, /do not copy[^\n]*(?:product )?colorway/i);
    assert.doesNotMatch(binding.promptBlock, /do not copy or infer[^\n]*label, colors/i);
    assert.ok(binding.tags.includes(`style-surface:${binding.reference.surface}`));
    assert.ok(binding.tags.includes(`style-reference-image:${binding.reference.imageId}`));
    assert.ok(binding.tags.includes(`style-reference-sha256:${binding.reference.exportSha256}`));
    assert.ok(binding.tags.includes("style-transfer:optical-material"));
  });

  it("uses the same resolved cobalt binding when applying the prompt", () => {
    const binding = resolveBestBottlesVisualTargetBinding(
      "glass",
      { color: "Cobalt Blue", graceSku: "GB-CYL-BLU-9ML-SPR-BLK" },
      "assembled",
    );
    const prompt = applyResolvedBestBottlesVisualTargetPrompt("BASE", binding);

    assert.equal(binding.reference.surface, "cobalt");
    assert.match(prompt, new RegExp(binding.reference.imageId));
    assert.match(prompt, /saturated cobalt transmitted color/i);
    assert.doesNotMatch(prompt, /clear-glass wall definition/i);
  });

  it("lets an authorized amber material plate alter glass appearance but never product geometry", () => {
    const binding = resolveBestBottlesVisualTargetBinding(
      "glass",
      { color: "Amber", graceSku: "GB-CYL-AMB-9ML-SPR-BLK" },
      "assembled",
    );
    const prompt = applyResolvedBestBottlesVisualTargetPrompt(
      `${PRESERVE}\n\n${KEEP_MATERIAL}\n\n${STUDIO_DIRECTION}\n\nGEOMETRY REMAINS LOCKED`,
      binding,
    );

    assert.doesNotMatch(prompt, /preserve the glass's exact color/i);
    assert.doesNotMatch(prompt, /preserve the exact hue and chroma shown in the reference/i);
    assert.doesNotMatch(prompt, /do not redesign, recolor, resize/i);
    assert.doesNotMatch(prompt, /geometry, color, material, and component placement/i);
    assert.match(prompt, /MATERIAL AUTHORITY SPLIT/i);
    assert.match(prompt, /Image 2 is the sole authority for the glass-body material appearance/i);
    assert.match(prompt, /must alter the glass material from Image 1 as needed to match Image 2/i);
    assert.match(prompt, /Image 1 remains the sole authority for product geometry/i);
    assert.match(prompt, /must not alter silhouette, dimensions, proportions, wall boundaries, neck, threads, base, hardware, closure, or component topology/i);
    assert.match(prompt, /exact original glass-body spatial envelope and silhouette from Image 1 are immutable/i);
    assert.match(prompt, /apply Image 2 optics only inside those exact Image 1 glass boundaries/i);
    assert.match(prompt, /bottle remains empty/i);
    assert.match(prompt, /GEOMETRY REMAINS LOCKED/);
  });

  it("describes Image 1 as geometry truth without locking its old amber optics", () => {
    const binding = resolveBestBottlesVisualTargetBinding(
      "glass",
      { color: "Amber", graceSku: "GB-CYL-AMB-9ML-SPR-BLK" },
      "assembled",
    );
    const description = getBestBottlesProductReferenceDescription(
      "amber glass",
      binding,
    );

    assert.match(description, /exact glass-body spatial mask, outer contour, wall boundaries, and proportions/i);
    assert.match(description, /Image 2 controls glass hue, transmission, refraction, and specular behavior/i);
    assert.doesNotMatch(description, /preserve[^\n]*body color/i);
    assert.doesNotMatch(description, /do not[^\n]*recolor[^\n]*product components/i);
  });

  it("fails closed when the attached URL, prompt, or tags disagree with the resolved target", () => {
    const binding = resolveBestBottlesVisualTargetBinding(
      "glass",
      { color: "Amber", graceSku: "GB-CYL-AMB-9ML-SPR-BLK" },
      "assembled",
    );
    const validPrompt = applyResolvedBestBottlesVisualTargetPrompt("BASE", binding);

    assert.equal(getBestBottlesVisualTargetBindingIssue({
      binding,
      attachedStyleReferenceUrl: binding.reference.imageUrl,
      prompt: validPrompt,
      tags: binding.tags,
    }), null);
    assert.match(getBestBottlesVisualTargetBindingIssue({
      binding,
      attachedStyleReferenceUrl: BEST_BOTTLES_VISUAL_TARGET_SURFACES.clear.imageUrl,
      prompt: validPrompt,
      tags: binding.tags,
    }) ?? "", /URL.*resolved material target/i);
    assert.match(getBestBottlesVisualTargetBindingIssue({
      binding,
      attachedStyleReferenceUrl: binding.reference.imageUrl,
      prompt: validPrompt.replace(binding.reference.imageId, BEST_BOTTLES_VISUAL_TARGET_SURFACES.clear.imageId),
      tags: binding.tags,
    }) ?? "", /prompt.*resolved material target/i);
    assert.match(getBestBottlesVisualTargetBindingIssue({
      binding,
      attachedStyleReferenceUrl: binding.reference.imageUrl,
      prompt: validPrompt,
      tags: binding.tags.filter((tag) => !tag.startsWith("style-reference-sha256:")),
    }) ?? "", /tags.*resolved material target/i);
    assert.match(getBestBottlesVisualTargetBindingIssue({
      binding,
      attachedStyleReferenceUrl: binding.reference.imageUrl,
      prompt: `${KEEP_MATERIAL}\n${validPrompt}`,
      tags: binding.tags,
    }) ?? "", /optical material authority conflicts/i);
  });
});
