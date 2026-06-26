#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  buildBestBottlesLaunchReconciliation,
  type BestBottlesLaunchBlockerRow,
  type BestBottlesLaunchCoverageRow,
  type BestBottlesLaunchReconciliationManifest,
  type BestBottlesLaunchResidualRow,
  type BestBottlesLaunchReferenceManifestRow,
} from "../src/lib/bestBottlesLaunchReconciliation";

const DEFAULT_BEST_BOTTLES_REPO =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const DEFAULT_AUDIT_ROOT = join(
  DEFAULT_BEST_BOTTLES_REPO,
  "data/audits/stage-in-sight-image-sync-2026-06-15",
);
const DEFAULT_OUT_DIR = join(DEFAULT_AUDIT_ROOT, "cleanup");

const DEFAULT_RESIDUAL_CSV = join(
  DEFAULT_AUDIT_ROOT,
  "cleanup/remaining_missing_shopify_variant_images_after_cleanup.csv",
);
const DEFAULT_COVERAGE_JSON = join(
  DEFAULT_AUDIT_ROOT,
  "agent-2/image-generation-coverage/image_generation_coverage.json",
);
const DEFAULT_LOCAL_REFERENCE_JSON = join(
  DEFAULT_AUDIT_ROOT,
  "agent-2/image-generation-coverage/madison_manifest_local_reference.json",
);
const DEFAULT_LEGACY_REFERENCE_JSON = join(
  DEFAULT_AUDIT_ROOT,
  "agent-2/image-generation-coverage/madison_manifest_legacy_reference.json",
);
const DEFAULT_BLOCKER_CSV = join(
  DEFAULT_AUDIT_ROOT,
  "coordinator/product_truth_sku_mapping_blockers.csv",
);

type CsvRow = Record<string, string>;

interface CliArgs {
  residualCsv: string;
  coverageJson: string;
  localReferenceJson: string;
  legacyReferenceJson: string;
  blockerCsv: string;
  outJson: string;
  outCsv: string;
  report: string;
}

function readArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function parseArgs(): CliArgs {
  const outDir = readArg("--out-dir", DEFAULT_OUT_DIR);
  return {
    residualCsv: resolve(readArg("--residual-csv", DEFAULT_RESIDUAL_CSV)),
    coverageJson: resolve(readArg("--coverage-json", DEFAULT_COVERAGE_JSON)),
    localReferenceJson: resolve(readArg("--local-reference-json", DEFAULT_LOCAL_REFERENCE_JSON)),
    legacyReferenceJson: resolve(readArg("--legacy-reference-json", DEFAULT_LEGACY_REFERENCE_JSON)),
    blockerCsv: resolve(readArg("--blocker-csv", DEFAULT_BLOCKER_CSV)),
    outJson: resolve(readArg("--out-json", join(outDir, "launch_image_reconciliation_manifest.json"))),
    outCsv: resolve(readArg("--out-csv", join(outDir, "launch_image_reconciliation_manifest.csv"))),
    report: resolve(readArg("--report", join(outDir, "launch_image_reconciliation_summary.md"))),
  };
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const header = rows.shift() ?? [];
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function readJsonRows<T>(filePath: string): T[] {
  const payload = JSON.parse(readFileSync(filePath, "utf8"));
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload.rows)) return payload.rows as T[];
  throw new Error(`Expected JSON array or payload.rows in ${filePath}`);
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(manifest: BestBottlesLaunchReconciliationManifest): string {
  const headers = [
    "graceSku",
    "websiteSku",
    "product_group_slug",
    "family",
    "action_bucket",
    "reference_source",
    "reference_url_or_path",
    "generated_image_path_or_shopify_cdn_url",
    "shopify_media_id",
    "shopify_variant_id",
    "variant_image_assigned",
    "convex_synced_by_graceSku",
    "qa_status",
    "product_media_count",
    "issue",
    "recommended_next_action",
    "identity_capacity",
    "identity_color",
    "identity_material_bucket",
    "identity_applicator",
    "identity_cap_style",
    "identity_cap_color",
    "identity_item_name",
    "legacy_product_url",
    "notes",
  ] as const;

  const values = manifest.rows.map((row) =>
    [
      row.graceSku,
      row.websiteSku,
      row.productGroupSlug,
      row.family,
      row.actionBucket,
      row.referenceSource,
      row.referenceUrlOrPath,
      row.generatedImagePathOrShopifyCdnUrl,
      row.shopifyMediaId,
      row.shopifyVariantId,
      row.variantImageAssigned,
      row.convexSyncedByGraceSku,
      row.qaStatus,
      row.productMediaCount,
      row.issue,
      row.recommendedNextAction,
      row.identityCapacity,
      row.identityColor,
      row.identityMaterialBucket,
      row.identityApplicator,
      row.identityCapStyle,
      row.identityCapColor,
      row.identityItemName,
      row.legacyProductUrl,
      row.notes,
    ].map(csvEscape).join(","),
  );

  return [headers.join(","), ...values].join("\n");
}

