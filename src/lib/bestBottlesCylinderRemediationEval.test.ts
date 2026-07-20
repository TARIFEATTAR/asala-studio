import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PRESERVE } from "../config/bestBottlesCatalogCanon";
import type { CylinderReferenceRemediationPlan, CylinderReferenceRemediationRow } from "./bestBottlesCylinderReferenceRemediation";
import {
  assertCylinderRemediationPlanSeal,
  buildCylinderRemediationEvalProduct,
  buildCylinderRemediationEvalPrompt,
} from "./bestBottlesCylinderRemediationEval";

const row: CylinderReferenceRemediationRow = {
  canonicalIdentityKey: "WEB|GRACE",
  websiteSku: "WebSku",
  graceSku: "GB-CYL-CLR-9ML-SPR-BLK",
  productGroupSlug: "cylinder-9ml-clear-17-415-finemist",
  capacityMl: 9,
  status: "ready-for-remediation-eval",
  blockers: [],
  remediationMode: "assemble-and-regenerate",
  sourcePath: "/evidence/source.psd",
  sourceReferencePath: "/evidence/source.png",
  sourcePsdSha256: "a".repeat(64),
  sourceReferenceSha256: "b".repeat(64),
  sourceDimensions: { widthPx: 600, heightPx: 975 },
  sourceClassification: "detached-cap-or-sidecar",
  canonicalGeometry: {
    bodyHeightMm: 70,
    assembledHeightMm: 96,
    widthAxisMm: 20,
    secondAxisMm: 20,
  },
  scaleAuthority: "canonical-columns",
  geometrySource: "canon_*",
  geometrySourceUrl: null,
  targetCanvas: { widthPx: 2080, heightPx: 2288 },
};

describe("Cylinder remediation evaluation contract", () => {
  it("requires the exact sealed plan SHA and all 96 ready rows", () => {
    const plan = {
      sha256: "c167ba5618c575af50fa3044167ee4f0941376d69823eb8c3fe6f87c9fb3d23b",
      summary: { generationReadyCount: 96, geometryBlockedCount: 0 },
      rows: Array.from({ length: 96 }, () => row),
    } as unknown as CylinderReferenceRemediationPlan;

    assert.doesNotThrow(() => assertCylinderRemediationPlanSeal(plan));
    assert.throws(
      () => assertCylinderRemediationPlanSeal({ ...plan, sha256: "0".repeat(64) }),
      /sealed remediation plan SHA/i,
    );
  });

  it("joins both identities and uses only plan canon geometry", () => {
    const product = buildCylinderRemediationEvalProduct(row, [{
      graceSku: row.graceSku,
      websiteSku: row.websiteSku,
      family: "Cylinder",
      bottleCollection: "Cylinder",
      category: "Fine Mist Sprayer",
      color: "Clear",
      capacityMl: "9",
      applicator: "Fine Mist Sprayer",
      capStyle: "Sprayer",
      capColor: "Black",
      trimColor: "Black",
      itemName: "Cylinder design 9ml clear glass bottle with sprayer",
      productUrl: "https://www.bestbottles.com/product/example",
      heightWithoutCap_raw: "999 mm",
      heightWithCap_raw: "999 mm",
      diameter_raw: "999 mm",
      convexWidthMm_live: "999",
      convexDepthMm_live: "999",
    }]);

    assert.equal(product.heightWithoutCap, "70 mm");
    assert.equal(product.heightWithCap, "96 mm");
    assert.equal(product.diameter, "20 mm");
    assert.equal(product.family, "Cylinder");
    assert.equal(product.capState, "assembled");
    assert.equal(product.topologyReferenceId, row.sourcePsdSha256);
  });

  it("fails closed on a one-sided identity match", () => {
    assert.throws(() => buildCylinderRemediationEvalProduct(row, [{
      graceSku: row.graceSku,
      websiteSku: "DifferentWebsiteSku",
      family: "Cylinder",
    }]), /exact canonical master identity/i);
  });

  it("replaces PRESERVE with an assembled-output contract for detached evidence", () => {
    const base = `${PRESERVE}\n\nCYLINDER FRAMING\n- If a detached cap or applicator is present, keep it as a right-sidecar component on the same baseline; it must not shift the primary bottle off center.\n\nFINAL`;
    const prompt = buildCylinderRemediationEvalPrompt(base, row);

    assert.doesNotMatch(prompt, /Do not .*reposition.*remove/i);
    assert.match(prompt, /exactly one fully assembled cap-on product/i);
    assert.match(prompt, /no detached sidecar/i);
    assert.match(prompt, /reference-remediation-v1/i);
    assert.match(prompt, /CANONICAL ASSEMBLED GEOMETRY LOCK/);
    assert.match(prompt, /body height: 70 mm/i);
    assert.match(prompt, /assembled height: 96 mm/i);
    assert.match(prompt, /maximum body diameter: 20 mm/i);
    assert.match(prompt, /visible closure contribution above the body: 26 mm/i);
    assert.match(prompt, /assembled height-to-diameter ratio: 4\.8/i);
  });
});
