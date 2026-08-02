import assert from "node:assert/strict";
import test from "node:test";

import { buildRollonLineup, type RollonLineupAsset } from "./rollonLineupModel";

function asset(slot: "body" | "roller" | "overcap", variantKey: string): RollonLineupAsset {
  return {
    componentVersionId: `${slot}-${variantKey}`,
    displayName: `${slot} ${variantKey}`,
    slot,
    variantKey,
    imageUrl: `signed://${slot}-${variantKey}`,
  };
}

test("lineup renders five explicit body canvases in the locked catalog order", () => {
  const assets = ["CLR", "AMB", "BLU", "FRS", "SWL"].map((variant) => asset("body", variant));
  const lineup = buildRollonLineup(assets, { rollerVariantKey: "PLASTIC", overcapVariantKey: "SHN-SL" });

  assert.deepEqual(lineup.map((item) => item.bodyVariantKey), ["CLR", "AMB", "BLU", "FRS", "SWL"]);
  assert.ok(lineup.every((item) => item.canvas.widthPx === 2080 && item.canvas.heightPx === 2288));
});

test("lineup never substitutes a fallback when a selected component is missing", () => {
  const assets = [
    ...["CLR", "AMB", "BLU", "FRS", "SWL"].map((variant) => asset("body", variant)),
    asset("overcap", "SHN-GL"),
  ];
  const lineup = buildRollonLineup(assets, { rollerVariantKey: "PLASTIC", overcapVariantKey: "SHN-SL" });

  assert.ok(lineup.every((item) => item.layers.overcap === null));
  assert.ok(lineup.every((item) => item.layers.roller === null));
  assert.ok(lineup.every((item) => item.status === "blocked"));
});

test("lineup previews the selected roller candidate across all five bodies", () => {
  const assets = [
    ...["CLR", "AMB", "BLU", "FRS", "SWL"].map((variant) => asset("body", variant)),
    asset("roller", "PLASTIC"),
    asset("roller", "METAL"),
    asset("overcap", "SHN-SL"),
  ];
  const candidateImageUrl = "signed://candidate-metal-roller";

  const lineup = buildRollonLineup(assets, {
    rollerVariantKey: "METAL",
    overcapVariantKey: "SHN-SL",
    rollerImageUrlOverride: candidateImageUrl,
  });

  assert.equal(lineup.length, 5);
  assert.ok(lineup.every((item) => item.layers.roller?.variantKey === "METAL"));
  assert.ok(lineup.every((item) => item.layers.roller?.imageUrl === candidateImageUrl));
});

test("a staged metal candidate uses the registered roller geometry carrier before release cutover", () => {
  const assets = [
    ...["CLR", "AMB", "BLU", "FRS", "SWL"].map((variant) => asset("body", variant)),
    asset("roller", "PLASTIC"),
    asset("overcap", "SHN-SL"),
  ];
  const candidateImageUrl = "signed://candidate-metal-roller";

  const lineup = buildRollonLineup(assets, {
    rollerVariantKey: "METAL",
    overcapVariantKey: "SHN-SL",
    rollerImageUrlOverride: candidateImageUrl,
  });

  assert.ok(lineup.every((item) => item.layers.roller?.variantKey === "METAL"));
  assert.ok(lineup.every((item) => item.layers.roller?.imageUrl === candidateImageUrl));
});
