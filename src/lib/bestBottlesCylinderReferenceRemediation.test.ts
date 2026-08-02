import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCylinderReferenceRemediationPlan,
  cylinderRemediationSourceStoragePath,
  selectCylinderReferenceRemediationEval,
  verifyCylinderRemediationSourceEvidence,
  type CylinderRecoveryApprovalArtifact,
  type CylinderRemediationReadinessArtifact,
} from "./bestBottlesCylinderReferenceRemediation";

function approvalDecision(overrides: Record<string, unknown> = {}) {
  return {
    websiteSku: "GBCyl5SpryBlkMatt",
    graceSku: "GB-CYL-CLR-5ML-SPR-MBLK",
    sourcePath: "/approved/GBCyl5SpryBlkMatt.psd",
    sourceSha256: "a".repeat(64),
    outputPath: "/approved/GBCyl5SpryBlkMatt.png",
    outputSha256: "b".repeat(64),
    width: 600,
    height: 975,
    pixelCount: 585000,
    resolutionStatus: "low-resolution",
    classification: "detached-cap-or-sidecar",
    identityDecision: "approved-exact-product",
    productionDisposition: "regeneration-required-low-resolution",
    ...overrides,
  };
}

function approval(decisions: ReturnType<typeof approvalDecision>[]): CylinderRecoveryApprovalArtifact {
  return {
    version: "approval-v1",
    minimumPixels: 1_000_000,
    decisions,
  };
}

function readinessRow(overrides: Record<string, unknown> = {}) {
  return {
    canonicalIdentityKey: "GBCYL5SPRYBLKMATT|GBCYLCLR5MLSPRMBLK",
    websiteSku: "GBCyl5SpryBlkMatt",
    graceSku: "GB-CYL-CLR-5ML-SPR-MBLK",
    status: "blocked",
    blockers: ["reference-below-minimum-pixels"],
    blockerLane: "technical-reference-resolution",
    canonical: {
      websiteSku: "GBCyl5SpryBlkMatt",
      graceSku: "GB-CYL-CLR-5ML-SPR-MBLK",
      family: "Cylinder",
      productGroupSlug: "cylinder-5ml-clear-13-415-finemist",
      capacityMl: "5",
      canon_bodyHeightMm: "53",
      canon_widthAxisMm: "17",
      canon_secondAxisMm: "17",
      canon_heightWithCapMm: "72",
    },
    reference: {
      filename: "GBCYL5SPRYBLKMATT.png",
      sourceSha256: "a".repeat(64),
      exportSha256: "b".repeat(64),
      width: 600,
      height: 975,
      pixelCount: 585000,
      opaque: true,
      capState: "detached-cap-or-sidecar",
      reviewer: "Jordan Richter",
      reviewedAt: "2026-07-14T00:00:00.000Z",
    },
    ...overrides,
  };
}

function readiness(rows: ReturnType<typeof readinessRow>[]): CylinderRemediationReadinessArtifact {
  return { version: "readiness-v1", rows };
}

