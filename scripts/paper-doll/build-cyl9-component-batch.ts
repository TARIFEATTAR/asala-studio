import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildComponentMaterialPrompt } from "../../src/lib/paperDoll/componentMaterialPrompt";
import {
  type PixelBounds,
} from "../../src/lib/paperDoll/componentPlateContract";
import { loadCyl9ComponentFactory } from "../../src/lib/paperDoll/cyl9ComponentFactory";
import {
  buildRhinestoneLayout,
  type RhinestoneLayoutPoint,
  type RhinestoneRecipePoint,
} from "../../src/lib/paperDoll/rhinestoneLayout";

const ROOT = process.cwd();
const RECIPE_PATH = "docs/paper-doll-rig/cyl9-component-material-recipes.json";
const DEFAULT_OUTPUT = "outputs/paper-doll-component-factory/CYL-9ML/requests";

interface MaterialPolicy {
  provider: "openai" | "deterministic";
  model: string;
  estimatedCostUsd: number | null;
  decorationPolicy?: string;
  reviewChecklist: string[];
}

interface MaterialRecipe {
  componentKey: string;
  policy: string;
  physicalSubstrate: string;
  coating: string;
  referencePath: string;
  sourceBoundsPx: PixelBounds;
}

interface RecipeFile {
  schemaVersion: 1;
  familyKey: "CYL-9ML";
  confirmationToken: "CYL9-MATERIAL-BATCH";
  materialPolicies: Record<string, MaterialPolicy>;
  rhinestoneLayout: RhinestoneRecipePoint[];
  components: MaterialRecipe[];
}

export interface Cyl9ComponentBatchJob {
  requestId: string;
  componentKey: string;
  variantKey: string;
  slot: string;
  materialClass: string;
  geometryFamilyId: string;
  authorityMaskPath: string;
  authorityMaskSha256: string;
  sourceReferencePath: string;
  sourceBoundsPx: PixelBounds;
  editBoundsPx: PixelBounds;
  authorityBoundsPx: PixelBounds;
  placementBoundsPx: PixelBounds;
  provider: MaterialPolicy["provider"];
  model: string;
  estimatedCostUsd: number | null;
  costStatus: "known" | "price-card-required";
  prompt: string;
  promptSha256: string;
  rhinestoneLayout: RhinestoneLayoutPoint[] | null;
  reviewChecklist: string[];
}

export interface Cyl9BatchResult {
  mode: "plan" | "execute";
  target: "none" | "local" | "remote";
  jobs: Cyl9ComponentBatchJob[];
  knownEstimatedCostUsd: number;
  unpricedProviderJobs: number;
  reviewAssemblies: number;
  catalogMappings: number;
  requestPaths: string[];
  createdRequests: number;
  resumedRequests: number;
  mutationPolicy: { currentReleaseChanged: false; sanityChanged: false };
}

export interface BuildCyl9BatchOptions {
  mode: "plan" | "execute";
  target?: "local" | "remote";
  confirmation?: string;
  allowRemoteWrites?: boolean;
  outputDirectory?: string;
}

function absolute(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function ensureRecipeFile(value: RecipeFile): RecipeFile {
  if (value.schemaVersion !== 1 || value.familyKey !== "CYL-9ML") {
    throw new Error("CYL-9ML material recipe contract is invalid.");
  }
  if (value.components.length !== 23 || new Set(value.components.map((row) => row.componentKey)).size !== 23) {
    throw new Error("CYL-9ML material recipes must contain exactly 23 unique component keys.");
  }
  for (const recipe of value.components) {
    if (!value.materialPolicies[recipe.policy]) throw new Error(`Unknown material policy: ${recipe.policy}.`);
  }
  return value;
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(absolute(relativePath), "utf8"));
}

