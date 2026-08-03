import { readFile } from "node:fs/promises";

import {
  parsePaperDollFamilyProductionManifest,
} from "../../../../src/lib/paperDoll/componentPlateContract";
import { buildCyl9ExpectedCatalogMappings } from "../../../../src/lib/paperDoll/cyl9ComponentFactory";

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error("Usage: validate_family_manifest.ts <manifest.json>");

const parsed = parsePaperDollFamilyProductionManifest(
  JSON.parse(await readFile(manifestPath, "utf8")),
);
const catalogMappings = parsed.familyKey === "CYL-9ML" && parsed.catalogMappings.length === 0
  ? buildCyl9ExpectedCatalogMappings(parsed)
  : parsed.catalogMappings;

process.stdout.write(`${JSON.stringify({
  valid: true,
  familyKey: parsed.familyKey,
  bodyPlateCount: parsed.bodyPlates.length,
  componentCount: parsed.components.length,
  placementCount: parsed.placements.length,
  catalogMappingCount: catalogMappings.length,
  approvedAuthorityCount: parsed.components.filter((row) => row.authorityStatus === "approved").length,
}, null, 2)}\n`);
