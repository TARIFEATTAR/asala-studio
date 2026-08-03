import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parsePaperDollFamilyIntake, type PaperDollFamilyIntake, type PaperDollInventorySlot } from "../../src/lib/paperDoll/familyIntakeContract";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const backlogPath = path.join(workspaceRoot, "docs/paper-doll-rig/catalog-wide-plate-backlog.json");
const outputPath = path.join(workspaceRoot, "docs/paper-doll-rig/cyl5-family-intake.json");
const SUPPORTED_INTAKE_SLOTS = new Set<PaperDollInventorySlot>([
  "cap", "roller", "sprayer", "overcap", "pump", "dropper", "reducer", "glass-rod", "stopper", "bulb-sprayer",
]);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requirementKey(slot: string, descriptor: unknown): string {
  return `desired__${slug(slot)}__${sha256(canonical(descriptor)).slice(0, 12)}`;
}

function normalizedApplicatorDescriptor(descriptor: Record<string, unknown>): { slot: PaperDollInventorySlot; descriptor: Record<string, unknown> } | null {
  const slot = descriptor.slot;
  if (typeof slot !== "string") return null;
  if (slot === "roller") {
    return {
      slot,
      descriptor: {
        applicator: descriptor.applicator,
        neckThreadSize: descriptor.neckThreadSize,
        ballMaterial: descriptor.ballMaterial,
      },
    };
  }
  if (slot === "sprayer") {
    return {
      slot,
      descriptor: {
        applicator: descriptor.applicator,
        neckThreadSize: descriptor.neckThreadSize,
        finish: descriptor.capColor,
        trimColor: descriptor.trimColor,
      },
    };
  }
  if (!SUPPORTED_INTAKE_SLOTS.has(slot as PaperDollInventorySlot)) return null;
  return { slot: slot as PaperDollInventorySlot, descriptor };
}

function normalizedClosureDescriptor(descriptor: Record<string, unknown>): Record<string, unknown> {
  const capStyle = descriptor.capStyle === "Short Cap" ? "Short" : descriptor.capStyle;
  const capColor = typeof descriptor.capColor === "string" && capStyle === "Short"
    ? descriptor.capColor.replace(/^Short\s+/i, "")
    : descriptor.capColor;
  return {
    neckThreadSize: descriptor.neckThreadSize,
    capStyle,
    capColor,
    trimColor: descriptor.trimColor,
  };
}

function closureIsIntegratedWithApplicator(
  closure: Record<string, unknown>,
  applicators: Array<Record<string, unknown>>,
): boolean {
  const slots = new Set(applicators.map((descriptor) => descriptor.slot).filter((slot): slot is string => typeof slot === "string"));
  return (closure.capStyle === "Spray" && slots.has("sprayer"))
    || (closure.capStyle === "Pump" && slots.has("pump"));
}

