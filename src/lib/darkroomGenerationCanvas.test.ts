import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDarkroomGenerationCanvas } from "./darkroomGenerationCanvas";
import type { PreserveSourceCanvasConstraints } from "./imageCanvasMetadata";

const sourceCanvas: PreserveSourceCanvasConstraints = {
  preserveSourceCanvas: true,
  outputCanvas: { width: 2080, height: 2288 },
};

describe("resolveDarkroomGenerationCanvas", () => {
  it("preserves the source canvas for standard reference edits", () => {
    const result = resolveDarkroomGenerationCanvas({
      mode: "preserve-source",
      sourceAspectRatio: "10:11",
      sourceImageConstraints: sourceCanvas,
      selectedAspectRatio: "16:9",
      fallbackAspectRatio: "1:1",
    });

    assert.equal(result.aspectRatio, "10:11");
    assert.equal(result.imageConstraints, sourceCanvas);
    assert.equal(result.modeApplied, "preserve-source");
  });

  it("uses the selected aspect ratio for hero-scene generations", () => {
    const result = resolveDarkroomGenerationCanvas({
      mode: "selected-aspect",
      sourceAspectRatio: "10:11",
      sourceImageConstraints: sourceCanvas,
      selectedAspectRatio: "16:9",
      fallbackAspectRatio: "1:1",
    });

    assert.equal(result.aspectRatio, "16:9");
    assert.equal(result.imageConstraints, undefined);
    assert.equal(result.modeApplied, "selected-aspect");
  });

  it("keeps background plate generations on the selected aspect ratio", () => {
    const result = resolveDarkroomGenerationCanvas({
      mode: "preserve-source",
      sourceAspectRatio: "10:11",
      sourceImageConstraints: sourceCanvas,
      selectedAspectRatio: "21:9",
      fallbackAspectRatio: "1:1",
      backgroundPlateMode: true,
    });

    assert.equal(result.aspectRatio, "21:9");
    assert.equal(result.imageConstraints, undefined);
    assert.equal(result.modeApplied, "selected-aspect");
  });
});
