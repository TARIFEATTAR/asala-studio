import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parsePaperDollMasterShotList,
  type PaperDollMasterShotList,
  type PaperDollMasterShotRow,
} from "../../src/lib/paperDoll/masterPlateShotListContract";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogBacklogPath = path.join(workspaceRoot, "docs/paper-doll-rig/catalog-wide-plate-backlog.json");
const familyIntakesPath = path.join(workspaceRoot, "docs/paper-doll-rig/catalog-family-intakes.json");
const componentQueuePath = path.join(workspaceRoot, "docs/paper-doll-rig/component-authority-queue.json");
const cyl9ManifestPath = path.join(workspaceRoot, "docs/paper-doll-rig/cyl9-component-factory.json");
const outputJsonPath = path.join(workspaceRoot, "docs/paper-doll-rig/master-plate-shot-list.json");
const outputCsvPath = path.join(workspaceRoot, "docs/paper-doll-rig/master-plate-shot-list.csv");
const reportPath = path.join(workspaceRoot, "docs/paper-doll-rig/MASTER-PLATE-SHOT-LIST.md");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function unique(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()))].sort();
}

function validUrls(values: unknown[]): string[] {
  return unique(values).filter((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvFor(rows: PaperDollMasterShotRow[]): string {
  const headers: Array<keyof PaperDollMasterShotRow> = [
    "lineNumber", "shotId", "recordType", "plateType", "family", "capacityMl", "neckFinish",
    "geometryOrAuthorityKey", "appearance", "materialEvidence", "sourceIdentity", "sourceReferenceUrls",
    "catalogSkuCount", "cohortKeys", "status", "priority", "authorityStatus", "compatibilityStatus",
    "nextGate", "existingAssetPaths", "existingAssetSha256", "notes",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => {
    const value = row[header];
    return csvCell(Array.isArray(value) ? value.join(" | ") : value);
  }).join(",")).join("\n")}\n`;
}

function bodyAppearanceShotId(geometryKey: string, color: string): string {
  return `shot__${geometryKey}__${slug(color)}`;
}

export async function buildMasterPlateShotList(): Promise<PaperDollMasterShotList> {
  const [catalogText, familyText, componentText, cyl9Text] = await Promise.all([
    readFile(catalogBacklogPath, "utf8"),
    readFile(familyIntakesPath, "utf8"),
    readFile(componentQueuePath, "utf8"),
    readFile(cyl9ManifestPath, "utf8"),
  ]);
  const catalog = JSON.parse(catalogText) as any;
  const familyIntakes = JSON.parse(familyText) as any;
  const componentQueue = JSON.parse(componentText) as any;
  const cyl9 = JSON.parse(cyl9Text) as any;
  const componentByKey = new Map(cyl9.components.map((component: any) => [component.componentKey, component]));
  const cohortKeysByGeometry = new Map<string, string[]>();
  for (const cohort of familyIntakes.cohorts) {
    for (const geometry of cohort.geometries) {
      cohortKeysByGeometry.set(geometry.geometryKey, [...(cohortKeysByGeometry.get(geometry.geometryKey) ?? []), cohort.familyKey]);
    }
  }

  const colorByBodyVariant: Record<string, string> = { AMB: "Amber", BLU: "Cobalt Blue", CLR: "Clear", FRS: "Frosted", SWL: "Swirl" };
  const lockedBodyMatch = new Map<string, any>();
  const supplementalLockedBodies: any[] = [];
  const cylinderNine = catalog.families.find((family: any) => family.familyName === "Cylinder")?.geometries.filter((geometry: any) => geometry.capacityMl === 9) ?? [];
  for (const plate of catalog.currentPilot.lockedBodyPlates) {
    const color = colorByBodyVariant[plate.bodyVariantKey];
    const matches = cylinderNine.filter((geometry: any) => geometry.dimensionsMm.bodyHeight === 70
      && geometry.dimensionsMm.widthAxis === 20
      && geometry.requiredBodyAppearances.some((appearance: any) => appearance.color === color));
    if (matches.length === 1) lockedBodyMatch.set(bodyAppearanceShotId(matches[0].geometryKey, color), plate);
    else supplementalLockedBodies.push({ ...plate, color });
  }

  const bodyRows: Omit<PaperDollMasterShotRow, "lineNumber">[] = catalog.families.flatMap((family: any) => family.geometries.flatMap((geometry: any) => (
    geometry.requiredBodyAppearances.map((appearance: any) => {
      const shotId = bodyAppearanceShotId(geometry.geometryKey, appearance.color);
      const locked = lockedBodyMatch.get(shotId);
      const matchingCatalog = catalog.catalogAssemblyBacklog.filter((identity: any) => identity.geometry.geometryKeys.includes(geometry.geometryKey)
        && identity.bodyColors.includes(appearance.color));
      const sourceRows = matchingCatalog.flatMap((identity: any) => identity.sourceRows);
      const manual = appearance.status === "manual-body-truth-review" || geometry.conflictFlags.length > 0;
      return {
        shotId,
        recordType: "body-appearance" as const,
        plateType: "body",
        family: family.familyName,
        capacityMl: geometry.capacityMl,
        neckFinish: unique(sourceRows.map((row: any) => row.neckThreadSize)).join(" | "),
        geometryOrAuthorityKey: geometry.geometryKey,
        appearance: appearance.color,
        materialEvidence: unique(sourceRows.map((row: any) => row.material)),
        sourceIdentity: "",
        sourceReferenceUrls: validUrls(sourceRows.flatMap((row: any) => [row.imageUrl, row.siteMeasuredRenderUrl, row.siteDepthviewRenderUrl])),
        catalogSkuCount: matchingCatalog.length,
        cohortKeys: unique(cohortKeysByGeometry.get(geometry.geometryKey) ?? []),
        status: locked ? "locked-existing" as const : manual ? "manual-review-required" as const : "needs-authority" as const,
        priority: locked ? "P0-VERIFY" as const : manual ? "P0-TRUTH" as const : "P1-PRODUCE" as const,
        authorityStatus: locked ? "locked-local-body-authority" : "missing",
        compatibilityStatus: "measured-body-geometry-only",
        nextGate: locked ? "Preserve SHA-pinned body plate and verify catalog geometry crosswalk." : manual ? "Resolve catalog geometry/body-color truth before authority creation." : "Register or render one clean body authority, then approve the body appearance plate.",
        existingAssetPaths: locked ? [locked.imagePath] : [],
        existingAssetSha256: locked ? [locked.imageSha256] : [],
        notes: geometry.conflictFlags.join(" | "),
      };
    })
  )));

  const componentRows: Omit<PaperDollMasterShotRow, "lineNumber">[] = componentQueue.items.map((item: any) => {
    const localComponents = unique(item.localPlateVariants.map((variant: any) => variant.componentKey));
      const localDefinitions = localComponents.map((key) => componentByKey.get(key)).filter(Boolean) as any[];
    const hasLocal = item.authorityStatus === "local-pilot-authority-exists";
    const manual = item.authorityStatus === "manual-review-required" || item.sourceReferenceStatus === "reference-url-missing";
    const appearance = unique([
      ...item.applicatorEvidence,
      ...item.capStyleEvidence,
      ...item.finishEvidence,
      ...item.trimEvidence,
    ]).join(" · ") || item.sourceIdentity;
    return {
      shotId: `shot__${item.authorityQueueKey}`,
      recordType: "component-source" as const,
      plateType: item.slotProposals.join(" | "),
      family: item.familyLabels.join(" | "),
      capacityMl: null,
      neckFinish: item.neckFinishEvidence.join(" | "),
      geometryOrAuthorityKey: item.authorityQueueKey,
      appearance,
      materialEvidence: item.materialEvidence,
      sourceIdentity: item.sourceIdentity,
      sourceReferenceUrls: item.referenceUrls,
      catalogSkuCount: null,
      cohortKeys: [],
      status: hasLocal ? "authority-existing-local" as const : manual ? "manual-review-required" as const : "needs-authority" as const,
      priority: hasLocal ? "P0-VERIFY" as const : manual ? "P0-TRUTH" as const : "P1-PRODUCE" as const,
      authorityStatus: item.authorityStatus,
      compatibilityStatus: item.compatibilityStatus,
      nextGate: hasLocal ? "Approve material pixels and family fit through the production lifecycle." : manual ? "Resolve source identity/reference evidence before authority creation." : "Create one geometry authority, derive approved material pixels, then verify fit per cohort.",
      existingAssetPaths: unique(localDefinitions.flatMap((component) => [component.source.path, component.authority?.maskPath])),
      existingAssetSha256: unique(localDefinitions.flatMap((component) => [component.source.sha256, component.authority?.maskSha256])),
      notes: item.issues.join(" | "),
    };
  });

  const coveredComponentKeys = new Set(componentQueue.items.flatMap((item: any) => item.localPlateVariants.map((variant: any) => variant.componentKey)));
  const supplementalComponentRows: Omit<PaperDollMasterShotRow, "lineNumber">[] = cyl9.components
    .filter((component: any) => !coveredComponentKeys.has(component.componentKey))
    .flatMap((component: any) => component.variants.map((variant: any) => ({
      shotId: `shot__supplemental__${slug(component.componentKey)}__${slug(variant.variantKey)}`,
      recordType: "supplemental-existing" as const,
      plateType: component.slot,
      family: "CYL-9ML local pilot",
      capacityMl: 9,
      neckFinish: component.componentKey.includes("17-415") ? "17-415" : "",
      geometryOrAuthorityKey: component.geometryFamilyId,
      appearance: variant.materialVariant,
      materialEvidence: [variant.materialClass],
      sourceIdentity: "",
      sourceReferenceUrls: [],
      catalogSkuCount: null,
      cohortKeys: ["CYL-9ML-17-415"],
      status: "authority-existing-local" as const,
      priority: "P0-VERIFY" as const,
      authorityStatus: component.authorityStatus,
      compatibilityStatus: "local-pilot-only",
      nextGate: "Retain local authority; establish exact catalog source/compatibility identity before cross-family reuse.",
      existingAssetPaths: unique([component.source.path, component.authority?.maskPath]),
      existingAssetSha256: unique([component.source.sha256, component.authority?.maskSha256]),
      notes: "Local functional plate has no independent canonical component-source row.",
    })));

  const supplementalBodyRows: Omit<PaperDollMasterShotRow, "lineNumber">[] = supplementalLockedBodies.map((plate) => ({
    shotId: `shot__supplemental__body__cyl9__${slug(plate.color)}`,
    recordType: "supplemental-existing" as const,
    plateType: "body",
    family: "CYL-9ML local pilot",
    capacityMl: 9,
    neckFinish: "17-415",
    geometryOrAuthorityKey: plate.componentVersionId,
    appearance: plate.color,
    materialEvidence: ["glass"],
    sourceIdentity: "",
    sourceReferenceUrls: [],
    catalogSkuCount: null,
    cohortKeys: ["CYL-9ML-17-415"],
    status: "locked-existing" as const,
    priority: "P0-TRUTH" as const,
    authorityStatus: "locked-local-body-authority",
    compatibilityStatus: "catalog-geometry-crosswalk-review-required",
    nextGate: "Preserve locked pixels and resolve the canonical geometry alias before source-backed coverage is claimed.",
    existingAssetPaths: [plate.imagePath],
    existingAssetSha256: [plate.imageSha256],
    notes: "Locked Frosted/Swirl plate has no exact 70×20 source appearance row in the current canonical geometry snapshot.",
  }));

  const sourceGapRows: Omit<PaperDollMasterShotRow, "lineNumber">[] = componentQueue.missingSourceResponsibilities.map((gap: any) => ({
    shotId: `shot__source-gap__${slug(gap.slot)}`,
    recordType: "source-gap" as const,
    plateType: gap.slot,
    family: "Catalog-wide",
    capacityMl: null,
    neckFinish: "",
    geometryOrAuthorityKey: `missing-source__${gap.slot}`,
    appearance: `${gap.slot} source identity required`,
    materialEvidence: [],
    sourceIdentity: "",
    sourceReferenceUrls: [],
    catalogSkuCount: null,
    cohortKeys: [],
    status: "needs-source" as const,
    priority: "P0-TRUTH" as const,
    authorityStatus: "missing-source-identity",
    compatibilityStatus: "unverified",
    nextGate: gap.nextAction,
    existingAssetPaths: [],
    existingAssetSha256: [],
    notes: gap.reason,
  }));

  const statusRank: Record<string, number> = { "locked-existing": 0, "authority-existing-local": 1, "manual-review-required": 2, "needs-source": 3, "needs-authority": 4 };
  const unsorted = [...bodyRows, ...componentRows, ...supplementalBodyRows, ...supplementalComponentRows, ...sourceGapRows];
  const rows = unsorted.sort((left, right) => statusRank[left.status] - statusRank[right.status]
    || left.recordType.localeCompare(right.recordType)
    || left.family.localeCompare(right.family)
    || (left.capacityMl ?? 0) - (right.capacityMl ?? 0)
    || left.plateType.localeCompare(right.plateType)
    || left.appearance.localeCompare(right.appearance)
    || left.shotId.localeCompare(right.shotId))
    .map((row, index) => ({ ...row, lineNumber: index + 1 }));

  const sourceRows = rows.filter((row) => row.recordType === "body-appearance" || row.recordType === "component-source");
  return parsePaperDollMasterShotList({
    schemaVersion: 1,
    generatedFrom: {
      catalogBacklogPath: path.relative(workspaceRoot, catalogBacklogPath),
      catalogBacklogSha256: sha256(catalogText),
      familyIntakesPath: path.relative(workspaceRoot, familyIntakesPath),
      familyIntakesSha256: sha256(familyText),
      componentAuthorityQueuePath: path.relative(workspaceRoot, componentQueuePath),
      componentAuthorityQueueSha256: sha256(componentText),
    },
    summary: {
      operationalRowCount: rows.length,
      sourceBackedPlateCount: sourceRows.length,
      bodyAppearancePlateCount: bodyRows.length,
      explicitComponentPlateCount: componentRows.length,
      exactSourceBackedExistingCount: sourceRows.filter((row) => row.status === "locked-existing" || row.status === "authority-existing-local").length,
      exactSourceBackedOutstandingCount: sourceRows.filter((row) => row.status !== "locked-existing" && row.status !== "authority-existing-local").length,
      supplementalExistingCount: supplementalBodyRows.length + supplementalComponentRows.length,
      missingSourceResponsibilityCount: sourceGapRows.length,
    },
    rows,
    mutationPolicy: { assetsGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  });
}

function reportFor(shotList: PaperDollMasterShotList): string {
  const statusCounts = new Map<string, number>();
  for (const row of shotList.rows) statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  return `# Best Bottles master reusable plate shot list

## Answer

The catalog does **not** require one rendered product per SKU. The source-backed reusable plate ceiling is **${shotList.summary.sourceBackedPlateCount} plates**:

- ${shotList.summary.bodyAppearancePlateCount} body appearance plates across 118 measured geometries;
- ${shotList.summary.explicitComponentPlateCount} explicit component appearance plates.

The operational ledger has ${shotList.summary.operationalRowCount} rows because it also preserves ${shotList.summary.supplementalExistingCount} already-built local plates that do not yet have an exact source-row crosswalk and ${shotList.summary.missingSourceResponsibilityCount} blocked source gaps. Those support/review rows are not additional generation commitments.

## Current status

- ${shotList.summary.exactSourceBackedExistingCount} source-backed requirements already have exact local authority coverage.
- ${shotList.summary.exactSourceBackedOutstandingCount} source-backed requirements remain authority or truth work.
- Status distribution: ${[...statusCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => `${status} ${count}`).join(", ")}.

This is an upper-bound appearance shot list, not a claim that every row needs a separately modeled mesh. Geometry-family deduplication and deterministic material variants should reduce modeling work while retaining one approved output plate per required appearance.

## Operating sequence

1. Verify/release existing local authorities.
2. Resolve P0 truth and missing-source rows.
3. Group source-backed component appearances by measured physical geometry.
4. Produce one authority per geometry family.
5. Produce and exact-alpha clamp each required appearance plate.
6. Review family fit and lock placement.
7. Cut immutable releases and sync Sanity drafts.
`;
}

async function main() {
  const shotList = await buildMasterPlateShotList();
  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(shotList, null, 2)}\n`, "utf8"),
    writeFile(outputCsvPath, csvFor(shotList.rows), "utf8"),
    writeFile(reportPath, reportFor(shotList), "utf8"),
  ]);
  console.log(JSON.stringify({ outputJsonPath, outputCsvPath, reportPath, summary: shotList.summary, mutationPolicy: shotList.mutationPolicy }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
