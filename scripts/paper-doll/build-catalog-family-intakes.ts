import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parsePaperDollCatalogFamilyIntakeIndex,
  parsePaperDollFamilyIntake,
  type PaperDollCatalogFamilyIntakeIndex,
  type PaperDollFamilyIntake,
} from "../../src/lib/paperDoll/familyIntakeContract";
import { buildFamilyIntakeFromCatalogBacklog } from "./build-next-family-intake";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const backlogPath = path.join(workspaceRoot, "docs/paper-doll-rig/catalog-wide-plate-backlog.json");
const outputPath = path.join(workspaceRoot, "docs/paper-doll-rig/catalog-family-intakes.json");
const reportPath = path.join(workspaceRoot, "docs/paper-doll-rig/CATALOG-FAMILY-INTAKES.md");

const CURRENT_PRODUCTION_SLOTS = new Set(["cap", "roller", "sprayer", "overcap", "pump"]);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value: string): string {
  return value.normalize("NFKD").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function unique(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()))].sort();
}

function cohortEvidence(identity: any): { family: string; capacityMl: string; neckFinish: string } {
  const family = unique(identity.family).join("|") || "UNKNOWN";
  const capacityMl = unique(identity.capacityMl).join("|") || "UNKNOWN";
  const descriptors = [...identity.applicatorDescriptors, ...identity.closureDescriptors];
  const neckFinish = unique(descriptors.map((descriptor: any) => descriptor.neckThreadSize)).join("|") || "UNKNOWN";
  return { family, capacityMl, neckFinish };
}

function familyKeyFor(evidence: { family: string; capacityMl: string; neckFinish: string }): string {
  const family = evidence.family === "Cylinder" ? "CYL" : slug(evidence.family);
  return `${family}-${slug(evidence.capacityMl)}ML-${slug(evidence.neckFinish)}`;
}

function neckNeedsReview(neckFinish: string): boolean {
  return neckFinish === "UNKNOWN" || neckFinish.includes("|") || /^SIZE:/i.test(neckFinish);
}

function buildBlockers(identities: any[], evidence: { neckFinish: string }): string[] {
  const blockers = new Set([
    "body-geometry-authorities-missing",
    "body-appearance-plates-missing",
    "component-source-links-unverified",
    "component-geometry-authorities-missing",
  ]);
  if (neckNeedsReview(evidence.neckFinish)) blockers.add("neck-finish-review-required");
  if (identities.some((identity) => identity.issues.length > 0)) blockers.add("catalog-truth-review-open");
  return [...blockers];
}

function withDerivedBlockers(intake: PaperDollFamilyIntake): PaperDollFamilyIntake {
  const blockers = new Set(intake.blockers);
  if (intake.geometries.length > 1) blockers.add("multiple-measured-geometries-require-separate-authority-review");
  if (intake.componentRequirements.length === 0) blockers.add("no-supported-component-responsibility-resolved");
  if (intake.componentRequirements.some((requirement) => !CURRENT_PRODUCTION_SLOTS.has(requirement.slot))) {
    blockers.add("release-slot-contract-extension-required");
  }
  return parsePaperDollFamilyIntake({ ...intake, blockers: [...blockers] });
}

