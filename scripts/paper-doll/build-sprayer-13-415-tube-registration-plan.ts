import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildSourceBodyRegistrationPlan,
  type BuildSourceBodyRegistrationPlanInput,
} from "../../src/lib/paperDoll/sourceBodyRegistration";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const recipePath = path.join(
  workspaceRoot,
  "docs/paper-doll-rig/sprayer-13-415-source-body-registrations.json",
);
const outputPath = path.join(
  workspaceRoot,
  "outputs/paper-doll-component-kit-reviews/13-415-sprayer/tube-registration-v1/manifest.json",
);

interface Recipe extends BuildSourceBodyRegistrationPlanInput {
  schemaVersion: 1;
  sourceSceneContract: {
    bodySceneIndex: number;
    tubeSceneIndex: number;
    headSceneIndex: number;
    detachedOvercapSceneIndex: number;
    sourceCanvas: { width: number; height: number };
  };
}

export async function buildSprayer13TubeRegistrationPlan() {
  const recipe = JSON.parse(await readFile(recipePath, "utf8")) as Recipe;
  const plan = buildSourceBodyRegistrationPlan(recipe);
  return { ...plan, sourceSceneContract: recipe.sourceSceneContract };
}

async function main(): Promise<void> {
  const plan = await buildSprayer13TubeRegistrationPlan();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    outputPath: path.relative(workspaceRoot, outputPath),
    sourceCount: plan.sourceCount,
    sharedRegistrationConfirmed: plan.sharedRegistrationConfirmed,
    targetJobsWritten: plan.targetJobsWritten,
    mutationPolicy: plan.mutationPolicy,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
