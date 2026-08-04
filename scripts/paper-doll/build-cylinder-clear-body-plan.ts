import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  deriveBestBottlesBodyTargetPx,
} from "../../src/config/bestBottlesCatalogScale";
import {
  resolveCylinderPaperDollPresentation,
} from "../../src/config/bestBottlesCylinderPresentation";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const completionBoardPath = path.join(workspaceRoot, "docs/paper-doll-rig/cylinder-family-completion-board.json");
const curveManifestPath = path.join(workspaceRoot, "tmp/best-bottles-reference-production/cylinder-applicator-curves-v1/cylinder-applicator-curves-manifest.json");
const registeredManifestPath = path.join(workspaceRoot, "outputs/paper-doll-cylinder-requested-family-reviews/source-registered-v3-exact-jumbo-rollons/manifest.json");
const fiveMlCandidatePath = path.join(workspaceRoot, "outputs/paper-doll-body-authority-reviews/CYL-5ML-13-415/53x17-clear-v1/canonical-review-candidate.png");

const CANVAS = { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" } as const;
const REGISTRATION = { centerX: 1040, baselineY: 2082 } as const;
const OPTICAL_BENCHMARK = {
  path: "assets/paper-doll/body-plates/body__cylinder__9ml__clear__70.0x20.0mm.png",
  sha256: "97cfe967a4ab02ba4de51c07416c80df54244adf8dfab95406a36f4fe90e933f",
  role: "Approved optical benchmark for clear-glass specularity, edge definition, restrained ground shadow, and premium catalog lighting only. It is never a geometry source for another capacity.",
} as const;
const SOURCE_CALIBRATED_BLENDER_REQUIRED = new Set([
  "body__cylinder__3ml__37x14x14.0__aa7c8c6e6d",
  "body__cylinder__4ml__49x14x14.0__c3932dacb5",
]);

type CurvePosition = {
  displayKey: string;
  capacityMl: number;
  bodyHeightMm: number;
  widthAxisMm: number;
  secondAxisMm: number;
  heightWithCapMm: number;
  sourceTypeKeys: string[];
  referenceClass: string;
  canonicalIdentityKey: string | null;
  websiteSku: string | null;
  graceSku: string | null;
  previewPath: string;
  previewSha256: string;
};

function valueAfter(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function workspaceRelative(candidatePath: string): string {
  const resolved = path.resolve(candidatePath);
  const relative = path.relative(workspaceRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Evidence path escapes the workspace: ${candidatePath}`);
  }
  return relative;
}

function flattenCurvePositions(manifest: any): CurvePosition[] {
  return [
    ...manifest.curves.sprays.positions,
    ...manifest.curves.rollOns.positions,
    ...manifest.curves.reducers.positions,
  ];
}

function neckFinish(position: CurvePosition): string {
  const sourceType = position.sourceTypeKeys?.[0];
  const value = sourceType?.split("|")[5];
  if (!value) throw new Error(`${position.displayKey} does not contain a neck-finish source key.`);
  return value;
}

function coverageNeckFinish(row: any, position: CurvePosition): string {
  if (position.sourceTypeKeys?.length) return neckFinish(position);
  const responsibility = row.requiredResponsibilities?.find((value: string) => /^\d+-\d+/.test(value));
  const measuredFinish = responsibility?.match(/^(\d+-\d+)/)?.[1];
  if (!measuredFinish) throw new Error(`${position.displayKey} has no measured neck-finish evidence.`);
  return measuredFinish;
}

function markdown(plan: any): string {
  const rows = plan.bodyAuthorities.map((entry: any) => (
    `| \`${entry.geometryKey}\` | ${entry.capacityMl} mL · ${entry.dimensionsMm.bodyHeight} × ${entry.dimensionsMm.widthAxis} mm · ${entry.neckFinish} | ${entry.displayKeys.map((key: string) => `\`${key}\``).join(", ")} | ${entry.sourceState} | ${entry.nextGate} |`
  )).join("\n");
  const coverageRows = plan.coverageAudit.map((entry: any) => (
    `| \`${entry.displayKey}\` | ${entry.dimensionsMm.bodyHeight} × ${entry.dimensionsMm.widthAxis} mm | ${entry.neckFinish} | ${entry.stage} |`
  )).join("\n");
  return `# Cylinder clear-body production plan

**State:** generated, review-only build plan; no paid generation, approval, release, Supabase, or Sanity mutation

## Outcome

- ${plan.summary.authorityReadyDisplayPositionCount} authority-ready presentation positions reduce to ${plan.summary.uniqueBodyAuthorityCount} physical clear-body authorities.
- ${plan.summary.bodyOnlyCandidateAvailableCount} body-only candidates already exist locally.
- ${plan.summary.bodyExtractionRequiredCount} approved assembled PSD references still need body-layer extraction before authority review.
- ${plan.summary.sourceCalibratedBlenderRequiredCount} mini-sprayer sources contain baked-in dip-tube pixels and therefore require source-calibrated Blender bodies rather than destructive retouching.
- The approved 70 × 20 mm clear 9 mL plate is the optical benchmark only. It is never stretched into another bottle.
- Ground shadow is excluded from every authority mask and added deterministically to the catalog appearance plate after material clamping.
- Paid GPT Image requests planned or executed by this command: 0.

## Complete Cylinder coverage audit

This table is the non-lossy catalog checklist. Build-ready authorities remain separate below so blocked or ambiguous references cannot be promoted merely to make the count look complete. Glass-rod products are intentionally absent because catalog truth classifies them as Vials.

| Presentation position | Measured body profile | Neck finish | Current gate |
|---|---:|---|---|
${coverageRows}

## Body authorities

| Geometry authority | Physical profile | Presentation positions | Source state | Next gate |
|---|---|---|---|---|
${rows}

## Repeatable loop

1. Extract or render one measured body-only candidate for the exact physical profile.
2. Calibrate the real file and approve a clean bottle-only alpha authority; a bounding box alone is insufficient.
3. Use the 9 mL clear plate only to guide premium clear-glass optics: crisp edge refraction, controlled vertical highlights, clean base glass, and quiet mid-body transmission.
4. Run one explicitly authorized GPT Image material edit only when the source candidate fails material review.
5. Copy the approved authority alpha exactly and require zero mismatched alpha pixels.
6. Composite a deterministic soft contact shadow on the Bone catalog background without adding the shadow to the authority mask.
7. Assemble fitment, tube, closure, and body at workbench registration, then apply one uniform complete-product transform for the selected presentation position.
8. Record named pixel, geometry, family-fit, and placement approval before an append-only release cut.

## Clear-glass material target

Premium commercial clear glass with physically believable wall thickness, edge refraction, thin-section highlights, a defined but transparent center, clean base glass, restrained vertical studio reflections, and the same lighting direction and subtle contact shadow language as the approved 9 mL benchmark. No barcode rails, milky plastic, opaque white fill, invented seams, distorted neck, changed threads, or geometry drift.
`;
}

