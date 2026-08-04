import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CONFIRMATION = "CYL9-CAPPED-DISPENSER-LOCK";
const DEFAULT_SOURCE_MANIFEST = "outputs/paper-doll-dispenser-17-415/capped-source-swatches-v3/manifest.json";
const DEFAULT_BODY_REGISTRY = "docs/paper-doll-rig/body-plate-registry.json";
const DEFAULT_OUTPUT = "docs/paper-doll-rig/cyl9-capped-dispenser-v3-placement-lock.json";

interface PixelBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CandidateInput {
  lane: "sprayer" | "pump";
  variantKey: string;
  candidatePath: string;
  candidateSha256: string;
  authorityPath: string;
  authoritySha256: string;
  placementBoundsPx: PixelBounds;
  qa: { alphaMismatchedPixels: number; exactMaskClampVerified: boolean };
}

interface SourceManifest {
  state: string;
  calibration: { targetWidthPx: number; centerXPx: number; seatYPx: number };
  candidates: CandidateInput[];
  qa: { exactMaskClampVerified: boolean; fiveBodyAssemblyContextRendered: boolean };
  mutationPolicy: { remoteWritesPerformed: boolean; currentReleaseChanged: boolean; sanityChanged: boolean };
}

interface BodyRegistry {
  entries: Array<{
    id: string;
    asset: { path: string; sha256: string; widthPx: number; heightPx: number };
  }>;
}

