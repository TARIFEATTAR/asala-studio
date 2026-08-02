import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import type { Product } from "@/integrations/convex/bestBottles";
import {
  prepareCylinderStudioGeneration,
  orchestrateCylinderStudioGeneration,
} from "./bestBottlesCylinderStudioOrchestration";
import {
  verifyCylinderImmutableReferenceBytesForPreset,
  type CylinderRoleAwareReadinessRow,
} from "./bestBottlesCylinderRoleAuthority";

function pngBytes(width = 1000, height = 1300): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function fixture() {
  const bytes = pngBytes();
  const hash = createHash("sha256").update(bytes).digest("hex");
  const path = `best-bottles/production-references/cylinder/sidecar-v2/${hash.slice(0, 2)}/WEB__GRACE__${hash}.png`;
  const publicUrl = `https://example.supabase.co/storage/v1/object/public/reference-images/${path}`;
  const reference = {
    roleId: "pdp-cap-off-sidecar" as const,
    status: "verified" as const,
    remoteStatus: "verified" as const,
    sourceReviewStatus: "approved",
    sourceRoute: "reviewed-immutable-sidecar-remediation",
    productionStatus: "generation-authorized" as const,
    publicUrl,
    storagePath: path,
    exportSha256: hash,
    reviewedOutputSha256: hash,
    topology: "fitment-attached-cap-right-sidecar" as const,
    approvedException: null,
    blockers: [],
    width: 1000,
    height: 1300,
    opaque: true as const,
  };
  const row: CylinderRoleAwareReadinessRow = {
    canonicalIdentityKey: "WEB|GRACE",
    websiteSku: "WEB",
    graceSku: "GRACE",
    status: "both-roles-verified",
    blockers: [],
    canonical: {
      websiteSku: "WEB",
      graceSku: "GRACE",
      family: "Cylinder",
      productGroupSlug: "cylinder-9ml",
      capacityMl: "9",
      canon_bodyHeightMm: "70",
      canon_widthAxisMm: "20",
      canon_secondAxisMm: "20",
      canon_heightWithCapMm: "96",
    },
    references: {
      identityCapOn: { ...reference, roleId: "identity-cap-on", topology: "assembled-cap-on", sourceRoute: "psd-reviewed-export" },
      pdpCapOffSidecar: reference,
    },
    approvedEvidence: { livePointer: null, recovery: null },
  };
  const product: Product = {
    _id: "product",
    websiteSku: "WEB",
    graceSku: "GRACE",
    category: "Bottle",
    family: "Cylinder",
    color: "Clear",
    capacity: "9 ml",
    capacityMl: 9,
    capacityOz: 0.3,
    heightWithCap: "999 mm",
    heightWithoutCap: "888 mm",
    diameter: "777 mm",
    neckThreadSize: "17-415",
    applicator: "Fine mist sprayer",
    capStyle: "Overcap",
    capColor: "Black",
    trimColor: "Black",
    bottleCollection: "Cylinder",
    itemName: "9 ml cylinder",
    itemDescription: "fixture",
    stockStatus: "In stock",
    verified: true,
  };
  return { bytes, row, product, publicUrl };
}

describe("Cylinder Studio generation orchestration", () => {
  it("retrieves the URL once and invokes with canonical geometry plus the exact verified payload", async () => {
    const { bytes, row, product, publicUrl } = fixture();
    let remoteRetrievals = 0;
    const events: string[] = [];
    const result = await orchestrateCylinderStudioGeneration({
      product,
      row,
      presetId: "grid-card-exploded-2000x2200",
      referenceUrl: publicUrl,
      verifyReference: (authorityRow, presetId, referenceUrl) => {
        remoteRetrievals += 1;
        events.push("retrieve-and-verify");
        return verifyCylinderImmutableReferenceBytesForPreset(
          authorityRow,
          presetId,
          referenceUrl,
          async () => new Response(bytes, { status: 200 }),
        );
      },
      invoke: async (prepared) => {
        events.push("invoke");
        assert.equal(prepared.product.heightWithoutCap, "70");
        assert.equal(prepared.product.heightWithCap, "96");
        assert.equal(prepared.product.diameter, "20");
        assert.equal(prepared.product.measurementSource, "best-bottles-canonical-truth-2026-07-12");
        assert.equal(prepared.canonicalGeometryContract.canon_bodyHeightMm, "70");
        assert.equal(prepared.canonicalGeometryContract.canon_heightWithCapMm, "96");
        assert.equal(prepared.canonicalGeometryContract.canon_widthAxisMm, "20");
        assert.deepEqual(prepared.referenceCanvas, { width: 1000, height: 1300 });
        assert.match(prepared.verifiedReference.dataUrl, /^data:image\/png;base64,/);
        return prepared;
      },
    });
    assert.equal(remoteRetrievals, 1);
    assert.deepEqual(events, ["retrieve-and-verify", "invoke"]);
    assert.notEqual(result.product.heightWithoutCap, product.heightWithoutCap);
    assert.notEqual(result.product.heightWithCap, product.heightWithCap);
    assert.notEqual(result.product.diameter, product.diameter);
  });

  it("reuses a batch preparation without another URL retrieval", async () => {
    const { bytes, row, product, publicUrl } = fixture();
    let remoteRetrievals = 0;
    const verifyReference = (authorityRow: CylinderRoleAwareReadinessRow | null | undefined, presetId: string, referenceUrl: string | null | undefined) => {
      remoteRetrievals += 1;
      return verifyCylinderImmutableReferenceBytesForPreset(
        authorityRow,
        presetId,
        referenceUrl,
        async () => new Response(bytes, { status: 200 }),
      );
    };
    const prepared = await prepareCylinderStudioGeneration({
      product,
      row,
      presetId: "grid-card-exploded-2000x2200",
      referenceUrl: publicUrl,
      verifyReference,
    });
    const received = await orchestrateCylinderStudioGeneration({
      product,
      row,
      presetId: "grid-card-exploded-2000x2200",
      referenceUrl: publicUrl,
      prepared,
      verifyReference,
      invoke: async (value) => value,
    });
    assert.equal(remoteRetrievals, 1);
    assert.strictEqual(received, prepared);
    assert.strictEqual(received.verifiedReference, prepared.verifiedReference);
  });

  it("fails closed before retrieval when canonical Cylinder authority is missing", async () => {
    const { product, publicUrl } = fixture();
    let remoteRetrievals = 0;
    await assert.rejects(
      orchestrateCylinderStudioGeneration({
        product,
        row: null,
        presetId: "grid-card-exploded-2000x2200",
        referenceUrl: publicUrl,
        verifyReference: async () => {
          remoteRetrievals += 1;
          throw new Error("must not retrieve");
        },
        invoke: async () => null,
      }),
      /canonical cylinder generation requires exact dual identity/i,
    );
    assert.equal(remoteRetrievals, 0);
  });
});
