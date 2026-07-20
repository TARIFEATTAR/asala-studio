import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getBestBottlesCanonicalReferenceIssue } from "./bestBottlesReferenceValidation.ts";

describe("Best Bottles canonical reference validation", () => {
  it("accepts a reviewed native canonical canvas", () => {
    assert.equal(
      getBestBottlesCanonicalReferenceIssue(
        "https://storage.example/reference.png",
        { width: 750, height: 1594 },
        { referenceSource: "flattened-product-truth" },
      ),
      null,
    );
  });

  it("accepts an approved reference already staged on the 2080 × 2288 output canvas", () => {
    assert.equal(
      getBestBottlesCanonicalReferenceIssue(
        "https://storage.example/reference.png",
        { width: 2080, height: 2288 },
        { referenceSource: "flattened-product-truth" },
      ),
      null,
    );
  });

  it("fails closed when a correctly sized storage object has no approved provenance", () => {
    assert.match(
      getBestBottlesCanonicalReferenceIssue(
        "https://storage.example/renamed-website-copy.png",
        { width: 750, height: 1594 },
        { referenceSource: null },
      ) ?? "",
      /approved PSD-derived provenance/,
    );
  });

  it("accepts a locally reviewed canonical before its clean pointer is persisted", () => {
    assert.equal(
      getBestBottlesCanonicalReferenceIssue(
        "https://storage.example/GB-SPR-CLR-3ML-BLK__GBSpry3mlClBlk__pdp-main__v001.png",
        { width: 750, height: 1594 },
        {
          referenceSource: "reviewed-local-canonical",
          referenceName: "GB-SPR-CLR-3ML-BLK__GBSpry3mlClBlk__pdp-main__v001.png",
        },
      ),
      null,
    );
  });

  it("blocks low-resolution website copies even when renamed as PNG", () => {
    assert.match(
      getBestBottlesCanonicalReferenceIssue(
        "https://storage.example/legacy-website-copy.png",
        { width: 360, height: 480 },
        { referenceSource: "flattened-product-truth" },
      ) ?? "",
      /360 × 480.*website thumbnail/,
    );
  });

  it("keeps direct BestBottles imagery in the evidence lane", () => {
    assert.match(
      getBestBottlesCanonicalReferenceIssue(
        "https://www.bestbottles.com/images/store/enlarged_pics/GBTallCylFrst9SpryBlkMatt.gif",
        { width: 360, height: 480 },
        { referenceSource: "bestbottles-live" },
      ) ?? "",
      /commercial evidence/,
    );
  });

  it("fails closed when the canvas cannot be verified", () => {
    assert.match(
      getBestBottlesCanonicalReferenceIssue(
        "https://storage.example/reference.png",
        null,
        { referenceSource: "flattened-product-truth" },
      ) ?? "",
      /could not be verified/,
    );
  });
});
