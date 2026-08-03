import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { parseComponentCandidate } from "../../src/lib/paperDoll/componentPlateContract";
import { composeComponentAssembly } from "../../src/lib/paperDoll/componentPlateImage.node";
import { loadCyl9ComponentFactory } from "../../src/lib/paperDoll/cyl9ComponentFactory";

const DEFAULT_MATERIALIZED = "outputs/paper-doll-component-factory/CYL-9ML/materialized";
const DEFAULT_OUTPUT = "outputs/paper-doll-component-factory/CYL-9ML/family-fit-review";

type CandidateIndexArtifact = {
  componentKey: string;
  variantKey: string;
  candidateId: string;
  materialClass?: string;
  decorationState?: string;
  materialFillQa?: { status: "pass" | "review-required" };
  paths: {
    layerPath: string;
    manifestPath: string;
  };
};

type MaterializationIndex = {
  familyKey: "CYL-9ML";
  artifacts: CandidateIndexArtifact[];
};

type ReviewRow = {
  label: string;
  reviewState: string;
  assemblies: Array<{ bodyVariantKey: string; png: Buffer; path: string }>;
};

export function mergeCyl9CandidateArtifacts(input: {
  deterministic: CandidateIndexArtifact[];
  generated?: CandidateIndexArtifact[];
  componentOrder: string[];
}): CandidateIndexArtifact[] {
  const artifacts = [...input.deterministic, ...(input.generated ?? [])];
  const keys = artifacts.map(({ componentKey }) => componentKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error("CYL-9ML review indexes contain a duplicate component candidate.");
  }
  if (input.generated && (
    artifacts.length !== input.componentOrder.length ||
    input.componentOrder.some((componentKey) => !keys.includes(componentKey))
  )) {
    throw new Error("Complete Family Fit review requires one candidate for every CYL-9ML component.");
  }
  const order = new Map(input.componentOrder.map((componentKey, index) => [componentKey, index]));
  return artifacts.sort((left, right) => (
    (order.get(left.componentKey) ?? Number.MAX_SAFE_INTEGER) -
    (order.get(right.componentKey) ?? Number.MAX_SAFE_INTEGER)
  ));
}

