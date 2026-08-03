import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = path.join(workspaceRoot, "docs/paper-doll-rig/master-plate-shot-list.json");
const geometryReviewPath = path.join(workspaceRoot, "docs/paper-doll-rig/component-geometry-review-groups.json");
const sourceReviewPath = path.join(workspaceRoot, "docs/paper-doll-rig/component-source-review-summary.json");
const physicalReviewDecisionsPath = path.join(workspaceRoot, "docs/paper-doll-rig/component-physical-review-decisions.json");
const outputDir = path.join(workspaceRoot, "outputs/paper-doll-master-shot-list-2026-08-03");
const outputPath = path.join(outputDir, "best-bottles-master-paper-doll-shot-list.xlsx");

const [source, geometryReview, sourceReview, physicalReviewDecisions] = await Promise.all([
  fs.readFile(sourcePath, "utf8").then(JSON.parse),
  fs.readFile(geometryReviewPath, "utf8").then(JSON.parse),
  fs.readFile(sourceReviewPath, "utf8").then(JSON.parse),
  fs.readFile(physicalReviewDecisionsPath, "utf8").then(JSON.parse),
]);
const workbook = Workbook.create();
const summarySheet = workbook.worksheets.add("Summary");
const shotSheet = workbook.worksheets.add("Shot List");
const geometrySheet = workbook.worksheets.add("Geometry Review");
const sourceReviewSheet = workbook.worksheets.add("Source Review");
const decisionSheet = workbook.worksheets.add("Review Decisions");
const gapSheet = workbook.worksheets.add("Source Gaps");
const definitionSheet = workbook.worksheets.add("Definitions");

const colors = {
  charcoal: "#151515",
  charcoal2: "#24211D",
  gold: "#C6A15B",
  bone: "#F5F3EF",
  cream: "#E7E0D4",
  teal: "#2F8F83",
  green: "#2E7D54",
  amber: "#C47A2C",
  red: "#A5453C",
  gray: "#6B6B67",
  paleGreen: "#E2F1E9",
  paleAmber: "#F7E9D4",
  paleRed: "#F5DEDA",
  paleGray: "#ECEAE5",
};

const shotHeaders = [
  "Line", "Shot ID", "Record Type", "Plate Type", "Family", "Capacity (mL)", "Neck Finish",
  "Geometry / Authority Key", "Appearance", "Material Evidence", "Source Identity", "Reference URLs",
  "Catalog SKU Count", "Cohort Keys", "System Status", "Priority", "Authority Status", "Compatibility Status",
  "Next Gate", "Existing Asset Paths", "Existing Asset SHA-256", "Notes", "Owner", "Operator Status", "Approval Note",
];

function safeText(value) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(" | ") : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function shotValues(row) {
  return [
    row.lineNumber,
    safeText(row.shotId),
    safeText(row.recordType),
    safeText(row.plateType),
    safeText(row.family),
    row.capacityMl ?? "",
    safeText(row.neckFinish),
    safeText(row.geometryOrAuthorityKey),
    safeText(row.appearance),
    safeText(row.materialEvidence),
    safeText(row.sourceIdentity),
    safeText(row.sourceReferenceUrls),
    row.catalogSkuCount ?? "",
    safeText(row.cohortKeys),
    safeText(row.status),
    safeText(row.priority),
    safeText(row.authorityStatus),
    safeText(row.compatibilityStatus),
    safeText(row.nextGate),
    safeText(row.existingAssetPaths),
    safeText(row.existingAssetSha256),
    safeText(row.notes),
    "",
    "Not Started",
    "",
  ];
}

function titleBand(sheet, title, subtitle, endColumn) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${endColumn}2`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A1:${endColumn}2`).format = {
    fill: colors.charcoal,
    font: { color: colors.bone, bold: true, size: 18 },
    verticalAlignment: "center",
  };
  sheet.getRange(`A3:${endColumn}3`).merge();
  sheet.getRange("A3").values = [[subtitle]];
  sheet.getRange(`A3:${endColumn}3`).format = {
    fill: colors.charcoal2,
    font: { color: colors.cream, italic: true, size: 10 },
    verticalAlignment: "center",
  };
  sheet.getRange("A1:A2").format.rowHeight = 26;
  sheet.getRange("A3").format.rowHeight = 24;
}

