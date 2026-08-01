import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFilledHoverTwinLibraryTags,
  buildFilledHoverTwinProviderInput,
  validateFilledHoverTwinEdgeRequest,
} from "../_shared/bestBottlesFilledHoverTwinContract.ts";

const validRequest = {
  assetRole: "marketing-hover-filled",
  organizationId: "22222222-2222-4222-8222-222222222222",
  parentImageId: "11111111-1111-4111-8111-111111111111",
  graceSku: "GB-CYL-CLR-9ML-ROL-BKDT-02",
  websiteSku: "GBTallCyl9RollBlkDot",
  provider: "openai-image-2",
  liquid: { color: "warm translucent amber", fillPercent: 70 },
  mask: {
    imageUrl: "https://example.com/reviewed-cavity-mask.png",
    mimeType: "image/png",
    reviewed: true,
    reviewedBy: "Jordan",
  },
  destinations: ["madison-library"],
};

test("accepts only the exact approved pilot identity contract", () => {
  const result = validateFilledHoverTwinEdgeRequest(validRequest);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.request.graceSku, "GB-CYL-CLR-9ML-ROL-BKDT-02");
    assert.equal(result.request.websiteSku, "GBTallCyl9RollBlkDot");
  }
});

test("rejects alternate identities and every commerce destination", () => {
  const wrongSku = validateFilledHoverTwinEdgeRequest({
    ...validRequest,
    graceSku: "GB-CYL-CLR-9ML-ROL-SBLK-02",
  });
  assert.equal(wrongSku.ok, false);

  const wrongLiquid = validateFilledHoverTwinEdgeRequest({
    ...validRequest,
    liquid: { color: "cobalt blue", fillPercent: 70 },
  });
  assert.equal(wrongLiquid.ok, false);

  for (const destination of ["shopify", "convex-products", "pdp-primary", "sku-job"]) {
    const result = validateFilledHoverTwinEdgeRequest({
      ...validRequest,
      destinations: [destination],
    });
    assert.equal(result.ok, false);
  }
});

test("stores the validated liquid and fixed pilot platform as explicit lineage tags", () => {
  const validated = validateFilledHoverTwinEdgeRequest(validRequest);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const tags = buildFilledHoverTwinLibraryTags(validated.request, "pass");
  assert.ok(tags.includes("liquid-color:warm-translucent-amber"));
  assert.ok(tags.includes("platform-theme:pale-limestone-low-plinth"));
  assert.ok(tags.includes("pair-qa:pass"));
});

test("rejects caller-supplied references and unknown destination-write instructions", () => {
  for (const extra of [
    { referenceImages: ["https://example.com/parent.png"] },
    { shopifyProductId: "123" },
    { convexProductId: "456" },
    { reconciliationId: "789" },
  ]) {
    const result = validateFilledHoverTwinEdgeRequest({ ...validRequest, ...extra });
    assert.equal(result.ok, false);
  }
});

test("builds one-parent masked provider input without duplicating the parent", () => {
  const validated = validateFilledHoverTwinEdgeRequest(validRequest);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const providerInput = buildFilledHoverTwinProviderInput(validated.request, {
    parentBase64: btoa("approved-empty-parent"),
    parentMimeType: "image/png",
    maskBase64: btoa("reviewed-cavity-mask"),
  });

  assert.equal(providerInput.referenceImages.length, 1);
  assert.equal(providerInput.referenceImages[0].data, btoa("approved-empty-parent"));
  assert.equal(providerInput.editMask.data, btoa("reviewed-cavity-mask"));
  assert.equal(providerInput.model, "gpt-image-2");
  assert.match(providerInput.prompt, /70%/);
});

test("keeps the endpoint quarantined from PDP and commerce mutation paths", () => {
  const source = Deno.readTextFileSync(new URL("./index.ts", import.meta.url));
  assert.match(source, /validateFilledHoverTwinEdgeRequest/);
  assert.match(source, /FILLED_HOVER_TWIN_PARENT_APPROVAL_TAG/);
  assert.match(source, /OpenAIProvider\.generateImage/);
  assert.match(source, /evaluateFilledHoverTwinQa/);
  assert.match(source, /from\("generated_images"\)/);
  assert.doesNotMatch(source, /generate-madison-image/);
  assert.doesNotMatch(source, /push-shopify|shopify_product|shopifyVariant/i);
  assert.doesNotMatch(source, /best_bottles_pipeline_sku_jobs/);
  assert.doesNotMatch(source, /convex/i);
  assert.doesNotMatch(source, /image_reconciliation/);
});
