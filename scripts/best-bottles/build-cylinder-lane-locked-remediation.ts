import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { CylinderDualRoleRemediationPlan } from "../../src/lib/bestBottlesCylinderDualRoleRemediation";
import {
  buildCylinderLaneLockedRemediationPlan,
  type CylinderLaneLockedRemediationInput,
} from "../../src/lib/bestBottlesCylinderLaneLockedRemediation";
import type { CylinderRoleAwareReadinessArtifact } from "../../src/lib/bestBottlesCylinderRoleAwareReadiness";

const INPUT_PATHS = {
  supersededDualRolePlan:
    "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/cylinder-dual-role-remediation-plan.json",
  roleAwareReadiness: "public/data/best-bottles-cylinder-sidecar-promotion.json",
} as const;

const DEFAULT_OUTPUT_ROOT =
  "tmp/best-bottles-reference-production/cylinder-lane-locked-remediation-v3";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readSource<T>(workspaceRoot: string, relativePath: string): Promise<{
  path: string;
  fileSha256: string;
  data: T;
}> {
  const bytes = await readFile(path.join(workspaceRoot, relativePath));
  return {
    path: relativePath,
    fileSha256: sha256(bytes),
    data: JSON.parse(bytes.toString("utf8")) as T,
  };
}

export async function buildCylinderLaneLockedRemediationArtifact(input: {
  workspaceRoot: string;
  generatedAt?: string;
  outputRoot?: string;
}): Promise<{ artifactPath: string; sha256: string }> {
  const sources: CylinderLaneLockedRemediationInput["sources"] = {
    supersededDualRolePlan: await readSource<CylinderDualRoleRemediationPlan>(
      input.workspaceRoot,
      INPUT_PATHS.supersededDualRolePlan,
    ),
    roleAwareReadiness: await readSource<CylinderRoleAwareReadinessArtifact>(
      input.workspaceRoot,
      INPUT_PATHS.roleAwareReadiness,
    ),
  };
  const artifact = buildCylinderLaneLockedRemediationPlan({
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sources,
  });
  const outputRoot = input.outputRoot
    ? path.resolve(input.outputRoot)
    : path.join(input.workspaceRoot, DEFAULT_OUTPUT_ROOT);
  const artifactDirectory = path.join(outputRoot, artifact.sha256);
  const artifactPath = path.join(
    artifactDirectory,
    "cylinder-lane-locked-remediation-plan.json",
  );
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return { artifactPath, sha256: artifact.sha256 };
}

const isCli = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isCli) {
  const workspaceRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const result = await buildCylinderLaneLockedRemediationArtifact({ workspaceRoot });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