titleBand(
  summarySheet,
  "BEST BOTTLES — MASTER PAPER-DOLL SHOT LIST",
  "Reusable plate requirements, not one render per SKU · generated from canonical catalog evidence · 2026-08-03",
  "H",
);

summarySheet.getRange("A5:B13").values = [
  ["Metric", "Live workbook count"],
  ["Source-backed reusable plates", null],
  ["Body appearance plates", null],
  ["Explicit component plates", null],
  ["Exact source-backed coverage", null],
  ["Source-backed work outstanding", null],
  ["Supplemental existing pilot assets", null],
  ["Missing-source responsibilities", null],
  ["Total operational ledger rows", null],
];
summarySheet.getRange("B6:B13").formulas = [
  ["=COUNTIF('Shot List'!$C$6:$C$323,\"body-appearance\")+COUNTIF('Shot List'!$C$6:$C$323,\"component-source\")"],
  ["=COUNTIF('Shot List'!$C$6:$C$323,\"body-appearance\")"],
  ["=COUNTIF('Shot List'!$C$6:$C$323,\"component-source\")"],
  ["=COUNTIFS('Shot List'!$C$6:$C$323,\"body-appearance\",'Shot List'!$O$6:$O$323,\"locked-existing\")+COUNTIFS('Shot List'!$C$6:$C$323,\"component-source\",'Shot List'!$O$6:$O$323,\"authority-existing-local\")"],
  ["=B6-B9"],
  ["=COUNTIF('Shot List'!$C$6:$C$323,\"supplemental-existing\")"],
  ["=COUNTIF('Shot List'!$C$6:$C$323,\"source-gap\")"],
  ["=COUNTA('Shot List'!$A$6:$A$323)"],
];
summarySheet.getRange("A5:B13").format = {
  borders: { preset: "all", style: "thin", color: "#CFC9BE" },
  verticalAlignment: "center",
};
summarySheet.getRange("A5:B5").format = { fill: colors.gold, font: { bold: true, color: colors.charcoal } };
summarySheet.getRange("A6:A13").format = { fill: colors.bone, font: { color: colors.charcoal } };
summarySheet.getRange("B6:B13").format = { fill: "#FFFFFF", font: { bold: true, color: colors.teal }, numberFormat: "0" };

summarySheet.getRange("D5:E11").values = [
  ["System status", "Count"],
  ["locked-existing", null],
  ["authority-existing-local", null],
  ["manual-review-required", null],
  ["needs-source", null],
  ["needs-authority", null],
  ["Total operational rows", null],
];
summarySheet.getRange("E6:E10").formulas = [
  ["=COUNTIF('Shot List'!$O$6:$O$323,D6)"],
  ["=COUNTIF('Shot List'!$O$6:$O$323,D7)"],
  ["=COUNTIF('Shot List'!$O$6:$O$323,D8)"],
  ["=COUNTIF('Shot List'!$O$6:$O$323,D9)"],
  ["=COUNTIF('Shot List'!$O$6:$O$323,D10)"],
];
summarySheet.getRange("E11").formulas = [["=SUM(E6:E10)"]];
summarySheet.getRange("D5:E11").format = { borders: { preset: "all", style: "thin", color: "#CFC9BE" } };
summarySheet.getRange("D5:E5").format = { fill: colors.gold, font: { bold: true, color: colors.charcoal } };
summarySheet.getRange("D6:D11").format = { fill: colors.bone };
summarySheet.getRange("E6:E11").format = { font: { bold: true }, numberFormat: "0" };
summarySheet.getRange("D8:E9").format.fill = colors.paleAmber;
summarySheet.getRange("D10:E10").format.fill = colors.paleRed;

