import { createHash } from "node:crypto";

export const BEST_BOTTLES_CYLINDER_SIX_ROLE_PILOT_VERSION =
  "best-bottles-cylinder-six-role-pilot-v1" as const;

export type CylinderPilotRoleTopology =
  | "assembled-cap-on"
  | "fitment-attached-detached-sidecar";

export interface CylinderPilotReferenceInput {
  locator: string;
  sha256: string;
  topology: CylinderPilotRoleTopology;
  sourceLane: string;
  conditioning?: {
    sourceLocator: string;
    sourceSha256: string;
    evidenceRecordLocator: string;
    maskLocator: string;
    maskSha256: string;
    maskSemantics: "transparent-body-material-edit-opaque-hardware-sidecar-bone-preserve";
    identityOverlayLocator: string;
    identityOverlaySha256: string;
    identityOverlaySemantics: "exact-sprayer-closure-sidecar-with-body-removed";
    operation: "pre-generation-whole-role-uniform-conditioning";
    postGenerationMutationAllowed: false;
  };
}

export interface CylinderSixRolePilotProductInput {
  websiteSku: string;
  graceSku: string;
  family: "Cylinder";
  capacityMl: 3 | 5 | 9 | 25 | 50 | 100;
  bodyHeightMm: number;
  widthMm: number;
  depthMm: number;
  heightWithCapMm: number;
  references: {
    identityCapOn: CylinderPilotReferenceInput;
    pdpCapOffSidecar: CylinderPilotReferenceInput;
  };
}

export interface CylinderSixRolePilotInput {
  generatedAt: string;
  canonicalMaster: {
    path: string;
    sha256: string;
  };
  products: CylinderSixRolePilotProductInput[];
}

export interface CylinderSixRolePilotArtifact {
  version: typeof BEST_BOTTLES_CYLINDER_SIX_ROLE_PILOT_VERSION;
  generatedAt: string;
  canonicalMaster: CylinderSixRolePilotInput["canonicalMaster"];
  authorization: {
    scope: "controlled-visual-test-only";
    paidGeneration: "not-authorized-by-manifest";
    remoteWrites: "forbidden";
    publishing: "forbidden";
  };
  summary: {
    productCount: 6;
    roleSlotCount: 12;
    visualTestReadySlotCount: number;
    productionReadyProductCount: number;
    identityBlockedProductCount: number;
  };
  products: Array<{
    websiteSku: string;
    graceSku: string | null;
    capacityMl: CylinderSixRolePilotProductInput["capacityMl"];
    canonicalGeometry: {
      bodyHeightMm: number;
      widthMm: number;
      depthMm: number;
      heightWithCapMm: number;
    };
    visualTestStatus: "ready";
    productionStatus: "ready" | "blocked";
    blockers: string[];
    roles: {
      identityCapOn: CylinderPilotReferenceInput & { role: "identity-cap-on" };
      pdpCapOffSidecar: CylinderPilotReferenceInput & { role: "pdp-cap-off-sidecar" };
    };
  }>;
  sha256: string;
}

const CAPACITIES = [3, 5, 9, 25, 50, 100] as const;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(record[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertHash(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`${label} must be a SHA-256 hash.`);
  }
}

function assertReference(
  role: "identity-cap-on" | "pdp-cap-off-sidecar",
  reference: CylinderPilotReferenceInput,
): void {
  assertHash(reference.sha256, `${role} reference hash`);
  if (!reference.locator || !reference.sourceLane) {
    throw new Error(`${role} requires a locator and source lane.`);
  }
  if (role === "identity-cap-on" && reference.topology !== "assembled-cap-on") {
    throw new Error("identity-cap-on requires assembled-cap-on topology.");
  }
  if (
    role === "pdp-cap-off-sidecar"
    && reference.topology !== "fitment-attached-detached-sidecar"
  ) {
    throw new Error(
      "pdp-cap-off-sidecar requires fitment-attached-detached-sidecar topology.",
    );
  }
  if (reference.conditioning) {
    assertHash(reference.conditioning.sourceSha256, `${role} conditioning source hash`);
    assertHash(reference.conditioning.maskSha256, `${role} conditioning mask hash`);
    assertHash(
      reference.conditioning.identityOverlaySha256,
      `${role} conditioning identity overlay hash`,
    );
    if (
      !reference.conditioning.sourceLocator
      || !reference.conditioning.evidenceRecordLocator
      || !reference.conditioning.maskLocator
      || !reference.conditioning.identityOverlayLocator
    ) throw new Error(`${role} conditioning requires source, evidence, and mask locators.`);
  }
}

export function buildCylinderSixRolePilot(
  input: CylinderSixRolePilotInput,
): CylinderSixRolePilotArtifact {
  assertHash(input.canonicalMaster.sha256, "Canonical master hash");
  if (input.products.length !== 6) {
    throw new Error("Cylinder six-role pilot requires exactly six products.");
  }
  const byCapacity = new Map(input.products.map((row) => [row.capacityMl, row]));
  if (byCapacity.size !== 6 || CAPACITIES.some((capacity) => !byCapacity.has(capacity))) {
    throw new Error("Cylinder six-role pilot requires 3, 5, 9, 25, 50, and 100 mL.");
  }

  const products = CAPACITIES.map((capacityMl) => {
    const row = byCapacity.get(capacityMl)!;
    assertReference("identity-cap-on", row.references.identityCapOn);
    assertReference("pdp-cap-off-sidecar", row.references.pdpCapOffSidecar);
    if (row.references.identityCapOn.sha256 === row.references.pdpCapOffSidecar.sha256) {
      throw new Error(`cross-lane reference reuse detected for ${row.websiteSku}.`);
    }
    for (const [name, value] of Object.entries({
      bodyHeightMm: row.bodyHeightMm,
      widthMm: row.widthMm,
      depthMm: row.depthMm,
      heightWithCapMm: row.heightWithCapMm,
    })) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${row.websiteSku} has invalid canonical ${name}.`);
      }
    }
    const blockers = row.graceSku.trim() ? [] : ["missing-grace-sku"];
    return {
      websiteSku: row.websiteSku,
      graceSku: row.graceSku.trim() || null,
      capacityMl,
      canonicalGeometry: {
        bodyHeightMm: row.bodyHeightMm,
        widthMm: row.widthMm,
        depthMm: row.depthMm,
        heightWithCapMm: row.heightWithCapMm,
      },
      visualTestStatus: "ready" as const,
      productionStatus: blockers.length ? "blocked" as const : "ready" as const,
      blockers,
      roles: {
        identityCapOn: {
          role: "identity-cap-on" as const,
          ...row.references.identityCapOn,
        },
        pdpCapOffSidecar: {
          role: "pdp-cap-off-sidecar" as const,
          ...row.references.pdpCapOffSidecar,
        },
      },
    };
  });

  const unsigned = {
    version: BEST_BOTTLES_CYLINDER_SIX_ROLE_PILOT_VERSION,
    generatedAt: input.generatedAt,
    canonicalMaster: input.canonicalMaster,
    authorization: {
      scope: "controlled-visual-test-only" as const,
      paidGeneration: "not-authorized-by-manifest" as const,
      remoteWrites: "forbidden" as const,
      publishing: "forbidden" as const,
    },
    summary: {
      productCount: 6 as const,
      roleSlotCount: 12 as const,
      visualTestReadySlotCount: 12,
      productionReadyProductCount: products.filter((row) => row.productionStatus === "ready").length,
      identityBlockedProductCount: products.filter((row) => row.productionStatus === "blocked").length,
    },
    products,
  };
  return { ...unsigned, sha256: sha256(stableJson(unsigned)) };
}
