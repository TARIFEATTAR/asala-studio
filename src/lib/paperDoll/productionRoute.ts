export const PRODUCTION_ROUTE_STAGE_IDS = [
  "source",
  "identity",
  "contract",
  "blender-build",
  "geometry-lock",
  "material-studio",
  "components-assembly",
  "qa-release",
  "publish-verify",
] as const;

export type ProductionRouteStageId = (typeof PRODUCTION_ROUTE_STAGE_IDS)[number];
export type ProductionRouteStageStatus =
  | "verified"
  | "approved"
  | "in-progress"
  | "candidate"
  | "blocked"
  | "failed"
  | "not-started"
  | "not-applicable"
  | "superseded";

export interface ProductionRouteStage {
  id: ProductionRouteStageId;
  label: string;
  status: ProductionRouteStageStatus;
  summary: string;
  gateScope: string;
}

export interface ProductionRouteEvidence {
  id: string;
  title: string;
  classification: "approval-evidence" | "visual-reference" | "candidate-evidence";
  previewUrl: string;
  sourcePath: string;
  sourceSha256: string;
  previewSha256: string;
  scope: string;
}

export interface ProductionRouteRegistration {
  schemaVersion: 1;
  routeId: string;
  sourceAssetKey: string;
  sourceRecordPath: string;
  expectedSourceRecordSha256: string;
  familyKey: string;
  identity: {
    commercialName: string;
    graceSku: string;
    websiteSku: string;
    finish: string;
    housing: string;
    ball: string;
    cap: string;
    catalog: { volumeMl: number; heightMm: number; diameterMm: number };
    drawing: { volumeMl: number; heightMm: number; diameterMm: number };
    discrepancy: string;
  };
  stages: ProductionRouteStage[];
  blockers: string[];
  nextAction: string;
  evidence: ProductionRouteEvidence[];
}

export interface ProductionRouteArtifact {
  schemaVersion: 1;
  recordType: "production-route";
  routeId: string;
  familyKey: string;
  sourceAssetKey: string;
  sourceRecord: {
    path: string;
    sha256: string;
    createdAt: string;
    scope: string;
  };
  identity: ProductionRouteRegistration["identity"];
  stages: ProductionRouteStage[];
  blockers: string[];
  nextAction: string;
  evidence: ProductionRouteEvidence[];
  artifact: {
    sourceRepository: string;
    git: {
      branch: string;
      commit: string;
      bundle: string;
      bundleVerified: boolean;
      completeHistory: boolean;
      pushed: boolean;
    };
    protection: {
      protectedEntriesIncludingBundle: number;
      checksumEntries: number;
      totalBytesIncludingBundle: number;
      localCapsule: string;
      googleDriveMirror: string;
      manifestSha256: string;
      localChecksumsPassed: number;
      mirrorChecksumsPassed: number;
      localFilesystemReadOnly: boolean;
      mirrorFilesystemReadOnly: boolean;
      sourceFilesMoved: boolean;
      sourceBlendFilesEdited: boolean;
      providerSideCloudSyncIndependentlyVerified: boolean;
    };
    approvalScope: {
      hashVerified: string;
      notImplied: string[];
    };
    verification: {
      pythonContractTests: string;
      blender17415Helix: string;
      blenderFiveVariantBaseline: string;
      gitBundle: string;
      substanceAddonWarning: string;
    };
  };
  stageCoverageComplete: boolean;
  provenanceComplete: boolean;
  releaseReady: boolean;
  overallStatus: "ready" | "blocked" | "failed" | "in-progress";
}

export interface LivePaperDollReleaseSnapshot {
  version: string;
  status: string;
  manifestSha256: string;
  assetCount: number;
  bodyCount: number;
  componentCount: number;
}

export interface ProductionRouteMatrixRow extends ProductionRouteArtifact {
  liveRelease: LivePaperDollReleaseSnapshot | null;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Malformed ${label}.`);
  }
  return value as UnknownRecord;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Malformed ${label}.`);
  return value;
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Malformed ${label}.`);
  return value;
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Malformed ${label}.`);
  return value;
}

function requiredSha256(value: unknown, label: string): string {
  const sha256 = requiredString(value, label);
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`Malformed ${label}.`);
  return sha256;
}

function requiredStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`Malformed ${label}.`);
  }
  return [...value];
}

