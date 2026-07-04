import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BEST_BOTTLES_STONE_HERO_PRESETS,
  buildBestBottlesStoneHeroPrompt,
} from "./darkroomHeroPrompts";

describe("Best Bottles Darkroom stone hero prompts", () => {
  it("defines exactly eight client-specific stone styles", () => {
    assert.equal(BEST_BOTTLES_STONE_HERO_PRESETS.length, 8);

    const ids = new Set(BEST_BOTTLES_STONE_HERO_PRESETS.map((preset) => preset.id));
    assert.equal(ids.size, 8);

    const combinedStoneLanguage = BEST_BOTTLES_STONE_HERO_PRESETS
      .map((preset) => preset.materialPrompt)
      .join(" ");

    assert.match(combinedStoneLanguage, /travertine/i);
    assert.match(combinedStoneLanguage, /limestone/i);
    assert.match(combinedStoneLanguage, /marble/i);
    assert.match(combinedStoneLanguage, /basalt/i);
    assert.match(combinedStoneLanguage, /onyx/i);
  });

  it("builds a one-stone homepage hero prompt that keeps product identity locked", () => {
    const prompt = buildBestBottlesStoneHeroPrompt({
      stoneId: "warm-travertine",
      arrangement: "single-stone",
    });

    assert.match(prompt, /Best Bottles homepage hero/i);
    assert.match(prompt, /one sculptural stone plinth/i);
    assert.match(prompt, /warm honed travertine/i);
    assert.match(prompt, /preserve the exact product identity/i);
    assert.match(prompt, /Best Bottles Bone #F5F3EF/i);
    assert.doesNotMatch(prompt, /#EEE6D4/i);
    assert.match(prompt, /Amouage-like/i);
    assert.match(prompt, /do not copy Amouage/i);
    assert.match(prompt, /do not paste the source image/i);
    assert.match(prompt, /no side padding/i);
    assert.match(prompt, /no vertical bands/i);
    assert.match(prompt, /poster-print/i);
    assert.match(prompt, /no text, no labels, no logos/i);
  });

  it("builds a cluster arrangement prompt with useful homepage negative space", () => {
    const prompt = buildBestBottlesStoneHeroPrompt({
      stoneId: "basalt-slate",
      arrangement: "stone-cluster",
    });

    assert.match(prompt, /three to five stone forms/i);
    assert.match(prompt, /deep basalt/i);
    assert.match(prompt, /negative space/i);
    assert.match(prompt, /upper-front-left/i);
    assert.match(prompt, /backlight through glass/i);
    assert.match(prompt, /no hands, no flowers, no extra bottles/i);
  });
});
