#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCyl9DraftRelease,
  CYL9_FROZEN_BODY_SHA256,
  parseCyl9ReleaseArgs,
} from "../../src/lib/paperDoll/cyl9FamilyRelease.node";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function currentCommit(): string {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("Unable to resolve the current Git commit.");
  return result.stdout.trim();
}

async function main(): Promise<void> {
  const { outputDirectory } = parseCyl9ReleaseArgs(process.argv.slice(2));
  const result = await buildCyl9DraftRelease({
    repositoryRoot,
    bodyRegistryPath: resolve(repositoryRoot, "docs/paper-doll-rig/body-plate-registry.json"),
    placementRecipePath: resolve(repositoryRoot, "docs/paper-doll-rig/closure-placement-recipe.json"),
    closurePilotManifestPath: resolve(repositoryRoot, "outputs/paper-doll-closure-material-pilot/manifest.json"),
    outputDirectory: resolve(repositoryRoot, outputDirectory),
    sourceGitCommit: currentCommit(),
    expectedBodySha256ById: CYL9_FROZEN_BODY_SHA256,
  });

  console.log(`Family: ${result.manifest.familyKey}`);
  console.log(`Release: ${result.manifest.releaseVersion}`);
  console.log(`Manifest SHA-256: ${result.manifestSha256}`);
  console.log(`Assets: ${result.manifest.assets.length}`);
  console.log(`Mappings: ${result.manifest.assemblyMappings.length}`);
  console.log(`Ready: ${result.validation.ready ? "YES" : "NO"}`);
  for (const blocker of result.validation.blockers) console.log(`BLOCKED ${blocker}`);
  if (!result.validation.ready) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