function parseReceipt(input: unknown) {
  const receipt = asRecord(input, "artifact containment receipt");
  if (requiredNumber(receipt.schemaVersion, "artifact containment schema version") !== 1) {
    throw new Error("Unsupported artifact containment schema version.");
  }
  if (requiredString(receipt.recordType, "artifact containment record type") !== "artifact-containment-receipt") {
    throw new Error("Unsupported artifact containment record type.");
  }
  if (requiredString(receipt.project, "artifact containment project") !== "Best Bottles") {
    throw new Error("Artifact containment receipt belongs to another project.");
  }

  const git = asRecord(receipt.git, "artifact containment git record");
  const protection = asRecord(receipt.protection, "artifact containment protection record");
  const approvalScope = asRecord(receipt.approvalScope, "artifact containment approval scope");
  const verification = asRecord(receipt.verification, "artifact containment verification record");

  const parsed = {
    assetKey: requiredString(receipt.assetKey, "artifact containment asset key"),
    createdAt: requiredString(receipt.createdAt, "artifact containment creation date"),
    scope: requiredString(receipt.scope, "artifact containment scope"),
    sourceRepository: requiredString(receipt.sourceRepository, "artifact containment source repository"),
    git: {
      branch: requiredString(git.branch, "artifact containment branch"),
      commit: requiredString(git.commit, "artifact containment commit"),
      bundle: requiredString(git.bundle, "artifact containment bundle"),
      bundleVerified: requiredBoolean(git.bundleVerified, "artifact containment bundle verification"),
      completeHistory: requiredBoolean(git.completeHistory, "artifact containment complete history"),
      pushed: requiredBoolean(git.pushed, "artifact containment pushed state"),
    },
    protection: {
      protectedEntriesIncludingBundle: requiredNumber(protection.protectedEntriesIncludingBundle, "protected entry count"),
      checksumEntries: requiredNumber(protection.checksumEntries, "checksum entry count"),
      totalBytesIncludingBundle: requiredNumber(protection.totalBytesIncludingBundle, "protected byte count"),
      localCapsule: requiredString(protection.localCapsule, "local capsule path"),
      googleDriveMirror: requiredString(protection.googleDriveMirror, "Google Drive mirror path"),
      manifestSha256: requiredSha256(protection.manifestSha256, "containment manifest checksum"),
      localChecksumsPassed: requiredNumber(protection.localChecksumsPassed, "local checksum pass count"),
      mirrorChecksumsPassed: requiredNumber(protection.mirrorChecksumsPassed, "mirror checksum pass count"),
      localFilesystemReadOnly: requiredBoolean(protection.localFilesystemReadOnly, "local read-only state"),
      mirrorFilesystemReadOnly: requiredBoolean(protection.mirrorFilesystemReadOnly, "mirror read-only state"),
      sourceFilesMoved: requiredBoolean(protection.sourceFilesMoved, "source move state"),
      sourceBlendFilesEdited: requiredBoolean(protection.sourceBlendFilesEdited, "source edit state"),
      providerSideCloudSyncIndependentlyVerified: requiredBoolean(
        protection.providerSideCloudSyncIndependentlyVerified,
        "provider cloud-sync verification state",
      ),
    },
    approvalScope: {
      hashVerified: requiredString(approvalScope.hashVerified, "hash-verified approval scope"),
      notImplied: requiredStringArray(approvalScope.notImplied, "approval scopes not implied"),
    },
    verification: {
      pythonContractTests: requiredString(verification.pythonContractTests, "Python contract verification"),
      blender17415Helix: requiredString(verification.blender17415Helix, "Blender helix verification"),
      blenderFiveVariantBaseline: requiredString(verification.blenderFiveVariantBaseline, "Blender baseline verification"),
      gitBundle: requiredString(verification.gitBundle, "Git bundle verification"),
      substanceAddonWarning: requiredString(verification.substanceAddonWarning, "Blender add-on warning"),
    },
  };

  const protectionIsVerified = parsed.git.bundleVerified
    && parsed.git.completeHistory
    && parsed.protection.protectedEntriesIncludingBundle > 0
    && parsed.protection.checksumEntries > 0
    && parsed.protection.localChecksumsPassed === parsed.protection.checksumEntries
    && parsed.protection.mirrorChecksumsPassed === parsed.protection.checksumEntries
    && parsed.protection.localFilesystemReadOnly
    && parsed.protection.mirrorFilesystemReadOnly
    && !parsed.protection.sourceFilesMoved
    && !parsed.protection.sourceBlendFilesEdited;
  if (!protectionIsVerified) {
    throw new Error("Containment protection is not checksum-matched, read-only, and non-destructive.");
  }

  return parsed;
}

