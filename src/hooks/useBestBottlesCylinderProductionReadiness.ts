import { useQuery } from "@tanstack/react-query";

import {
  BEST_BOTTLES_CYLINDER_PRODUCTION_READINESS_VERSION,
  cylinderProductionIdentityKey,
  type CylinderProductionReadinessArtifact,
  type CylinderProductionReadinessRow,
} from "@/lib/bestBottlesCylinderProductionCutover";
import {
  BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION,
  BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_PATH,
  buildCylinderCanonicalRosterAuthority,
  buildCylinderRoleAwareReadinessIndex,
  type CylinderRoleAwareReadinessArtifact,
  type CylinderRoleAwareReadinessIndex,
} from "@/lib/bestBottlesCylinderRoleAuthority";
export {
  BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_PATH,
  BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION,
  buildCylinderRoleAwareReadinessIndex,
  buildCylinderCanonicalRosterAuthority,
  getCylinderGenerationTopologyForPreset,
  getCylinderReferenceForPreset,
  getCylinderReferenceRoleForPreset,
  getCylinderRoleAwareReadinessForIdentity,
  getCylinderVerifiedReferenceCacheKey,
  invokeWithCylinderVerifiedReference,
  isCylinderReferenceAuthorizedForPreset,
  resolveCylinderImmutableReferenceForPreset,
  verifyCylinderImmutableReferenceBytesForPreset,
} from "@/lib/bestBottlesCylinderRoleAuthority";
export type {
  CylinderGenerationTopology,
  CylinderReferenceApprovedException,
  CylinderReferenceRoleId,
  CylinderReferenceTopology,
  CylinderRoleAwareReadinessArtifact,
  CylinderRoleAwareReadinessIndex,
  CylinderRoleAwareReadinessRow,
  CylinderRoleAwareReference,
  CylinderVerifiedReferenceBytes,
} from "@/lib/bestBottlesCylinderRoleAuthority";

export type CylinderProductionReadinessIndex = Map<string, CylinderProductionReadinessRow>;

export function buildCylinderProductionReadinessIndex(
  artifact: CylinderProductionReadinessArtifact,
): CylinderProductionReadinessIndex {
  if (artifact.version !== BEST_BOTTLES_CYLINDER_PRODUCTION_READINESS_VERSION) {
    throw new Error(`Unexpected Cylinder readiness version ${String(artifact.version)}.`);
  }
  if (
    artifact.summary.canonicalIdentityCount !== artifact.rows.length ||
    artifact.summary.productionQualifiedCount !== artifact.rows.filter((row) => row.status === "production-qualified").length ||
    artifact.summary.totalBlockedCount !== artifact.rows.filter((row) => row.status === "blocked").length ||
    artifact.summary.externalWriteCount !== 0
  ) {
    throw new Error(
      "Cylinder readiness summary must match its artifact-derived identity, production-qualified, and blocked row totals and prove zero external writes.",
    );
  }

  const index: CylinderProductionReadinessIndex = new Map();
  for (const row of artifact.rows) {
    const key = cylinderProductionIdentityKey(row.websiteSku, row.graceSku);
    if (key !== row.canonicalIdentityKey) {
      throw new Error(`Cylinder identity ${row.canonicalIdentityKey} does not match its exact SKUs.`);
    }
    if (index.has(key)) throw new Error(`Duplicate Cylinder production identity ${key}.`);
    index.set(key, row);
  }
  return index;
}

export function getCylinderProductionReadinessForIdentity(
  index: CylinderProductionReadinessIndex | null | undefined,
  websiteSku: string | null | undefined,
  graceSku: string | null | undefined,
): CylinderProductionReadinessRow | null {
  if (!index || !websiteSku?.trim() || !graceSku?.trim()) return null;
  return index.get(cylinderProductionIdentityKey(websiteSku, graceSku)) ?? null;
}

export function isCylinderPromotedReferenceUrl(
  row: CylinderProductionReadinessRow | null | undefined,
  referenceUrl: string | null | undefined,
): boolean {
  if (row?.status !== "production-qualified" || !row.reference || !referenceUrl?.trim()) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(referenceUrl);
  } catch {
    return false;
  }
  const exportSha256 = row.reference.exportSha256.toLowerCase();
  return parsed.protocol === "https:"
    && parsed.pathname.includes("/storage/v1/object/public/reference-images/")
    && parsed.pathname.includes("/best-bottles/production-references/cylinder/v1/")
    && parsed.pathname.endsWith(`__${exportSha256}.png`);
}

async function loadCylinderProductionReadiness(): Promise<{
  artifact: CylinderProductionReadinessArtifact;
  index: CylinderProductionReadinessIndex;
}> {
  const response = await fetch("/data/best-bottles-cylinder-production-readiness.json", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Cylinder production readiness could not be loaded (${response.status}).`);
  }
  const artifact = await response.json() as CylinderProductionReadinessArtifact;
  return { artifact, index: buildCylinderProductionReadinessIndex(artifact) };
}

async function loadCylinderRoleAwareReadiness(): Promise<{
  artifact: CylinderRoleAwareReadinessArtifact;
  index: CylinderRoleAwareReadinessIndex;
}> {
  const response = await fetch(BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_PATH, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Cylinder role-aware readiness could not be loaded (${response.status}).`);
  }
  const artifact = await response.json() as CylinderRoleAwareReadinessArtifact;
  const provenancePath = artifact.provenance?.productionReadiness?.path;
  if (
    typeof provenancePath !== "string"
    || !/^public\/data\/[a-z0-9._-]+\.json$/i.test(provenancePath)
  ) {
    throw new Error("Cylinder role-aware readiness has an invalid canonical-roster provenance path.");
  }
  const rosterResponse = await fetch(`/${provenancePath.replace(/^public\//, "")}`, {
    cache: "no-store",
  });
  if (!rosterResponse.ok) {
    throw new Error(`Cylinder canonical production roster could not be loaded (${rosterResponse.status}).`);
  }
  const rosterBytes = new Uint8Array(await rosterResponse.arrayBuffer());
  const roster = buildCylinderCanonicalRosterAuthority(artifact, rosterBytes);
  return { artifact, index: buildCylinderRoleAwareReadinessIndex(artifact, roster) };
}

export function useBestBottlesCylinderProductionReadiness() {
  return useQuery({
    queryKey: ["best-bottles-cylinder-production-readiness", BEST_BOTTLES_CYLINDER_PRODUCTION_READINESS_VERSION],
    queryFn: loadCylinderProductionReadiness,
    staleTime: 0,
    retry: false,
  });
}

export function useBestBottlesCylinderRoleAwareReadiness() {
  return useQuery({
    queryKey: [
      "best-bottles-cylinder-role-aware-readiness",
      BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION,
    ],
    queryFn: loadCylinderRoleAwareReadiness,
    staleTime: 0,
    retry: false,
  });
}
