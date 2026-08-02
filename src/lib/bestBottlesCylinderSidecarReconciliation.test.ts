import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCylinderSidecarGenerationAuthority,
  buildCylinderSidecarReconciliation,
  type CylinderSidecarIdentityJoinRow,
  type CylinderSidecarReadinessRow,
} from "./bestBottlesCylinderSidecarReconciliation";

function target(overrides: Partial<CylinderSidecarReadinessRow> = {}): CylinderSidecarReadinessRow {
  return {
    canonicalIdentityKey: "WEB|GRACE",
    websiteSku: "WebSku",
    graceSku: "GB-CYL-CLR-50ML-SPR-BLK",
    status: "production-qualified",
    canonical: {
      family: "Cylinder",
      capacityMl: "50",
      canon_bodyHeightMm: "117",
      canon_widthAxisMm: "32",
      canon_secondAxisMm: "32",
      canon_heightWithCapMm: "142",
    },
    ...overrides,
  };
}

function source(overrides: Partial<CylinderSidecarIdentityJoinRow> = {}): CylinderSidecarIdentityJoinRow {
  return {
    sourcePath: "/archive/Uncapped/WebSku.psd",
    sourceRelativePath: "Cylinder/Uncapped/WebSku.psd",
    sourceSha256: "a".repeat(64),
    sourceBytes: 100,
    websiteSku: "WebSku",
    graceSku: "GB-CYL-CLR-50ML-SPR-BLK",
    identityStatus: "exact-website-sku",
    family: "Cylinder",
    canonicalReviewMetadata: {
      applicator: "Perfume Spray Pump",
      assemblyType: "3-part",
    },
    composite: {
      width: 1400,
      height: 2100,
      opaque: true,
      previewPath: "/archive/preview.png",
      evidenceSha256: "b".repeat(64),
    },
    ...overrides,
  };
}

