import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DUPLICATE_CAP_REFINEMENT,
  IMAGE_REFINEMENT_QUICK_EDITS,
  getInlineRefinementRequestPrompt,
  mergeRefinementLibraryTags,
} from "./imageRefinementQuickEdits";

describe("image refinement quick edits", () => {
  it("provides a short duplicate-cap repair instruction for Image Editor refine", () => {
    assert.ok(DUPLICATE_CAP_REFINEMENT.length < 900);
    assert.match(DUPLICATE_CAP_REFINEMENT, /exactly one detached/i);
    assert.match(DUPLICATE_CAP_REFINEMENT, /exposed sprayer/i);
    assert.match(DUPLICATE_CAP_REFINEMENT, /do not render a second/i);
    assert.doesNotMatch(DUPLICATE_CAP_REFINEMENT, /REFERENCE-LOCKED BEST BOTTLES/i);
  });

  it("registers duplicate cap as a runnable quick edit", () => {
    assert.deepEqual(
      IMAGE_REFINEMENT_QUICK_EDITS.map((quickEdit) => quickEdit.id),
      ["duplicate-cap"],
    );
    assert.equal(IMAGE_REFINEMENT_QUICK_EDITS[0].instruction, DUPLICATE_CAP_REFINEMENT);
  });

  it("preserves product image role when carrying refinement tags forward", () => {
    assert.deepEqual(
      mergeRefinementLibraryTags(["brand:best-bottles", "role:product-image", "family:Cylinder"]),
      ["role:product-image", "brand:best-bottles", "family:Cylinder"],
    );
  });

  it("uses the original prompt as the inline refinement request stabilizer", () => {
    assert.equal(
      getInlineRefinementRequestPrompt(
        "REFERENCE-LOCKED BEST BOTTLES PDP prompt",
        "Remove the duplicate cap",
      ),
      "REFERENCE-LOCKED BEST BOTTLES PDP prompt",
    );
    assert.equal(
      getInlineRefinementRequestPrompt("", "Remove the duplicate cap"),
      "Remove the duplicate cap",
    );
  });
});
