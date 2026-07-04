import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BEST_BOTTLES_GRID_BONE_BACKGROUND_HEX,
  IMAGE_PRESET_LIST,
  buildPresetBlock,
} from "./imagePresets";

describe("Best Bottles image preset backgrounds", () => {
  it("uses Best Bottles Bone as the registered default background, not retired parchment", () => {
    assert.equal(BEST_BOTTLES_GRID_BONE_BACKGROUND_HEX, "#F5F3EF");

    for (const preset of IMAGE_PRESET_LIST) {
      if (preset.backgroundHex !== "transparent" && preset.backgroundHex !== "#FFFFFF") {
        assert.equal(
          preset.backgroundHex,
          BEST_BOTTLES_GRID_BONE_BACKGROUND_HEX,
          `${preset.id} should use Best Bottles Bone`,
        );
      }

      assert.doesNotMatch(
        [
          preset.purpose,
          preset.backgroundDescription,
          preset.lightingLanguage,
          preset.shadowLanguage,
          preset.compositionLanguage,
          preset.qualityLanguage,
          preset.negativeLanguage,
          buildPresetBlock(preset),
        ].join("\n"),
        /#EEE6D4|parchment-cream/i,
        `${preset.id} should not emit retired parchment language`,
      );
    }
  });
});
