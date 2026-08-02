import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  prepareLineupProductLayer,
  type ProductLayerResult,
} from "../../src/lib/bestBottlesLineupProductLayer";

const execFileAsync = promisify(execFile);

export interface EligibleManifestRow {
  physicalTypeKey: string;
  plateId: string;
  websiteSku: string;
  graceSku: string;
  measurements: {
    heightWithCapMm: number;
    diameterMm: number;
  };
  reference: {
    source: "authoritative-psd" | "catalog-image-url";
    path: string;
    sha256: string | null;
  };
  primarySourceChecksum: string;
}

export interface CylinderManifest {
  version: string;
  eligibleRows: EligibleManifestRow[];
}

export interface LoadedSourceAsset {
  imageBytes: Buffer;
  /** SHA-256 of imageBytes: downloaded catalog bytes or the decoded PSD composite analyzed by Sharp. */
  resolvedAssetChecksum: string;
}

export interface PreparedLayerRow extends ProductLayerResult {
  physicalTypeKey: string;
  plateId: string;
  websiteSku: string;
  graceSku: string;
  /** SHA-256 of the exact decoded/downloaded image bytes analyzed, separate from manifest lineage. */
  resolvedAssetChecksum: string;
}

interface LayerBlocker {
  physicalTypeKey: string;
  plateId: string;
  websiteSku: string;
  graceSku: string;
  reasons: string[];
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeFilename(value: string): string {
  const safe = value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "unnamed-product";
}

async function renderPsdComposite(sourcePath: string): Promise<Buffer> {
  const { stdout } = await execFileAsync("magick", [
    `${sourcePath}[0]`,
    "-background", "white",
    "-alpha", "remove",
    "-alpha", "off",
    "png:-",
  ], { encoding: "buffer", maxBuffer: 1024 * 1024 * 1024 });
  return Buffer.from(stdout);
}

async function loadSourceAsset(row: EligibleManifestRow): Promise<LoadedSourceAsset> {
  const sourcePath = row.reference.path;
  if (/^https?:\/\//i.test(sourcePath)) {
    const response = await fetch(sourcePath, { redirect: "follow" });
    if (!response.ok) throw new Error(`source_http_${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    return { imageBytes: bytes, resolvedAssetChecksum: sha256(bytes) };
  }

  const sourceBytes = await readFile(sourcePath);
  const localSourceChecksum = sha256(sourceBytes);
  const declaredChecksum = row.reference.sha256 ?? row.primarySourceChecksum;
  if (declaredChecksum && localSourceChecksum !== declaredChecksum) {
    throw new Error(`source_checksum_mismatch:${declaredChecksum}:${localSourceChecksum}`);
  }
  const imageBytes = /\.ps[bd]$/i.test(sourcePath) ? await renderPsdComposite(sourcePath) : sourceBytes;
  return {
    imageBytes,
    resolvedAssetChecksum: sha256(imageBytes),
  };
}

export async function prepareEligibleLayers(input: {
  manifest: CylinderManifest;
  outputRoot: string;
  loadSourceAsset?: (row: EligibleManifestRow) => Promise<LoadedSourceAsset>;
}): Promise<{ layers: PreparedLayerRow[]; blockers: LayerBlocker[] }> {
  const layersDirectory = path.join(input.outputRoot, "layers");
  await mkdir(layersDirectory, { recursive: true });
  const layers: PreparedLayerRow[] = [];
  const blockers: LayerBlocker[] = [];

  for (const row of input.manifest.eligibleRows) {
    const identity = {
      physicalTypeKey: row.physicalTypeKey,
      plateId: row.plateId,
      websiteSku: row.websiteSku,
      graceSku: row.graceSku,
    };
    try {
      const source = await (input.loadSourceAsset ?? loadSourceAsset)(row);
      const reviewLayerPath = path.join(layersDirectory, `${safeFilename(row.websiteSku)}.png`);
      const usesRightHandVintageBottleLane = row.plateId === "08";
      const result = await prepareLineupProductLayer({
        sourceBytes: source.imageBytes,
        sourceChecksum: row.primarySourceChecksum,
        reviewLayerPath,
        heightWithCapMm: row.measurements.heightWithCapMm,
        diameterMm: row.measurements.diameterMm,
        expectedPrimaryLane: usesRightHandVintageBottleLane
          ? { leftPct: 0.6, rightPct: 1 }
          : undefined,
        clipPrimarySearchToLane: usesRightHandVintageBottleLane,
      });
      if (result.status === "blocked") {
        blockers.push({ ...identity, reasons: result.blockers });
        continue;
      }
      layers.push({
        ...identity,
        ...result,
        resolvedAssetChecksum: source.resolvedAssetChecksum,
        reviewLayerPath: path.relative(process.cwd(), reviewLayerPath),
      });
    } catch (error) {
      blockers.push({
        ...identity,
        reasons: [`layer_preparation_failed:${error instanceof Error ? error.message : String(error)}`],
      });
    }
  }
  return { layers, blockers };
}

async function runCli(): Promise<void> {
  const root = process.cwd();
  const manifestPath = path.join(root, "public/data/best-bottles-cylinder-75-type-lineup-manifest.json");
  const outputRoot = path.join(root, "tmp/best-bottles-cylinder-75");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as CylinderManifest;
  const { layers, blockers } = await prepareEligibleLayers({ manifest, outputRoot });
  const summary = {
    manifestVersion: manifest.version,
    eligibleCount: manifest.eligibleRows.length,
    processedCount: layers.length + blockers.length,
    preparedCount: layers.length,
    topologyReviewCount: layers.filter((row) => row.topologyStatus === "topology-review").length,
    blockerCount: blockers.length,
    externalWrites: false,
  };
  await mkdir(outputRoot, { recursive: true });
  await writeFile(path.join(outputRoot, "layers.json"), `${JSON.stringify({ summary, layers }, null, 2)}\n`);
  await writeFile(path.join(outputRoot, "layer-blockers.json"), `${JSON.stringify({ summary, blockers }, null, 2)}\n`);
  console.log(JSON.stringify({ outputRoot, ...summary }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
