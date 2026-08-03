import { readFile } from "node:fs/promises";

import {
  PaperDollFamilyProductionManifestSchema,
} from "../../../../src/lib/paperDoll/componentPlateContract";
import { attachCyl9CatalogMappings } from "../../../../src/lib/paperDoll/cyl9ComponentFactory";
import { PaperDollFamilyIntakeSchema } from "../../../../src/lib/paperDoll/familyIntakeContract";

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error("Usage: validate_family_manifest.ts <manifest.json>");

const input = JSON.parse(await readFile(manifestPath, "utf8"));
const productionResult = PaperDollFamilyProductionManifestSchema.safeParse(input);
if (!productionResult.success) {
  const intake = PaperDollFamilyIntakeSchema.parse(input);
  process.stdout.write(`${JSON.stringify({
    valid: true,
    manifestKind: "family-intake",
    familyKey: intake.familyKey,
    geometryCount: intake.geometries.length,
    bodyAppearanceCount: intake.bodyAppearances.length,
    componentRequirementCount: intake.componentRequirements.length,
    catalogIdentityCount: intake.catalogIdentities.length,
    approvedAuthorityCount: intake.bodyAppearances.filter((row) => row.authorityStatus === "approved").length,
    verifiedCompatibilityCount: intake.componentRequirements.filter((row) => row.compatibilityStatus === "verified").length,
    blockers: intake.blockers,
    mutationPolicy: intake.mutationPolicy,
  }, null, 2)}\n`);
  process.exit(0);
}
const parsed = productionResult.data;
const productionManifest = parsed.familyKey === "CYL-9ML"
  ? attachCyl9CatalogMappings(parsed)
  : parsed;

process.stdout.write(`${JSON.stringify({
  valid: true,
  manifestKind: "production-manifest",
  familyKey: parsed.familyKey,
  bodyPlateCount: parsed.bodyPlates.length,
  componentCount: parsed.components.length,
  placementCount: parsed.placements.length,
  catalogMappingCount: productionManifest.catalogMappings.length,
  exactCatalogIdentityCount: productionManifest.catalogMappings.filter((row) => (
    row.graceSku && row.websiteSku
  )).length,
  catalogReviewIssueCount: productionManifest.catalogReviewIssues.length,
  approvedAuthorityCount: parsed.components.filter((row) => row.authorityStatus === "approved").length,
}, null, 2)}\n`);