describe("Cylinder sidecar reconciliation", () => {
  it("builds fail-closed generation authority from a hash-matched sidecar record", () => {
    const authority = buildCylinderSidecarGenerationAuthority({
      route: "exact-psd-sidecar",
      requiredOutputTopology: "fitment-attached-cap-right-sidecar",
      blockers: [],
      output: { sha256: "c".repeat(64) },
    }, "c".repeat(64));

    assert.deepEqual(authority, {
      componentTopology: "fitment-attached-cap-right-sidecar",
      capState: "detached",
      capOffReferenceId: "c".repeat(64),
      topologyReferenceId: "c".repeat(64),
      shadowTopology: "detached-sidecar",
    });
  });

  it("blocks live-PDP composites until they are remediated to one bottle plus one cap", () => {
    assert.throws(() => buildCylinderSidecarGenerationAuthority({
      route: "exact-live-pdp-sidecar",
      requiredOutputTopology: "fitment-attached-cap-right-sidecar",
      blockers: [],
      output: { sha256: "c".repeat(64) },
    }, "c".repeat(64)), /remediat/i);
  });

  it("authorizes a reviewed immutable sidecar remediation only when the actual input hash matches", () => {
    const authority = buildCylinderSidecarGenerationAuthority({
      route: "reviewed-immutable-sidecar-remediation",
      requiredOutputTopology: "fitment-attached-cap-right-sidecar",
      blockers: [],
      output: { sha256: "f".repeat(64) },
    }, "f".repeat(64));

    assert.equal(authority.componentTopology, "fitment-attached-cap-right-sidecar");
    assert.equal(authority.capOffReferenceId, "f".repeat(64));
  });

  it("blocks generation authority when the live reference hash differs from the reviewed export", () => {
    assert.throws(() => buildCylinderSidecarGenerationAuthority({
      route: "exact-psd-sidecar",
      requiredOutputTopology: "fitment-attached-cap-right-sidecar",
      blockers: [],
      output: { sha256: "c".repeat(64) },
    }, "d".repeat(64)), /hash mismatch/i);
  });

  it("preserves reviewed bulb products as assembled live-site topology exceptions", () => {
    const authority = buildCylinderSidecarGenerationAuthority({
      route: "live-topology-exception",
      requiredOutputTopology: "assembled-live-site-exception",
      blockers: [],
      output: { sha256: "e".repeat(64) },
    }, "e".repeat(64));

    assert.equal(authority.componentTopology, "assembled-live-site-exception");
    assert.equal(authority.capState, "assembled");
    assert.equal(authority.shadowTopology, "complex-contact");
  });

  it("selects one exact dual-identity PSD from an explicitly uncapped source folder", () => {
    const plan = buildCylinderSidecarReconciliation({
      readinessRows: [target()],
      identityJoinRows: [source()],
    });

    assert.equal(plan.rows[0].route, "exact-psd-sidecar");
    assert.equal(plan.rows[0].source?.sourcePath, "/archive/Uncapped/WebSku.psd");
    assert.equal(plan.summary.exactPsdSidecarCount, 1);
    assert.equal(plan.summary.blockedCount, 0);
  });

  it("recognizes the archive's parenthesized Uncapped folder spelling", () => {
    const plan = buildCylinderSidecarReconciliation({
      readinessRows: [target()],
      identityJoinRows: [source({
        sourcePath: "/archive/3. Amber 9ml (Uncapped)/WebSku.psd",
        sourceRelativePath: "17-415 Bottles/3. Amber 9ml (Uncapped)/WebSku.psd",
      })],
    });

    assert.equal(plan.rows[0].route, "exact-psd-sidecar");
  });

  it("does not mistake a Capped child inside a Capped & Uncapped archive group for sidecar evidence", () => {
    const plan = buildCylinderSidecarReconciliation({
      readinessRows: [target()],
      identityJoinRows: [source({
        sourcePath: "/archive/Capped & Uncapped/Capped/WebSku.psd",
        sourceRelativePath: "31. Capped & Uncapped/Capped/50ml Capped/WebSku.psd",
        composite: {
          width: 1400,
          height: 2100,
          opaque: true,
          previewPath: "/archive/preview.png",
          evidenceSha256: "b".repeat(64),
          largeForegroundComponentCount: 1,
        },
      })],
    });

    assert.equal(plan.rows[0].route, "exact-live-pdp-sidecar");
  });

  it("preserves vintage bulb products as exact live-topology exceptions", () => {
    const plan = buildCylinderSidecarReconciliation({
      readinessRows: [target()],
      identityJoinRows: [source({
        sourcePath: "/archive/WebSku.psd",
        sourceRelativePath: "Cylinder/WebSku.psd",
        canonicalReviewMetadata: {
          applicator: "Vintage Bulb Sprayer with Tassel",
          assemblyType: "2-part",
        },
      })],
    });

    assert.equal(plan.rows[0].route, "live-topology-exception");
    assert.equal(plan.rows[0].requiredOutputTopology, "assembled-live-site-exception");
    assert.equal(plan.summary.liveTopologyExceptionCount, 1);
  });

  it("routes an exact non-bulb identity without an uncapped PSD to the live PDP sidecar", () => {
    const plan = buildCylinderSidecarReconciliation({
      readinessRows: [target()],
      identityJoinRows: [source({
        sourcePath: "/archive/WebSku.psd",
        sourceRelativePath: "Cylinder/WebSku.psd",
        canonicalReviewMetadata: { applicator: "Reducer", assemblyType: "3-part" },
      })],
    });

    assert.equal(plan.rows[0].route, "exact-live-pdp-sidecar");
    assert.equal(
      plan.rows[0].liveSourceUrl,
      "https://www.bestbottles.com/images/store/enlarged_pics/WebSku.gif",
    );
    assert.equal(plan.rows[0].requiredOutputTopology, "fitment-attached-cap-right-sidecar");
  });

  it("fails closed when only one SKU identity matches", () => {
    const plan = buildCylinderSidecarReconciliation({
      readinessRows: [target()],
      identityJoinRows: [source({ graceSku: "GB-CYL-DIFFERENT" })],
    });

    assert.equal(plan.rows[0].route, "blocked");
    assert.deepEqual(plan.rows[0].blockers, ["no-exact-dual-identity-source"]);
    assert.equal(plan.summary.blockedCount, 1);
  });
});
