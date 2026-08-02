#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

type Disposition =
  | "already_live"
  | "ready_to_push"
  | "ready_to_review_existing_generation"
  | "ready_to_generate"
  | "ready_to_generate_pending_shopify_preflight"
  | "needs_reference"
  | "needs_canonical_copy_review"
  | "needs_shopify_mapping"
  | "legacy_catalog_only";

type WorkflowLane =
  | "quarantine_or_exclude"
  | "needs_sku_key_correction"
  | "needs_shopify_mapping"
  | "needs_reference"
  | "needs_canonical_reference_choice"
  | "approved_reference_needs_regeneration"
  | "approved_unknown_needs_provenance_review"
  | "ready_to_generate_after_shopify_preflight"
  | "ready_to_generate"
  | "generated_needs_visual_review"
  | "approved_generated_ready_to_push"
  | "live_needs_convex_sync"
  | "live_needs_provenance_spot_check"
  | "complete_generated";

interface AuditInput {
  generatedAt?: string;
  dryRun?: boolean;
  summary?: Record<string, unknown>;
  rows: AuditRow[];
}

interface AuditRow {
  disposition: Disposition;
  nextAction: string;
  graceSku: string;
  websiteSku: string | null;
  family: string | null;
  productGroupSlug: string | null;
  productGroupDisplayName: string | null;
  capacityMl: string | null;
  applicator: string | null;
  color: string | null;
  capStyle: string | null;
  capColor: string | null;
  catalogProductId: string | null;
  catalogStockStatus: string | null;
  presentInCatalog: boolean;
  presentInPipeline: boolean;
  presentInSupabase: boolean;
  hasReference: boolean;
  readinessStatus: string | null;
  readinessIssues: string[];
  renderStatus: string | null;
  proposedSourcePath: string | null;
  generatedCandidateCount: number;
  reviewCandidateCount: number;
  shopifyReadyCount: number;
  hasGeneratedImage: boolean;
  generatedImageId: string | null;
  generatedImageProvenanceKind: string | null;
  generatedImageProvenanceLabel: string | null;
  generatedImageIsRegenerated: boolean;
  generatedImageIsReferenceLike: boolean;
  hasApprovedImage: boolean;
  approvedImageId: string | null;
  approvedImageProvenanceKind: string | null;
  approvedImageProvenanceLabel: string | null;
  approvedImageIsRegenerated: boolean;
  approvedImageIsReferenceLike: boolean;
  hasShopifyProductId: boolean;
  hasShopifyVariantId: boolean;
  hasShopifyMediaId: boolean;
  hasShopifyCdnUrl: boolean;
  convexSynced: boolean;
  lastError: string | null;
}

interface WorkflowRow extends AuditRow {
  sequenceOrder: number;
  workflowLane: WorkflowLane;
  gate: string;
  laneLabel: string;
  recommendedNextAction: string;
  riskFlags: string[];
  skuNamingState: string;
  sourceFilenameSku: string | null;
  sourceCapState: "cap-on" | "cap-off" | null;
}

interface WorkflowPayload {
  generatedAt: string;
  source: {
    inputAudit: string;
    inputGeneratedAt: string | null;
    inputDryRun: boolean | null;
  };
  policy: {
    masterCanvas: string;
    skuFilenameConvention: string;
    capStateConvention: string;
    pushGate: string;
  };
  summary: {
    totalRows: number;
    byWorkflowLane: Record<WorkflowLane, number>;
    byFamily: Record<string, number>;
    cleanGeneratedComplete: number;
    liveNeedsProvenanceSpotCheck: number;
    approvedGeneratedReadyToPush: number;
    referenceImportsNeedingRegeneration: number;
    readyToGenerateNow: number;
    readyToGenerateAfterShopifyPreflight: number;
    sourceCleanupBlockers: number;
    skuKeyCorrectionBlockers: number;
    nonCanonicalGraceSkuKeys: number;
  };
  rows: WorkflowRow[];
}

const ROOT = process.cwd();
const DEFAULT_INPUT = "tmp/best-bottles-cylinder-generation-audit.json";
const DEFAULT_OUT_JSON = "tmp/best-bottles-family-workflow-sequence-cylinder.json";
const DEFAULT_OUT_CSV = "tmp/best-bottles-family-workflow-sequence-cylinder.csv";
const DEFAULT_REPORT = "docs/best-bottles-family-workflow-sequence-cylinder.md";

