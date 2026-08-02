import assert from "node:assert/strict";
import test from "node:test";
import { expectedBestBottlesVisualIdentityForProduct } from "./bestBottlesShopifyPushIdentity";

test("resolves Diva tassel accessory identity from website SKU", () => {
  const identity = expectedBestBottlesVisualIdentityForProduct({
    graceSku: "GB-DVA-CLR-46ML-T-28",
    websiteSku: "GBDivaFrst46AnSpTslWht",
    family: "Diva",
    category: "Glass Bottle",
    color: "Clear",
    applicator: "Antique bulb sprayer with tassel",
  });

  assert.equal(identity, "White");
});

test("resolves Diva reducer leather identity from website SKU", () => {
  const identity = expectedBestBottlesVisualIdentityForProduct({
    graceSku: "GB-DVA-CLR-46ML-T-30",
    websiteSku: "GBDivaFrst46RdcrBlkLthr",
    family: "Diva",
    category: "Glass Bottle",
    color: "Clear",
    applicator: "Reducer",
  });

  assert.equal(identity, "Black Leather");
});

test("resolves plain glass bottle identity from glass color", () => {
  const identity = expectedBestBottlesVisualIdentityForProduct({
    graceSku: "GB-DVA-CLR-46ML-01",
    websiteSku: "GBDivaClr46",
    family: "Diva",
    category: "Glass Bottle",
    color: "Clear",
    applicator: "Bottle only",
  });

  assert.equal(identity, "Clear");
});