summarySheet.getRange("G5:H11").values = [
  ["Component geometry review", "Count"],
  ["Conservative descriptor lanes", null],
  ["Exact shared authority groups", null],
  ["Appearances in exact shared group", null],
  ["Local reconciliation groups", null],
  ["Source-ready physical review", null],
  ["Source-incomplete groups", null],
];
summarySheet.getRange("H6:H11").formulas = [
  ["=COUNTA('Geometry Review'!$A$6:$A$47)"],
  ["=COUNTIF('Geometry Review'!$N$6:$N$47,\"verified-local-shared-authority\")"],
  ["=SUMIF('Geometry Review'!$N$6:$N$47,\"verified-local-shared-authority\",'Geometry Review'!$G$6:$G$47)"],
  ["=COUNTIF('Geometry Review'!$N$6:$N$47,\"local-authorities-require-reconciliation\")"],
  ["=COUNTIF('Geometry Review'!$N$6:$N$47,\"source-ready-physical-review\")"],
  ["=COUNTIF('Geometry Review'!$N$6:$N$47,\"source-incomplete\")"],
];
summarySheet.getRange("G5:H11").format = { borders: { preset: "all", style: "thin", color: "#CFC9BE" } };
summarySheet.getRange("G5:H5").format = { fill: colors.gold, font: { bold: true, color: colors.charcoal } };
summarySheet.getRange("G6:G11").format = { fill: colors.bone, wrapText: true };
summarySheet.getRange("H6:H11").format = { font: { bold: true }, numberFormat: "0" };
summarySheet.getRange("G:G").format.columnWidth = 34;
summarySheet.getRange("H:H").format.columnWidth = 12;
summarySheet.getRange("G6:H11").format.rowHeight = 34;

summarySheet.getRange("A15:H19").merge();
summarySheet.getRange("A15").values = [[
  "How to read the count\n309 is the catalog's source-backed appearance-plate worklist: 161 body appearances plus 148 explicit component appearances. It is not 309 separate Blender meshes. Shared physical geometry, deterministic material derivation, and exact-alpha clamping should reduce modeling work while retaining one approved output per required appearance. The 318-row operational ledger also carries six existing pilot assets awaiting exact catalog crosswalks and three blocked source gaps.",
]];
summarySheet.getRange("A15:H19").format = {
  fill: colors.paleGreen,
  font: { color: colors.charcoal, size: 11 },
  wrapText: true,
  verticalAlignment: "center",
  borders: { preset: "outside", style: "medium", color: colors.teal },
};
summarySheet.getRange("A21:H26").values = [
  ["Production order", "Gate", "Why", "Mutates production?", "", "", "", ""],
  [1, "Verify existing authorities", "Preserve SHA-pinned pixels and prove catalog crosswalks.", "No", "", "", "", ""],
  [2, "Resolve P0 truth/source gaps", "Do not model ambiguous geometry or compatibility.", "No", "", "", "", ""],
  [3, "Group by physical geometry", "Minimize Blender models and repeated work.", "No", "", "", "", ""],
  [4, "Produce and clamp appearances", "Material pixels may vary; silhouette may not.", "Candidate only", "", "", "", ""],
  [5, "Named approval → family fit → release", "Only approved evidence enters immutable release cuts.", "Named actions only", "", "", "", ""],
];
summarySheet.getRange("A21:D26").format = { borders: { preset: "all", style: "thin", color: "#CFC9BE" }, wrapText: true };
summarySheet.getRange("A21:D21").format = { fill: colors.charcoal2, font: { color: colors.bone, bold: true } };
summarySheet.getRange("A:D").format.columnWidth = 24;
summarySheet.getRange("A:A").format.columnWidth = 34;
summarySheet.getRange("C:C").format.columnWidth = 46;
summarySheet.freezePanes.freezeRows(3);