const STAGE_STATUSES: readonly ProductionRouteStageStatus[] = [
  "verified",
  "approved",
  "in-progress",
  "candidate",
  "blocked",
  "failed",
  "not-started",
  "not-applicable",
  "superseded",
];

function validateRegistration(registration: ProductionRouteRegistration): void {
  if (registration.schemaVersion !== 1) throw new Error("Unsupported production route registration schema.");
  requiredString(registration.routeId, "production route id");
  requiredString(registration.sourceAssetKey, "production route source asset key");
  requiredString(registration.sourceRecordPath, "production route source record path");
  requiredSha256(registration.expectedSourceRecordSha256, "production route source record checksum");
  requiredString(registration.familyKey, "production route family key");
  requiredString(registration.identity.discrepancy, "production route identity discrepancy");
  requiredStringArray(registration.blockers, "production route blockers");
  requiredString(registration.nextAction, "production route next action");

  const stageIds = registration.stages.map((stage) => stage.id);
  const exactCoverage = stageIds.length === PRODUCTION_ROUTE_STAGE_IDS.length
    && PRODUCTION_ROUTE_STAGE_IDS.every((id, index) => stageIds[index] === id)
    && new Set(stageIds).size === PRODUCTION_ROUTE_STAGE_IDS.length;
  if (!exactCoverage) {
    throw new Error("A production route must register every required stage exactly once and in route order.");
  }
  for (const stage of registration.stages) {
    if (!STAGE_STATUSES.includes(stage.status)) throw new Error(`Unsupported production route stage status '${stage.status}'.`);
    requiredString(stage.label, `${stage.id} stage label`);
    requiredString(stage.summary, `${stage.id} stage summary`);
    requiredString(stage.gateScope, `${stage.id} gate scope`);
  }
  for (const evidence of registration.evidence) {
    requiredString(evidence.id, "route evidence id");
    requiredString(evidence.title, "route evidence title");
    requiredString(evidence.previewUrl, "route evidence preview URL");
    requiredString(evidence.sourcePath, "route evidence source path");
    requiredSha256(evidence.sourceSha256, "route evidence source checksum");
    requiredSha256(evidence.previewSha256, "route evidence preview checksum");
    requiredString(evidence.scope, "route evidence scope");
  }
}

function deriveOverallStatus(stages: readonly ProductionRouteStage[]): ProductionRouteArtifact["overallStatus"] {
  if (stages.some((stage) => stage.status === "failed")) return "failed";
  if (stages.some((stage) => stage.status === "blocked")) return "blocked";
  if (stages.some((stage) => ["in-progress", "candidate", "not-started"].includes(stage.status))) return "in-progress";
  return "ready";
}

export function adaptContainmentReceiptToProductionRoute(
  input: unknown,
  registration: ProductionRouteRegistration,
  sourceRecordSha256: string,
): ProductionRouteArtifact {
  validateRegistration(registration);
  const parsedReceipt = parseReceipt(input);
  const parsedSourceRecordSha256 = requiredSha256(sourceRecordSha256, "source record checksum");
  if (parsedSourceRecordSha256 !== registration.expectedSourceRecordSha256) {
    throw new Error("Source record checksum does not match the registered immutable input.");
  }
  if (parsedReceipt.assetKey !== registration.sourceAssetKey) {
    throw new Error("Artifact containment asset key does not match the production route registration.");
  }

  const stages = registration.stages.map((stage) => ({ ...stage }));
  const stageCoverageComplete = stages.length === PRODUCTION_ROUTE_STAGE_IDS.length;
  const sourceStatus = stages.find((stage) => stage.id === "source")?.status;
  const buildStatus = stages.find((stage) => stage.id === "blender-build")?.status;
  const geometryStatus = stages.find((stage) => stage.id === "geometry-lock")?.status;
  const provenanceComplete = sourceStatus === "verified"
    && buildStatus === "verified"
    && geometryStatus === "approved";
  const releaseReady = stages.every((stage) =>
    stage.status === "verified" || stage.status === "approved" || stage.status === "not-applicable",
  );

  return {
    schemaVersion: 1,
    recordType: "production-route",
    routeId: registration.routeId,
    familyKey: registration.familyKey,
    sourceAssetKey: registration.sourceAssetKey,
    sourceRecord: {
      path: registration.sourceRecordPath,
      sha256: parsedSourceRecordSha256,
      createdAt: parsedReceipt.createdAt,
      scope: parsedReceipt.scope,
    },
    identity: {
      ...registration.identity,
      catalog: { ...registration.identity.catalog },
      drawing: { ...registration.identity.drawing },
    },
    stages,
    blockers: [...registration.blockers],
    nextAction: registration.nextAction,
    evidence: registration.evidence.map((evidence) => ({ ...evidence })),
    artifact: {
      sourceRepository: parsedReceipt.sourceRepository,
      git: parsedReceipt.git,
      protection: parsedReceipt.protection,
      approvalScope: parsedReceipt.approvalScope,
      verification: parsedReceipt.verification,
    },
    stageCoverageComplete,
    provenanceComplete,
    releaseReady,
    overallStatus: deriveOverallStatus(stages),
  };
}

