import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildBodyContextWeldPlan,
  type BodyContextDispenserInput,
  type BodyContextWeldPlan,
  type BodyPlateRegistry,
} from "../../src/lib/paperDoll/bodyContextWeldPlan";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const registryPath = path.join(workspaceRoot, "docs/paper-doll-rig/body-plate-registry.json");
const outputPath = path.join(workspaceRoot, "docs/paper-doll-rig/dispenser-17-415-body-context-weld-plan.json");
const reportPath = path.join(workspaceRoot, "docs/paper-doll-rig/DISPENSER-17-415-BODY-CONTEXT-WELD-PLAN.md");

const dispensers: BodyContextDispenserInput[] = [
  {
    lane: "sprayer",
    componentPartId: "sprayer-dip-tube",
    exteriorSeatY: 1002,
    stockTubeLengthMm: 93.8,
    tubeDiameterMm: null,
    interiorBottomMarginMm: null,
    includesInsertedPlug: true,
    sourceEvidence: "Best Bottles catalog dimension records a 93.8 mm stock tube; target-body trim, outside diameter, and inserted-plug profile remain unverified.",
  },
  {
    lane: "pump",
    componentPartId: "pump-dip-tube",
    exteriorSeatY: 1002,
    stockTubeLengthMm: null,
    tubeDiameterMm: null,
    interiorBottomMarginMm: null,
    includesInsertedPlug: true,
    sourceEvidence: "The repository has no verified 17-415 pump tube length, outside diameter, target-body trim margin, or inserted-plug profile.",
  },
];

export async function buildDispenser17415BodyContextPlan(): Promise<BodyContextWeldPlan> {
  const bodyRegistry = JSON.parse(await readFile(registryPath, "utf8")) as BodyPlateRegistry;
  return buildBodyContextWeldPlan({
    familyId: "CYL-9ML-17-415",
    bodyRegistry,
    dispensers,
  });
}

function renderReport(plan: BodyContextWeldPlan): string {
  const bodyRows = plan.jobs
    .filter((job) => job.lane === "sprayer")
    .map((job) => (
      `| ${job.bodyColorway} | \`${job.bodyAssetSha256.slice(0, 12)}…\` | ${job.registration.centerX} | ${job.registration.neckTopY}–${job.registration.neckBaseY} | ${job.registration.baselineY} | ${job.renderedPath.startY}–${job.renderedPath.maximumBottomY} |`
    ));
  const laneRows = ["sprayer", "pump"].map((lane) => {
    const jobs = plan.jobs.filter((job) => job.lane === lane);
    const first = jobs[0];
    return `| ${lane} | ${first.stockTubeLengthMm ?? "unverified"} | ${first.tubeDiameterMm ?? "unverified"} | ${first.interiorBottomMarginMm ?? "unverified"} | ${first.state} | ${[...new Set(jobs.flatMap((job) => job.blockers))].join(", ")} |`;
  });

  return `# CYL-9ML 17-415 body-context weld plan

**Status:** dry-run contract only

**Scope:** fine-mist sprayer and lotion-pump dip tubes plus inserted-plug interaction on the five locked CYL-9ML body plates

**Mutation state:** no masks written, no candidates generated, no Current Release change, no Sanity write

## Architecture decision

The exposed dispenser and the closed dispenser-plus-translucent-overcap are reusable swatches. The dip tube, inserted plug, interior occlusion, and refraction are not reusable global plates. They are five explicit body-context jobs tied to immutable body SHAs.

The 93.8 mm sprayer value is the catalog stock-tube length. It is not the visible rendered reach. A stock tube longer than this 70 mm bottle must be trimmed to the verified interior depth for each target body.

## Calibration gate

- Thread-crest proxy: ${plan.scaleCalibration.threadCrestPxPerMm.toFixed(4)} px/mm.
- Neck-top-to-baseline body-height proxy: ${plan.scaleCalibration.bodyHeightProxyPxPerMm.toFixed(4)} px/mm.
- Divergence: ${plan.scaleCalibration.divergencePercent.toFixed(2)}%.
- State: **${plan.scaleCalibration.status}**.

The proxies do not describe the same physical span and cannot be silently substituted for an approved tube-width conversion. The inherited 4.4 mm weld default is therefore not accepted as 17-415 evidence.

## Locked body registrations

| Body | Immutable SHA | Center X | Neck Y | Baseline Y | Maximum untrimmed tube path Y |
|---|---|---:|---:|---:|---:|
${bodyRows.join("\n")}

## Lane gates

| Lane | Stock length mm | Diameter mm | Interior margin mm | State | Open blockers |
|---|---:|---:|---:|---|---|
${laneRows.join("\n")}

## Required evidence before mask creation

1. Measure the real tube outside diameter for each physical dispenser lane.
2. Measure or document the CYL-9ML target-body interior bottom clearance.
3. Verify the pump stock tube length and trim rule.
4. Calibrate a reviewed pixel conversion against the actual mounted assembly rather than selecting one of the conflicting proxies.
5. Define the inserted-plug horizontal profile from the real part or layered source.
6. Generate one body-specific mask per immutable body SHA; then run the masked weld, deterministic clamp, and five-body visual QA.

Until those gates pass, all ten jobs remain pre-generation and no geometry-lock claim is allowed.
`;
}

async function main(): Promise<void> {
  const plan = await buildDispenser17415BodyContextPlan();
  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`),
    writeFile(reportPath, renderReport(plan)),
  ]);
  process.stdout.write(`${JSON.stringify({
    outputPath: path.relative(workspaceRoot, outputPath),
    reportPath: path.relative(workspaceRoot, reportPath),
    summary: plan.summary,
    mutationPolicy: plan.mutationPolicy,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
