import { readFile } from "node:fs/promises";

import { parsePaperDollFamilyProductionManifest } from "../../../../src/lib/paperDoll/componentPlateContract";
import { buildCyl9ExpectedCatalogMappings } from "../../../../src/lib/paperDoll/cyl9ComponentFactory";

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error("Usage: summarize_family_status.ts <manifest.json>");
const manifest = parsePaperDollFamilyProductionManifest(JSON.parse(await readFile(manifestPath, "utf8")));
const mappings = manifest.familyKey === "CYL-9ML" && manifest.catalogMappings.length === 0
  ? buildCyl9ExpectedCatalogMappings(manifest)
  : manifest.catalogMappings;
const approvedAuthorities = manifest.components.filter((row) => row.authorityStatus === "approved").length;
const lockedPlacements = manifest.placements.filter((row) => row.locked).length;
const geometryFamilies = new Set(manifest.components.map((row) => row.geometryFamilyId)).size;

process.stdout.write(`${JSON.stringify({
  familyKey: manifest.familyKey,
  counts: {
    bodies: manifest.bodyPlates.length,
    components: manifest.components.length,
    geometryFamilies,
    approvedAuthorities,
    placements: manifest.placements.length,
    lockedPlacements,
    catalogMappings: mappings.length,
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