const LANE_CONFIG: Record<
  WorkflowLane,
  {
    order: number;
    gate: string;
    label: string;
    nextAction: string;
  }
> = {
  quarantine_or_exclude: {
    order: 1,
    gate: "blocked",
    label: "Quarantine / exclude",
    nextAction: "Do not generate or push until the row is confirmed in Convex and Shopify truth.",
  },
  needs_sku_key_correction: {
    order: 2,
    gate: "blocked",
    label: "Needs SKU key correction",
    nextAction: "Replace website-style or invented SKU keys with the canonical Convex/Grace SKU before generation or push.",
  },
  needs_shopify_mapping: {
    order: 3,
    gate: "blocked",
    label: "Needs Shopify mapping",
    nextAction: "Resolve Shopify product and variant IDs before any push can be trusted.",
  },
  needs_reference: {
    order: 4,
    gate: "blocked",
    label: "Needs clean reference",
    nextAction: "Create or attach a clean background-removed reference named exactly by Grace SKU.",
  },
  needs_canonical_reference_choice: {
    order: 5,
    gate: "blocked",
    label: "Needs canonical reference choice",
    nextAction: "Pick the exact source image, rename it to the Grace SKU, and store it in the cap-on or cap-off path.",
  },
  approved_reference_needs_regeneration: {
    order: 6,
    gate: "blocked_for_push",
    label: "Approved reference needs regeneration",
    nextAction:
      "Treat the approved keeper/reference import as source material only; regenerate and post-process a final rigged master before push.",
  },
  approved_unknown_needs_provenance_review: {
    order: 7,
    gate: "manual_review",
    label: "Approved unknown provenance",
    nextAction: "Identify whether the approved asset is a generated master or a reference import before using it for Shopify.",
  },
  ready_to_generate_after_shopify_preflight: {
    order: 8,
    gate: "preflight",
    label: "Ready after Shopify preflight",
    nextAction: "Backfill or verify Shopify product and variant mapping, then generate with the Madison rig.",
  },
  ready_to_generate: {
    order: 9,
    gate: "generation_eligible",
    label: "Ready to generate",
    nextAction: "Generate with GPT Image 2 using the clean reference and deterministic Madison rig.",
  },
  generated_needs_visual_review: {
    order: 10,
    gate: "visual_qa",
    label: "Generated needs visual QA",
    nextAction: "Approve only if identity, cap state, material, baseline, canvas, and brand style all pass.",
  },
  approved_generated_ready_to_push: {
    order: 11,
    gate: "push_eligible_after_visual_approval",
    label: "Approved generated push-eligible",
    nextAction:
      "Push to Shopify by Grace SKU only after the visual approval gate confirms PDP alignment, brand fit, canvas, and product identity.",
  },
  live_needs_convex_sync: {
    order: 12,
    gate: "sync_required",
    label: "Live needs Convex sync",
    nextAction: "Shopify has media; mirror the Shopify CDN URL and media IDs back into Convex.",
  },
  live_needs_provenance_spot_check: {
    order: 13,
    gate: "spot_check",
    label: "Live unknown provenance",
    nextAction:
      "Spot-check the live Shopify image; replace it if it is off-brand, a reference import, or not a final Madison master.",
  },
  complete_generated: {
    order: 14,
    gate: "complete",
    label: "Complete generated master",
    nextAction: "No generation needed; keep in spot-check pool for launch QA.",
  },
};

function getArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return fallback;
  return value;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, filePath), "utf8")) as T;
}

function ensureParent(filePath: string): void {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, filePath)), { recursive: true });
}

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    },
    {} as Record<T, number>,
  );
}

function hasTextMatch(row: AuditRow, pattern: RegExp): boolean {
  return [
    row.generatedImageProvenanceKind,
    row.generatedImageProvenanceLabel,
    row.approvedImageProvenanceKind,
    row.approvedImageProvenanceLabel,
  ].some((value) => pattern.test(value ?? ""));
}

function hasRegeneratedApprovedAsset(row: AuditRow): boolean {
  return row.approvedImageIsRegenerated || row.generatedImageIsRegenerated || hasTextMatch(row, /generated output/i);
}

function hasReferenceLikeApprovedAsset(row: AuditRow): boolean {
  return (
    row.approvedImageIsReferenceLike ||
    row.generatedImageIsReferenceLike ||
    hasTextMatch(row, /keeper|reference|import|backfill/i)
  );
}

