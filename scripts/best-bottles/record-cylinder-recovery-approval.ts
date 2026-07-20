import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  buildCylinderRecoveryApproval,
  type CylinderAliasRecoveryExport,
  type CylinderExactRecoveryExport,
  type CylinderRecoveryApprovalSheet,
} from "../../src/lib/bestBottlesCylinderRecoveryApproval";
import type { ReviewedPsdAlias } from "../../src/lib/bestBottlesPsdIdentityJoin";

const EXACT_MANIFEST = "tmp/best-bottles-reference-production/cylinder-blocked-recovery-v1/cylinder-blocked-recovery.json";
const ALIAS_MANIFEST = "tmp/best-bottles-reference-production/cylinder-blocked-recovery-v1/deep-archive-reconciliation/review-sheets/cylinder-semantic-alias-review-manifest.json";
const APPROVAL_OUTPUT = "docs/best-bottles-canonical-truth/best-bottles-cylinder-recovery-approval.json";
const ALIAS_OUTPUT = "docs/best-bottles-canonical-truth/best-bottles-psd-reviewed-aliases.json";
const APPROVAL_STATEMENT = "All of these sheets and images are accurate and ready to go.";

const SHEETS: Array<{ cohort: CylinderRecoveryApprovalSheet["cohort"]; path: string }> = [{
  cohort: "exact-high-resolution",
  path: "tmp/best-bottles-reference-production/cylinder-blocked-recovery-v1/cylinder-high-resolution-recovery-review-sheet.png",
}, {
  cohort: "exact-low-resolution",
  path: "tmp/best-bottles-reference-production/cylinder-blocked-recovery-v1/cylinder-low-resolution-exact-reference-review-sheet.png",
}, {
  cohort: "legacy-alias-high-resolution",
  path: "tmp/best-bottles-reference-production/cylinder-blocked-recovery-v1/deep-archive-reconciliation/review-sheets/cylinder-legacy-alias-high-resolution-review-sheet.png",
}, {
  cohort: "legacy-alias-low-resolution",
  path: "tmp/best-bottles-reference-production/cylinder-blocked-recovery-v1/deep-archive-reconciliation/review-sheets/cylinder-legacy-alias-low-resolution-review-sheet.png",
}];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function normalized(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function loadExistingAliases(path: string): Promise<ReviewedPsdAlias[]> {
  if (!(await exists(path))) return [];
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  const aliases = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { aliases?: unknown }).aliases)
      ? (parsed as { aliases: unknown[] }).aliases
      : null;
  if (aliases === null) throw new Error("Existing reviewed alias file has an invalid shape.");
  return aliases as ReviewedPsdAlias[];
}

function mergeAliases(existing: readonly ReviewedPsdAlias[], approved: readonly ReviewedPsdAlias[]): ReviewedPsdAlias[] {
  const byToken = new Map<string, ReviewedPsdAlias>();
  for (const alias of [...existing, ...approved]) {
    const token = normalized(alias.sourceToken);
    const previous = byToken.get(token);
    if (previous && (
      normalized(previous.websiteSku) !== normalized(alias.websiteSku)
      || normalized(previous.graceSku) !== normalized(alias.graceSku)
    )) {
      throw new Error(`Reviewed alias token ${alias.sourceToken} has conflicting canonical targets.`);
    }
    byToken.set(token, previous ?? alias);
  }
  return [...byToken.values()].sort((left, right) => (
    left.sourceToken.localeCompare(right.sourceToken)
    || left.websiteSku.localeCompare(right.websiteSku)
    || left.graceSku.localeCompare(right.graceSku)
  ));
}

async function main(): Promise<void> {
  const exactManifestPath = resolve(EXACT_MANIFEST);
  const aliasManifestPath = resolve(ALIAS_MANIFEST);
  const approvalOutputPath = resolve(APPROVAL_OUTPUT);
  const aliasOutputPath = resolve(ALIAS_OUTPUT);
  const exactManifest = JSON.parse(await readFile(exactManifestPath, "utf8")) as {
    minimumPixels: number;
    reviewExports: CylinderExactRecoveryExport[];
  };
  const aliasManifest = JSON.parse(await readFile(aliasManifestPath, "utf8")) as {
    minimumPixels: number;
    exports: CylinderAliasRecoveryExport[];
  };
  if (exactManifest.minimumPixels !== aliasManifest.minimumPixels) {
    throw new Error("Exact and alias recovery manifests use different minimum pixel gates.");
  }
  const sheets = await Promise.all(SHEETS.map(async (sheet): Promise<CylinderRecoveryApprovalSheet> => {
    const path = resolve(sheet.path);
    return { cohort: sheet.cohort, path, sha256: await sha256(path) };
  }));
  const approval = buildCylinderRecoveryApproval({
    reviewer: "Jordan Richter",
    reviewedAt: new Date().toISOString(),
    approvalStatement: APPROVAL_STATEMENT,
    minimumPixels: exactManifest.minimumPixels,
    sheets,
    exactExports: exactManifest.reviewExports,
    aliasExports: aliasManifest.exports,
  });
  const aliases = mergeAliases(await loadExistingAliases(aliasOutputPath), approval.aliases);
  await Promise.all([
    mkdir(dirname(approvalOutputPath), { recursive: true }),
    mkdir(dirname(aliasOutputPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(approvalOutputPath, `${JSON.stringify(approval, null, 2)}\n`, "utf8"),
    writeFile(aliasOutputPath, `${JSON.stringify({
      version: "best-bottles-reviewed-psd-aliases-v1",
      aliases,
    }, null, 2)}\n`, "utf8"),
  ]);
  process.stdout.write(`${JSON.stringify({
    approvalOutputPath,
    aliasOutputPath,
    summary: approval.summary,
    sheetHashes: Object.fromEntries(sheets.map((sheet) => [sheet.cohort, sheet.sha256])),
    mergedAliasCount: aliases.length,
    externalWriteCount: 0,
  }, null, 2)}\n`);
}

await main();