titleBand(
  shotSheet,
  "MASTER SHOT LIST — 318 OPERATIONAL ROWS",
  "Filter by family, plate type, status, or priority. Owner, Operator Status, and Approval Note are intentionally editable tracking fields.",
  "Y",
);
shotSheet.getRange("A5:Y5").values = [shotHeaders];
shotSheet.getRange(`A6:Y${source.rows.length + 5}`).values = source.rows.map(shotValues);
const shotTable = shotSheet.tables.add(`A5:Y${source.rows.length + 5}`, true, "MasterShotListTable");
shotTable.style = "TableStyleMedium2";
shotTable.showFilterButton = true;
shotTable.showBandedColumns = false;
shotSheet.getRange("A5:Y5").format = { fill: colors.charcoal, font: { color: colors.bone, bold: true }, wrapText: true };
shotSheet.getRange(`A6:Y${source.rows.length + 5}`).format = { verticalAlignment: "top", wrapText: true };
shotSheet.getRange(`A6:Y${source.rows.length + 5}`).format.rowHeight = 42;
shotSheet.getRange("A5:Y5").format.rowHeight = 34;
shotSheet.getRange(`A6:A${source.rows.length + 5}`).format.numberFormat = "0";
shotSheet.getRange(`F6:F${source.rows.length + 5}`).format.numberFormat = "0.##";
shotSheet.getRange(`M6:M${source.rows.length + 5}`).format.numberFormat = "0";
shotSheet.getRange(`X6:X${source.rows.length + 5}`).dataValidation = {
  rule: { type: "list", values: ["Not Started", "In Review", "Blocked", "Approved", "Deprecated"] },
};
shotSheet.getRange(`O6:O${source.rows.length + 5}`).conditionalFormats.add("containsText", { text: "locked-existing", format: { fill: colors.paleGreen, font: { color: colors.green, bold: true } } });
shotSheet.getRange(`O6:O${source.rows.length + 5}`).conditionalFormats.add("containsText", { text: "authority-existing-local", format: { fill: colors.paleGreen, font: { color: colors.green, bold: true } } });
shotSheet.getRange(`O6:O${source.rows.length + 5}`).conditionalFormats.add("containsText", { text: "manual-review-required", format: { fill: colors.paleAmber, font: { color: colors.amber, bold: true } } });
shotSheet.getRange(`O6:O${source.rows.length + 5}`).conditionalFormats.add("containsText", { text: "needs-source", format: { fill: colors.paleRed, font: { color: colors.red, bold: true } } });
shotSheet.getRange(`O6:O${source.rows.length + 5}`).conditionalFormats.add("containsText", { text: "needs-authority", format: { fill: colors.paleGray, font: { color: colors.gray } } });
shotSheet.freezePanes.freezeRows(5);
shotSheet.freezePanes.freezeColumns(5);
const shotWidths = [7, 42, 20, 18, 24, 12, 16, 44, 28, 26, 28, 45, 14, 28, 24, 14, 26, 26, 48, 44, 44, 38, 18, 18, 36];
shotWidths.forEach((width, index) => shotSheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width);

