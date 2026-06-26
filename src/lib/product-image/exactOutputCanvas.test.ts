import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getExactOutputCanvasConstraints,
  resolveExactCanvasForAspectRatio,
} from "./exactOutputCanvas";

describe("exact output canvas constraints", () => {
  it("allows Cylinder's native 1024 x 1536 canvas", () => {
    assert.deepEqual(
      getExactOutputCanvasConstraints({ widthPx: 1024, heightPx: 1536 }),
      { outputCanvas: { width: 1024, height: 1536 } },
    );
  });

  it("resolves 2:3 aspect requests to the Cylinder native canvas", () => {
    assert.deepEqual(resolveExactCanvasForAspectRatio("2:3"), {
      widthPx: 1024,
      heightPx: 1536,
    });
  });

  it("keeps the existing 10:11 catalog canvas contract", () => {
    assert.deepEqual(resolveExactCanvasForAspectRatio("10:11"), {
      widthPx: 2080,
      heightPx: 2288,
    });
  });
});
