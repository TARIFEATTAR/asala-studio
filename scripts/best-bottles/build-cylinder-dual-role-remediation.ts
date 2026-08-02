import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import {
  buildCylinderDualRoleRemediationPlan,
  type CylinderDualRoleEvidenceVerification,
  type CylinderDualRoleRemediationInput,
} from "../../src/lib/bestBottlesCylinderDualRoleRemediation";

const ROOT = process.cwd();
const OUTPUT_PATH =
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/cylinder-dual-role-remediation-plan.json";

const SOURCE_PATHS = {
  roleAwareReadiness:
    "public/data/best-bottles-cylinder-sidecar-promotion.json",
  recoveryApproval:
    "docs/best-bottles-canonical-truth/best-bottles-cylinder-recovery-approval.json",
  livePointerApproval:
    "docs/best-bottles-canonical-truth/best-bottles-cylinder-live-pointer-approval.json",
  taxonomyOverrides:
    "docs/best-bottles-canonical-truth/best-bottles-family-taxonomy-overrides.json",
} as const;

const LIVE_POINTER_IMAGE_ROOT =
  "tmp/best-bottles-reference-production/cylinder-live-pointer-intake-v1";
const RETIRED_REFERENCE_TOKEN =
  /clean-references|transparent|background-removed|paper-doll|mask-/i;

function normalizedIdentity(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function identityKey(row: { websiteSku: string; graceSku: string }): string {
  return `${normalizedIdentity(row.websiteSku)}|${normalizedIdentity(row.graceSku)}`;
}

async function readArtifactSource<T>(relativePath: string): Promise<{
  path: string;
  fileSha256: string;
  data: T;
}> {
  const bytes = await readFile(path.resolve(ROOT, relativePath));
  return {
    path: relativePath,
    fileSha256: createHash("sha256").update(bytes).digest("hex"),
    data: JSON.parse(bytes.toString("utf8")) as T,
  };
}

async function verifyLocalEvidence(input: {
  canonicalIdentityKey: string;
  evidenceLane: CylinderDualRoleEvidenceVerification["evidenceLane"];
  localPath: string;
  expectedSha256: string;
  expectedWidth: number;
  expectedHeight: number;
}): Promise<CylinderDualRoleEvidenceVerification> {
  if (
    path.isAbsolute(input.localPath)
    || input.localPath.startsWith("..")
    || RETIRED_REFERENCE_TOKEN.test(input.localPath)
  ) {
    throw new Error(`Evidence path is not original-background eligible: ${input.localPath}`);
  }
  const bytes = await readFile(path.resolve(ROOT, input.localPath));
  const referenceSha256 = createHash("sha256").update(bytes).digest("hex");
  if (referenceSha256 !== input.expectedSha256.toLowerCase()) {
    throw new Error(`Evidence bytes do not match approval for ${input.canonicalIdentityKey}.`);
  }
  const image = sharp(bytes);
  const metadata = await image.metadata();
  const stats = await image.stats();
  const alpha = metadata.hasAlpha ? stats.channels.at(-1) : undefined;
  const opaque = !metadata.hasAlpha || alpha?.min === 255;
  if (
    metadata.format !== "png"
    || metadata.width !== input.expectedWidth
    || metadata.height !== input.expectedHeight
    || !opaque
  ) {
    throw new Error(`Evidence pixels do not match approved opaque PNG for ${input.canonicalIdentityKey}.`);
  }

  return {
    canonicalIdentityKey: input.canonicalIdentityKey,
    evidenceLane: input.evidenceLane,
    localPath: input.localPath,
    referenceSha256,
    width: metadata.width,
    height: metadata.height,
    opaque: true,
    originalBackgroundEligible: true,
    verificationMethod: "sha256+sharp-alpha-scan",
  };
}

async function buildEvidenceVerifications(
  sources: CylinderDualRoleRemediationInput["sources"],
): Promise<CylinderDualRoleEvidenceVerification[]> {
  const readiness = new Map(sources.roleAwareReadiness.data.rows.map((row) => [
    row.canonicalIdentityKey,
    row,
  ]));
  const vialIdentities = new Set(
    sources.taxonomyOverrides.data.overrides.map(identityKey),
  );
  const verifications: Promise<CylinderDualRoleEvidenceVerification>[] = [];

  for (const decision of sources.recoveryApproval.data.decisions) {
    const key = identityKey(decision);
    if (readiness.get(key)?.status !== "blocked" || vialIdentities.has(key)) continue;
    const localPath = path.relative(ROOT, decision.outputPath ?? "");
    verifications.push(verifyLocalEvidence({
      canonicalIdentityKey: key,
      evidenceLane: "approved-recovery",
      localPath,
      expectedSha256: decision.outputSha256,
      expectedWidth: decision.width,
      expectedHeight: decision.height,
    }));
  }

  for (const decision of sources.livePointerApproval.data.decisions) {
    const key = identityKey(decision);
    if (readiness.get(key)?.status !== "blocked" || vialIdentities.has(key)) continue;
    const localPath = path.posix.join(
      LIVE_POINTER_IMAGE_ROOT,
      decision.approvedReference.relativePath ?? "",
    );
    verifications.push(verifyLocalEvidence({
      canonicalIdentityKey: key,
      evidenceLane: "approved-live-pointer",
      localPath,
      expectedSha256: decision.approvedReference.sha256,
      expectedWidth: decision.approvedReference.width,
      expectedHeight: decision.approvedReference.height,
    }));
  }

  return Promise.all(verifications);
}

async function main(): Promise<void> {
  type Sources = CylinderDualRoleRemediationInput["sources"];
  const sources = {} as Sources;

  for (const [name, relativePath] of Object.entries(SOURCE_PATHS)) {
    sources[name as keyof Sources] = await readArtifactSource(relativePath) as never;
  }

  const plan = buildCylinderDualRoleRemediationPlan({
    generatedAt: sources.roleAwareReadiness.data.generatedAt,
    sources,
    evidenceVerifications: await buildEvidenceVerifications(sources),
  });
  const outputPath = path.resolve(ROOT, OUTPUT_PATH);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    outputPath: OUTPUT_PATH,
    version: plan.version,
    summary: plan.summary,
    authorization: plan.authorization,
    sha256: plan.sha256,
  }, null, 2));
}

await main();