const geometryHeaders = [
  "Review Group Key", "Descriptor Signature", "Slots", "Neck Finish", "Applicator", "Cap Style",
  "Source Identity Count", "Source Identities", "Appearances", "Reference URLs", "Reference Count",
  "Local Geometry Families", "Local Authority Mask SHA-256", "Status", "Priority", "Geometry Claim",
  "Next Gate", "Issues", "Owner", "Review Status", "Review Note",
];
titleBand(
  geometrySheet,
  "COMPONENT GEOMETRY REVIEW — 42 CONSERVATIVE LANES",
  "A descriptor lane is not a geometry lock. Only exact shared authority or verified physical dimensions can establish one reusable model.",
  "U",
);
geometrySheet.getRange("A5:U5").values = [geometryHeaders];
geometrySheet.getRange(`A6:U${geometryReview.groups.length + 5}`).values = geometryReview.groups.map((group) => [
  safeText(group.reviewGroupKey), safeText(group.descriptorSignature), safeText(group.slotProposals), safeText(group.neckFinishEvidence),
  safeText(group.applicatorEvidence), safeText(group.capStyleEvidence), group.sourceIdentityCount, safeText(group.sourceIdentities),
  safeText(group.appearanceEvidence), safeText(group.sourceReferenceUrls), group.sourceReferenceObservedCount,
  safeText(group.localGeometryFamilyIds), safeText(group.localAuthorityMaskSha256), safeText(group.status), safeText(group.priority),
  safeText(group.geometryClaim), safeText(group.nextGate), safeText(group.issues), "", "Not Started", "",
]);
const geometryTable = geometrySheet.tables.add(`A5:U${geometryReview.groups.length + 5}`, true, "ComponentGeometryReviewTable");
geometryTable.style = "TableStyleMedium2";
geometryTable.showFilterButton = true;
geometrySheet.getRange("A5:U5").format = { fill: colors.charcoal, font: { color: colors.bone, bold: true }, wrapText: true };
geometrySheet.getRange(`A6:U${geometryReview.groups.length + 5}`).format = { verticalAlignment: "top", wrapText: true };
geometrySheet.getRange(`A6:U${geometryReview.groups.length + 5}`).format.rowHeight = 44;
geometrySheet.getRange(`G6:G${geometryReview.groups.length + 5}`).format.numberFormat = "0";
geometrySheet.getRange(`K6:K${geometryReview.groups.length + 5}`).format.numberFormat = "0";
geometrySheet.getRange(`T6:T${geometryReview.groups.length + 5}`).dataValidation = {
  rule: { type: "list", values: ["Not Started", "In Review", "Needs Measurement", "Split", "Shared Authority Approved", "Blocked"] },
};
geometrySheet.getRange(`N6:N${geometryReview.groups.length + 5}`).conditionalFormats.add("containsText", { text: "verified-local-shared-authority", format: { fill: colors.paleGreen, font: { color: colors.green, bold: true } } });
geometrySheet.getRange(`N6:N${geometryReview.groups.length + 5}`).conditionalFormats.add("containsText", { text: "local-authorities-require-reconciliation", format: { fill: colors.paleAmber, font: { color: colors.amber, bold: true } } });
geometrySheet.getRange(`N6:N${geometryReview.groups.length + 5}`).conditionalFormats.add("containsText", { text: "source-ready-physical-review", format: { fill: colors.paleGray, font: { color: colors.gray } } });
geometrySheet.getRange(`N6:N${geometryReview.groups.length + 5}`).conditionalFormats.add("containsText", { text: "source-incomplete", format: { fill: colors.paleRed, font: { color: colors.red, bold: true } } });
geometrySheet.freezePanes.freezeRows(5);
geometrySheet.freezePanes.freezeColumns(6);
[42, 38, 18, 16, 24, 18, 13, 48, 32, 48, 13, 44, 48, 36, 14, 28, 52, 38, 18, 24, 36]
  .forEach((width, index) => geometrySheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width);