export async function buildCylinderClearBodyPlan() {
  const [board, curveManifest, registeredManifest] = await Promise.all([
    readFile(completionBoardPath, "utf8").then(JSON.parse),
    readFile(curveManifestPath, "utf8").then(JSON.parse),
    readFile(registeredManifestPath, "utf8").then(JSON.parse),
  ]);
  const curveByDisplayKey = new Map(flattenCurvePositions(curveManifest).map((position) => [position.displayKey, position]));
  const bodyOnlyCandidateByGeometry = new Map<string, string>();
  bodyOnlyCandidateByGeometry.set(
    "body__cylinder__5ml__53x17x17.0__f94a16652c",
    workspaceRelative(fiveMlCandidatePath),
  );
  for (const family of registeredManifest.families) {
    const body = family.layers.find((layer: any) => layer.role === "body");
    if (body?.fullCanvasPlatePath) {
      bodyOnlyCandidateByGeometry.set(family.geometry.geometryKey, workspaceRelative(body.fullCanvasPlatePath));
    }
  }

  const coverageAudit = board.positions.map((row: any) => {
    const curve = curveByDisplayKey.get(row.displayKey);
    if (!curve) throw new Error(`No Cylinder curve evidence exists for ${row.displayKey}.`);
    return {
      displayKey: row.displayKey,
      productClass: "Cylinder",
      stage: row.stage,
      bodyAuthorityKey: row.bodyAuthorityKey,
      dimensionsMm: {
        bodyHeight: curve.bodyHeightMm,
        widthAxis: curve.widthAxisMm,
        depthAxis: curve.secondAxisMm,
        assembledHeight: curve.heightWithCapMm,
      },
      neckFinish: coverageNeckFinish(row, curve),
      referenceClass: curve.referenceClass,
      sourceIdentity: {
        canonicalIdentityKey: curve.canonicalIdentityKey,
        websiteSku: curve.websiteSku,
        graceSku: curve.graceSku,
      },
      productionEligible: false,
    };
  });

  const authorityRows = board.positions.filter((position: any) => position.stage === "authority-build-ready");
  const grouped = new Map<string, any[]>();
  for (const row of authorityRows) {
    const existing = grouped.get(row.bodyAuthorityKey) ?? [];
    existing.push(row);
    grouped.set(row.bodyAuthorityKey, existing);
  }

  const bodyAuthorities = [...grouped.entries()].map(([geometryKey, rows]) => {
    const positions = rows.map((row) => {
      const curve = curveByDisplayKey.get(row.displayKey);
      if (!curve) throw new Error(`No Cylinder curve evidence exists for ${row.displayKey}.`);
      const presentation = resolveCylinderPaperDollPresentation(row.displayKey);
      return { row, curve, presentation };
    });
    const first = positions[0].curve;
    for (const candidate of positions.slice(1)) {
      if (candidate.curve.bodyHeightMm !== first.bodyHeightMm
        || candidate.curve.widthAxisMm !== first.widthAxisMm
        || candidate.curve.secondAxisMm !== first.secondAxisMm) {
        throw new Error(`${geometryKey} was assigned to conflicting physical dimensions.`);
      }
    }
    const bodyOnlyCandidatePath = bodyOnlyCandidateByGeometry.get(geometryKey) ?? null;
    const sourceState = bodyOnlyCandidatePath
      ? "body-only-candidate-available"
      : SOURCE_CALIBRATED_BLENDER_REQUIRED.has(geometryKey)
        ? "source-calibrated-blender-required"
        : "body-extraction-required";
    return {
      geometryKey,
      capacityMl: first.capacityMl,
      dimensionsMm: {
        bodyHeight: first.bodyHeightMm,
        widthAxis: first.widthAxisMm,
        depthAxis: first.secondAxisMm,
      },
      neckFinish: neckFinish(first),
      displayKeys: positions.map(({ row }) => row.displayKey),
      presentationTargets: positions.map(({ row, curve, presentation }) => ({
        displayKey: row.displayKey,
        assembledHeightMm: curve.heightWithCapMm,
        targetAssembledHeightPct: presentation.targetAssembledHeightPct,
        expectedBodyHeightPxAfterAssemblyTransform: deriveBestBottlesBodyTargetPx({
          canvasHeightPx: CANVAS.heightPx,
          assembledHeightPct: presentation.targetAssembledHeightPct,
          verifiedBodyHeightMm: curve.bodyHeightMm,
          verifiedAssembledHeightMm: curve.heightWithCapMm,
        }),
        transformScope: "complete-paper-doll-assembly",
      })),
      sourceState,
      bodyOnlyCandidatePath,
      sourceEvidence: positions.map(({ curve }) => ({
        referenceClass: curve.referenceClass,
        previewPath: workspaceRelative(curve.previewPath),
        previewSha256: curve.previewSha256,
        canonicalIdentityKey: curve.canonicalIdentityKey,
        websiteSku: curve.websiteSku,
        graceSku: curve.graceSku,
      })),
      materialTarget: "premium-clear-glass",
      authorityMaskIncludesGroundShadow: false,
      catalogAppearanceIncludesDeterministicGroundShadow: true,
      geometryLocked: false,
      productionEligible: false,
      authorityStrategy: "approve-clean-source-silhouette-or-source-calibrated-blender-profile",
      gptMaterialPass: {
        status: "not-requested",
        provider: "gpt-image-2",
        requiresExplicitPaidAuthorization: true,
        allowedChanges: ["glass material fidelity", "specular highlights", "refraction", "edge definition"],
        forbiddenChanges: ["silhouette", "neck", "threads", "seat", "scale", "camera", "placement", "shadow geometry"],
        exactAlphaMismatchTolerancePx: 0,
      },
      nextGate: sourceState === "body-only-candidate-available"
        ? "Calibrate the real body candidate, approve a clean bottle-only authority mask, then decide whether a paid material pass is necessary."
        : sourceState === "source-calibrated-blender-required"
          ? "Calibrate a parametric Blender body to the SHA-pinned assembled reference because the PSD body pixels contain the dip tube; review the body profile before material generation."
          : "Extract the body layer from the SHA-pinned approved PSD source before any Blender calibration or material generation.",
    };
  });

  const plan = {
    schemaVersion: 1,
    asOfDate: "2026-08-03",
    scope: "Best Bottles Cylinder clear-body authority tranche",
    canvas: CANVAS,
    registration: REGISTRATION,
    opticalBenchmark: OPTICAL_BENCHMARK,
    summary: {
      catalogCoveragePositionCount: coverageAudit.length,
      authorityReadyDisplayPositionCount: authorityRows.length,
      uniqueBodyAuthorityCount: bodyAuthorities.length,
      bodyOnlyCandidateAvailableCount: bodyAuthorities.filter((entry) => entry.sourceState === "body-only-candidate-available").length,
      bodyExtractionRequiredCount: bodyAuthorities.filter((entry) => entry.sourceState === "body-extraction-required").length,
      sourceCalibratedBlenderRequiredCount: bodyAuthorities.filter((entry) => entry.sourceState === "source-calibrated-blender-required").length,
      candidateReadyPositionCount: coverageAudit.filter((entry: any) => entry.stage === "candidate-ready-for-named-approval").length,
      truthDecisionPositionCount: coverageAudit.filter((entry: any) => entry.stage === "truth-decision-required").length,
      exactReferenceRequiredPositionCount: coverageAudit.filter((entry: any) => entry.stage === "exact-reference-required").length,
      paidGenerationRequestCount: 0,
    },
    coverageAudit,
    bodyAuthorities,
    qualityDoctrine: {
      geometrySourceOfTruth: "per-body approved source silhouette or source-calibrated Blender profile",
      opticalSourceOfTruth: "approved 9 mL clear body benchmark",
      finalScaleSourceOfTruth: "reviewed Cylinder complete-assembly presentation contract",
      geometryLockGate: "exact authority-alpha clamp with zero mismatched pixels",
      shadowPolicy: "deterministic catalog integration effect; excluded from geometry authority alpha",
      railPolicy: "calibrate the existing vertical-rail gate on each real candidate before trusting it",
    },
    mutationPolicy: {
      paidGenerationPerformed: false,
      approvalsWritten: false,
      remoteWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
      publicPublicationChanged: false,
    },
  };
  if (plan.summary.catalogCoveragePositionCount !== 18
    || plan.summary.authorityReadyDisplayPositionCount !== 12
    || plan.summary.uniqueBodyAuthorityCount !== 8) {
    throw new Error("Cylinder clear-body plan no longer matches the reviewed 18-position / 12-build-ready / 8-authority contract.");
  }
  return plan;
}

async function main() {
  const outputDirectory = path.resolve(valueAfter("out") ?? path.join(workspaceRoot, "docs/paper-doll-rig"));
  await mkdir(outputDirectory, { recursive: true });
  const plan = await buildCylinderClearBodyPlan();
  const jsonPath = path.join(outputDirectory, "cylinder-clear-body-plan.json");
  const markdownPath = path.join(outputDirectory, "CYLINDER-CLEAR-BODY-PLAN.md");
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(plan, null, 2)}\n`),
    writeFile(markdownPath, markdown(plan)),
  ]);
  console.log(JSON.stringify({ jsonPath, markdownPath, summary: plan.summary }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
