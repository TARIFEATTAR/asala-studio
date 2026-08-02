import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCylinderReferenceManifest,
  classifyCylinderPsdPath,
  getBestBottlesCanonicalReferenceArtifactIssues,
  qualifyCylinderReference,
  type CylinderReferenceQualificationInput,
} from "./bestBottlesCylinderReferenceReadiness";

const target = {
  graceSku: "GB-CYL-CLR-5ML-SPR-BLK",
  websiteSku: "GBCyl5SpryBlk",
  aliases: [],
  productGroupSlug: "cylinder-5ml-clear",
  status: "ready",
  issues: [],
  sourceGraceSkus: ["GB-CYL-CLR-5ML-SPR-BLK"],
};

function input(
  overrides: Partial<CylinderReferenceQualificationInput> = {},
): CylinderReferenceQualificationInput {
  return {
    target,
    reference: {
      sourcePath:
        "/reviewed/cylinder/GB-CYL-CLR-5ML-SPR-BLK__GBCyl5SpryBlk__pdp-main__v001.png",
      provenance: "reviewed-local-canonical",
      width: 1200,
      height: 1200,
      opaque: true,
      sha256: "a".repeat(64),
    },
    psdCandidates: [],
    ...overrides,
  };
}

describe("qualifyCylinderReference", () => {
  it("classifies capped and uncapped PSD paths independently within a mixed inventory row", () => {
    const hints = {
      sampleCappedPsd: "17-415 Bottles/8. Swirl 9ml (Capped)/item.psd",
      sampleUncappedPsd: "17-415 Bottles/7. Swirl 9ml (Uncapped)/item.psd",
      sampleUnspecifiedPsd: "",
      recoveryCoverageLabel: "capped_psd_candidate_available",
    };

    assert.equal(
      classifyCylinderPsdPath(hints.sampleCappedPsd, hints),
      "capped_product",
    );
    assert.equal(
      classifyCylinderPsdPath(hints.sampleUncappedPsd, hints),
      "uncapped_only",
    );
  });

  it("requires an exact SKU filename token and opaque reviewed raster", () => {
    assert.deepEqual(
      getBestBottlesCanonicalReferenceArtifactIssues({
        sourcePath: "/reviewed/unrelated.png",
        expectedSkuTokens: [target.graceSku, target.websiteSku],
        width: 1200,
        height: 1200,
        opaque: false,
        provenance: "reviewed-local-canonical",
      }),
      [
        "Reference filename does not contain an exact canonical or website SKU token.",
        "Reference contains transparent pixels; Cylinder generation requires an opaque flattened raster.",
      ],
    );
  });

  it("accepts one opaque reviewed flattened PNG with exact SKU provenance", () => {
    const result = qualifyCylinderReference(input());

    assert.equal(result.status, "eligible");
    assert.equal(result.graceSku, target.graceSku);
    assert.equal(result.sha256, "a".repeat(64));
  });

  it("routes a matched capped PSD without an export to recovery, not generation", () => {
    const result = qualifyCylinderReference(
      input({
        reference: null,
        psdCandidates: [
          {
            sourcePath: "/psd/GBCyl5SpryBlk.psd",
            pathClass: "capped_product",
          },
        ],
      }),
    );

    assert.equal(result.status, "recover-from-psd");
    assert.equal(result.sourcePsdPath, "/psd/GBCyl5SpryBlk.psd");
  });

  it("blocks live website imagery and component-only PSDs", () => {
    const live = qualifyCylinderReference(
      input({
        reference: {
          sourcePath:
            "https://www.bestbottles.com/images/store/enlarged_pics/GBCyl5SpryBlk.gif",
          provenance: "bestbottles-live",
          width: 360,
          height: 480,
          opaque: true,
          sha256: null,
        },
      }),
    );
    const component = qualifyCylinderReference(
      input({
        reference: null,
        psdCandidates: [
          {
            sourcePath: "/psd/GBCyl5SpryBlk-cap-only.psd",
            pathClass: "component_only",
          },
        ],
      }),
    );

    assert.equal(live.status, "blocked");
    assert.match(live.reasons.join(" "), /commercial evidence/i);
    assert.equal(component.status, "blocked");
    assert.match(component.reasons.join(" "), /component-only/i);
  });

  it("accounts for each publication target exactly once", async () => {
    const manifest = await buildCylinderReferenceManifest({
      ledgerHash: "b".repeat(64),
      targets: [target],
      referencesByWebsiteSku: {
        [target.websiteSku]: input().reference,
      },
      psdCandidatesByWebsiteSku: {},
      generatedAt: "2026-07-12T00:00:00.000Z",
    });

    assert.equal(manifest.decisions.length, 1);
    assert.equal(manifest.summary.eligible, 1);
    assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
  });
});