function classifyLane(row: AuditRow): WorkflowLane {
  if (row.disposition === "legacy_catalog_only") return "quarantine_or_exclude";
  if (!isCanonicalGraceSku(row.graceSku)) return "needs_sku_key_correction";
  if (row.disposition === "needs_shopify_mapping") return "needs_shopify_mapping";

  if (row.hasShopifyCdnUrl) {
    if (!row.convexSynced) return "live_needs_convex_sync";
    return hasRegeneratedApprovedAsset(row) ? "complete_generated" : "live_needs_provenance_spot_check";
  }

  if (row.disposition === "ready_to_push") {
    if (hasRegeneratedApprovedAsset(row)) return "approved_generated_ready_to_push";
    if (hasReferenceLikeApprovedAsset(row)) return "approved_reference_needs_regeneration";
    return "approved_unknown_needs_provenance_review";
  }

  if (row.disposition === "ready_to_review_existing_generation" || row.hasGeneratedImage) {
    return "generated_needs_visual_review";
  }

  if (row.disposition === "ready_to_generate_pending_shopify_preflight") {
    return "ready_to_generate_after_shopify_preflight";
  }
  if (row.disposition === "ready_to_generate") return "ready_to_generate";
  if (row.disposition === "needs_canonical_copy_review") return "needs_canonical_reference_choice";
  if (row.disposition === "needs_reference") return "needs_reference";

  return "quarantine_or_exclude";
}

function sourceFilenameSku(row: AuditRow): string | null {
  if (!row.proposedSourcePath) return null;
  return path.basename(row.proposedSourcePath).replace(/\.[^.]+$/, "") || null;
}

function sourceCapState(row: AuditRow): "cap-on" | "cap-off" | null {
  if (!row.proposedSourcePath) return null;
  if (/(^|\/)cap-on(\/|$)/i.test(row.proposedSourcePath)) return "cap-on";
  if (/(^|\/)cap-off(\/|$)/i.test(row.proposedSourcePath)) return "cap-off";
  return null;
}

function isCanonicalGraceSku(value: string | null | undefined): boolean {
  return /^[A-Z]{2}-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(value?.trim() ?? "");
}

function skuNamingState(row: AuditRow, filenameSku: string | null): string {
  if (!row.graceSku?.trim()) return "missing_grace_sku";
  if (!isCanonicalGraceSku(row.graceSku)) return "non_canonical_grace_sku_format";
  if (!row.websiteSku?.trim()) return "missing_website_sku";
  if (!filenameSku) return "no_source_filename";
  if (filenameSku.toUpperCase() !== row.graceSku.toUpperCase()) return "source_filename_mismatch";
  return "grace_filename_aligned";
}

function riskFlags(row: AuditRow, lane: WorkflowLane, namingState: string, capState: string | null): string[] {
  const flags = new Set<string>();
  if (!row.hasReference) flags.add("no_reference");
  if (!row.hasShopifyProductId) flags.add("missing_shopify_product_id");
  if (!row.hasShopifyVariantId) flags.add("missing_shopify_variant_id");
  if (row.lastError) flags.add("last_error");
  if (namingState !== "grace_filename_aligned") flags.add(namingState);
  if (!capState && row.proposedSourcePath) flags.add("missing_cap_state_folder");
  if (lane === "approved_reference_needs_regeneration") flags.add("reference_import_not_final_master");
  if (lane === "live_needs_provenance_spot_check") flags.add("live_image_unknown_provenance");
  if (lane === "live_needs_convex_sync") flags.add("convex_not_synced");
  if (lane === "needs_canonical_reference_choice") flags.add("canonical_reference_unresolved");
  return [...flags];
}

function toWorkflowRow(row: AuditRow): WorkflowRow {
  const workflowLane = classifyLane(row);
  const config = LANE_CONFIG[workflowLane];
  const filenameSku = sourceFilenameSku(row);
  const capState = sourceCapState(row);
  const namingState = skuNamingState(row, filenameSku);

  return {
    ...row,
    sequenceOrder: config.order,
    workflowLane,
    gate: config.gate,
    laneLabel: config.label,
    recommendedNextAction: config.nextAction,
    riskFlags: riskFlags(row, workflowLane, namingState, capState),
    skuNamingState: namingState,
    sourceFilenameSku: filenameSku,
    sourceCapState: capState,
  };
}

