import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildInlineRefinementStabilizerBlock } from "./inlineRefinementPrompt";

describe("inline refinement prompt stabilizer", () => {
  it("keeps the original prompt active as a bounded stabilizer block", () => {
    const block = buildInlineRefinementStabilizerBlock(
      "REFERENCE-LOCKED BEST BOTTLES LUXURY PRODUCT PHOTOGRAPHY V5.1.\nCanvas: exact 2080 x 2288.\nBackground: Bone #F5F3EF.",
    );

    assert.ok(block);
    assert.match(block, /INLINE EDIT STABILIZER/i);
    assert.match(block, /original prompt remains active/i);
    assert.match(block, /REFERENCE-LOCKED BEST BOTTLES/i);
    assert.match(block, /2080 x 2288/);
    assert.match(block, /Bone #F5F3EF/);
  });

  it("does not emit a stabilizer block when the original prompt is missing", () => {
    assert.equal(buildInlineRefinementStabilizerBlock(""), null);
    assert.equal(buildInlineRefinementStabilizerBlock(null), null);
  });
});
