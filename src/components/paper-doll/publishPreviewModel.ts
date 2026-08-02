import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import type { PaperDollSanityProjection } from "@/lib/paperDoll/sanityProjection";
import type { MatrixModel } from "./matrixModel";

export type ReleasePhaseStatus = "passed" | "blocked" | "not-run";

export interface ReleasePhase {
  index: number;
  key:
    | "catalog-identity"
    | "component-truth"
    | "geometry-lock"
    | "assembly-context"
    | "matrix-completeness"
    | "catalog-lineup"
    | "sanity-round-trip"
    | "named-visual-approval"
    | "publication-verification";
  label: string;
  status: ReleasePhaseStatus;
  detail: string;
}

interface PublishPreviewModelInput {
  manifest: PaperDollReleaseManifest;
  projection: PaperDollSanityProjection;
  catalogReconciliation: MatrixModel["catalogReconciliation"];
  lineupReady: boolean;
}

export interface PublishPreviewModel {
  phases: ReleasePhase[];
  blockers: string[];
  target: PaperDollSanityProjection["target"];
  manifestSha256: string;
  payloadSha256: string;
  writeCount: 0;
  roundTripPassed: boolean;
  assetPlan: PaperDollSanityProjection["assetPlan"];
  diff: {
    mode: "full-document-create-preview";
    additions: number;
    changes: 0;
    removals: 0;
    preservedUnrelatedFields: true;
  };
  stableKeys: { assets: number; recipes: number; mappings: number; evidence: number };
  approvalEnabled: false;
  publishEnabled: false;
}

function componentTruthPasses(manifest: PaperDollReleaseManifest): boolean {
  return manifest.assets.every((asset) =>
    asset.widthPx === manifest.canvas.widthPx &&
    asset.heightPx === manifest.canvas.heightPx &&
    /^[a-f0-9]{64}$/.test(asset.imageSha256) &&
    asset.componentVersionId.length > 0,
  ) && manifest.provenance.sourceGitCommit.length > 0 && manifest.provenance.rendererVersion.length > 0;
}

function geometryLockPasses(manifest: PaperDollReleaseManifest): boolean {
  const maskedAssets = manifest.assets.filter((asset) => asset.geometryMaskSha256);
  if (maskedAssets.length === 0) return false;
  return maskedAssets.every((asset) => manifest.qaEvidence.some((evidence) =>
    evidence.subjectId === asset.geometryFamilyId &&
    evidence.gateKey === "shared-geometry-mask" &&
    evidence.status === "passed" &&
    evidence.blocking &&
    evidence.calibratedWith.length > 0 &&
    evidence.measurements.maskSha256 === asset.geometryMaskSha256,
  ));
}

function phase(
  index: number,
  key: ReleasePhase["key"],
  label: string,
  status: ReleasePhaseStatus,
  detail: string,
): ReleasePhase {
  return { index, key, label, status, detail };
}

export function buildPublishPreviewModel({
  manifest,
  projection,
  catalogReconciliation,
  lineupReady,
}: PublishPreviewModelInput): PublishPreviewModel {
  const catalogReady = catalogReconciliation.catalogProducts > 0 &&
    catalogReconciliation.unmatchedProducts === 0 &&
    catalogReconciliation.previewMappings === 0;
  const contextEvidence = manifest.qaEvidence.filter((evidence) =>
    /assembly-context/.test(evidence.gateKey),
  );
  const contextReady = contextEvidence.length > 0 && contextEvidence.every((evidence) => evidence.status === "passed");
  const matrixReady = manifest.assets.length > 0 &&
    manifest.assets.every((asset) => asset.approvalStatus === "approved") &&
    catalogReady;

  const phases: ReleasePhase[] = [
    phase(1, "catalog-identity", "Catalog identity", catalogReady ? "passed" : "blocked",
      catalogReady ? "Every catalog product resolves to an exact release mapping." : `${catalogReconciliation.unmatchedProducts} catalog products remain unmatched; ${catalogReconciliation.previewMappings} mappings use preview identities.`),
    phase(2, "component-truth", "Component truth", componentTruthPasses(manifest) ? "passed" : "blocked",
      componentTruthPasses(manifest) ? "Canvas, hashes, IDs, and provenance are structurally complete." : "One or more asset bytes, dimensions, IDs, or provenance fields are incomplete."),
    phase(3, "geometry-lock", "Geometry lock", geometryLockPasses(manifest) ? "passed" : "blocked",
      geometryLockPasses(manifest) ? "Authoritative mask identity is backed by calibrated passing evidence." : "Mask-and-clamp geometry evidence is incomplete."),
    phase(4, "assembly-context", "Assembly context", contextReady ? "passed" : "blocked",
      contextReady ? "Material appearance passes in required assembled contexts." : "Translucent or fitment context evidence remains blocked or absent."),
    phase(5, "matrix-completeness", "Matrix completeness", matrixReady ? "passed" : "blocked",
      matrixReady ? "Every required release row resolves exactly once." : "Blocked assets or catalog identity gaps keep the matrix incomplete."),
    phase(6, "catalog-lineup", "Catalog lineup", lineupReady ? "passed" : "blocked",
      lineupReady ? "The named family lineup is approved at one scale and baseline." : "Selected geometry registers, but complete family visual approval is not recorded."),
    phase(7, "sanity-round-trip", "Sanity projection round-trip", projection.roundTrip.passed ? "passed" : "blocked",
      projection.roundTrip.passed ? "Projection reconstructs the canonical Release v1 manifest without loss." : projection.roundTrip.issue ?? "Round-trip verification failed."),
    phase(8, "named-visual-approval", "Named visual approval", "not-run", "No approver is bound to the exact manifest, payload, target, and lineup hashes."),
    phase(9, "publication-verification", "Publication verification", "not-run", "No live write, Sanity revision, or storefront readback has occurred."),
  ];

  const blockers = [
    ...projection.validation.blockers,
    ...(!catalogReady ? ["catalog_identity_incomplete"] : []),
    ...(!lineupReady ? ["named_lineup_approval_required"] : []),
    ...projection.publishBlockers,
  ];

  return {
    phases,
    blockers: [...new Set(blockers)],
    target: projection.target,
    manifestSha256: projection.manifestSha256,
    payloadSha256: projection.payloadSha256,
    writeCount: 0,
    roundTripPassed: projection.roundTrip.passed,
    assetPlan: projection.assetPlan,
    diff: {
      mode: "full-document-create-preview",
      additions: Object.keys(projection.document).filter((key) => key !== "_id" && key !== "_type").length,
      changes: 0,
      removals: 0,
      preservedUnrelatedFields: true,
    },
    stableKeys: {
      assets: projection.document.assets.length,
      recipes: projection.document.assemblyRecipes.length,
      mappings: projection.document.assemblyMappings.length,
      evidence: projection.document.qaEvidence.length,
    },
    approvalEnabled: false,
    publishEnabled: false,
  };
}