function sortRows(rows: WorkflowRow[]): WorkflowRow[] {
  return rows.sort((a, b) => {
    const orderDelta = a.sequenceOrder - b.sequenceOrder;
    if (orderDelta) return orderDelta;
    const familyDelta = (a.family ?? "").localeCompare(b.family ?? "");
    if (familyDelta) return familyDelta;
    const capacityDelta = Number(a.capacityMl ?? 0) - Number(b.capacityMl ?? 0);
    if (capacityDelta) return capacityDelta;
    const groupDelta = (a.productGroupSlug ?? "").localeCompare(b.productGroupSlug ?? "");
    if (groupDelta) return groupDelta;
    return a.graceSku.localeCompare(b.graceSku);
  });
}

function toCsv(rows: WorkflowRow[]): string {
  const headers: Array<keyof WorkflowRow> = [
    "sequenceOrder",
    "workflowLane",
    "gate",
    "laneLabel",
    "recommendedNextAction",
    "riskFlags",
    "skuNamingState",
    "sourceFilenameSku",
    "sourceCapState",
    "graceSku",
    "websiteSku",
    "family",
    "productGroupSlug",
    "productGroupDisplayName",
    "capacityMl",
    "applicator",
    "color",
    "capStyle",
    "capColor",
    "disposition",
    "hasReference",
    "proposedSourcePath",
    "approvedImageProvenanceKind",
    "approvedImageProvenanceLabel",
    "approvedImageIsRegenerated",
    "approvedImageIsReferenceLike",
    "hasShopifyProductId",
    "hasShopifyVariantId",
    "hasShopifyMediaId",
    "hasShopifyCdnUrl",
    "convexSynced",
    "lastError",
  ];

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function markdownTable(rows: Array<Array<string | number>>): string {
  const header = rows[0];
  const body = rows.slice(1);
  return [
    `| ${header.join(" |")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function buildSummary(rows: WorkflowRow[]): WorkflowPayload["summary"] {
  const byWorkflowLane = countBy(rows.map((row) => row.workflowLane));
  const byFamily = countBy(rows.map((row) => row.family ?? "Unknown"));

  for (const lane of Object.keys(LANE_CONFIG) as WorkflowLane[]) {
    byWorkflowLane[lane] = byWorkflowLane[lane] ?? 0;
  }

  return {
    totalRows: rows.length,
    byWorkflowLane,
    byFamily,
    cleanGeneratedComplete: byWorkflowLane.complete_generated,
    liveNeedsProvenanceSpotCheck: byWorkflowLane.live_needs_provenance_spot_check,
    approvedGeneratedReadyToPush: byWorkflowLane.approved_generated_ready_to_push,
    referenceImportsNeedingRegeneration: byWorkflowLane.approved_reference_needs_regeneration,
    readyToGenerateNow: byWorkflowLane.ready_to_generate,
    readyToGenerateAfterShopifyPreflight: byWorkflowLane.ready_to_generate_after_shopify_preflight,
    sourceCleanupBlockers:
      byWorkflowLane.needs_sku_key_correction +
      byWorkflowLane.needs_reference +
      byWorkflowLane.needs_canonical_reference_choice +
      byWorkflowLane.approved_reference_needs_regeneration +
      byWorkflowLane.approved_unknown_needs_provenance_review,
    skuKeyCorrectionBlockers: byWorkflowLane.needs_sku_key_correction,
    nonCanonicalGraceSkuKeys: rows.filter((row) => row.skuNamingState === "non_canonical_grace_sku_format").length,
  };
}

function buildReport(payload: WorkflowPayload, outJson: string, outCsv: string): string {
  const laneRows = (Object.keys(LANE_CONFIG) as WorkflowLane[]).map((lane) => {
    const config = LANE_CONFIG[lane];
    return [config.order, config.label, payload.summary.byWorkflowLane[lane] ?? 0, config.gate, config.nextAction];
  });

  const sampleRows = payload.rows.slice(0, 20).map((row) => [
    row.sequenceOrder,
    row.laneLabel,
    row.graceSku,
    row.websiteSku ?? "",
    row.productGroupSlug ?? "",
    row.riskFlags.join("; "),
  ]);

  return `# Best Bottles Family Workflow Sequence - Cylinder

Generated: ${payload.generatedAt}
Source audit: \`${payload.source.inputAudit}\`
Outputs: \`${outJson}\`, \`${outCsv}\`

## Operating Decision

Do not resume mass Cylinder generation from the mixed library state. The family should move through a sequenced cleanup queue first: fix references and naming, regenerate from clean references where needed, visually approve only final rigged masters, then push to Shopify by Grace SKU and reconcile Convex from the returned Shopify CDN URL.

## Current Readout

- Total Cylinder/Tall Cylinder rows: ${payload.summary.totalRows}
- Complete live generated masters: ${payload.summary.cleanGeneratedComplete}
- Live Shopify/Convex rows with unknown image provenance requiring spot check: ${payload.summary.liveNeedsProvenanceSpotCheck}
- Approved generated masters push-eligible after visual approval: ${payload.summary.approvedGeneratedReadyToPush}
- Approved keeper/reference imports that are not automatically push-eligible final masters: ${payload.summary.referenceImportsNeedingRegeneration}
- Ready to generate now: ${payload.summary.readyToGenerateNow}
- Ready to generate after Shopify preflight: ${payload.summary.readyToGenerateAfterShopifyPreflight}
- Source cleanup blockers before clean family completion: ${payload.summary.sourceCleanupBlockers}
- SKU key correction blockers: ${payload.summary.skuKeyCorrectionBlockers}
- Rows where the \`graceSku\` key is not in canonical Convex/Grace SKU format: ${payload.summary.nonCanonicalGraceSkuKeys}

## Lane Sequence

${markdownTable([["Order", "Lane", "Rows", "Gate", "Next action"], ...laneRows])}

## Visual Approval Gate

Push eligibility is not a purely mechanical judgment. A generated or already-live image can move forward only after a reviewer confirms:

- PDP alignment: product centered on the vertical centerline, stable baseline, no drift, no crop, cap-off compositions show the cap beside the bottle.
- Brand fit: high-end editorial product photography, clean bone background, soft drop shadow, believable glass backlight, no clutter or props.
- Canvas contract: final master is \`2080 x 2288\`, uses the Madison rig, and is ready for downstream Shopify/staging display.
- Product truth: the image does not change the intended object, dimensions, glass color, finish, applicator, cap, reducer, tassel, collar, hose, ring, or other SKU-specific characteristics.
- Output quality: no warped geometry, hallucinated labels, damaged transparency, jagged edges, muddy reflections, incorrect shadow, or low-resolution artifacts.

## Naming Contract

- Canonical source and generated master filename: \`{graceSku}.png\`.
- Cap state is a folder/state, not a third product state: only \`cap-on\` or \`cap-off\`.
- \`cap-off\` means the cap is off the bottle and visible beside it.
- Shopify writes must use the Convex/Grace SKU mapping plus Shopify product and variant IDs; generated ad hoc names are not write keys.
- Reference imports are allowed as source truth, but they are not final Madison masters until regenerated or explicitly approved as an exception.

## First 20 Queue Rows

${markdownTable([["Order", "Lane", "Grace SKU", "Website SKU", "Product group", "Risk flags"], ...sampleRows])}
`;
}

function main(): void {
  const input = getArg("--input", DEFAULT_INPUT);
  const outJson = getArg("--out-json", DEFAULT_OUT_JSON);
  const outCsv = getArg("--out-csv", DEFAULT_OUT_CSV);
  const report = getArg("--report", DEFAULT_REPORT);
  const audit = readJson<AuditInput>(input);
  const rows = sortRows(audit.rows.map(toWorkflowRow));
  const payload: WorkflowPayload = {
    generatedAt: new Date().toISOString(),
    source: {
      inputAudit: input,
      inputGeneratedAt: audit.generatedAt ?? null,
      inputDryRun: audit.dryRun ?? null,
    },
    policy: {
      masterCanvas: "2080x2288",
      skuFilenameConvention: "{graceSku}.png",
      capStateConvention: "cap-on or cap-off only",
      pushGate:
        "Generated/post-processed Madison masters are push-eligible only after visual approval confirms PDP alignment, brand fit, canvas, output quality, and product truth.",
    },
    summary: buildSummary(rows),
    rows,
  };

  ensureParent(outJson);
  ensureParent(outCsv);
  ensureParent(report);
  fs.writeFileSync(path.resolve(ROOT, outJson), `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(path.resolve(ROOT, outCsv), `${toCsv(rows)}\n`);
  fs.writeFileSync(path.resolve(ROOT, report), buildReport(payload, outJson, outCsv));

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outCsv}`);
  console.log(`Wrote ${report}`);
  console.log(JSON.stringify(payload.summary, null, 2));
}

main();
