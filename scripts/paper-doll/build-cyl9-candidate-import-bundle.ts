import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseComponentCandidate } from "../../src/lib/paperDoll/componentPlateContract";
import {
  CYL9_PRODUCTION_COMPONENT_KEYS,
  loadCyl9ComponentFactory,
} from "../../src/lib/paperDoll/cyl9ComponentFactory";

type ArtifactIndex = {
  familyKey: string;
  artifacts: Array<{
    componentKey: string;
    variantKey: string;
    candidateId: string;
    paths: { candidatePath: string; layerPath: string; reviewPath: string; manifestPath: string };
  }>;
};

export interface CandidateImportBundle {
  schemaVersion: 1;
  familyKey: "CYL-9ML";
  candidateCount: 21;
  assemblyReviewCount: 105;
  candidates: Array<{
    componentKey: string;
    variantKey: string;
    slot: string;
    geometryFamilyId: string;
    displayName: string;
    materialVariant: string;
    reviewState: "candidate-review" | "registered-rhinestone-review" | "translucent-five-body-review";
    candidate: ReturnType<typeof parseComponentCandidate>;
    artifacts: {
      rawPath: string;
      rawSha256: string;
      candidatePath: string;
      candidateSha256: string;
      layerPath: string;
      layerSha256: string;
      reviewPath: string;
      reviewSha256: string;
      manifestPath: string;
      authorityMaskPath: string;
    };
  }>;
  mutationPolicy: {
    remoteWritesPerformed: false;
    approvalsWritten: false;
    placementsWritten: false;
    currentReleaseChanged: false;
    sanityChanged: false;
  };
}

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const factoryRoot = path.join(workspaceRoot, "outputs/paper-doll-component-factory/CYL-9ML");
const defaultOutput = path.join(factoryRoot, "candidate-import-bundle.json");

async function json<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function sha256(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function artifactKey(item: { componentKey: string; variantKey: string }): string {
  return `${item.componentKey}:${item.variantKey}`;
}

export async function buildCyl9CandidateImportBundle(): Promise<CandidateImportBundle> {
  const manifest = loadCyl9ComponentFactory();
  const materialized = await json<ArtifactIndex>(path.join(factoryRoot, "materialized/materialization-index.json"));
  const generated = await json<ArtifactIndex>(path.join(factoryRoot, "generated/generation-index.json"));
  const rhinestones = await json<ArtifactIndex>(path.join(factoryRoot, "registered-rhinestones/generation-index.json"));
  if ([materialized, generated, rhinestones].some((index) => index.familyKey !== manifest.familyKey)) {
    throw new Error("Every candidate index must belong to CYL-9ML.");
  }

  const selected = new Map([...materialized.artifacts, ...generated.artifacts].map((item) => [artifactKey(item), item]));
  for (const registered of rhinestones.artifacts) selected.set(artifactKey(registered), registered);
  const productionComponentKeys = new Set<string>(CYL9_PRODUCTION_COMPONENT_KEYS);
  const productionComponents = manifest.components.filter((component) => productionComponentKeys.has(component.componentKey));
  if (productionComponents.length !== 21) {
    throw new Error(`Candidate import bundle requires 21 production-selectable component definitions; found ${productionComponents.length}.`);
  }

  const candidates: CandidateImportBundle["candidates"] = [];
  for (const component of productionComponents) {
    for (const variant of component.variants) {
      const artifact = selected.get(artifactKey({ componentKey: component.componentKey, variantKey: variant.variantKey }));
      if (!artifact) throw new Error(`Missing selected candidate for ${component.componentKey}:${variant.variantKey}.`);
      const candidate = parseComponentCandidate(await json<unknown>(artifact.paths.manifestPath));
      const candidateSha256 = await sha256(artifact.paths.candidatePath);
      const layerSha256 = await sha256(artifact.paths.layerPath);
      const reviewSha256 = await sha256(artifact.paths.reviewPath);
      const rawSha256 = await sha256(candidate.source.path);
      if (candidateSha256 !== candidate.normalizedCandidateSha256 || layerSha256 !== candidate.fullCanvasLayerSha256) {
        throw new Error(`Candidate bytes do not match immutable evidence for ${candidate.candidateId}.`);
      }
      if (rawSha256 !== candidate.source.sha256) {
        throw new Error(`Raw source bytes do not match immutable evidence for ${candidate.candidateId}.`);
      }
      if (!candidate.qa.geometryLocked || candidate.qa.mismatchedPixels !== 0 || candidate.qa.minIoU !== 1) {
        throw new Error(`Candidate ${candidate.candidateId} has not earned exact geometry lock.`);
      }
      const reviewState = variant.materialClass === "translucent"
        ? "translucent-five-body-review"
        : variant.materialClass === "rhinestone"
          ? "registered-rhinestone-review"
          : "candidate-review";
      candidates.push({
        componentKey: component.componentKey,
        variantKey: variant.variantKey,
        slot: component.slot,
        geometryFamilyId: component.geometryFamilyId,
        displayName: `${variant.materialVariant.replace(/-/g, " ")} ${component.slot}`,
        materialVariant: variant.materialVariant,
        reviewState,
        candidate,
        artifacts: {
          rawPath: candidate.source.path,
          rawSha256,
          candidatePath: artifact.paths.candidatePath,
          candidateSha256,
          layerPath: artifact.paths.layerPath,
          layerSha256,
          reviewPath: artifact.paths.reviewPath,
          reviewSha256,
          manifestPath: artifact.paths.manifestPath,
          authorityMaskPath: path.resolve(workspaceRoot, candidate.authorityMaskPath),
        },
      });
    }
  }
  return {
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    candidateCount: 21,
    assemblyReviewCount: 105,
    candidates,
    mutationPolicy: {
      remoteWritesPerformed: false,
      approvalsWritten: false,
      placementsWritten: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
}

async function main() {
  const bundle = await buildCyl9CandidateImportBundle();
  await writeFile(defaultOutput, `${JSON.stringify(bundle, null, 2)}\n`, { flag: "w" });
  console.log(JSON.stringify({ output: defaultOutput, candidateCount: bundle.candidateCount, reviewCounts: bundle.candidates.reduce<Record<string, number>>((counts, item) => {
    counts[item.reviewState] = (counts[item.reviewState] ?? 0) + 1;
    return counts;
  }, {}), mutationPolicy: bundle.mutationPolicy }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
