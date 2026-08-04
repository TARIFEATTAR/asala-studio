import type { PixelBounds } from "./componentPlateContract";

export interface SourceBodyRegistrationEvidence {
  sourceId: string;
  sourceSha256: string;
  bodyBoundsPx: PixelBounds;
  contextualPartBoundsPx: PixelBounds;
}

export interface BuildSourceBodyRegistrationPlanInput {
  familyId: string;
  componentPartId: string;
  sources: SourceBodyRegistrationEvidence[];
  targetBodyAuthorityState: string;
}

type NormalizedRegistration = {
  leftWithinBody: number;
  topWithinBody: number;
  widthOfBody: number;
  heightOfBody: number;
};

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function assertBounds(bounds: PixelBounds, label: string): void {
  if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isInteger)
    || bounds.left < 0 || bounds.top < 0 || bounds.width < 1 || bounds.height < 1) {
    throw new Error(`${label} must contain positive integer pixel bounds.`);
  }
}

function normalize(source: SourceBodyRegistrationEvidence): NormalizedRegistration {
  return {
    leftWithinBody: round((source.contextualPartBoundsPx.left - source.bodyBoundsPx.left) / source.bodyBoundsPx.width),
    topWithinBody: round((source.contextualPartBoundsPx.top - source.bodyBoundsPx.top) / source.bodyBoundsPx.height),
    widthOfBody: round(source.contextualPartBoundsPx.width / source.bodyBoundsPx.width),
    heightOfBody: round(source.contextualPartBoundsPx.height / source.bodyBoundsPx.height),
  };
}

export function buildSourceBodyRegistrationPlan(input: BuildSourceBodyRegistrationPlanInput) {
  if (input.sources.length < 2) throw new Error("At least two layered source assemblies are required.");
  const sourceIds = new Set<string>();
  for (const source of input.sources) {
    if (sourceIds.has(source.sourceId)) throw new Error(`Duplicate source registration: ${source.sourceId}`);
    sourceIds.add(source.sourceId);
    if (!/^[a-f0-9]{64}$/i.test(source.sourceSha256)) {
      throw new Error(`Invalid immutable source SHA-256: ${source.sourceId}`);
    }
    assertBounds(source.bodyBoundsPx, `${source.sourceId} body`);
    assertBounds(source.contextualPartBoundsPx, `${source.sourceId} contextual part`);
  }
  const registrations = input.sources.map(normalize);
  const normalizedRegistration = registrations[0];
  if (registrations.some((registration) => (
    registration.leftWithinBody !== normalizedRegistration.leftWithinBody
    || registration.topWithinBody !== normalizedRegistration.topWithinBody
    || registration.widthOfBody !== normalizedRegistration.widthOfBody
    || registration.heightOfBody !== normalizedRegistration.heightOfBody
  ))) {
    throw new Error("Source-body registration drift detected across layered assemblies.");
  }
  const bodyAuthorityApproved = input.targetBodyAuthorityState === "approved";
  return {
    schemaVersion: 1 as const,
    familyId: input.familyId,
    componentPartId: input.componentPartId,
    sourceCount: input.sources.length,
    sources: input.sources,
    normalizedRegistration,
    sharedRegistrationConfirmed: true,
    outputPolicy: "body-contextual-weld" as const,
    productionPlateEligible: false,
    targetJobsWritten: false,
    blocker: bodyAuthorityApproved
      ? "Target body jobs require explicit immutable target-body registrations before masks are written."
      : `Target body authority is ${input.targetBodyAuthorityState}; approve the body authority before target masks or weld jobs are written.`,
    mutationPolicy: {
      masksWritten: false,
      candidatesGenerated: false,
      remoteWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
}
