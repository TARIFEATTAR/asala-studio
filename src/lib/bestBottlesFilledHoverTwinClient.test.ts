import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFilledHoverTwinInvocation,
  getFilledHoverTwinParentEligibility,
} from "./bestBottlesFilledHoverTwinClient";

const eligibleImage = {
  id: "11111111-1111-4111-8111-111111111111",
  imageUrl: "https://example.com/empty-scene.png",
  libraryTags: [
    "brand:best-bottles",
    "studio-master",
    "scene-flexible",
    "sku:GB-CYL-CLR-9ML-ROL-BKDT-02",
    "websiteSku:GBTallCyl9RollBlkDot",
    "marketing-hover-parent-approved",
  ],
};

test("recognizes only the exact approved pilot marketing parent", () => {
  assert.deepEqual(getFilledHoverTwinParentEligibility(eligibleImage), {
    eligible: true,
    approved: true,
    graceSku: "GB-CYL-CLR-9ML-ROL-BKDT-02",
    websiteSku: "GBTallCyl9RollBlkDot",
    issue: null,
  });

  const pdp = getFilledHoverTwinParentEligibility({
    ...eligibleImage,
    libraryTags: eligibleImage.libraryTags.filter((tag) => tag !== "scene-flexible").concat("pdp-primary"),
  });
  assert.equal(pdp.eligible, false);
});

test("requires durable parent approval before building a paid invocation", () => {
  const unapproved = {
    ...eligibleImage,
    libraryTags: eligibleImage.libraryTags.filter((tag) => tag !== "marketing-hover-parent-approved"),
  };

  assert.throws(
    () => buildFilledHoverTwinInvocation({
      image: unapproved,
      organizationId: "22222222-2222-4222-8222-222222222222",
      maskImageUrl: "https://example.com/mask.png",
      reviewedBy: "Jordan",
    }),
    /approve.*parent/i,
  );
});

test("builds only the dedicated endpoint request with one parent ID and no reference array", () => {
  const invocation = buildFilledHoverTwinInvocation({
    image: eligibleImage,
    organizationId: "22222222-2222-4222-8222-222222222222",
    maskImageUrl: "https://example.com/mask.png",
    reviewedBy: "Jordan",
  });

  assert.equal(invocation.functionName, "generate-bestbottles-filled-twin");
  assert.equal(invocation.body.parentImageId, eligibleImage.id);
  assert.equal(invocation.body.provider, "openai-image-2");
  assert.equal(invocation.body.liquid.fillPercent, 70);
  assert.deepEqual(invocation.body.destinations, ["madison-library"]);
  assert.equal("referenceImages" in invocation.body, false);
  assert.equal("shopify" in invocation.body, false);
  assert.equal("convex" in invocation.body, false);
});
