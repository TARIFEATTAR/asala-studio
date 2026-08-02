import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildCylinderLaneLockedRemediationArtifact } from "./build-cylinder-lane-locked-remediation";

const WORKSPACE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const temporaryRoots: string[] = [];

after(async () => {
  await Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("Cylinder lane-locked remediation v3 builder", () => {
  it("writes one content-addressed local artifact with no external writes", async () => {
    const outputRoot = await mkdtemp(path.join(tmpdir(), "cylinder-lane-locked-v3-"));
    temporaryRoots.push(outputRoot);

    const result = await buildCylinderLaneLockedRemediationArtifact({
      workspaceRoot: WORKSPACE_ROOT,
      outputRoot,
      generatedAt: "2026-07-15T12:00:00.000Z",
    });
    const bytes = await readFile(result.artifactPath);
    const artifact = JSON.parse(bytes.toString("utf8"));

    assert.equal(path.basename(path.dirname(result.artifactPath)), artifact.sha256);
    assert.equal(result.sha256, artifact.sha256);
    assert.equal(artifact.version, "best-bottles-cylinder-lane-locked-remediation-v3");
    assert.equal(artifact.summary.validRoleJobCount, 192);
    assert.equal(artifact.summary.blockedRoleSlotCount, 158);
    assert.equal(artifact.summary.externalWriteCount, 0);
    assert.equal(artifact.authorization.remoteWrites, "forbidden");
    assert.equal(artifact.authorization.paidGeneration, "not-authorized");
  });
});