describe("Cylinder reference remediation planner", () => {
  it("creates a generation-ready row only from an exact approved identity and matching immutable hashes", () => {
    const plan = buildCylinderReferenceRemediationPlan({
      approval: approval([approvalDecision()]),
      readiness: readiness([readinessRow()]),
    });

    assert.deepEqual(plan.summary, {
      approvedRegenerationCount: 1,
      cylinderRemediationCount: 1,
      reclassifiedToVialCount: 0,
      generationReadyCount: 1,
      geometryBlockedCount: 0,
      lowResolutionAssembledCount: 0,
      lowResolutionDetachedCount: 1,
      highResolutionDetachedCount: 0,
    });
    assert.equal(plan.rows[0].status, "ready-for-remediation-eval");
    assert.equal(plan.rows[0].remediationMode, "assemble-and-regenerate");
    assert.equal(plan.rows[0].sourceReferenceSha256, "b".repeat(64));
    assert.deepEqual(plan.rows[0].targetCanvas, { widthPx: 2080, heightPx: 2288 });
  });

  it("fails closed when the approved PNG hash does not match the readiness evidence", () => {
    assert.throws(() => buildCylinderReferenceRemediationPlan({
      approval: approval([approvalDecision({ outputSha256: "c".repeat(64) })]),
      readiness: readiness([readinessRow()]),
    }), /hash mismatch/i);
  });

  it("accepts a signed detached approval when production readiness intentionally has no assembled reference", () => {
    const plan = buildCylinderReferenceRemediationPlan({
      approval: approval([approvalDecision()]),
      readiness: readiness([readinessRow({ reference: null })]),
    });

    assert.equal(plan.rows[0].status, "ready-for-remediation-eval");
    assert.equal(plan.rows[0].sourceClassification, "detached-cap-or-sidecar");
    assert.equal(plan.rows[0].sourceReferenceSha256, "b".repeat(64));
  });

  it("still requires readiness reference evidence for an assembled low-resolution approval", () => {
    assert.throws(() => buildCylinderReferenceRemediationPlan({
      approval: approval([approvalDecision({ classification: "assembled-cap-on" })]),
      readiness: readiness([readinessRow({ reference: null })]),
    }), /assembled reviewed reference evidence/i);
  });

  it("holds ambiguous canonical geometry instead of borrowing a sibling body", () => {
    const plan = buildCylinderReferenceRemediationPlan({
      approval: approval([approvalDecision()]),
      readiness: readiness([readinessRow({
        blockers: ["ambiguous-canonical-body-geometry", "no-approved-assembled-cap-on-reference"],
        blockerLane: "source-and-geometry",
      })]),
    });

    assert.equal(plan.summary.generationReadyCount, 0);
    assert.equal(plan.summary.geometryBlockedCount, 1);
    assert.equal(plan.rows[0].status, "blocked-canonical-geometry");
    assert.deepEqual(plan.rows[0].blockers, ["ambiguous-canonical-body-geometry"]);
  });

  it("allows the approved 9 mL vial outlier to use explicit assembled-height-only scaling", () => {
    const plan = buildCylinderReferenceRemediationPlan({
      approval: approval([approvalDecision({
        websiteSku: "GB09BlackCapApp",
        graceSku: "GB-CYL-CLR-9ML-T-01",
        classification: "assembled-cap-on",
      })]),
      readiness: readiness([readinessRow({
        websiteSku: "GB09BlackCapApp",
        graceSku: "GB-CYL-CLR-9ML-T-01",
        canonical: {
          websiteSku: "GB09BlackCapApp",
          graceSku: "GB-CYL-CLR-9ML-T-01",
          family: "Cylinder",
          productGroupSlug: "cylinder-9ml-clear-18-400-glasswand",
          capacityMl: "9",
          canon_bodyHeightMm: "79.4",
          canon_widthAxisMm: "20",
          canon_secondAxisMm: "20",
          canon_heightWithCapMm: "50",
        },
        reference: {
          ...readinessRow().reference,
          exportSha256: "b".repeat(64),
          capState: "assembled-cap-on",
        },
      })]),
      geometryOverrides: {
        overrides: [{
          graceSku: "GB-CYL-CLR-9ML-T-01",
          websiteSku: "GB09BlackCapApp",
          bodyHeightMm: null,
          assembledHeightMm: 50,
          widthAxisMm: 20,
          secondAxisMm: 20,
          scaleAuthority: "assembled-height-only",
          source: "Live Best Bottles PDP",
          sourceUrl: "https://www.bestbottles.com/product/Vial-design-9-ml-clear-glass-black-cap-with-glass-rod-applicator",
          note: "The PDP publishes assembled height and diameter but no body-only height.",
        }],
      },
    });

    assert.equal(plan.rows[0].status, "ready-for-remediation-eval");
    assert.deepEqual(plan.rows[0].blockers, []);
    assert.equal(plan.rows[0].scaleAuthority, "assembled-height-only");
    assert.equal(plan.rows[0].canonicalGeometry.bodyHeightMm, null);
    assert.equal(plan.rows[0].canonicalGeometry.assembledHeightMm, 50);
    assert.equal(plan.rows[0].canonicalGeometry.widthAxisMm, 20);
  });

  it("uses an exact live-PDP override to resolve an ambiguous 5 mL body without sibling substitution", () => {
    const plan = buildCylinderReferenceRemediationPlan({
      approval: approval([approvalDecision()]),
      readiness: readiness([readinessRow({
        blockers: ["ambiguous-canonical-body-geometry", "no-approved-assembled-cap-on-reference"],
        blockerLane: "source-and-geometry",
      })]),
      geometryOverrides: {
        overrides: [{
          graceSku: "GB-CYL-CLR-5ML-SPR-MBLK",
          websiteSku: "GBCyl5SpryBlkMatt",
          bodyHeightMm: 53,
          assembledHeightMm: 72,
          widthAxisMm: 17,
          secondAxisMm: 17,
          scaleAuthority: "exact-pdp-override",
          source: "Live Best Bottles PDP",
          sourceUrl: "https://www.bestbottles.com/product/example",
          note: "Exact product page dimensions.",
        }],
      },
    });

    assert.equal(plan.rows[0].status, "ready-for-remediation-eval");
    assert.deepEqual(plan.rows[0].blockers, []);
    assert.equal(plan.rows[0].scaleAuthority, "exact-pdp-override");
    assert.deepEqual(plan.rows[0].canonicalGeometry, {
      bodyHeightMm: 53,
      assembledHeightMm: 72,
      widthAxisMm: 17,
      secondAxisMm: 17,
    });
  });

  it("excludes already-qualified approval rows from the regeneration cohort", () => {
    const plan = buildCylinderReferenceRemediationPlan({
      approval: approval([approvalDecision({ productionDisposition: "production-gate-candidate" })]),
      readiness: readiness([readinessRow()]),
    });

    assert.equal(plan.summary.approvedRegenerationCount, 0);
    assert.deepEqual(plan.rows, []);
  });

  it("reclassifies an exact Vial identity out of the Cylinder remediation cohort", () => {
    const plan = buildCylinderReferenceRemediationPlan({
      approval: approval([approvalDecision({
        websiteSku: "GB09BlackCapApp",
        graceSku: "GB-CYL-CLR-9ML-T-01",
        classification: "assembled-cap-on",
      })]),
      readiness: readiness([readinessRow({
        websiteSku: "GB09BlackCapApp",
        graceSku: "GB-CYL-CLR-9ML-T-01",
      })]),
      taxonomyOverrides: {
        overrides: [{
          graceSku: "GB-CYL-CLR-9ML-T-01",
          websiteSku: "GB09BlackCapApp",
          canonicalFamily: "Vial",
          sourceUrl: "https://www.bestbottles.com/product/example",
          note: "Exact PDP classifies this product as a vial.",
        }],
      },
    });

    assert.equal(plan.summary.approvedRegenerationCount, 1);
    assert.equal(plan.summary.cylinderRemediationCount, 0);
    assert.equal(plan.summary.reclassifiedToVialCount, 1);
    assert.deepEqual(plan.rows, []);
    assert.equal(plan.reclassifiedRows.length, 1);
    assert.equal(plan.reclassifiedRows[0].graceSku, "GB-CYL-CLR-9ML-T-01");
    assert.equal(plan.reclassifiedRows[0].websiteSku, "GB09BlackCapApp");
    assert.equal(plan.reclassifiedRows[0].canonicalFamily, "Vial");
  });

  it("verifies the immutable PSD and approved PNG bytes before a remediation call", async () => {
    const root = await mkdtemp(join(tmpdir(), "bb-remediation-"));
    const psdPath = join(root, "source.psd");
    const pngPath = join(root, "source.png");
    await writeFile(psdPath, "psd-evidence");
    await writeFile(pngPath, "png-evidence");
    const { createHash } = await import("node:crypto");
    const sha = (value: string) => createHash("sha256").update(value).digest("hex");
    const row = {
      ...buildCylinderReferenceRemediationPlan({
        approval: approval([approvalDecision({
          sourcePath: psdPath,
          outputPath: pngPath,
          sourceSha256: sha("psd-evidence"),
          outputSha256: sha("png-evidence"),
        })]),
        readiness: readiness([readinessRow({
          reference: {
            ...readinessRow().reference,
            sourceSha256: sha("psd-evidence"),
            exportSha256: sha("png-evidence"),
          },
        })]),
      }).rows[0],
    };

    const verified = await verifyCylinderRemediationSourceEvidence(row);
    assert.equal(verified.sourcePsdSha256, sha("psd-evidence"));
    assert.equal(verified.sourceReferenceSha256, sha("png-evidence"));
    await writeFile(pngPath, "mutated");
    await assert.rejects(verifyCylinderRemediationSourceEvidence(row), /PNG hash mismatch/i);
  });

  it("selects a deterministic eval set spanning remediation modes and capacities while excluding blockers", () => {
    const base = buildCylinderReferenceRemediationPlan({
      approval: approval([approvalDecision()]),
      readiness: readiness([readinessRow()]),
    }).rows[0];
    const rows = [
      { ...base, graceSku: "SKU-5-ASSEMBLED", capacityMl: 5, remediationMode: "regenerate-native-resolution" as const },
      { ...base, graceSku: "SKU-5-DETACHED", capacityMl: 5, remediationMode: "assemble-and-regenerate" as const },
      { ...base, graceSku: "SKU-9-DETACHED", capacityMl: 9, remediationMode: "assemble-detached" as const },
      { ...base, graceSku: "SKU-28-DETACHED", capacityMl: 28, remediationMode: "assemble-detached" as const },
      { ...base, graceSku: "SKU-50-DETACHED", capacityMl: 50, remediationMode: "assemble-detached" as const },
      { ...base, graceSku: "SKU-100-ASSEMBLED", capacityMl: 100, remediationMode: "regenerate-native-resolution" as const },
      { ...base, graceSku: "SKU-BLOCKED", status: "blocked-canonical-geometry" as const, blockers: ["ambiguous-canonical-body-geometry"] },
    ];

    const selected = selectCylinderReferenceRemediationEval(rows, 6);
    assert.ok(!selected.map((row) => row.graceSku).includes("SKU-BLOCKED"));
    assert.deepEqual(new Set(selected.map((row) => row.remediationMode)), new Set([
      "regenerate-native-resolution",
      "assemble-and-regenerate",
      "assemble-detached",
    ]));
    assert.deepEqual(new Set(selected.map((row) => row.capacityMl)), new Set([5, 9, 28, 50, 100]));
    assert.deepEqual(
      selectCylinderReferenceRemediationEval(rows, 6).map((row) => row.graceSku),
      selected.map((row) => row.graceSku),
    );
  });

  it("builds a content-addressed immutable staging path", () => {
    const row = buildCylinderReferenceRemediationPlan({
      approval: approval([approvalDecision()]),
      readiness: readiness([readinessRow()]),
    }).rows[0];

    assert.equal(cylinderRemediationSourceStoragePath("org-123", row),
      `org-123/best-bottles/reference-remediation/v1/source-evidence/gbcyl5spryblkmatt__gb-cyl-clr-5ml-spr-mblk__${"b".repeat(12)}.png`,
    );
  });
});
