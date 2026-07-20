import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import {
  buildCylinderRecoveryReviewDecisions,
  type CylinderRecoveryApprovalArtifact,
} from "../../src/lib/bestBottlesCylinderRecoveryApproval";
import type { PsdReviewUnit } from "../../src/lib/bestBottlesPsdCapStateAudit";
import type { PsdReviewDecision } from "../../src/lib/bestBottlesPsdReviewDecisions";
import { parsePsdReviewDecisionsCsv } from "./apply-psd-cap-state-review";

const AUDIT_ROOT = "tmp/best-bottles-reference-production/psd-cap-state-audit-v1";
const APPROVAL_PATH = "docs/best-bottles-canonical-truth/best-bottles-cylinder-recovery-approval.json";
const DECISION_COLUMNS = [
  "reviewUnitKey",
  "sourceSha256",
  "websiteSku",
  "graceSku",
  "family",
  "representativePreviewPath",
  "proposedClassification",
  "decision",
  "reviewer",
  "reviewedAt",
  "notes",
] as const;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function csvValue(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(input: {
  decisions: readonly PsdReviewDecision[];
  unitsByKey: ReadonlyMap<string, PsdReviewUnit>;
}): string {
  const rows = input.decisions.map((decision) => {
    const unit = input.unitsByKey.get(decision.reviewUnitKey);
    if (!unit) throw new Error(`Decision ${decision.reviewUnitKey} does not match a current review unit.`);
    const row: Record<(typeof DECISION_COLUMNS)[number], unknown> = {
      reviewUnitKey: decision.reviewUnitKey,
      sourceSha256: decision.sourceSha256,
      websiteSku: unit.websiteSku,
      graceSku: unit.graceSku,
      family: unit.family,
      representativePreviewPath: unit.representative.composite?.previewPath ?? "",
      proposedClassification: unit.representative.machineTriage.proposedClassification,
      decision: decision.decision,
      reviewer: decision.reviewer,
      reviewedAt: decision.reviewedAt,
      notes: decision.notes,
    };
    return DECISION_COLUMNS.map((column) => csvValue(row[column])).join(",");
  });
  return `${DECISION_COLUMNS.join(",")}\n${rows.join("\n")}\n`;
}

async function main(): Promise<void> {
  const auditRoot = resolve(AUDIT_ROOT);
  const reviewUnitsPath = join(auditRoot, "review-units.json");
  const decisionsPath = join(auditRoot, "review-decisions.csv");
  const backupPath = join(auditRoot, "review-decisions.before-cylinder-recovery-approval.csv");
  const approvalPath = resolve(APPROVAL_PATH);
  const reviewUnits = JSON.parse(await readFile(reviewUnitsPath, "utf8")) as PsdReviewUnit[];
  const approval = JSON.parse(await readFile(approvalPath, "utf8")) as CylinderRecoveryApprovalArtifact;
  const existing = parsePsdReviewDecisionsCsv(await readFile(decisionsPath, "utf8"));
  const recovery = buildCylinderRecoveryReviewDecisions({ approval, reviewUnits });
  const byKey = new Map<string, PsdReviewDecision>();
  for (const decision of [...existing, ...recovery]) {
    const previous = byKey.get(decision.reviewUnitKey);
    if (previous && (
      previous.sourceSha256 !== decision.sourceSha256
      || previous.decision !== decision.decision
      || previous.reviewer.trim() !== decision.reviewer.trim()
    )) {
      throw new Error(`Review decision ${decision.reviewUnitKey} has conflicting human outcomes.`);
    }
    byKey.set(decision.reviewUnitKey, previous ?? decision);
  }
  const merged = [...byKey.values()].sort((left, right) => left.reviewUnitKey.localeCompare(right.reviewUnitKey));
  const unitsByKey = new Map(reviewUnits.map((unit) => [unit.reviewUnitKey, unit]));
  if (!(await exists(backupPath))) await copyFile(decisionsPath, backupPath);
  await writeFile(decisionsPath, toCsv({ decisions: merged, unitsByKey }), "utf8");
  process.stdout.write(`${JSON.stringify({
    reviewUnitsPath,
    approvalPath,
    decisionsPath,
    backupPath,
    previousDecisionCount: existing.length,
    recoveryDecisionCount: recovery.length,
    mergedDecisionCount: merged.length,
    externalWriteCount: 0,
    sourceArchiveWriteCount: 0,
    decisionFile: basename(decisionsPath),
  }, null, 2)}\n`);
}

await main();