const sourceReviewHeaders = [
  "Review Group Key", "Descriptor Signature", "Identity Count", "Reference Count", "Evidence Status", "Comparison Basis",
  "Diagnostic Medoid", "Medoid Avg IoU", "Worst Pair Left", "Worst Pair Right", "Worst Diagnostic IoU",
  "Bounds Aspect Spread %", "Lowest-IoU Attention Rank", "Aspect-Spread Attention Rank", "Geometry Claim",
  "Contact Sheet", "Silhouette Analysis", "Next Gate", "Owner", "Review Status", "Review Note",
];
titleBand(
  sourceReviewSheet,
  "SOURCE-REFERENCE REVIEW — 28 CALIBRATED LANES",
  "Ranked diagnostic evidence only. Low IoU requests attention; high IoU does not prove shared physical geometry.",
  "U",
);
sourceReviewSheet.getRange("A5:U5").values = [sourceReviewHeaders];
sourceReviewSheet.getRange(`A6:U${sourceReview.records.length + 5}`).values = sourceReview.records.map((record) => [
  safeText(record.reviewGroupKey), safeText(record.descriptorSignature), record.sourceIdentityCount, record.sourceReferenceCount,
  safeText(record.evidenceStatus), safeText(record.comparisonBasis), safeText(record.medoidSourceIdentity), record.medoidAverageIou ?? "",
  safeText(record.worstPairLeft), safeText(record.worstPairRight), record.worstPairIou ?? "", record.boundsAspectSpreadPercent ?? "",
  record.diagnosticLowestIouRank ?? "", record.diagnosticLargestAspectSpreadRank ?? "", safeText(record.geometryClaim),
  safeText(record.contactSheetPath), safeText(record.silhouetteAnalysisPath), safeText(record.nextGate), "", "Not Started", "",
]);
const sourceReviewTable = sourceReviewSheet.tables.add(`A5:U${sourceReview.records.length + 5}`, true, "ComponentSourceReviewTable");
sourceReviewTable.style = "TableStyleMedium2";
sourceReviewTable.showFilterButton = true;
sourceReviewSheet.getRange("A5:U5").format = { fill: colors.charcoal, font: { color: colors.bone, bold: true }, wrapText: true };
sourceReviewSheet.getRange(`A6:U${sourceReview.records.length + 5}`).format = { verticalAlignment: "top", wrapText: true };
sourceReviewSheet.getRange(`A6:U${sourceReview.records.length + 5}`).format.rowHeight = 44;
sourceReviewSheet.getRange(`C6:D${sourceReview.records.length + 5}`).format.numberFormat = "0";
sourceReviewSheet.getRange(`H6:H${sourceReview.records.length + 5}`).format.numberFormat = "0.0000";
sourceReviewSheet.getRange(`K6:K${sourceReview.records.length + 5}`).format.numberFormat = "0.0000";
sourceReviewSheet.getRange(`L6:L${sourceReview.records.length + 5}`).format.numberFormat = "0.00";
sourceReviewSheet.getRange(`M6:N${sourceReview.records.length + 5}`).format.numberFormat = "0";
sourceReviewSheet.getRange(`T6:T${sourceReview.records.length + 5}`).dataValidation = {
  rule: { type: "list", values: ["Not Started", "In Review", "Needs Measurement", "Split Recorded", "Authority Selected", "Blocked"] },
};
sourceReviewSheet.getRange(`E6:E${sourceReview.records.length + 5}`).conditionalFormats.add("containsText", { text: "review-evidence-ready", format: { fill: colors.paleGreen, font: { color: colors.green, bold: true } } });
sourceReviewSheet.getRange(`M6:M${sourceReview.records.length + 5}`).conditionalFormats.add("cellIs", { operator: "equalTo", formula: 1, format: { fill: colors.paleRed, font: { color: colors.red, bold: true } } });
sourceReviewSheet.freezePanes.freezeRows(5);
sourceReviewSheet.freezePanes.freezeColumns(6);
[42, 40, 13, 13, 24, 26, 24, 14, 24, 24, 18, 18, 18, 20, 16, 52, 52, 56, 18, 22, 36]
  .forEach((width, index) => sourceReviewSheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width);