function reviewStateFor(artifact: CandidateIndexArtifact): string {
  if (artifact.materialClass === "translucent") return "TRANSLUCENT · 5-BODY REVIEW";
  if (artifact.materialClass === "rhinestone") {
    return artifact.decorationState === "registered-layout-locked"
      ? "STONES · REGISTERED REVIEW"
      : "STONES · REGISTRATION REVIEW";
  }
  return "CANDIDATE · REVIEW";
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function fileLabel(componentKey: string, variantKey: string): string {
  const slot = componentKey.split("__")[0] || "component";
  return `${slot}-${variantKey}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

async function buildFiveBodyLineup(row: ReviewRow): Promise<Buffer> {
  const tileWidth = 320;
  const imageHeight = 352;
  const labelHeight = 40;
  const gap = 12;
  const padding = 18;
  const width = padding * 2 + row.assemblies.length * tileWidth + (row.assemblies.length - 1) * gap;
  const height = padding * 2 + imageHeight + labelHeight + 46;
  const layers: sharp.OverlayOptions[] = [{
    input: Buffer.from(`<svg width="${width}" height="46" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="27" fill="#d9b36b" font-family="monospace" font-size="18" font-weight="700">${escapeXml(row.label)}</text>
    </svg>`),
    left: padding,
    top: 4,
  }];
  for (let index = 0; index < row.assemblies.length; index++) {
    const assembly = row.assemblies[index];
    const left = padding + index * (tileWidth + gap);
    const top = padding + 46;
    layers.push({
      input: await sharp(assembly.png).resize({ width: tileWidth, height: imageHeight, fit: "fill" }).png().toBuffer(),
      left,
      top,
    });
    layers.push({
      input: Buffer.from(`<svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${tileWidth}" height="${labelHeight}" fill="#11100f"/>
        <text x="12" y="26" fill="#d8d2c7" font-family="monospace" font-size="14">${escapeXml(assembly.bodyVariantKey)}</text>
      </svg>`),
      left,
      top: top + imageHeight,
    });
  }
  return sharp({
    create: { width, height, channels: 4, background: { r: 7, g: 7, b: 6, alpha: 1 } },
  }).composite(layers).png().toBuffer();
}

async function buildContactSheet(rows: ReviewRow[]): Promise<Buffer> {
  const labelWidth = 190;
  const tileWidth = 180;
  const tileHeight = 198;
  const headerHeight = 42;
  const gap = 8;
  const padding = 18;
  const bodyKeys = rows[0]?.assemblies.map(({ bodyVariantKey }) => bodyVariantKey) ?? [];
  const width = padding * 2 + labelWidth + gap + bodyKeys.length * tileWidth + (bodyKeys.length - 1) * gap;
  const height = padding * 2 + headerHeight + rows.length * (tileHeight + gap);
  const layers: sharp.OverlayOptions[] = [];
  for (let column = 0; column < bodyKeys.length; column++) {
    layers.push({
      input: Buffer.from(`<svg width="${tileWidth}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
        <text x="8" y="27" fill="#d9b36b" font-family="monospace" font-size="15">${escapeXml(bodyKeys[column])}</text>
      </svg>`),
      left: padding + labelWidth + gap + column * (tileWidth + gap),
      top: padding,
    });
  }
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const top = padding + headerHeight + rowIndex * (tileHeight + gap);
    layers.push({
      input: Buffer.from(`<svg width="${labelWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${labelWidth}" height="${tileHeight}" fill="#11100f"/>
        <text x="12" y="30" fill="#d9b36b" font-family="monospace" font-size="14" font-weight="700">${escapeXml(row.label)}</text>
        <text x="12" y="54" fill="#72e6d1" font-family="monospace" font-size="11">${escapeXml(row.reviewState)}</text>
      </svg>`),
      left: padding,
      top,
    });
    for (let column = 0; column < row.assemblies.length; column++) {
      layers.push({
        input: await sharp(row.assemblies[column].png)
          .resize({ width: tileWidth, height: tileHeight, fit: "fill" })
          .png()
          .toBuffer(),
        left: padding + labelWidth + gap + column * (tileWidth + gap),
        top,
      });
    }
  }
  return sharp({
    create: { width, height, channels: 4, background: { r: 7, g: 7, b: 6, alpha: 1 } },
  }).composite(layers).png().toBuffer();
}

export async function buildCyl9FamilyFitReview(input: {
  materializedDirectory?: string;
  generatedDirectory?: string;
  outputDirectory?: string;
}) {
  const manifest = loadCyl9ComponentFactory();
  const materializedDirectory = path.resolve(input.materializedDirectory ?? DEFAULT_MATERIALIZED);
  const outputDirectory = path.resolve(input.outputDirectory ?? DEFAULT_OUTPUT);
  const index = JSON.parse(
    await readFile(path.join(materializedDirectory, "materialization-index.json"), "utf8"),
  ) as MaterializationIndex;
  if (index.familyKey !== "CYL-9ML" || index.artifacts.length !== 7) {
    throw new Error("Family Fit review requires the complete seven-candidate deterministic CYL-9ML index.");
  }

  const generatedIndex = input.generatedDirectory
    ? JSON.parse(
      await readFile(path.join(path.resolve(input.generatedDirectory), "generation-index.json"), "utf8"),
    ) as MaterializationIndex
    : undefined;
  if (generatedIndex && (generatedIndex.familyKey !== "CYL-9ML" || generatedIndex.artifacts.length !== 16)) {
    throw new Error("Complete Family Fit review requires the sixteen-candidate generated CYL-9ML index.");
  }
  const artifacts = mergeCyl9CandidateArtifacts({
    deterministic: index.artifacts,
    generated: generatedIndex?.artifacts,
    componentOrder: manifest.components.map(({ componentKey }) => componentKey),
  });

  const bodyPlates = await Promise.all(manifest.bodyPlates.map(async (body) => {
    const png = await readFile(body.imagePath);
    if (sha256(png) !== body.imageSha256) {
      throw new Error(`Locked body hash mismatch for ${body.bodyVariantKey}.`);
    }
    return { ...body, png };
  }));
  await Promise.all([
    mkdir(path.join(outputDirectory, "assemblies"), { recursive: true }),
    mkdir(path.join(outputDirectory, "lineups"), { recursive: true }),
  ]);

  const rows: ReviewRow[] = [];
  const candidateEvidence = [];
  for (const artifact of artifacts) {
    const candidate = parseComponentCandidate(
      JSON.parse(await readFile(artifact.paths.manifestPath, "utf8")),
    );
    if (candidate.candidateId !== artifact.candidateId) {
      throw new Error(`Candidate index identity mismatch for ${artifact.componentKey}.`);
    }
    if (!candidate.qa.geometryLocked || candidate.qa.mismatchedPixels !== 0) {
      throw new Error(`Candidate ${candidate.candidateId} lacks exact-alpha evidence.`);
    }
    const layerPng = await readFile(artifact.paths.layerPath);
    const label = fileLabel(artifact.componentKey, artifact.variantKey);
    const assemblies = [];
    for (const body of bodyPlates) {
      const assemblyPng = await composeComponentAssembly({ bodyPng: body.png, layerPng });
      const assemblyPath = path.join(outputDirectory, "assemblies", `${label}-${body.bodyVariantKey}.png`);
      await writeFile(assemblyPath, assemblyPng);
      assemblies.push({ bodyVariantKey: body.bodyVariantKey, png: assemblyPng, path: assemblyPath });
    }
    const row = { label, reviewState: reviewStateFor(artifact), assemblies };
    rows.push(row);
    const lineupPath = path.join(outputDirectory, "lineups", `${label}.png`);
    await writeFile(lineupPath, await buildFiveBodyLineup(row));
    candidateEvidence.push({
      componentKey: artifact.componentKey,
      variantKey: artifact.variantKey,
      candidateId: candidate.candidateId,
      geometryLocked: candidate.qa.geometryLocked,
      mismatchedPixels: candidate.qa.mismatchedPixels,
      materialClass: artifact.materialClass ?? null,
      materialFillQa: artifact.materialFillQa ?? null,
      decorationState: artifact.decorationState ?? null,
      reviewState: row.reviewState,
      lineupPath,
      assemblies: assemblies.map(({ bodyVariantKey, path: assemblyPath }) => ({
        bodyVariantKey,
        assemblyPath,
      })),
    });
  }

  const contactSheetPath = path.join(outputDirectory, "contact-sheet.png");
  await writeFile(contactSheetPath, await buildContactSheet(rows));
  const manifestPath = path.join(outputDirectory, "family-fit-review.json");
  await writeFile(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    lifecycleState: "family-fit-review-required",
    completeComponentSet: artifacts.length === manifest.components.length,
    bodyPlates: bodyPlates.map(({ bodyVariantKey, componentVersionId, imageSha256 }) => ({
      bodyVariantKey,
      componentVersionId,
      imageSha256,
    })),
    candidates: candidateEvidence,
    contactSheetPath,
    mutationPolicy: {
      approvalsWritten: false,
      placementsWritten: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  }, null, 2)}\n`, "utf8");

  return {
    candidateCount: rows.length,
    assemblyCount: rows.reduce((count, row) => count + row.assemblies.length, 0),
    lineupCount: rows.length,
    contactSheetPath,
    manifestPath,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const result = await buildCyl9FamilyFitReview({
    materializedDirectory: valueAfter(args, "--materialized"),
    generatedDirectory: valueAfter(args, "--generated"),
    outputDirectory: valueAfter(args, "--output"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
