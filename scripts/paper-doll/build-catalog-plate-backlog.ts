import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type CsvRow = Record<string, string>;

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const masterTruthPath = path.join(workspaceRoot, "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv");
const bodyGeometryPath = path.join(workspaceRoot, "docs/best-bottles-canonical-truth/best-bottles-body-geometry.csv");
const cyl9ManifestPath = path.join(workspaceRoot, "docs/paper-doll-rig/cyl9-component-factory.json");
const outputPath = path.join(workspaceRoot, "docs/paper-doll-rig/catalog-wide-plate-backlog.json");
const reportPath = path.join(workspaceRoot, "docs/paper-doll-rig/CATALOG-WIDE-PLATE-BACKLOG.md");

const COMPONENT_FAMILIES = new Set([
  "Cap/Closure",
  "Cap/Component",
  "Dropper",
  "Lotion Pump",
  "Roll-On Cap",
  "Sprayer",
]);

export function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field.replace(/\r$/, ""));
      if (record.some((value) => value.length > 0)) records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field.replace(/\r$/, ""));
    records.push(record);
  }
  const [headers, ...rows] = records;
  if (!headers?.length) return [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function split(value: string): string[] {
  return [...new Set(value.split("|").map((item) => item.trim()).filter(Boolean))];
}

function numeric(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function token(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, "");
}

function slug(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function groupBy<T>(values: readonly T[], key: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const groupKey = key(value);
    result.set(groupKey, [...(result.get(groupKey) ?? []), value]);
  }
  return result;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function geometryKey(row: CsvRow): string {
  const identity = [row.family, row.capacityMl, row.bodyHeightMm, row.widthAxisMm, row.depthAxisMm, row.productGroupSlugs].join("|");
  return `body__${slug(row.family)}__${row.capacityMl || "unknown"}ml__${row.bodyHeightMm || "unknown"}x${row.widthAxisMm || "unknown"}x${row.depthAxisMm || "unknown"}__${sha256(identity).slice(0, 10)}`;
}

function proposedSlot(row: CsvRow): string {
  const family = row.family;
  const text = `${row.itemName} ${row.applicator} ${row.capStyle}`.toLowerCase();
  if (family === "Dropper" || text.includes("dropper")) return "dropper";
  if (family === "Lotion Pump" || text.includes("lotion") || row.capStyle === "Pump") return "pump";
  if (family === "Sprayer" && (text.includes("antique") || text.includes("vintage") || text.includes("tassel"))) return "bulb-sprayer";
  if (family === "Sprayer" || text.includes("spray")) return "sprayer";
  return "cap";
}

function applicatorSlot(applicator: string): string | null {
  switch (applicator) {
    case "Metal Roller Ball":
    case "Plastic Roller Ball": return "roller";
    case "Fine Mist Sprayer":
    case "Perfume Spray Pump":
    case "Atomizer": return "sprayer";
    case "Lotion Pump": return "pump";
    case "Dropper": return "dropper";
    case "Reducer": return "reducer";
    case "Glass Rod": return "glass-rod";
    case "Glass Stopper": return "stopper";
    case "Vintage Bulb Sprayer":
    case "Vintage Bulb Sprayer with Tassel": return "bulb-sprayer";
    default: return null;
  }
}

function relevantTruth(row: CsvRow) {
  return {
    graceSku: row.graceSku,
    family: row.family,
    productGroupSlug: row.productGroupSlug,
    color: row.color,
    capacityMl: numeric(row.capacityMl),
    material: row.material,
    glassFinish: row.glassFinish,
    neckThreadSize: row.neckThreadSize,
    applicator: row.applicator,
    capStyle: row.capStyle,
    capHeight: row.capHeight,
    capColor: row.capColor,
    trimColor: row.trimColor,
    ballMaterial: row.ballMaterial,
    assemblyType: row.assemblyType,
    readinessStatus: row.readinessStatus,
    readinessIssues: row.readinessIssues,
    conflictFlags: row.conflict_flags,
    imageUrl: row.imageUrl,
    productUrl: row.productUrl,
    siteMeasuredRenderUrl: row.site_measuredRenderUrl,
    siteDepthviewRenderUrl: row.site_depthviewRenderUrl,
  };
}

function resolveGeometry(rows: CsvRow[], geometries: Array<CsvRow & { geometryKey: string }>) {
  const matches = new Set<string>();
  const reasons = new Set<string>();
  for (const row of rows) {
    const candidates = geometries.filter((geometry) => geometry.family === row.family && geometry.capacityMl === row.capacityMl);
    const slugMatches = candidates.filter((geometry) => split(geometry.productGroupSlugs).includes(row.productGroupSlug));
    if (slugMatches.length === 1) {
      matches.add(slugMatches[0].geometryKey);
      reasons.add("exact-product-group-slug");
      continue;
    }
    const dimensions = [numeric(row.canon_bodyHeightMm), numeric(row.canon_widthAxisMm), numeric(row.canon_secondAxisMm)];
    const dimensionMatches = candidates.filter((geometry) => {
      const actual = [numeric(geometry.bodyHeightMm), numeric(geometry.widthAxisMm), numeric(geometry.depthAxisMm)];
      return dimensions.every((value, index) => value === null || actual[index] === value);
    });
    if (dimensionMatches.length === 1) {
      matches.add(dimensionMatches[0].geometryKey);
      reasons.add("canonical-dimensions");
    } else if (candidates.length === 1) {
      matches.add(candidates[0].geometryKey);
      reasons.add("unique-family-capacity");
    }
  }
  return {
    geometryKeys: [...matches].sort(),
    evidence: [...reasons].sort(),
    status: matches.size === 1 ? "mapped" : matches.size === 0 ? "unresolved" : "ambiguous",
  } as const;
}

export async function buildCatalogPlateBacklog() {
  const [masterText, geometryText, cyl9Text] = await Promise.all([
    readFile(masterTruthPath, "utf8"),
    readFile(bodyGeometryPath, "utf8"),
    readFile(cyl9ManifestPath, "utf8"),
  ]);
  const masterRows = parseCsv(masterText);
  const rawGeometryRows = parseCsv(geometryText);
  const geometries = rawGeometryRows.map((row) => ({ ...row, geometryKey: geometryKey(row) }));
  const cyl9 = JSON.parse(cyl9Text) as {
    bodyPlates: Array<{ bodyVariantKey: string; componentVersionId: string; imagePath: string; imageSha256: string }>;
    components: Array<{
      componentKey: string;
      geometryFamilyId: string;
      slot: string;
      source: { originalFilename: string };
      authorityStatus: string;
      authority: { authorityId: string; maskSha256: string } | null;
      variants: Array<{ variantKey: string; materialVariant: string }>;
    }>;
    catalogMappings: unknown[];
  };
  const bodyFamilies = new Set(geometries.map((row) => row.family));
  const bottleRows = masterRows.filter((row) => bodyFamilies.has(row.family));
  const componentRows = masterRows.filter((row) => COMPONENT_FAMILIES.has(row.family));
  const localComponentsBySource = groupBy(cyl9.components, (component) => token(component.source.originalFilename));

  const componentIdentities = [...groupBy(componentRows, (row) => row.websiteSku || row.graceSku).entries()]
    .map(([sourceIdentity, rows]) => {
      const localComponents = localComponentsBySource.get(token(sourceIdentity)) ?? [];
      const slotProposal = unique(rows.map(proposedSlot));
      const issues = [
        ...(rows.length > 1 ? ["duplicate-source-rows-require-alias-review"] : []),
        ...(slotProposal.length !== 1 ? ["conflicting-slot-proposal"] : []),
        ...(slotProposal.some((slotName) => !new Set(["cap", "roller", "sprayer", "overcap", "pump"]).has(slotName)) ? ["release-slot-contract-extension-required"] : []),
      ];
      return {
        sourceIdentity,
        websiteSkus: unique(rows.map((row) => row.websiteSku)),
        graceSkus: unique(rows.map((row) => row.graceSku)),
        family: unique(rows.map((row) => row.family)),
        neckThreadSizes: unique(rows.map((row) => row.neckThreadSize)),
        applicators: unique(rows.map((row) => row.applicator)),
        capStyles: unique(rows.map((row) => row.capStyle)),
        capColors: unique(rows.map((row) => row.capColor)),
        trimColors: unique(rows.map((row) => row.trimColor)),
        itemNames: unique(rows.map((row) => row.itemName)),
        materials: unique(rows.map((row) => row.material)),
        assemblyTypes: unique(rows.map((row) => row.assemblyType)),
        imageUrls: unique(rows.map((row) => row.imageUrl)),
        productUrls: unique(rows.map((row) => row.productUrl)),
        siteMeasuredRenderUrls: unique(rows.map((row) => row.site_measuredRenderUrl)),
        siteDepthviewRenderUrls: unique(rows.map((row) => row.site_depthviewRenderUrl)),
        slotProposal,
        sourceRowCount: rows.length,
        sourceReferenceStatus: rows.some((row) => row.imageUrl || row.site_measuredRenderUrl)
          ? "reference-url-observed"
          : "reference-url-missing",
        localPlateVariants: localComponents.flatMap((component) => component.variants.map((variant) => ({
          componentKey: component.componentKey,
          geometryFamilyId: component.geometryFamilyId,
          slot: component.slot,
          authorityStatus: component.authorityStatus,
          authorityId: component.authority?.authorityId ?? null,
          authorityMaskSha256: component.authority?.maskSha256 ?? null,
          variantKey: variant.variantKey,
          materialVariant: variant.materialVariant,
        }))),
        status: localComponents.length > 0 ? "local-candidate-library-exists" : issues.length > 0 ? "manual-review-required" : "source-inventory-only",
        issues,
      };
    })
    .sort((left, right) => left.sourceIdentity.localeCompare(right.sourceIdentity));

  const catalogIdentities = [...groupBy(bottleRows, (row) => row.websiteSku).entries()]
    .map(([websiteSku, rows]) => {
      const geometry = resolveGeometry(rows, geometries);
      const applicatorDescriptors = unique(rows.map((row) => JSON.stringify({
        slot: applicatorSlot(row.applicator),
        applicator: row.applicator,
        neckThreadSize: row.neckThreadSize,
        ballMaterial: row.ballMaterial,
        capColor: row.capColor,
        trimColor: row.trimColor,
        requiresTassel: row.applicator === "Vintage Bulb Sprayer with Tassel",
      }))).map((value) => JSON.parse(value));
      const closureDescriptors = unique(rows.map((row) => JSON.stringify({
        required: Boolean(row.capStyle || row.capColor),
        neckThreadSize: row.neckThreadSize,
        capStyle: row.capStyle,
        capHeight: row.capHeight,
        capColor: row.capColor,
        trimColor: row.trimColor,
      }))).map((value) => JSON.parse(value));
      const issues = [
        ...(rows.length > 1 ? ["duplicate-website-sku-source-rows"] : []),
        ...(geometry.status !== "mapped" ? [`body-geometry-${geometry.status}`] : []),
        ...(applicatorDescriptors.length > 1 ? ["conflicting-applicator-descriptors"] : []),
        ...(closureDescriptors.length > 1 ? ["conflicting-closure-descriptors"] : []),
        ...(unique(rows.map((row) => row.color)).includes("White") ? ["white-body-truth-review-required"] : []),
      ];
      return {
        websiteSku,
        graceSkus: unique(rows.map((row) => row.graceSku)),
        family: unique(rows.map((row) => row.family)),
        capacityMl: unique(rows.map((row) => row.capacityMl)),
        bodyColors: unique(rows.map((row) => row.color)),
        geometry,
        applicatorDescriptors,
        closureDescriptors,
        componentResolutionStatus: "descriptor-only-no-component-source-link",
        sourceRows: rows.map(relevantTruth),
        status: issues.length > 0 ? "manual-review-required" : "inventory-ready",
        issues,
      };
    })
    .sort((left, right) => left.websiteSku.localeCompare(right.websiteSku));

  const families = [...groupBy(geometries, (row) => row.family).entries()].map(([familyName, rows]) => {
    const familyCatalog = catalogIdentities.filter((identity) => identity.family.includes(familyName));
    return {
      familyKey: slug(familyName).toUpperCase(),
      familyName,
      geometryCount: rows.length,
      bodyAppearanceRequirementCount: rows.reduce((sum, row) => sum + split(row.colors).length, 0),
      catalogIdentityCount: familyCatalog.length,
      geometries: rows.map((row) => ({
        geometryKey: row.geometryKey,
        capacityMl: numeric(row.capacityMl),
        dimensionsMm: {
          bodyHeight: numeric(row.bodyHeightMm),
          widthAxis: numeric(row.widthAxisMm),
          depthAxis: numeric(row.depthAxisMm),
          axisSemantics: row.axisSemantics,
        },
        sourceVariantCount: numeric(row.variantCount),
        requiredBodyAppearances: split(row.colors).map((color) => ({
          color,
          status: color === "White" ? "manual-body-truth-review" : "authority-and-plate-required",
        })),
        applicators: split(row.applicators),
        productGroupSlugs: split(row.productGroupSlugs),
        conflictFlags: split(row.conflictFlagCounts.replace(/;/g, "|")),
        status: "inventory-only-no-approved-body-authority",
      })),
    };
  }).sort((left, right) => left.familyName.localeCompare(right.familyName));

  const geometryMapped = catalogIdentities.filter((identity) => identity.geometry.status === "mapped").length;
  const bodyAppearanceRequirementCount = families.reduce((sum, family) => sum + family.bodyAppearanceRequirementCount, 0);
  const supportedSlots = new Set(["cap", "roller", "sprayer", "overcap", "pump"]);
  const catalogRequiredSlots = unique([
    ...catalogIdentities.flatMap((identity) => identity.applicatorDescriptors.flatMap((descriptor) => descriptor.slot ? [descriptor.slot] : [])),
    ...catalogIdentities.flatMap((identity) => identity.closureDescriptors.some((descriptor) => descriptor.required) ? ["cap"] : []),
  ]);
  const componentSourceProposedSlots = unique(componentIdentities.flatMap((identity) => identity.slotProposal));
  const localPilotSlots = unique(cyl9.components.map((component) => component.slot));
  const contractExtensionSlots = catalogRequiredSlots.filter((slotName) => !supportedSlots.has(slotName));
  const sourceMissingRequiredSlots = catalogRequiredSlots.filter((slotName) =>
    !componentSourceProposedSlots.includes(slotName) && !localPilotSlots.includes(slotName)
  );
  const backlog = {
    schemaVersion: 1,
    scope: "Best Bottles catalog-wide paper-doll plate inventory",
    sourcePolicy: "inventory-only; compatibility and physical deduplication require explicit evidence",
    sources: {
      masterTruth: { path: path.relative(workspaceRoot, masterTruthPath), sha256: sha256(masterText), rowCount: masterRows.length },
      bodyGeometry: { path: path.relative(workspaceRoot, bodyGeometryPath), sha256: sha256(geometryText), rowCount: geometries.length },
      currentPilot: { path: path.relative(workspaceRoot, cyl9ManifestPath), sha256: sha256(cyl9Text) },
    },
    summary: {
      bodyFamilyCount: families.length,
      bodyGeometryCount: geometries.length,
      bodyAppearanceRequirementCount,
      existingLockedBodyPlateCount: cyl9.bodyPlates.length,
      catalogBottleSourceRowCount: bottleRows.length,
      catalogBottleIdentityCount: catalogIdentities.length,
      geometryMappedCatalogIdentityCount: geometryMapped,
      geometryReviewCatalogIdentityCount: catalogIdentities.length - geometryMapped,
      componentSourceRowCount: componentRows.length,
      componentSourceIdentityCount: componentIdentities.length,
      exactWebsiteComponentSkuCount: componentIdentities.filter((identity) => identity.websiteSkus.length > 0).length,
      existingLocalComponentVariantCount: cyl9.components.reduce((sum, component) => sum + component.variants.length, 0),
      componentIdentitiesWithLocalCandidates: componentIdentities.filter((identity) => identity.localPlateVariants.length > 0).length,
      assemblyComponentLinksResolved: 0,
      catalogRequiredSlots,
      componentSourceProposedSlots,
      localPilotSlots,
      sourceMissingRequiredSlots,
      contractExtensionSlots,
    },
    currentPilot: {
      familyKey: "CYL-9ML",
      lockedBodyPlates: cyl9.bodyPlates,
      localComponentVariantCount: cyl9.components.reduce((sum, component) => sum + component.variants.length, 0),
      exactCatalogMappings: cyl9.catalogMappings.length,
    },
    recommendedNextPilot: {
      familyKey: "CYL-5ML-13-415",
      reason: "highest-volume remaining Cylinder cohort using only cap, fine-mist, and roller responsibilities already proven by CYL-9ML",
      authorityStatus: "missing",
      sourceGeometryKeys: geometries.filter((row) => row.family === "Cylinder" && row.capacityMl === "5").map((row) => row.geometryKey),
      stopCondition: "do not generate plates until clean body authorities and exact component compatibility are registered",
    },
    families,
    componentSourceIdentities: componentIdentities,
    catalogAssemblyBacklog: catalogIdentities,
    reviewPolicy: {
      duplicateRows: "quarantine until exact website SKU truth is reconciled",
      componentCompatibility: "do not link descriptor to component source from filenames or visual similarity",
      whiteBodyRows: "review for closure-color drift before creating a body plate",
      unsupportedSlots: "extend the database and release contracts before production use",
      generation: "authority first; candidates remain mutable until exact-alpha clamp and named approval",
    },
  };
  return backlog;
}

function markdown(backlog: Awaited<ReturnType<typeof buildCatalogPlateBacklog>>): string {
  const summary = backlog.summary;
  const rows = backlog.families.map((family) => `| ${family.familyName} | ${family.geometryCount} | ${family.bodyAppearanceRequirementCount} | ${family.catalogIdentityCount} |`).join("\n");
  return `# Best Bottles catalog-wide paper-doll plate backlog

**Source posture:** read-only canonical inventory. No compatibility relationship is inferred from a filename or visual resemblance.

## Exact current scope

- ${summary.bodyFamilyCount} bottle families.
- ${summary.bodyGeometryCount} measured body geometries.
- ${summary.bodyAppearanceRequirementCount} source-stated body geometry/color plate requirements.
- ${summary.catalogBottleIdentityCount} unique bottle website SKU identities from ${summary.catalogBottleSourceRowCount} source rows.
- ${summary.geometryMappedCatalogIdentityCount} SKU identities map to one measured geometry; ${summary.geometryReviewCatalogIdentityCount} remain ambiguous or unresolved.
- ${summary.componentSourceIdentityCount} explicit component-source identities from ${summary.componentSourceRowCount} source rows.
- ${summary.existingLockedBodyPlateCount} locked body plates and ${summary.existingLocalComponentVariantCount} local component candidates currently exist in the CYL-9ML pilot.
- 0 catalog-wide assembly-to-component source links are claimed. Those links require verified physical compatibility.

## What “complete” still requires

The counts above are an inventory, not a claim that every appearance is a unique physical model. Component-source duplicates, aliases, and shared tooling must be physically reconciled before deduplication. Every body appearance needs an approved authority/render or plate; every dispensing component needs a geometry authority, material candidates, five-body/family review, shared placement, and immutable release membership.

## Family backlog

| Family | Measured geometries | Body appearance requirements | Catalog SKU identities |
|---|---:|---:|---:|
${rows}

## Next pilot

**CYL-5ML-13-415** is the next recommended factory because it is the largest remaining Cylinder cohort that stays inside the already-proven cap, fine-mist, and roller responsibilities. It is not ready for generation yet: clean body authorities and exact component compatibility remain required.

## Non-negotiable review queues

- Duplicate website-SKU source rows remain quarantined.
- White-body rows remain blocked where “white” may actually describe the closure.
- Dropper, reducer, glass-rod, stopper, and bulb/tassel parts require release-slot contract extensions.
- Descriptor-only assembly requirements are not linked to component sources until physical compatibility is verified.
- Current Release and Sanity remain untouched by this inventory.
`;
}

async function main() {
  const backlog = await buildCatalogPlateBacklog();
  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(backlog, null, 2)}\n`, "utf8"),
    writeFile(reportPath, markdown(backlog), "utf8"),
  ]);
  console.log(JSON.stringify({ outputPath, reportPath, summary: backlog.summary, recommendedNextPilot: backlog.recommendedNextPilot }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
