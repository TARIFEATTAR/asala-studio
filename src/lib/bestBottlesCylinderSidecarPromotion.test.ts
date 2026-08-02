import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCylinderSidecarPromotionPlan } from "./bestBottlesCylinderSidecarPromotion";

const HASH = "a".repeat(64);
const identity = "WEBSKU|GRACESKU";

function record() {
  return {
    canonicalIdentityKey: identity,
    websiteSku: "WebSku",
    graceSku: "GraceSku",
    canonical: {
      websiteSku: "WebSku",
      graceSku: "GraceSku",
      family: "Cylinder",
      productGroupSlug: "cylinder-9ml",
      capacityMl: "9",
      canon_bodyHeightMm: "70",
      canon_widthAxisMm: "20",
      canon_secondAxisMm: "20",
      canon_heightWithCapMm: "96",
    },
    route: "exact-psd-sidecar" as const,
    requiredOutputTopology: "fitment-attached-cap-right-sidecar" as const,
    blockers: [],
    output: {
      path: "/tmp/sidecar.png",
      filename: "sidecar.png",
      width: 750,
      height: 1594,
      opaque: true as const,
      sha256: HASH,
      bytes: 1234,
    },
  };
}

describe("Cylinder sidecar promotion plan", () => {
  it("creates an immutable sidecar-v2 path for one exact dual-identity job", () => {
    const plan = buildCylinderSidecarPromotionPlan({
      records: [record()],
      jobs: [{
        id: "job-1",
        websiteSku: "WebSku",
        graceSku: "GraceSku",
        family: "Cylinder",
        bestReferenceCandidatePath: "https://old.example/ref.png",
      }],
      remoteObjects: [],
      bucket: "reference-images",
      supabaseUrl: "https://example.supabase.co",
      expectedCount: 1,
    });

    assert.equal(plan.summary.readyToUploadCount, 1);
    assert.equal(plan.summary.blockedCount, 0);
    assert.match(plan.rows[0].storage.path, /cylinder\/sidecar-v2\/aa\/WEBSKU__GRACESKU__/);
    assert.equal(plan.rows[0].pipeline.status, "needs-repoint");
  });

  it("fails closed on remote byte collisions", () => {
    const expectedPath = `best-bottles/production-references/cylinder/sidecar-v2/aa/WEBSKU__GRACESKU__${HASH}.png`;
    const plan = buildCylinderSidecarPromotionPlan({
      records: [record()],
      jobs: [{
        id: "job-1",
        websiteSku: "WebSku",
        graceSku: "GraceSku",
        family: "Cylinder",
        bestReferenceCandidatePath: null,
      }],
      remoteObjects: [{ path: expectedPath, status: "present", sha256: "b".repeat(64), bytes: 1234 }],
      bucket: "reference-images",
      supabaseUrl: "https://example.supabase.co",
      expectedCount: 1,
    });

    assert.equal(plan.summary.blockedCount, 1);
    assert.deepEqual(plan.rows[0].blockers, ["remote-path-byte-collision"]);
  });

  it("blocks duplicate exact pipeline jobs", () => {
    const job = {
      websiteSku: "WebSku",
      graceSku: "GraceSku",
      family: "Cylinder",
      bestReferenceCandidatePath: null,
    };
    const plan = buildCylinderSidecarPromotionPlan({
      records: [record()],
      jobs: [{ id: "job-1", ...job }, { id: "job-2", ...job }],
      remoteObjects: [],
      bucket: "reference-images",
      supabaseUrl: "https://example.supabase.co",
      expectedCount: 1,
    });

    assert.equal(plan.summary.blockedCount, 1);
    assert.deepEqual(plan.rows[0].blockers, ["duplicate-exact-pipeline-jobs"]);
  });
});