export function parseProductionRouteArtifact(input: unknown): ProductionRouteArtifact {
  const route = asRecord(input, "production route artifact");
  if (requiredNumber(route.schemaVersion, "production route schema version") !== 1) {
    throw new Error("Unsupported production route artifact schema.");
  }
  if (requiredString(route.recordType, "production route record type") !== "production-route") {
    throw new Error("Unsupported production route artifact record type.");
  }
  requiredString(route.routeId, "production route id");
  requiredString(route.familyKey, "production route family key");
  requiredString(route.sourceAssetKey, "production route source asset key");
  const sourceRecord = asRecord(route.sourceRecord, "production route source record");
  requiredString(sourceRecord.path, "production route source record path");
  requiredSha256(sourceRecord.sha256, "production route source record checksum");
  requiredString(sourceRecord.createdAt, "production route source record date");
  requiredString(sourceRecord.scope, "production route source record scope");
  asRecord(route.identity, "production route identity");
  asRecord(route.artifact, "production route artifact evidence");
  requiredStringArray(route.blockers, "production route blockers");
  requiredString(route.nextAction, "production route next action");
  requiredBoolean(route.stageCoverageComplete, "production route stage coverage state");
  requiredBoolean(route.provenanceComplete, "production route provenance state");
  requiredBoolean(route.releaseReady, "production route release-ready state");
  if (!["ready", "blocked", "failed", "in-progress"].includes(requiredString(route.overallStatus, "production route overall status"))) {
    throw new Error("Unsupported production route overall status.");
  }
  if (!Array.isArray(route.stages)) throw new Error("Malformed production route stages.");
  const stages = route.stages.map((value, index) => {
    const stage = asRecord(value, `production route stage ${index}`);
    const id = requiredString(stage.id, `production route stage ${index} id`);
    const status = requiredString(stage.status, `production route stage ${index} status`);
    if (!PRODUCTION_ROUTE_STAGE_IDS.includes(id as ProductionRouteStageId)) {
      throw new Error(`Unsupported production route stage '${id}'.`);
    }
    if (!STAGE_STATUSES.includes(status as ProductionRouteStageStatus)) {
      throw new Error(`Unsupported production route stage status '${status}'.`);
    }
    return id;
  });
  const exactCoverage = stages.length === PRODUCTION_ROUTE_STAGE_IDS.length
    && PRODUCTION_ROUTE_STAGE_IDS.every((id, index) => stages[index] === id)
    && new Set(stages).size === PRODUCTION_ROUTE_STAGE_IDS.length;
  if (!exactCoverage || route.stageCoverageComplete !== true) {
    throw new Error("Generated production route must retain exact nine-stage coverage.");
  }
  if (!Array.isArray(route.evidence)) throw new Error("Malformed production route evidence.");
  for (const value of route.evidence) {
    const evidence = asRecord(value, "production route evidence");
    requiredString(evidence.id, "production route evidence id");
    requiredString(evidence.previewUrl, "production route evidence preview URL");
    requiredSha256(evidence.sourceSha256, "production route evidence source checksum");
    requiredSha256(evidence.previewSha256, "production route evidence preview checksum");
  }
  return input as ProductionRouteArtifact;
}

export function buildProductionRouteMatrixRow(
  route: ProductionRouteArtifact,
  liveRelease: LivePaperDollReleaseSnapshot | null,
): ProductionRouteMatrixRow {
  return {
    ...route,
    stages: route.stages.map((stage) => ({ ...stage })),
    liveRelease: liveRelease ? { ...liveRelease } : null,
  };
}
