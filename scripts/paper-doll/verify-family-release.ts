#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

import {
  CYL9_FROZEN_BODY_SHA256,
} from "../../src/lib/paperDoll/cyl9FamilyRelease.node";
import {
  canonicalizeReleaseValue,
  parsePaperDollReleaseManifest,
  type PaperDollReleaseManifest,
} from "../../src/lib/paperDoll/releaseContract";
import { hashPaperDollRelease } from "../../src/lib/paperDoll/releaseHash.node";
import {
  validatePaperDollRelease,
  type PaperDollReleaseValidation,
} from "../../src/lib/paperDoll/releaseValidator";

const ValidationFileSchema = z.object({
  ready: z.boolean(),
  blockers: z.array(z.string()),
  advisories: z.array(z.string()),
  assetCountBySlot: z.record(z.number().int().nonnegative()),
});

type DatabaseStatus = "passed" | "not-run" | "failed";

interface VerificationArgs {
  manifestPath: string;
  validationPath: string;
  databaseStatus: DatabaseStatus;
}

interface ReleaseDecision {
  ready: boolean;
  blockers: string[];
}

const EXPECTED_OPAQUE_CAP_MATERIALS = new Set([
  "mirror-chrome",
  "matte-white",
  "glossy-black",
]);

function isExpectedResearchBlocker(blocker: string): boolean {
  return blocker.startsWith("assembly_context_required:") ||
    blocker === "blocking_gate_blocked:translucent-assembly-context";
}

function isExpectedManifestResearchBlocker(
  manifest: PaperDollReleaseManifest,
  blocker: string,
): boolean {
  if (blocker === "blocking_gate_blocked:translucent-assembly-context") return true;
  if (!blocker.startsWith("assembly_context_required:")) return false;
  const componentVersionId = blocker.slice("assembly_context_required:".length);
  return manifest.assets.some(
    (asset) => asset.componentVersionId === componentVersionId &&
      asset.materialVariant === "translucent-frosted" &&
      asset.approvalStatus === "blocked",
  );
}

export function releaseVerificationExitCode(decision: ReleaseDecision): 0 | 1 | 2 {
  if (decision.ready) return decision.blockers.length === 0 ? 0 : 1;
  if (decision.blockers.length === 0) return 1;
  return decision.blockers.every(isExpectedResearchBlocker) ? 2 : 1;
}