const decisionHeaders = [
  "Decision ID", "Source Review Group", "Status", "Evidence Type", "Evidence Paths", "Affected / Configuration Identities",
  "Observation", "Geometry Claim", "Next Gate", "Owner", "Review Status", "Approval Note",
];
titleBand(
  decisionSheet,
  "RECORDED PHYSICAL-REVIEW BOUNDARIES",
  "Explicit split and quarantine findings. These decisions prevent bad grouping; they do not approve geometry or compatibility.",
  "L",
);
decisionSheet.getRange("A5:L5").values = [decisionHeaders];
decisionSheet.getRange(`A6:L${physicalReviewDecisions.decisions.length + 5}`).values = physicalReviewDecisions.decisions.map((decision) => [
  safeText(decision.decisionId), safeText(decision.sourceReviewGroupKey), safeText(decision.status), safeText(decision.evidenceType),
  safeText(decision.evidencePaths), safeText(decision.reviewConfigurations
    ? decision.reviewConfigurations.map((configuration) => `${configuration.configurationId}: ${configuration.sourceIdentities.join(" | ")}`).join(" || ")
    : decision.affectedSourceIdentities),
  safeText(decision.observation), safeText(decision.geometryClaim), safeText(decision.nextGate), "", "Recorded", "",
]);
const decisionTable = decisionSheet.tables.add(`A5:L${physicalReviewDecisions.decisions.length + 5}`, true, "PhysicalReviewDecisionsTable");
decisionTable.style = "TableStyleMedium4";
decisionTable.showFilterButton = true;
decisionSheet.getRange("A5:L5").format = { fill: colors.charcoal, font: { color: colors.bone, bold: true }, wrapText: true };
decisionSheet.getRange(`A6:L${physicalReviewDecisions.decisions.length + 5}`).format = { fill: colors.paleAmber, verticalAlignment: "top", wrapText: true };
decisionSheet.getRange(`A6:L${physicalReviewDecisions.decisions.length + 5}`).format.rowHeight = 70;
decisionSheet.getRange(`K6:K${physicalReviewDecisions.decisions.length + 5}`).dataValidation = {
  rule: { type: "list", values: ["Recorded", "In Review", "Dimensions Requested", "Resolved", "Blocked"] },
};
decisionSheet.freezePanes.freezeRows(5);
decisionSheet.freezePanes.freezeColumns(3);
[46, 44, 34, 28, 52, 62, 64, 18, 58, 18, 22, 36]
  .forEach((width, index) => decisionSheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width);

const sourceGaps = source.rows.filter((row) => row.recordType === "source-gap");
titleBand(
  gapSheet,
  "SOURCE GAPS — DO NOT GUESS",
  "These responsibilities appear in catalog assemblies but lack independent canonical component-source identities.",
  "H",
);
gapSheet.getRange("A5:H5").values = [["Line", "Plate Type", "Appearance", "System Status", "Priority", "Next Gate", "Notes", "Owner"]];
gapSheet.getRange(`A6:H${sourceGaps.length + 5}`).values = sourceGaps.map((row) => [
  row.lineNumber, safeText(row.plateType), safeText(row.appearance), safeText(row.status), safeText(row.priority), safeText(row.nextGate), safeText(row.notes), "",
]);
gapSheet.tables.add(`A5:H${sourceGaps.length + 5}`, true, "SourceGapsTable").style = "TableStyleMedium4";
gapSheet.getRange("A5:H5").format = { fill: colors.red, font: { color: "#FFFFFF", bold: true } };
gapSheet.getRange(`A6:H${sourceGaps.length + 5}`).format = { fill: colors.paleRed, wrapText: true, verticalAlignment: "top" };
gapSheet.freezePanes.freezeRows(5);
[8, 18, 32, 20, 14, 52, 52, 18].forEach((width, index) => gapSheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width);

