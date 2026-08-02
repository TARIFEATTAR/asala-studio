import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EDGE_REFERENCE_IMAGE_MAX_BYTES,
  getContainedImageDimensions,
  getDataUrlBase64ByteSize,
  shouldPrepareReferenceForEdge,
} from "./generationReferenceImages";

describe("generation reference images", () => {
  it("estimates decoded data URL byte size from base64 payloads", () => {
    assert.equal(getDataUrlBase64ByteSize("data:image/png;base64,AAAA"), 3);
    assert.equal(getDataUrlBase64ByteSize("data:image/png;base64,AA=="), 1);
    assert.equal(getDataUrlBase64ByteSize("https://example.com/image.png"), null);
  });

  it("contains large portrait images inside the generation reference edge limit", () => {
    assert.deepEqual(getContainedImageDimensions(2080, 2288, 2048), {
      width: 1862,
      height: 2048,
    });
  });

  it("does not enlarge references that are already within bounds", () => {
    assert.deepEqual(getContainedImageDimensions(1024, 1536, 2048), {
      width: 1024,
      height: 1536,
    });
  });

  it("flags only oversized known-byte references for edge preparation", () => {
    assert.equal(shouldPrepareReferenceForEdge(EDGE_REFERENCE_IMAGE_MAX_BYTES + 1), true);
    assert.equal(shouldPrepareReferenceForEdge(EDGE_REFERENCE_IMAGE_MAX_BYTES), false);
    assert.equal(shouldPrepareReferenceForEdge(null), false);
  });
});