export async function buildCatalogFamilyIntakeIndex(): Promise<PaperDollCatalogFamilyIntakeIndex> {
  const backlogText = await readFile(backlogPath, "utf8");
  const backlog = JSON.parse(backlogText) as any;
  const groups = new Map<string, { evidence: ReturnType<typeof cohortEvidence>; identities: any[] }>();
  const unresolvedCatalogIdentities: PaperDollCatalogFamilyIntakeIndex["unresolvedCatalogIdentities"] = [];

  for (const identity of backlog.catalogAssemblyBacklog) {
    if (identity.geometry.status !== "mapped" || identity.geometry.geometryKeys.length !== 1) {
      unresolvedCatalogIdentities.push({
        websiteSku: identity.websiteSku,
        graceSkus: identity.graceSkus,
        family: identity.family,
        capacityMl: identity.capacityMl,
        geometryStatus: identity.geometry.status,
        geometryKeys: identity.geometry.geometryKeys,
        issues: identity.issues,
      });
      continue;
    }
    const evidence = cohortEvidence(identity);
    const key = JSON.stringify(evidence);
    const current = groups.get(key) ?? { evidence, identities: [] };
    current.identities.push(identity);
    groups.set(key, current);
  }

  const cohorts = [...groups.values()].map(({ evidence, identities }) => withDerivedBlockers(buildFamilyIntakeFromCatalogBacklog({
    backlog,
    backlogText,
    familyKey: familyKeyFor(evidence),
    familyName: `${evidence.family} ${evidence.capacityMl} ml ${evidence.neckFinish}`,
    scope: `Canonical ${evidence.family} ${evidence.capacityMl} ml catalog identities observed with neck/fit evidence ${evidence.neckFinish}; pre-authority intake only.`,
    identities,
    blockers: buildBlockers(identities, evidence),
  }))).sort((left, right) => left.familyKey.localeCompare(right.familyKey));

  const mappedSkus = cohorts.flatMap((cohort) => cohort.catalogIdentities.map((identity) => identity.websiteSku));
  const uniqueGeometryKeys = new Set(cohorts.flatMap((cohort) => cohort.geometries.map((geometry) => geometry.geometryKey)));
  return parsePaperDollCatalogFamilyIntakeIndex({
    schemaVersion: 1,
    sourceBacklogPath: path.relative(workspaceRoot, backlogPath),
    sourceBacklogSha256: sha256(backlogText),
    summary: {
      cohortCount: cohorts.length,
      catalogIdentityCount: mappedSkus.length,
      uniqueGeometryCount: uniqueGeometryKeys.size,
      geometryMembershipCount: cohorts.reduce((sum, cohort) => sum + cohort.geometries.length, 0),
      bodyAppearanceRequirementCount: cohorts.reduce((sum, cohort) => sum + cohort.bodyAppearances.length, 0),
      componentRequirementCount: cohorts.reduce((sum, cohort) => sum + cohort.componentRequirements.length, 0),
      unresolvedIdentityCount: unresolvedCatalogIdentities.length,
    },
    cohorts,
    unresolvedCatalogIdentities: unresolvedCatalogIdentities.sort((left, right) => left.websiteSku.localeCompare(right.websiteSku)),
    mutationPolicy: { candidatesGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  });
}

function renderReport(index: PaperDollCatalogFamilyIntakeIndex): string {
  const slotCounts = new Map<string, number>();
  const familyCounts = new Map<string, { cohorts: number; catalogIdentities: number; appearances: number; requirements: number }>();
  for (const cohort of index.cohorts) {
    for (const requirement of cohort.componentRequirements) slotCounts.set(requirement.slot, (slotCounts.get(requirement.slot) ?? 0) + 1);
    const family = cohort.familyName.replace(/\s+[^ ]+\s+ml\s+.*$/, "");
    const current = familyCounts.get(family) ?? { cohorts: 0, catalogIdentities: 0, appearances: 0, requirements: 0 };
    current.cohorts += 1;
    current.catalogIdentities += cohort.catalogIdentities.length;
    current.appearances += cohort.bodyAppearances.length;
    current.requirements += cohort.componentRequirements.length;
    familyCounts.set(family, current);
  }
  const rows = [...familyCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([family, counts]) => (
    `| ${family} | ${counts.cohorts} | ${counts.catalogIdentities} | ${counts.appearances} | ${counts.requirements} |`
  ));
  return `# Best Bottles catalog family intakes

**Purpose:** exhaustive pre-authority work queue derived from canonical Madison snapshots. These records do not claim component compatibility, generate candidates, approve pixels, change Current Release, or write Sanity.

## Coverage

- ${index.summary.cohortCount} family/capacity/neck-evidence cohorts.
- ${index.summary.catalogIdentityCount} catalog identities mapped to exactly one measured geometry.
- ${index.summary.uniqueGeometryCount} unique measured geometries represented across ${index.summary.geometryMembershipCount} cohort memberships.
- ${index.summary.bodyAppearanceRequirementCount} cohort-local body appearance requirements.
- ${index.summary.componentRequirementCount} cohort-local component responsibilities.
- ${index.summary.unresolvedIdentityCount} catalog identities quarantined outside mapped cohorts.

Component responsibility memberships by slot: ${[...slotCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([slot, count]) => `${slot} ${count}`).join(", ") || "none"}.

Counts are cohort-local work memberships, not a claim that every membership requires a unique physical model. Cross-cohort reuse must be earned by verified geometry and compatibility evidence.

## Family queue

| Family | Cohorts | Mapped catalog identities | Body appearances | Component responsibilities |
|---|---:|---:|---:|---:|
${rows.join("\n")}

## Hard gates

- Every authority is currently missing unless a stricter production manifest says otherwise.
- Every component source link and geometry compatibility claim remains unverified.
- Unknown, conflicting, and malformed neck evidence stays review-blocked.
- Integrated sprayer and pump finishes are not duplicated as separate caps.
- Roll-on overcaps remain independent closure responsibilities.
- No generation or production mutation is performed by this inventory.
`;
}

async function main() {
  const index = await buildCatalogFamilyIntakeIndex();
  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`, "utf8"),
    writeFile(reportPath, renderReport(index), "utf8"),
  ]);
  console.log(JSON.stringify({ outputPath, reportPath, summary: index.summary, mutationPolicy: index.mutationPolicy }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