titleBand(
  definitionSheet,
  "DEFINITIONS AND SOURCE CONTROL",
  "The workbook is a filterable operational view of immutable, machine-readable repository evidence.",
  "F",
);
definitionSheet.getRange("A5:C15").values = [
  ["Term", "Meaning", "Required action"],
  ["Source-backed plate", "One catalog-evidenced body or component appearance output.", "Produce or verify exact pixels."],
  ["Operational row", "A source-backed plate, preserved supplemental asset, or blocked source gap.", "Follow its next gate."],
  ["Geometry authority", "The approved silhouette/mask and physical dimension source.", "Never alter through material generation."],
  ["locked-existing", "SHA-pinned body plate with exact source-backed crosswalk.", "Verify and preserve."],
  ["authority-existing-local", "A local component authority exists.", "Verify catalog identity and lifecycle approval."],
  ["manual-review-required", "Catalog evidence conflicts or is insufficient.", "Resolve truth before generation."],
  ["needs-source", "Required responsibility has no canonical independent source row.", "Obtain verified physical/source identity."],
  ["needs-authority", "Source evidence exists but no clean authority is registered.", "Create authority, derive material pixels, exact-alpha clamp."],
  ["Descriptor review lane", "A conservative cluster sharing exact slot, neck, applicator, and cap-style descriptors.", "Review physical dimensions and silhouette; never call it geometry locked."],
  ["Exact shared authority", "Every appearance in a lane resolves to one geometry family and one identical authority-mask SHA.", "May serve as one reusable geometry authority after named verification."],
];
definitionSheet.getRange("A5:C15").format = { borders: { preset: "all", style: "thin", color: "#CFC9BE" }, wrapText: true, verticalAlignment: "top" };
definitionSheet.getRange("A5:C5").format = { fill: colors.gold, font: { color: colors.charcoal, bold: true } };
definitionSheet.getRange("A17:F25").values = [
  ["Source", "Repository path", "SHA-256", "Purpose", "Remote writes", "Current Release / Sanity"],
  ["Catalog backlog", source.generatedFrom.catalogBacklogPath, source.generatedFrom.catalogBacklogSha256, "161 body appearances and catalog identity evidence", "None", "Unchanged"],
  ["Family intakes", source.generatedFrom.familyIntakesPath, source.generatedFrom.familyIntakesSha256, "97 family/capacity/neck cohorts", "None", "Unchanged"],
  ["Component queue", source.generatedFrom.componentAuthorityQueuePath, source.generatedFrom.componentAuthorityQueueSha256, "148 explicit component source identities", "None", "Unchanged"],
  ["Geometry review", "docs/paper-doll-rig/component-geometry-review-groups.json", "See repository", "42 conservative physical-review lanes", "None", "Unchanged"],
  ["Source review", "docs/paper-doll-rig/component-source-review-summary.json", "See repository", "28 calibrated lanes / 117 references; diagnostics only", "None", "Unchanged"],
  ["Review decisions", "docs/paper-doll-rig/component-physical-review-decisions.json", "See repository", "Explicit split/quarantine boundaries without geometry approval", "None", "Unchanged"],
  ["Master JSON", "docs/paper-doll-rig/master-plate-shot-list.json", "See repository", "Canonical machine-readable ledger", "None", "Unchanged"],
  ["Master CSV", "docs/paper-doll-rig/master-plate-shot-list.csv", "Generated with JSON", "Portable filter/sort interchange", "None", "Unchanged"],
];
definitionSheet.getRange("A17:F25").format = { borders: { preset: "all", style: "thin", color: "#CFC9BE" }, wrapText: true, verticalAlignment: "top" };
definitionSheet.getRange("A17:F17").format = { fill: colors.charcoal2, font: { color: colors.bone, bold: true } };
[24, 48, 52, 40, 18, 22].forEach((width, index) => definitionSheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width);
definitionSheet.freezePanes.freezeRows(3);

await fs.mkdir(outputDir, { recursive: true });
const previews = [
  ["Summary", "A1:H26", "summary-preview.png"],
  ["Shot List", "A1:Y28", "shot-list-preview.png"],
  ["Geometry Review", "A1:U28", "geometry-review-preview.png"],
  ["Source Review", "A1:U28", "source-review-preview.png"],
  ["Review Decisions", "A1:L8", "review-decisions-preview.png"],
  ["Source Gaps", "A1:H9", "source-gaps-preview.png"],
  ["Definitions", "A1:F25", "definitions-preview.png"],
];
for (const [sheetName, range, filename] of previews) {
  const image = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(path.join(outputDir, filename), new Uint8Array(await image.arrayBuffer()));
}

const inspection = await workbook.inspect({
  kind: "workbook,sheet,table,formula",
  maxChars: 12000,
  tableMaxRows: 4,
  tableMaxCols: 8,
  options: { maxResults: 100 },
});
await fs.writeFile(path.join(outputDir, "workbook-inspection.ndjson"), inspection.ndjson, "utf8");

const errorInspection = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  maxChars: 6000,
});
await fs.writeFile(path.join(outputDir, "formula-error-scan.ndjson"), errorInspection.ndjson, "utf8");

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);

console.log(JSON.stringify({ outputPath, previews: previews.map(([, , filename]) => path.join(outputDir, filename)), summary: source.summary }, null, 2));
