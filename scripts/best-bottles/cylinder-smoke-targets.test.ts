import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildBestBottlesGenerationIdentity,
  getBestBottlesGenerationIdentityIssue,
} from "../../src/lib/bestBottlesGenerationIdentity";
import {
  ALL_CYLINDER_SMOKE_TARGETS,
  NINE_ML_FINE_MIST_SMOKE_TARGETS,
  NINE_ML_ROLL_ON_CAP_OFF_SMOKE_TARGETS,
  selectCylinderSmokeTargets,
} from "./cylinder-smoke-targets";

const ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const snapshot = JSON.parse(
  readFileSync(`${ROOT}/data/audits/2026-06-27-framing-profiles/convex_snapshot.json`, "utf8"),
) as { products: Array<Record<string, unknown>> };

describe("Best Bottles cylinder smoke targets", () => {
  it("includes the requested cap-off 5ml, regular 9ml, and slim 9ml cases", () => {
    const caseIds = ALL_CYLINDER_SMOKE_TARGETS.map((target) => target.caseId);

    assert.ok(caseIds.includes("5ml-cap-off"));
    assert.ok(caseIds.includes("9ml-regular"));
    assert.ok(caseIds.includes("9ml-slim"));
  });

  it("uses the exact regular 9ml 17-415 product-truth SKU", () => {
    const target = ALL_CYLINDER_SMOKE_TARGETS.find((item) => item.caseId === "9ml-regular");

    assert.equal(target?.sku, "GB-CYL-CLR-9ML-T-11");
    assert.equal(target?.mode, "cap-off");
    assert.equal(target?.capState, "detached");
    assert.match(target?.reference ?? "", /cylinder-9ml-clear-17-415-rollon/);
    assert.match(target?.reference ?? "", /GBCyl9RollBlkDot/);
  });

  it("marks the 28ml metal roll-on source truth as cap-off/detached", () => {
    const target = ALL_CYLINDER_SMOKE_TARGETS.find((item) => item.caseId === "28ml");

    assert.equal(target?.sku, "GB-CYL-CLR-28ML-MRL-01");
    assert.equal(target?.mode, "cap-off");
    assert.equal(target?.capState, "detached");
  });

  it("marks the 5ml fine-mist case as explicit cap-off/detached", () => {
    const target = ALL_CYLINDER_SMOKE_TARGETS.find((item) => item.caseId === "5ml-cap-off");

    assert.equal(target?.sku, "GB-CYL-CLR-5ML-SPR-SBLK");
    assert.equal(target?.mode, "cap-off");
    assert.equal(target?.capState, "detached");
    assert.match(target?.reference ?? "", /cylinder-5ml-clear-13-415-finemist/);
  });

  it("marks the 4ml fine-mist source truth as cap-off/detached", () => {
    const target = ALL_CYLINDER_SMOKE_TARGETS.find((item) => item.caseId === "4ml");

    assert.equal(target?.sku, "GB-SPR-CLR-4ML-BLK");
    assert.equal(target?.mode, "cap-off");
    assert.equal(target?.capState, "detached");
    assert.match(target?.reference ?? "", /cylinder-4ml-clear-12mm-finemist/);
  });

  it("marks the 3ml production canary as cap-off/detached", () => {
    const target = ALL_CYLINDER_SMOKE_TARGETS.find((item) => item.caseId === "3ml");

    assert.equal(target?.sku, "GB-SPR-CLR-3ML-BLK");
    assert.equal(target?.mode, "cap-off");
    assert.equal(target?.capState, "detached");
  });

  it("selects targets by either case id or SKU", () => {
    const targets = selectCylinderSmokeTargets(
      "5ml-cap-off,9ml-regular,GB-CYL-CLR-9ML-SPR-SBLK",
    );

    assert.deepEqual(
      targets.map((target) => target.caseId),
      ["5ml-cap-off", "9ml-regular", "9ml-slim"],
    );
  });

  it("defines a reusable ten-SKU 9ml roll-on cap-off consistency group (pink dot restored via cap-color override)", () => {
    assert.equal(NINE_ML_ROLL_ON_CAP_OFF_SMOKE_TARGETS.length, 10);
    assert.ok(
      NINE_ML_ROLL_ON_CAP_OFF_SMOKE_TARGETS.some((target) => target.sku === "GB-CYL-CLR-9ML-T-05"),
      "pink dot cap SKU must be in the ready set",
    );
    assert.ok(
      NINE_ML_ROLL_ON_CAP_OFF_SMOKE_TARGETS.every(
        (target) =>
          target.capacity === "9ml" &&
          target.mode === "cap-off" &&
          target.capState === "detached" &&
          target.caseId.startsWith("9ml-rollon-capoff-") &&
          /cylinder-9ml-clear-17-415-rollon/.test(target.reference),
      ),
    );
  });

  it("selects the reusable 9ml roll-on cap-off group by group id", () => {
    const targets = selectCylinderSmokeTargets("9ml-rollons-capoff");

    assert.equal(targets.length, 10);
    assert.deepEqual(
      targets.map((target) => target.sku),
      NINE_ML_ROLL_ON_CAP_OFF_SMOKE_TARGETS.map((target) => target.sku),
    );
  });

  it("selects a single reusable 9ml roll-on cap-off target by case id", () => {
    const targets = selectCylinderSmokeTargets("9ml-rollon-capoff-metal-shiny-black");

    assert.deepEqual(
      targets.map((target) => [target.caseId, target.sku]),
      [["9ml-rollon-capoff-metal-shiny-black", "GB-CYL-CLR-9ML-T-06"]],
    );
  });

  it("keeps the reusable 9ml roll-on cap-off group clear of identity-blocked SKUs", () => {
    for (const target of NINE_ML_ROLL_ON_CAP_OFF_SMOKE_TARGETS) {
      const product = snapshot.products.find((row) => row.graceSku === target.sku);
      assert.ok(product, `Missing Convex snapshot row for ${target.sku}`);

      const identity = buildBestBottlesGenerationIdentity(product, {
        bodyMaterial: "glass",
        sourceReference: target.reference,
      });

      assert.equal(getBestBottlesGenerationIdentityIssue(identity), null, target.sku);
    }
  });

  it("defines the six regular clear 9ml fine-mist sprayer targets", () => {
    assert.equal(NINE_ML_FINE_MIST_SMOKE_TARGETS.length, 6);
    assert.deepEqual(
      NINE_ML_FINE_MIST_SMOKE_TARGETS.map((target) => target.sku),
      [
        "GB-CYL-CLR-9ML-T-21",
        "GB-CYL-CLR-9ML-T-23",
        "GB-CYL-CLR-9ML-T-22",
        "GB-CYL-CLR-9ML-T-25",
        "GB-CYL-CLR-9ML-T-24",
        "GB-CYL-CLR-9ML-T-26",
      ],
    );
    assert.ok(
      NINE_ML_FINE_MIST_SMOKE_TARGETS.every(
        (target) =>
          target.capacity === "9ml" &&
          target.mode == null &&
          target.capState == null &&
          target.caseId.startsWith("9ml-finemist-") &&
          /cylinder-9ml-clear-17-415-finemist/.test(target.reference),
      ),
    );
  });

  it("selects the reusable 9ml fine-mist sprayer group by group id", () => {
    const targets = selectCylinderSmokeTargets("9ml-finemist");

    assert.equal(targets.length, 6);
    assert.deepEqual(
      targets.map((target) => target.sku),
      NINE_ML_FINE_MIST_SMOKE_TARGETS.map((target) => target.sku),
    );
  });

  it("keeps the reusable 9ml fine-mist sprayer group clear of identity-blocked SKUs", () => {
    for (const target of NINE_ML_FINE_MIST_SMOKE_TARGETS) {
      const product = snapshot.products.find((row) => row.graceSku === target.sku);
      assert.ok(product, `Missing Convex snapshot row for ${target.sku}`);

      const identity = buildBestBottlesGenerationIdentity(product, {
        bodyMaterial: "glass",
        sourceReference: target.reference,
      });

      assert.equal(getBestBottlesGenerationIdentityIssue(identity), null, target.sku);
    }
  });
});
