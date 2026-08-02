#!/usr/bin/env tsx
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCylinderReferenceRemediationPlan,
  selectCylinderReferenceRemediationEval,
  verifyCylinderRemediationSourceEvidence,
  type CylinderRecoveryApprovalArtifact,
  type CylinderRemediationGeometryOverridesArtifact,
  type CylinderRemediationReadinessArtifact,
  type CylinderRemediationTaxonomyOverridesArtifact,
} from "../../src/lib/bestBottlesCylinderReferenceRemediation";

const root = process.cwd();
const approvalPath = path.resolve(
  root,
  "docs/best-bottles-canonical-truth/best-bottles-cylinder-recovery-approval.json",
);
const overridesPath = path.resolve(
  root,
  "docs/best-bottles-canonical-truth/best-bottles-cylinder-remediation-geometry-overrides.json",
);
const readinessPath = path.resolve(
  root,
  "public/data/best-bottles-cylinder-production-readiness.json",
);
const taxonomyOverridesPath = path.resolve(
  root,
  "docs/best-bottles-canonical-truth/best-bottles-family-taxonomy-overrides.json",
);
const outputRoot = path.resolve(
  root,
  "tmp/best-bottles-reference-production/cylinder-reference-remediation-v1",
);

function csv(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

const [approval, overrides, readiness, taxonomyOverrides] = await Promise.all([
  readFile(approvalPath, "utf8").then((value) => JSON.parse(value) as CylinderRecoveryApprovalArtifact),
  readFile(overridesPath, "utf8").then((value) => JSON.parse(value) as CylinderRemediationGeometryOverridesArtifact),
  readFile(readinessPath, "utf8").then((value) => JSON.parse(value) as CylinderRemediationReadinessArtifact),
  readFile(taxonomyOverridesPath, "utf8").then((value) => JSON.parse(value) as CylinderRemediationTaxonomyOverridesArtifact),
]);
const plan = buildCylinderReferenceRemediationPlan({
  approval,
  readiness,
  geometryOverrides: overrides,
  taxonomyOverrides,
});

const evidenceResults = await Promise.allSettled(
  plan.rows.map((row) => verifyCylinderRemediationSourceEvidence(row)),
);
const failures = evidenceResults.flatMap((result, index) =>
  result.status === "rejected"
    ? [{ graceSku: plan.rows[index].graceSku, error: String(result.reason) }]
    : [],
);
if (failures.length > 0) {
  throw new Error(`Cylinder remediation evidence preflight failed: ${JSON.stringify(failures.slice(0, 10))}`);
}

const evalRows = selectCylinderReferenceRemediationEval(plan.rows, 8);
const artifact = {
  ...plan,
  evidencePreflight: {
    verifiedCount: plan.rows.length,
    failureCount: failures.length,
  },
  representativeEval: {
    count: evalRows.length,
    graceSkus: evalRows.map((row) => row.graceSku),
    rows: evalRows,
  },
};
const csvRows = [
  [
    "websiteSku",
    "graceSku",
    "status",
    "remediationMode",
    "capacityMl",
    "bodyHeightMm",
    "assembledHeightMm",
    "widthAxisMm",
    "secondAxisMm",
    "scaleAuthority",
    "sourceDimensions",
    "sourceReferenceSha256",
    "sourceReferencePath",
    "blockers",
  ].map(csv).join(","),
  ...plan.rows.map((row) => [
    row.websiteSku,
    row.graceSku,
    row.status,
    row.remediationMode,
    row.capacityMl,
    row.canonicalGeometry.bodyHeightMm,
    row.canonicalGeometry.assembledHeightMm,
    row.canonicalGeometry.widthAxisMm,
    row.canonicalGeometry.secondAxisMm,
    row.scaleAuthority,
    `${row.sourceDimensions.widthPx}x${row.sourceDimensions.heightPx}`,
    row.sourceReferenceSha256,
    row.sourceReferencePath,
    row.blockers.join("|"),
  ].map(csv).join(",")),
];

await mkdir(outputRoot, { recursive: true });
await Promise.all([
  writeFile(path.join(outputRoot, "cylinder-reference-remediation-plan.json"), `${JSON.stringify(artifact, null, 2)}\n`),
  writeFile(path.join(outputRoot, "cylinder-reference-remediation-plan.csv"), `${csvRows.join("\n")}\n`),
]);

console.log(JSON.stringify({
  outputRoot,
  planSha256: plan.sha256,
  summary: plan.summary,
  evidencePreflight: artifact.evidencePreflight,
  representativeEval: artifact.representativeEval.graceSkus,
}, null, 2));
