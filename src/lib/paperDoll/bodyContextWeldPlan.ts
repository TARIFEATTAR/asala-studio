export interface BodyPlateRegistryEntry {
  id: string;
  role: string;
  bodyKey: {
    family: string;
    capacityMl: number;
    colorway: string;
    heightMm: number;
    diameterMm: number;
    neckThreadSize: string;
  };
  asset: {
    path: string;
    sha256: string;
    widthPx: number;
    heightPx: number;
    hasAlpha: boolean;
  };
  registration: {
    canvas: string;
    background: string;
    neckTopY: number;
    neckBaseY: number;
    baselineY: number;
    centerX: number;
    threadCrestPx: number;
    threadCrestMm: number;
  };
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface BodyPlateRegistry {
  version: number;
  updatedAt: string;
  entries: BodyPlateRegistryEntry[];
}

export interface BodyContextDispenserInput {
  lane: "sprayer" | "pump";
  componentPartId: string;
  /** Bottom seat of the approved exterior component in canonical canvas pixels. */
  exteriorSeatY: number;
  /** Catalog stock tube length. It is evidence, not the rendered reach. */
  stockTubeLengthMm: number | null;
  /** Verified physical outside diameter. Never default this in production. */
  tubeDiameterMm: number | null;
  /** Verified target-body clearance above the interior base. */
  interiorBottomMarginMm: number | null;
  includesInsertedPlug: boolean;
  sourceEvidence: string;
}

export interface BuildBodyContextWeldPlanInput {
  familyId: string;
  bodyRegistry: BodyPlateRegistry;
  dispensers: BodyContextDispenserInput[];
  /** Explicit reviewed conversion only. Inferred family proxies do not qualify. */
  approvedPxPerMm?: number | null;
  approvedPxPerMmEvidence?: string | null;
}

export type BodyContextWeldState =
  | "dimension-review-required"
  | "blocked-missing-tube-dimensions"
  | "mask-plan-ready";

export interface BodyContextWeldJob {
  jobId: string;
  familyId: string;
  lane: BodyContextDispenserInput["lane"];
  componentPartId: string;
  bodyId: string;
  bodyColorway: string;
  bodyAssetPath: string;
  bodyAssetSha256: string;
  outputPolicy: "body-contextual-weld";
  state: BodyContextWeldState;
  sourceEvidence: string;
  stockTubeLengthMm: number | null;
  tubeDiameterMm: number | null;
  interiorBottomMarginMm: number | null;
  registration: {
    canvasWidthPx: number;
    canvasHeightPx: number;
    centerX: number;
    neckTopY: number;
    neckBaseY: number;
    baselineY: number;
    exteriorSeatY: number;
  };
  insertedPlugBand: {
    required: boolean;
    verticalEvidenceBoundsPx: { top: number; bottom: number } | null;
    horizontalBoundsPx: null;
    state: "dimension-review-required" | "not-required";
  };
  renderedPath: {
    startY: number;
    maximumBottomY: number;
    maximumReachPx: number;
    mustClipToBodyInterior: boolean;
    finalBottomY: number | null;
    finalReachMm: number | null;
  };
  mask: null | {
    tubeColumn: { left: number; top: number; right: number; bottom: number };
    insertedPlugBand: { left: number; top: number; right: number; bottom: number } | null;
  };
  blockers: string[];
}

export interface BodyContextWeldPlan {
  schemaVersion: 1;
  familyId: string;
  canonicalCanvas: { width: 2080; height: 2288 };
  scaleCalibration: {
    status: "ambiguous-review-required" | "explicitly-approved";
    threadCrestPxPerMm: number;
    bodyHeightProxyPxPerMm: number;
    divergencePercent: number;
    approvedPxPerMm: number | null;
    approvedPxPerMmEvidence: string | null;
    note: string;
  };
  summary: {
    bodyCount: number;
    dispenserCount: number;
    jobCount: number;
    productionReadyJobCount: number;
    dimensionReviewJobCount: number;
    blockedJobCount: number;
  };
  reusablePlateIds: string[];
  jobs: BodyContextWeldJob[];
  mutationPolicy: {
    masksWritten: false;
    candidatesGenerated: false;
    remoteWritesPerformed: false;
    currentReleaseChanged: false;
    sanityChanged: false;
  };
}

const CANVAS_WIDTH = 2080 as const;
const CANVAS_HEIGHT = 2288 as const;

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function assertRegistryEntry(entry: BodyPlateRegistryEntry): void {
  if (entry.status !== "approved") {
    throw new Error(`Body ${entry.id} must be approved before a body-context weld plan is built.`);
  }
  if (
    entry.asset.widthPx !== CANVAS_WIDTH ||
    entry.asset.heightPx !== CANVAS_HEIGHT ||
    entry.registration.canvas !== `${CANVAS_WIDTH}x${CANVAS_HEIGHT}`
  ) {
    throw new Error(`Body ${entry.id} must use the canonical 2080x2288 canvas.`);
  }
  if (!/^[a-f0-9]{64}$/i.test(entry.asset.sha256)) {
    throw new Error(`Body ${entry.id} must provide a valid immutable asset SHA-256.`);
  }
  if (entry.registration.neckTopY >= entry.registration.neckBaseY) {
    throw new Error(`Body ${entry.id} has an invalid neck registration.`);
  }
  if (entry.registration.neckBaseY >= entry.registration.baselineY) {
    throw new Error(`Body ${entry.id} has a baseline above its neck base.`);
  }
}

function scaleCalibration(
  entries: BodyPlateRegistryEntry[],
  approvedPxPerMm: number | null,
  approvedPxPerMmEvidence: string | null,
): BodyContextWeldPlan["scaleCalibration"] {
  const threadScales = entries.map((entry) => entry.registration.threadCrestPx / entry.registration.threadCrestMm);
  const bodyHeightScales = entries.map((entry) => (
    (entry.registration.baselineY - entry.registration.neckTopY) / entry.bodyKey.heightMm
  ));
  const threadCrestPxPerMm = threadScales.reduce((sum, value) => sum + value, 0) / threadScales.length;
  const bodyHeightProxyPxPerMm = bodyHeightScales.reduce((sum, value) => sum + value, 0) / bodyHeightScales.length;
  const divergencePercent = Math.abs(bodyHeightProxyPxPerMm - threadCrestPxPerMm) / threadCrestPxPerMm * 100;
  const explicitlyApproved = typeof approvedPxPerMm === "number" && approvedPxPerMm > 0 && Boolean(approvedPxPerMmEvidence?.trim());

  return {
    status: explicitlyApproved ? "explicitly-approved" : "ambiguous-review-required",
    threadCrestPxPerMm: round(threadCrestPxPerMm),
    bodyHeightProxyPxPerMm: round(bodyHeightProxyPxPerMm),
    divergencePercent: round(divergencePercent),
    approvedPxPerMm: explicitlyApproved ? round(approvedPxPerMm) : null,
    approvedPxPerMmEvidence: explicitlyApproved ? approvedPxPerMmEvidence : null,
    note: explicitlyApproved
      ? "Physical tube dimensions may be converted only through the explicitly reviewed family scale."
      : "Thread-crest and body-height proxies disagree materially. Preserve pixel registrations and require an explicit reviewed scale before creating tube-width or bottom-margin masks.",
  };
}

function buildJob(
  familyId: string,
  body: BodyPlateRegistryEntry,
  dispenser: BodyContextDispenserInput,
  scale: BodyContextWeldPlan["scaleCalibration"],
): BodyContextWeldJob {
  if (!Number.isInteger(dispenser.exteriorSeatY) || dispenser.exteriorSeatY <= body.registration.neckBaseY) {
    throw new Error(`${dispenser.lane} exterior seat must be an integer below the registered neck base.`);
  }
  if (dispenser.exteriorSeatY >= body.registration.baselineY) {
    throw new Error(`${dispenser.lane} exterior seat must remain above the body baseline.`);
  }

  const blockers: string[] = [];
  if (dispenser.stockTubeLengthMm === null) blockers.push("stock-tube-length-unverified");
  if (dispenser.tubeDiameterMm === null) blockers.push("tube-diameter-unverified");
  if (dispenser.interiorBottomMarginMm === null) blockers.push("interior-bottom-margin-unverified");
  if (scale.status !== "explicitly-approved") blockers.push("pixel-scale-ambiguous");
  if (dispenser.includesInsertedPlug) blockers.push("inserted-plug-horizontal-bounds-unverified");

  const startY = dispenser.exteriorSeatY + 1;
  const maximumBottomY = body.registration.baselineY - 1;
  const canPlanMask = blockers.length === 0 && scale.approvedPxPerMm !== null;
  const tubeRadiusPx = canPlanMask
    ? Math.max(1, Math.round((dispenser.tubeDiameterMm! * scale.approvedPxPerMm!) / 2))
    : null;
  const finalBottomY = canPlanMask
    ? Math.round(body.registration.baselineY - dispenser.interiorBottomMarginMm! * scale.approvedPxPerMm!)
    : null;
  const finalReachMm = canPlanMask
    ? round((finalBottomY! - startY + 1) / scale.approvedPxPerMm!)
    : null;

  const state: BodyContextWeldState = dispenser.stockTubeLengthMm === null
    ? "blocked-missing-tube-dimensions"
    : canPlanMask
      ? "mask-plan-ready"
      : "dimension-review-required";

  return {
    jobId: `${familyId.toLowerCase()}__${dispenser.lane}__${body.bodyKey.colorway}__body-context-v1`,
    familyId,
    lane: dispenser.lane,
    componentPartId: dispenser.componentPartId,
    bodyId: body.id,
    bodyColorway: body.bodyKey.colorway,
    bodyAssetPath: body.asset.path,
    bodyAssetSha256: body.asset.sha256,
    outputPolicy: "body-contextual-weld",
    state,
    sourceEvidence: dispenser.sourceEvidence,
    stockTubeLengthMm: dispenser.stockTubeLengthMm,
    tubeDiameterMm: dispenser.tubeDiameterMm,
    interiorBottomMarginMm: dispenser.interiorBottomMarginMm,
    registration: {
      canvasWidthPx: CANVAS_WIDTH,
      canvasHeightPx: CANVAS_HEIGHT,
      centerX: body.registration.centerX,
      neckTopY: body.registration.neckTopY,
      neckBaseY: body.registration.neckBaseY,
      baselineY: body.registration.baselineY,
      exteriorSeatY: dispenser.exteriorSeatY,
    },
    insertedPlugBand: {
      required: dispenser.includesInsertedPlug,
      verticalEvidenceBoundsPx: dispenser.includesInsertedPlug
        ? { top: body.registration.neckTopY, bottom: dispenser.exteriorSeatY }
        : null,
      horizontalBoundsPx: null,
      state: dispenser.includesInsertedPlug ? "dimension-review-required" : "not-required",
    },
    renderedPath: {
      startY,
      maximumBottomY,
      maximumReachPx: maximumBottomY - startY + 1,
      mustClipToBodyInterior: dispenser.stockTubeLengthMm !== null && dispenser.stockTubeLengthMm > body.bodyKey.heightMm,
      finalBottomY,
      finalReachMm,
    },
    mask: canPlanMask ? {
      tubeColumn: {
        left: body.registration.centerX - tubeRadiusPx!,
        top: startY,
        right: body.registration.centerX + tubeRadiusPx!,
        bottom: finalBottomY!,
      },
      // A tube mask is not permission to guess the inserted plug profile.
      insertedPlugBand: null,
    } : null,
    blockers,
  };
}

export function buildBodyContextWeldPlan(input: BuildBodyContextWeldPlanInput): BodyContextWeldPlan {
  if (input.bodyRegistry.entries.length === 0) {
    throw new Error("At least one approved body plate is required.");
  }
  input.bodyRegistry.entries.forEach(assertRegistryEntry);

  const scale = scaleCalibration(
    input.bodyRegistry.entries,
    input.approvedPxPerMm ?? null,
    input.approvedPxPerMmEvidence ?? null,
  );
  const jobs = input.dispensers.flatMap((dispenser) => (
    input.bodyRegistry.entries.map((body) => buildJob(input.familyId, body, dispenser, scale))
  ));

  return {
    schemaVersion: 1,
    familyId: input.familyId,
    canonicalCanvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    scaleCalibration: scale,
    summary: {
      bodyCount: input.bodyRegistry.entries.length,
      dispenserCount: input.dispensers.length,
      jobCount: jobs.length,
      productionReadyJobCount: jobs.filter((job) => job.state === "mask-plan-ready").length,
      dimensionReviewJobCount: jobs.filter((job) => job.state === "dimension-review-required").length,
      blockedJobCount: jobs.filter((job) => job.state === "blocked-missing-tube-dimensions").length,
    },
    reusablePlateIds: [],
    jobs,
    mutationPolicy: {
      masksWritten: false,
      candidatesGenerated: false,
      remoteWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
}
