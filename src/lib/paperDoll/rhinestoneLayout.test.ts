import assert from "node:assert/strict";
import { test } from "node:test";

import { buildRhinestoneLayout } from "./rhinestoneLayout";

const recipe = [
  { id: "stone-top-left", angleDeg: -42, heightRatio: 0.78, scaleRatio: 0.028 },
  { id: "stone-upper-center", angleDeg: 0, heightRatio: 0.64, scaleRatio: 0.028 },
  { id: "stone-top-right", angleDeg: 42, heightRatio: 0.78, scaleRatio: 0.028 },
];

test("rhinestone coordinates remain identical across rerenders", () => {
  assert.deepEqual(buildRhinestoneLayout(recipe), buildRhinestoneLayout(recipe));
});

test("rhinestone layouts reject duplicate IDs and out-of-range coordinates", () => {
  assert.throws(() => buildRhinestoneLayout([...recipe, recipe[0]]), /duplicate/i);
  assert.throws(() => buildRhinestoneLayout([{ ...recipe[0], heightRatio: 1.2 }]), /height ratio/i);
});