export function buildFamilyIntakeFromCatalogBacklog(input: {
  backlog: any;
  backlogText: string;
  familyKey: string;
  familyName: string;
  scope: string;
  identities: any[];
  blockers: string[];
  additionalGeometryKeys?: string[];
}): PaperDollFamilyIntake {
  const { backlog, backlogText, familyKey, familyName, scope, identities, blockers, additionalGeometryKeys = [] } = input;
  const geometryKeys = new Set<string>([
    ...identities.flatMap((identity) => identity.geometry.geometryKeys),
    ...additionalGeometryKeys,
  ]);
  const geometryByKey = new Map<string, any>(backlog.families.flatMap((family: any) => family.geometries).map((geometry: any) => [geometry.geometryKey, geometry]));
  const geometries = [...geometryKeys].map((geometryKey) => {
    const geometry = geometryByKey.get(geometryKey);
    if (!geometry) throw new Error(`Catalog intake references missing geometry ${geometryKey}.`);
    return geometry;
  }).sort((left, right) => left.geometryKey.localeCompare(right.geometryKey));

  const requirements = new Map<string, { slot: PaperDollInventorySlot; descriptor: Record<string, unknown>; geometryKeys: Set<string> }>();
  const identityRequirementKeys = new Map<string, string[]>();
  for (const identity of identities) {
    const keys: string[] = [];
    for (const rawDescriptor of identity.applicatorDescriptors) {
      const normalized = normalizedApplicatorDescriptor(rawDescriptor);
      if (!normalized) continue;
      const key = requirementKey(normalized.slot, normalized.descriptor);
      const current = requirements.get(key) ?? { slot: normalized.slot, descriptor: normalized.descriptor, geometryKeys: new Set<string>() };
      identity.geometry.geometryKeys.forEach((geometryKey: string) => current.geometryKeys.add(geometryKey));
      requirements.set(key, current);
      keys.push(key);
    }
    for (const rawDescriptor of identity.closureDescriptors) {
      if (!rawDescriptor.required || closureIsIntegratedWithApplicator(rawDescriptor, identity.applicatorDescriptors)) continue;
      const descriptor = normalizedClosureDescriptor(rawDescriptor);
      const key = requirementKey("cap", descriptor);
      const current = requirements.get(key) ?? { slot: "cap" as const, descriptor, geometryKeys: new Set<string>() };
      identity.geometry.geometryKeys.forEach((geometryKey: string) => current.geometryKeys.add(geometryKey));
      requirements.set(key, current);
      keys.push(key);
    }
    identityRequirementKeys.set(identity.websiteSku, [...new Set(keys)].sort());
  }

  return parsePaperDollFamilyIntake({
    schemaVersion: 1,
    familyKey,
    familyName,
    scope,
    sourceBacklogPath: path.relative(workspaceRoot, backlogPath),
    sourceBacklogSha256: sha256(backlogText),
    canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
    geometries: geometries.map((geometry: any) => ({
      geometryKey: geometry.geometryKey,
      capacityMl: geometry.capacityMl,
      dimensionsMm: geometry.dimensionsMm,
      productGroupSlugs: geometry.productGroupSlugs,
      conflictFlags: geometry.conflictFlags,
      authorityStatus: "missing",
    })),
    bodyAppearances: geometries.flatMap((geometry: any) => geometry.requiredBodyAppearances.map((appearance: any) => ({
      bodyAppearanceKey: `${geometry.geometryKey}:${slug(appearance.color)}`,
      geometryKey: geometry.geometryKey,
      color: appearance.color,
      truthStatus: appearance.status === "manual-body-truth-review" ? "manual-review-required" : "ready",
      authorityStatus: "missing",
      plateStatus: "missing",
    }))),
    componentRequirements: [...requirements.entries()].map(([componentRequirementKey, requirement]) => ({
      componentRequirementKey,
      slot: requirement.slot,
      descriptor: requirement.descriptor,
      compatibleGeometryKeys: [...requirement.geometryKeys].sort(),
      sourceIdentity: null,
      compatibilityStatus: "unverified",
      authorityStatus: "missing",
    })).sort((left, right) => left.componentRequirementKey.localeCompare(right.componentRequirementKey)),
    catalogIdentities: identities.map((identity: any) => ({
      websiteSku: identity.websiteSku,
      graceSkus: identity.graceSkus,
      bodyGeometryKeys: identity.geometry.geometryKeys,
      bodyColors: identity.bodyColors,
      componentRequirementKeys: identityRequirementKeys.get(identity.websiteSku) ?? [],
      reviewStatus: identity.status === "inventory-ready" && identity.bodyColors.length > 0 ? "ready" : "manual-review-required",
      issues: [...identity.issues, ...(identity.bodyColors.length === 0 ? ["body-color-missing"] : [])],
    })),
    blockers,
    mutationPolicy: { candidatesGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  });
}

export async function buildCyl5FamilyIntake(): Promise<PaperDollFamilyIntake> {
  const backlogText = await readFile(backlogPath, "utf8");
  const backlog = JSON.parse(backlogText) as any;
  const family = backlog.families.find((item: any) => item.familyName === "Cylinder");
  if (!family) throw new Error("Catalog backlog does not contain Cylinder.");
  const geometries = family.geometries.filter((geometry: any) => geometry.capacityMl === 5);
  const geometryKeys = new Set(geometries.map((geometry: any) => geometry.geometryKey));
  if (geometries.length !== 3) throw new Error(`CYL-5ML intake expects three source geometry records; found ${geometries.length}.`);
  const identities = backlog.catalogAssemblyBacklog.filter((identity: any) =>
    identity.family.includes("Cylinder") && identity.capacityMl.includes("5") && identity.geometry.geometryKeys.some((key: string) => geometryKeys.has(key))
  );
  return buildFamilyIntakeFromCatalogBacklog({
    backlog,
    backlogText,
    familyKey: "CYL-5ML-13-415",
    familyName: "Cylinder 5ml",
    scope: "All canonical 5 ml Cylinder website SKUs mapped to the 13-415 body cohort; authority intake only.",
    identities,
    additionalGeometryKeys: geometries.map((geometry: any) => geometry.geometryKey),
    blockers: [
      "three-body-geometry-authorities-missing",
      "four-body-appearance-plates-missing",
      "component-source-links-unverified",
      "component-geometry-authorities-missing",
      "duplicate-and-white-body-truth-review-open",
    ],
  });
}

async function main() {
  const intake = await buildCyl5FamilyIntake();
  await writeFile(outputPath, `${JSON.stringify(intake, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    outputPath,
    familyKey: intake.familyKey,
    geometryCount: intake.geometries.length,
    bodyAppearanceCount: intake.bodyAppearances.length,
    componentRequirementCount: intake.componentRequirements.length,
    catalogIdentityCount: intake.catalogIdentities.length,
    blockers: intake.blockers,
    mutationPolicy: intake.mutationPolicy,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