function topFamilies(manifest: BestBottlesLaunchReconciliationManifest): Array<[string, number]> {
  return Object.entries(manifest.summary.byFamily)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20);
}

function actionRows(manifest: BestBottlesLaunchReconciliationManifest): string {
  return Object.entries(manifest.summary.byActionBucket)
    .map(([bucket, count]) => `- \`${bucket}\`: ${count}`)
    .join("\n");
}

function sourceRows(manifest: BestBottlesLaunchReconciliationManifest): string {
  return Object.entries(manifest.summary.byReferenceSource)
    .map(([source, count]) => `- \`${source}\`: ${count}`)
    .join("\n");
}

function writeReport(manifest: BestBottlesLaunchReconciliationManifest): string {
  const bucketFiles = Object.keys(manifest.summary.byActionBucket)
    .map((bucket) => `- \`launch_image_reconciliation_${bucket}.csv\``)
    .join("\n");
  const familyTable = topFamilies(manifest)
    .map(([family, count]) => `| ${family} | ${count} |`)
    .join("\n");
  const blockedExamples = manifest.rows
    .filter((row) => row.actionBucket === "blocked_truth_review")
    .slice(0, 20)
    .map((row) => `| ${row.graceSku} | ${row.family ?? ""} | ${row.productGroupSlug ?? ""} | ${row.notes} |`)
    .join("\n");

  return `# Best Bottles Launch Image Reconciliation

Generated: ${manifest.generatedAt}

## Summary

- Residual rows: ${manifest.summary.totalRows}
- No Shopify product media: ${manifest.summary.noProductMedia}
- Shopify product media present: ${manifest.summary.productMediaPresent}
- Duplicate websiteSku keys retained by Grace SKU: ${manifest.summary.duplicateWebsiteSkuKeys}
- Needs visual review before mutation: ${manifest.summary.needsVisualReview}
- Blocked truth review rows: ${manifest.summary.blockedTruthReview}

## Action Buckets

${actionRows(manifest)}

## Queue Files

${bucketFiles}

## Reference Sources

${sourceRows(manifest)}

## Largest Families

| Family | Rows |
| --- | ---: |
${familyTable}

## Blocked Examples

| graceSku | Family | Product group | Notes |
| --- | --- | --- | --- |
${blockedExamples || "|  |  |  | None |"}

## Guardrails

- Use \`graceSku\` as the operational key for Shopify assignment and Convex sync.
- Do not patch by \`websiteSku\` alone.
- Rows with \`qa_status = needs_visual_review\` are not mutation-ready until visual/product identity review passes.
- Legacy BestBottles URLs are evidence only; generate Madison catalog images before launch assignment unless an exact generated/CDN asset is verified.
`;
}

function ensureParent(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

const args = parseArgs();
const residualRows = parseCsv(readFileSync(args.residualCsv, "utf8")) as BestBottlesLaunchResidualRow[];
const blockerRows = parseCsv(readFileSync(args.blockerCsv, "utf8")) as BestBottlesLaunchBlockerRow[];
const coverageRows = readJsonRows<BestBottlesLaunchCoverageRow>(args.coverageJson);
const localReferenceRows = readJsonRows<BestBottlesLaunchReferenceManifestRow>(args.localReferenceJson);
const legacyReferenceRows = readJsonRows<BestBottlesLaunchReferenceManifestRow>(args.legacyReferenceJson);

const manifest = buildBestBottlesLaunchReconciliation({
  residualRows,
  coverageRows,
  localReferenceRows,
  legacyReferenceRows,
  blockerRows,
  source: {
    residualCsv: args.residualCsv,
    coverageManifest: args.coverageJson,
    localReferenceManifest: args.localReferenceJson,
    legacyReferenceManifest: args.legacyReferenceJson,
    blockerCsv: args.blockerCsv,
  },
});

ensureParent(args.outJson);
ensureParent(args.outCsv);
ensureParent(args.report);
writeFileSync(args.outJson, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(args.outCsv, `${toCsv(manifest)}\n`);
writeFileSync(args.report, writeReport(manifest));

for (const bucket of Object.keys(manifest.summary.byActionBucket)) {
  const bucketManifest: BestBottlesLaunchReconciliationManifest = {
    ...manifest,
    rows: manifest.rows.filter((row) => row.actionBucket === bucket),
  };
  const bucketPath = join(dirname(args.outCsv), `launch_image_reconciliation_${bucket}.csv`);
  writeFileSync(bucketPath, `${toCsv(bucketManifest)}\n`);
}

console.log(`Launch reconciliation rows: ${manifest.summary.totalRows}`);
console.log(
  Object.entries(manifest.summary.byActionBucket)
    .map(([bucket, count]) => `${bucket}: ${count}`)
    .join(" · "),
);
console.log(`Wrote ${args.outJson}`);
console.log(`Wrote ${args.outCsv}`);
console.log(`Wrote ${args.report}`);