function parseArgs(argv: string[]): VerificationArgs {
  function requiredValue(flag: string): string {
    const index = argv.indexOf(flag);
    const value = index >= 0 ? argv[index + 1]?.trim() : "";
    if (!value) throw new Error(`${flag} is required.`);
    return value;
  }

  const databaseStatus = requiredValue("--database-status");
  if (databaseStatus !== "passed" && databaseStatus !== "not-run" && databaseStatus !== "failed") {
    throw new Error("--database-status must be passed, not-run, or failed.");
  }
  return {
    manifestPath: resolve(requiredValue("--manifest")),
    validationPath: resolve(requiredValue("--validation")),
    databaseStatus,
  };
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assetPath(manifestPath: string, relativeOrAbsolutePath: string): string {
  return isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : resolve(dirname(manifestPath), relativeOrAbsolutePath);
}

async function verifyAssetBytes(
  manifestPath: string,
  manifest: PaperDollReleaseManifest,
): Promise<string[]> {
  const problems: string[] = [];
  const verified = new Map<string, string>();

  async function verify(path: string, expectedSha: string, label: string): Promise<void> {
    const absolutePath = assetPath(manifestPath, path);
    const previousSha = verified.get(absolutePath);
    if (previousSha) {
      if (previousSha !== expectedSha) problems.push(`conflicting_expected_sha:${label}`);
      return;
    }
    try {
      const actualSha = sha256(await readFile(absolutePath));
      verified.set(absolutePath, expectedSha);
      if (actualSha !== expectedSha) problems.push(`asset_hash_drift:${label}`);
    } catch {
      problems.push(`asset_missing:${label}`);
    }
  }

  for (const asset of manifest.assets) {
    await verify(asset.imagePath, asset.imageSha256, `${asset.slot}:${asset.variantKey}`);
    if (asset.geometryMaskPath && asset.geometryMaskSha256) {
      await verify(
        asset.geometryMaskPath,
        asset.geometryMaskSha256,
        `geometry-mask:${asset.slot}:${asset.variantKey}`,
      );
    }
  }
  return problems;
}

function verifyCyl9Identity(manifest: PaperDollReleaseManifest): string[] {
  const problems: string[] = [];
  const bodies = manifest.assets.filter((asset) => asset.slot === "body");
  const expectedBodyEntries = Object.entries(CYL9_FROZEN_BODY_SHA256);
  if (bodies.length !== expectedBodyEntries.length) problems.push("frozen_body_count_mismatch");
  for (const [componentKey, expectedSha] of expectedBodyEntries) {
    const matches = bodies.filter((asset) => asset.componentKey === componentKey);
    if (matches.length !== 1) {
      problems.push(`frozen_body_identity_mismatch:${componentKey}`);
    } else if (matches[0].imageSha256 !== expectedSha) {
      problems.push(`frozen_body_hash_drift:${componentKey}`);
    }
  }

  const opaqueCaps = manifest.assets.filter(
    (asset) => asset.slot === "cap" && asset.approvalStatus === "approved",
  );
  const opaqueMaterials = new Set(opaqueCaps.map((asset) => asset.materialVariant));
  if (
    opaqueCaps.length !== EXPECTED_OPAQUE_CAP_MATERIALS.size ||
    [...EXPECTED_OPAQUE_CAP_MATERIALS].some((material) => !opaqueMaterials.has(material))
  ) {
    problems.push("opaque_cap_material_set_mismatch");
  }
  const opaqueMaskHashes = new Set(opaqueCaps.map((asset) => asset.geometryMaskSha256));
  if (opaqueMaskHashes.size !== 1 || opaqueMaskHashes.has(null)) {
    problems.push("opaque_cap_shared_geometry_mask_mismatch");
  }

  const translucentCaps = manifest.assets.filter(
    (asset) => asset.slot === "cap" && asset.materialVariant === "translucent-frosted",
  );
  if (translucentCaps.length !== 1 || translucentCaps[0].approvalStatus !== "blocked") {
    problems.push("translucent_cap_block_state_mismatch");
  } else {
    const evidence = manifest.qaEvidence.find(
      (entry) => entry.subjectId === translucentCaps[0].componentVersionId &&
        entry.gateKey === "translucent-assembly-context",
    );
    if (
      !evidence || !evidence.blocking || evidence.status !== "blocked" ||
      evidence.calibratedWith.length === 0
    ) {
      problems.push("translucent_cap_qa_evidence_missing");
    }
  }
  return problems;
}

function renderReport(input: {
  manifest: PaperDollReleaseManifest;
  manifestSha256: string;
  validation: PaperDollReleaseValidation;
  expectedBlockers: string[];
  unexpectedBlockers: string[];
  integrityProblems: string[];
  databaseStatus: DatabaseStatus;
  verdict: string;
}): void {
  const { manifest } = input;
  const bodies = manifest.assets.filter((asset) => asset.slot === "body");
  const opaqueCaps = manifest.assets.filter(
    (asset) => asset.slot === "cap" && asset.approvalStatus === "approved",
  );
  const sharedMask = opaqueCaps[0]?.geometryMaskSha256 ?? "none";

  console.log(`Family: ${manifest.familyKey}`);
  console.log(`Release: ${manifest.releaseVersion}`);
  console.log(`Schema: ${manifest.schemaVersion}`);
  console.log(`Canonical manifest SHA-256: ${input.manifestSha256}`);
  console.log(`Asset counts: ${canonicalizeReleaseValue(input.validation.assetCountBySlot)}`);
  console.log("Frozen bodies:");
  for (const body of bodies) console.log(`  ${body.variantKey} ${body.imageSha256} ${body.componentKey}`);
  console.log("Approved opaque caps:");
  for (const cap of opaqueCaps) console.log(`  ${cap.variantKey} ${cap.materialVariant} ${cap.imageSha256}`);
  console.log(`Shared closure geometry-mask SHA-256: ${sharedMask}`);
  console.log(`Expected research blockers: ${input.expectedBlockers.length}`);
  for (const blocker of input.expectedBlockers) console.log(`  ${blocker}`);
  console.log(`Unexpected blockers: ${input.unexpectedBlockers.length}`);
  for (const blocker of input.unexpectedBlockers) console.log(`  ${blocker}`);
  console.log(`Integrity problems: ${input.integrityProblems.length}`);
  for (const problem of input.integrityProblems) console.log(`  ${problem}`);
  console.log(`Advisories: ${input.validation.advisories.length}`);
  for (const advisory of input.validation.advisories) console.log(`  ${advisory}`);
  console.log(`Database status: ${input.databaseStatus}`);
  console.log(input.verdict);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const manifest = parsePaperDollReleaseManifest(
    JSON.parse(await readFile(args.manifestPath, "utf8")),
  );
  const suppliedValidation = ValidationFileSchema.parse(
    JSON.parse(await readFile(args.validationPath, "utf8")),
  ) as PaperDollReleaseValidation;
  const computedValidation = validatePaperDollRelease(manifest);
  const integrityProblems = [
    ...await verifyAssetBytes(args.manifestPath, manifest),
    ...verifyCyl9Identity(manifest),
  ];
  if (
    canonicalizeReleaseValue(suppliedValidation) !==
      canonicalizeReleaseValue(computedValidation)
  ) {
    integrityProblems.push("validation_evidence_drift");
  }

  const expectedBlockers = computedValidation.blockers.filter(
    (blocker) => isExpectedManifestResearchBlocker(manifest, blocker),
  );
  const unexpectedBlockers = computedValidation.blockers.filter(
    (blocker) => !isExpectedManifestResearchBlocker(manifest, blocker),
  );
  let exitCode = releaseVerificationExitCode(computedValidation);
  if (
    integrityProblems.length > 0 || unexpectedBlockers.length > 0 ||
    args.databaseStatus !== "passed"
  ) exitCode = 1;
  const verdict = exitCode === 0
    ? "CORE_READY_FOR_UI_PLAN"
    : exitCode === 2
      ? "CORE_VALID_WITH_RESEARCH_BLOCK"
      : "CORE_FAILED";

  renderReport({
    manifest,
    manifestSha256: hashPaperDollRelease(manifest),
    validation: computedValidation,
    expectedBlockers,
    unexpectedBlockers,
    integrityProblems,
    databaseStatus: args.databaseStatus,
    verdict,
  });
  process.exitCode = exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
