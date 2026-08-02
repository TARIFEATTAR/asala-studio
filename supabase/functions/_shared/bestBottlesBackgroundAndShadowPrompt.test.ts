import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BEST_BOTTLES_REFERENCE_LOCKED_BONE_CANVAS_RGBA,
  BEST_BOTTLES_REFERENCE_LOCKED_BONE_HEX,
  buildBestBottlesBackgroundAndShadowPrompt,
} from "./bestBottlesBackgroundAndShadowPrompt";

describe("buildBestBottlesBackgroundAndShadowPrompt", () => {
  it("uses the provided reference-locked prompt background and contact shadow language", () => {
    const lines = buildBestBottlesBackgroundAndShadowPrompt({
      shadowContact: "bottle base and sprayer/pump contact points visible in the reference",
    });
    const prompt = lines.join("\n");

    assert.match(prompt, /Best Bottles Bone #F5F3EF/);
    assert.match(prompt, /visible soft contact shadow and ambient occlusion under bottle base and sprayer\/pump contact points visible in the reference/);
    assert.match(prompt, /18-28% opacity at contact points/);
    assert.doesNotMatch(prompt, /#EEE6D4/);
    assert.doesNotMatch(prompt, /back-right/i);
    assert.doesNotMatch(prompt, /25-35%/);
    assert.doesNotMatch(prompt, /Bone surface/i);
  });

  it("exports the same Bone color for postprocess canvas fallback", () => {
    assert.equal(BEST_BOTTLES_REFERENCE_LOCKED_BONE_HEX, "#F5F3EF");
    assert.equal(BEST_BOTTLES_REFERENCE_LOCKED_BONE_CANVAS_RGBA, 0xF5F3EFFF);
  });
});