export async function buildCyl9ComponentBatch(
  options: BuildCyl9BatchOptions,
): Promise<Cyl9BatchResult> {
  const manifest = loadCyl9ComponentFactory();
  const recipes = ensureRecipeFile(await readJson<RecipeFile>(RECIPE_PATH));
  const recipeByComponent = new Map(recipes.components.map((recipe) => [recipe.componentKey, recipe]));
  const rhinestones = buildRhinestoneLayout(recipes.rhinestoneLayout);

  const jobs: Cyl9ComponentBatchJob[] = manifest.components.map((component) => {
    const recipe = recipeByComponent.get(component.componentKey);
    if (!recipe) throw new Error(`Missing material recipe for ${component.componentKey}.`);
    if (component.authorityStatus !== "approved" || !component.authority) {
      throw new Error(`Approved geometry authority is required for ${component.componentKey}.`);
    }
    const placement = manifest.placements.find(
      (row) => row.geometryFamilyId === component.geometryFamilyId,
    );
    if (!placement) throw new Error(`Placement calibration is missing for ${component.geometryFamilyId}.`);
    const variant = component.variants[0];
    const policy = recipes.materialPolicies[recipe.policy];
    const rhinestoneLayout = variant.materialClass === "rhinestone" ? rhinestones : null;
    const prompt = buildComponentMaterialPrompt({
      componentLabel: `${manifest.familyKey} ${component.slot} ${variant.variantKey}`,
      materialClass: variant.materialClass,
      physicalSubstrate: recipe.physicalSubstrate,
      finishDescription: recipe.coating,
      rhinestoneIds: rhinestoneLayout?.map(({ id }) => id),
    });
    const identity = JSON.stringify({
      familyKey: manifest.familyKey,
      componentKey: component.componentKey,
      variantKey: variant.variantKey,
      authorityMaskSha256: component.authority.maskSha256,
      provider: policy.provider,
      model: policy.model,
      promptSha256: hash(prompt),
      sourceBoundsPx: recipe.sourceBoundsPx,
    });
    return {
      requestId: `pdc_${hash(identity)}`,
      componentKey: component.componentKey,
      variantKey: variant.variantKey,
      slot: component.slot,
      materialClass: variant.materialClass,
      geometryFamilyId: component.geometryFamilyId,
      authorityMaskPath: component.authority.maskPath,
      authorityMaskSha256: component.authority.maskSha256,
      sourceReferencePath: recipe.referencePath,
      sourceBoundsPx: recipe.sourceBoundsPx,
      editBoundsPx: recipe.sourceBoundsPx,
      authorityBoundsPx: component.authority.authorityBoundsPx,
      placementBoundsPx: placement.placementBoundsPx,
      provider: policy.provider,
      model: policy.model,
      estimatedCostUsd: policy.estimatedCostUsd,
      costStatus: policy.estimatedCostUsd === null ? "price-card-required" : "known",
      prompt,
      promptSha256: hash(prompt),
      rhinestoneLayout,
      reviewChecklist: [...policy.reviewChecklist],
    };
  });

  const base: Cyl9BatchResult = {
    mode: options.mode,
    target: options.mode === "plan" ? "none" : (options.target ?? "local"),
    jobs,
    knownEstimatedCostUsd: Number(
      jobs.reduce((sum, job) => sum + (job.estimatedCostUsd ?? 0), 0).toFixed(2),
    ),
    unpricedProviderJobs: jobs.filter((job) => job.costStatus === "price-card-required").length,
    reviewAssemblies: jobs.length * manifest.bodyPlates.length,
    catalogMappings: manifest.catalogMappings.length,
    requestPaths: [],
    createdRequests: 0,
    resumedRequests: 0,
    mutationPolicy: { currentReleaseChanged: false, sanityChanged: false },
  };
  if (options.mode === "plan") return base;
  if (options.confirmation !== recipes.confirmationToken) {
    throw new Error(`Execute requires confirmation token ${recipes.confirmationToken}.`);
  }
  const target = options.target ?? "local";
  if (target === "remote" && !options.allowRemoteWrites) {
    throw new Error("Remote execution requires the separate --allow-remote-write flag.");
  }
  if (target === "remote") {
    throw new Error("Remote request creation is server-owned and is not available from this local batch command.");
  }

  const outputDirectory = absolute(options.outputDirectory ?? DEFAULT_OUTPUT);
  await mkdir(outputDirectory, { recursive: true });
  for (const job of jobs) {
    const requestPath = path.join(outputDirectory, `${job.requestId}.json`);
    base.requestPaths.push(requestPath);
    try {
      await readFile(requestPath);
      base.resumedRequests++;
      continue;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await writeFile(requestPath, `${JSON.stringify({
      ...job,
      lifecycleState: "queued",
      target: "local",
      mutationPolicy: {
        approvalWritten: false,
        placementWritten: false,
        currentReleaseChanged: false,
        sanityChanged: false,
      },
    }, null, 2)}\n`, { flag: "wx" });
    base.createdRequests++;
  }
  return base;
}

function flags(argv: string[]): Set<string> {
  return new Set(argv);
}

async function main(): Promise<void> {
  const args = flags(process.argv.slice(2));
  const mode = args.has("--execute") ? "execute" : "plan";
  const confirmationIndex = process.argv.indexOf("--confirmation");
  const outputIndex = process.argv.indexOf("--output");
  const result = await buildCyl9ComponentBatch({
    mode,
    target: args.has("--target-remote") ? "remote" : "local",
    confirmation: confirmationIndex >= 0 ? process.argv[confirmationIndex + 1] : undefined,
    allowRemoteWrites: args.has("--allow-remote-write"),
    outputDirectory: outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
