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
