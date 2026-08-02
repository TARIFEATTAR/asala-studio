import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  composeCylinderRoleAwareReadiness,
  type CylinderRoleAwareReadinessInput,
} from "../../src/lib/bestBottlesCylinderRoleAwareReadiness";

const ROOT = process.cwd();
const OUTPUT_PATH = "public/data/best-bottles-cylinder-sidecar-promotion.json";

const SOURCE_PATHS = {
  productionReadiness:
    "public/data/best-bottles-cylinder-production-readiness.json",
  identityCapOnAudit:
    "tmp/best-bottles-reference-production/cylinder-production-promotion-v1/cylinder-reference-promotion-manifest.json",
  identityCapOnExecution:
    "tmp/best-bottles-reference-production/cylinder-production-promotion-v1/cylinder-reference-promotion-execution.json",
  pdpCapOffSidecarPreflight:
    "tmp/best-bottles-reference-production/cylinder-sidecar-promotion-v2/cylinder-sidecar-promotion-preflight.json",
  pdpCapOffSidecarExecution:
    "tmp/best-bottles-reference-production/cylinder-sidecar-promotion-v2/cylinder-sidecar-promotion-execution.json",
  pdpCapOffSidecarManifest:
    "tmp/best-bottles-reference-production/cylinder-sidecar-reconciliation-v2/cylinder-sidecar-reconciliation-manifest.json",
  livePointerApproval:
    "docs/best-bottles-canonical-truth/best-bottles-cylinder-live-pointer-approval.json",
  recoveryApproval:
    "docs/best-bottles-canonical-truth/best-bottles-cylinder-recovery-approval.json",
  reviewedRoleApprovals:
    "docs/best-bottles-canonical-truth/best-bottles-cylinder-reviewed-role-approvals.json",
  bbuatStudioReferences:
    "tmp/best-bottles-reference-production/cylinder-reference-loop/bbuat-cylinder-exports/bbuat-cylinder-reviewed-references.json",
} as const;

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

async function main(): Promise<void> {
  type Sources = CylinderRoleAwareReadinessInput["sources"];
  const sources = {} as Sources;

  for (const [name, relativePath] of Object.entries(SOURCE_PATHS)) {
    sources[name as keyof Sources] = await readArtifactSource(relativePath) as never;
  }

  const artifact = composeCylinderRoleAwareReadiness({
    generatedAt: new Date().toISOString(),
    sources,
  });
  const outputPath = path.resolve(ROOT, OUTPUT_PATH);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    outputPath: OUTPUT_PATH,
    version: artifact.version,
    summary: artifact.summary,
    sha256: artifact.sha256,
  }, null, 2));
}

await main();