interface BuildPlacementLockInput {
  sourceManifestPath: string;
  sourceManifestSha256: string;
  sourceManifest: SourceManifest;
  bodies: BodyRegistry["entries"];
  approvedByName: string;
  approvedAt: string;
  approvalNote: string;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableId(prefix: string, content: unknown): string {
  return `${prefix}__${sha256(JSON.stringify(content)).slice(0, 24)}`;
}

export function buildCyl9CappedDispenserPlacementLock(input: BuildPlacementLockInput) {
  const expected = {
    sprayer: ["GLD", "MSLV", "BLK", "SSLV", "RED", "TUR"],
    pump: ["MSLV", "GLD", "BLK"],
  } as const;
  if (!input.approvedByName.trim() || !input.approvalNote.trim()) {
    throw new Error("Named approval and a non-empty approval note are required.");
  }
  if (!Number.isFinite(Date.parse(input.approvedAt))) throw new Error("Approval timestamp must be valid ISO-8601.");
  if (
    !input.sourceManifest.qa.exactMaskClampVerified
    || !input.sourceManifest.qa.fiveBodyAssemblyContextRendered
    || Object.values(input.sourceManifest.mutationPolicy).some(Boolean)
  ) {
    throw new Error("Placement lock requires exact mask clamp, five-body review, and zero prior remote mutations.");
  }
  if (input.bodies.length !== 5 || new Set(input.bodies.map(({ id }) => id)).size !== 5) {
    throw new Error("Placement lock requires five explicit unique body plates.");
  }
  for (const lane of ["sprayer", "pump"] as const) {
    const variants = input.sourceManifest.candidates.filter((candidate) => candidate.lane === lane);
    if (
      variants.length !== expected[lane].length
      || expected[lane].some((variantKey) => !variants.some((candidate) => candidate.variantKey === variantKey))
    ) {
      throw new Error(`Placement lock requires the exact ${lane} variant set.`);
    }
    if (new Set(variants.map(({ authoritySha256 }) => authoritySha256)).size !== 1) {
      throw new Error(`${lane} variants must share one exact authority mask.`);
    }
    if (new Set(variants.map(({ placementBoundsPx }) => JSON.stringify(placementBoundsPx))).size !== 1) {
      throw new Error(`${lane} variants must share one exact placement transform.`);
    }
  }
  for (const candidate of input.sourceManifest.candidates) {
    if (candidate.qa.alphaMismatchedPixels !== 0 || !candidate.qa.exactMaskClampVerified) {
      throw new Error(`${candidate.lane}:${candidate.variantKey} has not earned exact-alpha approval.`);
    }
  }

  const components = input.sourceManifest.candidates
    .map((candidate) => ({
      componentKey: `${candidate.lane}__17-415__${candidate.variantKey}`,
      lane: candidate.lane,
      variantKey: candidate.variantKey,
      componentVersionId: `local:${candidate.candidateSha256}`,
      candidatePath: candidate.candidatePath,
      candidateSha256: candidate.candidateSha256,
      authorityPath: candidate.authorityPath,
      authoritySha256: candidate.authoritySha256,
      placementBoundsPx: candidate.placementBoundsPx,
      geometryLocked: true,
      lifecycleState: "placement-locked" as const,
    }))
    .sort((left, right) => left.componentKey.localeCompare(right.componentKey));
  const bodyPlates = input.bodies
    .map((body) => ({
      bodyPlateId: body.id,
      assetPath: body.asset.path,
      assetSha256: body.asset.sha256,
      widthPx: body.asset.widthPx,
      heightPx: body.asset.heightPx,
    }))
    .sort((left, right) => left.bodyPlateId.localeCompare(right.bodyPlateId));
  const placementRows = components.flatMap((component) => bodyPlates.map((body) => ({
    componentVersionId: component.componentVersionId,
    bodyPlateId: body.bodyPlateId,
    placementBoundsPx: component.placementBoundsPx,
  })));
  const content = {
    familyKey: "CYL-9ML",
    geometryFamilyKey: "17-415-capped-dispensers-v3",
    sourceManifestPath: input.sourceManifestPath,
    sourceManifestSha256: input.sourceManifestSha256,
    canvas: { widthPx: 2080, heightPx: 2288 },
    sharedPlacement: {
      targetWidthPx: input.sourceManifest.calibration.targetWidthPx,
      centerXPx: input.sourceManifest.calibration.centerXPx,
      seatYPx: input.sourceManifest.calibration.seatYPx,
    },
    components,
    bodyPlates,
    placementRows,
  };
  const contentSha256 = sha256(JSON.stringify(content));
  return {
    schemaVersion: 1,
    lockId: stableId("placement-lock", content),
    placementVersionId: stableId("placement-version", content),
    lifecycleState: "placement-locked" as const,
    approvedByName: input.approvedByName.trim(),
    approvedAt: input.approvedAt,
    approvalNote: input.approvalNote.trim(),
    approvals: [
      { action: "pixels-approved", approvedByName: input.approvedByName.trim(), approvedAt: input.approvedAt, note: input.approvalNote.trim() },
      { action: "family-fit-approved", approvedByName: input.approvedByName.trim(), approvedAt: input.approvedAt, note: input.approvalNote.trim() },
      { action: "placement-locked", approvedByName: input.approvedByName.trim(), approvedAt: input.approvedAt, note: input.approvalNote.trim() },
    ],
    contentSha256,
    ...content,
    releaseState: {
      currentReleaseChanged: false,
      releaseCutCreated: false,
      sanityDraftChanged: false,
      publicPublicationChanged: false,
    },
    persistence: {
      localLockWritten: true,
      remoteDatabaseWritten: false,
      nextAction: "register immutable candidates and replay this named lock in the production workbench",
    },
  };
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (valueAfter(args, "--confirmation") !== CONFIRMATION) {
    throw new Error(`Placement lock requires --confirmation ${CONFIRMATION}.`);
  }
  const approvedByName = valueAfter(args, "--approved-by") ?? "";
  const approvalNote = valueAfter(args, "--approval-note") ?? "";
  const approvedAt = valueAfter(args, "--approved-at") ?? new Date().toISOString();
  const sourceManifestPath = path.resolve(valueAfter(args, "--source-manifest") ?? DEFAULT_SOURCE_MANIFEST);
  const bodyRegistryPath = path.resolve(valueAfter(args, "--body-registry") ?? DEFAULT_BODY_REGISTRY);
  const outputPath = path.resolve(valueAfter(args, "--output") ?? DEFAULT_OUTPUT);
  const [sourceManifestBytes, bodyRegistryBytes] = await Promise.all([
    readFile(sourceManifestPath),
    readFile(bodyRegistryPath),
  ]);
  const sourceManifest = JSON.parse(sourceManifestBytes.toString("utf8")) as SourceManifest;
  const bodyRegistry = JSON.parse(bodyRegistryBytes.toString("utf8")) as BodyRegistry;
  for (const candidate of sourceManifest.candidates) {
    const candidateBytes = await readFile(candidate.candidatePath);
    const authorityBytes = await readFile(candidate.authorityPath);
    if (sha256(candidateBytes) !== candidate.candidateSha256) throw new Error(`Candidate bytes changed: ${candidate.candidatePath}`);
    if (sha256(authorityBytes) !== candidate.authoritySha256) throw new Error(`Authority bytes changed: ${candidate.authorityPath}`);
  }
  for (const body of bodyRegistry.entries) {
    if (sha256(await readFile(body.asset.path)) !== body.asset.sha256) throw new Error(`Body plate bytes changed: ${body.asset.path}`);
  }
  const lock = buildCyl9CappedDispenserPlacementLock({
    sourceManifestPath,
    sourceManifestSha256: sha256(sourceManifestBytes),
    sourceManifest,
    bodies: bodyRegistry.entries,
    approvedByName,
    approvedAt,
    approvalNote,
  });
  await writeFile(outputPath, `${JSON.stringify(lock, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ outputPath, lockId: lock.lockId, placementVersionId: lock.placementVersionId, placementRows: lock.placementRows.length, remoteDatabaseWritten: false }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
