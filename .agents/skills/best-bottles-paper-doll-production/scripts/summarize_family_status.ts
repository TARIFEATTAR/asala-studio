import { readFile } from "node:fs/promises";

import { PaperDollFamilyProductionManifestSchema } from "../../../../src/lib/paperDoll/componentPlateContract";
import { attachCyl9CatalogMappings } from "../../../../src/lib/paperDoll/cyl9ComponentFactory";
import { PaperDollFamilyIntakeSchema } from "../../../../src/lib/paperDoll/familyIntakeContract";

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error("Usage: summarize_family_status.ts <manifest.json>");
const input = JSON.parse(await readFile(manifestPath, "utf8"));
const productionResult = PaperDollFamilyProductionManifestSchema.safeParse(input);
if (!productionResult.success) {
  const intake = PaperDollFamilyIntakeSchema.parse(input);
  const slotCounts = Object.fromEntries([...new Set(intake.componentRequirements.map((row) => row.slot))]
    .sort()
    .map((slot) => [slot, intake.componentRequirements.filter((row) => row.slot === slot).length]));
  process.stdout.write(`${JSON.stringify({
    familyKey: intake.familyKey,
    manifestKind: "family-intake",
    counts: {
      geometries: intake.geometries.length,
      bodyAppearances: intake.bodyAppearances.length,
      componentRequirements: intake.componentRequirements.length,
      componentRequirementsBySlot: slotCounts,
      catalogIdentities: intake.catalogIdentities.length,
    },
    blockers: intake.blockers,
    nextAction: "obtain and approve body/component authority evidence; do not generate or write production state",
    mutationPolicy: intake.mutationPolicy,
  }, null, 2)}\n`);
  process.exit(0);
}
const manifest = productionResult.data;
const productionManifest = manifest.familyKey === "CYL-9ML"
  ? attachCyl9CatalogMappings(manifest)
  : manifest;
const mappings = productionManifest.catalogMappings;
const approvedAuthorities = manifest.components.filter((row) => row.authorityStatus === "approved").length;
const lockedPlacements = manifest.placements.filter((row) => row.locked).length;
const geometryFamilies = new Set(manifest.components.map((row) => row.geometryFamilyId)).size;

process.stdout.write(`${JSON.stringify({
  familyKey: manifest.familyKey,
  manifestKind: "production-manifest",
  counts: {
    bodies: manifest.bodyPlates.length,
    components: manifest.components.length,
    geometryFamilies,
    approvedAuthorities,
    placements: manifest.placements.length,
    lockedPlacements,
    catalogMappings: mappings.length,
    exactCatalogIdentities: mappings.filter((row) => row.graceSku && row.websiteSku).length,
    catalogReviewIssues: productionManifest.catalogReviewIssues.length,
  },
  blockers: {
    authority: manifest.components.length - approvedAuthorities,
    familyFitAndPlacement: geometryFamilies - lockedPlacements,
    materialCandidates: "read lifecycle ledger",
    namedApprovals: "read lifecycle ledger",
    currentRelease: "read release head",
    sanityDraft: "read Sanity sync ledger",
    publicPublication: "requires separate named approval",
  },
  mutationPolicy: "status-only; no writes",
}, null, 2)}\n`);
