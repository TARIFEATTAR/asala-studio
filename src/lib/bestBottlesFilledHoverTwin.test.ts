import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFilledHoverTwinPrompt,
  buildFilledHoverTwinTags,
  parseFilledHoverTwinRequest,
} from "./bestBottlesFilledHoverTwin";

const validInput = {
  assetRole: "marketing-hover-filled",
  parent: {
    generatedImageId: "11111111-1111-4111-8111-111111111111",
    imageUrl: "https://example.com/empty.png",
    approvalStatus: "approved",
    assetRole: "scene",
  },
  identity: {
    graceSku: "GB-CYL-CLR-9ML-ROL-BKDT-02",
    websiteSku: "GBTallCyl9RollBlkDot",
  },
  liquid: {
    color: "warm translucent amber",
    fillPercent: 70,
  },
  provider: "openai-image-2",
  mask: {
    imageUrl: "https://example.com/cavity-mask.png",
    mimeType: "image/png",
    reviewed: true,
    reviewedBy: "Jordan",
  },
  destinations: ["madison-library"],
};

test("accepts one approved marketing parent and a reviewed PNG cavity mask", () => {
  const parsed = parseFilledHoverTwinRequest(validInput);

  assert.equal(parsed.parent.generatedImageId, validInput.parent.generatedImageId);
  assert.equal(parsed.liquid.fillPercent, 70);
  assert.deepEqual(parsed.destinations, ["madison-library"]);
});

test("rejects every commerce and PDP destination", () => {
  for (const destination of [
    "pdp-primary",
    "pdp-secondary",
    "shopify",
    "convex-products",
    "best_bottles_pipeline_sku_jobs",
    "pdp-reconciliation",
  ]) {
    assert.throws(
      () => parseFilledHoverTwinRequest({ ...validInput, destinations: [destination] }),
      /marketing-only|destination/i,
    );
  }
});

test("rejects non-marketing parents, unapproved parents, and unreviewed masks", () => {
  assert.throws(
    () => parseFilledHoverTwinRequest({
      ...validInput,
      parent: { ...validInput.parent, assetRole: "pdp-primary" },
    }),
    /marketing parent/i,
  );
  assert.throws(
    () => parseFilledHoverTwinRequest({
      ...validInput,
      parent: { ...validInput.parent, approvalStatus: "pending" },
    }),
    /approved/i,
  );
  assert.throws(
    () => parseFilledHoverTwinRequest({
      ...validInput,
      mask: { ...validInput.mask, reviewed: false },
    }),
    /reviewed/i,
  );
});

test("requires GPT Image 2, exact identity, and one implicit parent reference", () => {
  assert.throws(
    () => parseFilledHoverTwinRequest({ ...validInput, provider: "nano-banana-pro" }),
    /GPT Image 2/i,
  );
  assert.throws(
    () => parseFilledHoverTwinRequest({
      ...validInput,
      identity: { ...validInput.identity, graceSku: "" },
    }),
    /Grace SKU/i,
  );
  assert.throws(
    () => parseFilledHoverTwinRequest({
      ...validInput,
      referenceImages: [validInput.parent.imageUrl],
    }),
    /parent.*exactly once/i,
  );
});

test("builds a liquid-only prompt that locks every exterior scene element", () => {
  const parsed = parseFilledHoverTwinRequest(validInput);
  const prompt = buildFilledHoverTwinPrompt(parsed);

  assert.match(prompt, /warm translucent amber/i);
  assert.match(prompt, /70%/);
  assert.match(prompt, /only inside/i);
  assert.match(prompt, /preserve.*bottle exterior/i);
  assert.match(prompt, /platform.*background.*lighting.*shadow/i);
  assert.doesNotMatch(prompt, /PDP master|SHOPIFY|CONVEX/i);
});

test("builds explicit library-only lineage tags", () => {
  const parsed = parseFilledHoverTwinRequest(validInput);
  const tags = buildFilledHoverTwinTags(parsed);

  assert.ok(tags.includes("asset-role:marketing-hover-filled"));
  assert.ok(tags.includes("filled-twin"));
  assert.ok(tags.includes(`filled-twin-parent:${validInput.parent.generatedImageId}`));
  assert.ok(tags.includes(`sku:${validInput.identity.graceSku}`));
  assert.ok(tags.includes(`websiteSku:${validInput.identity.websiteSku}`));
  assert.ok(tags.includes("liquid-fill:70"));
  assert.ok(tags.every((tag) => !/pdp|shopify|convex|sku-job/i.test(tag)));
});
