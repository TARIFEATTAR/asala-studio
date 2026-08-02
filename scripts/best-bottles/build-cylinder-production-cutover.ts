import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BEST_BOTTLES_CYLINDER_PRODUCTION_ROOT } from "../../src/config/bestBottlesCylinderProductionContract";
import {
  buildCylinderProductionReadiness,
  type CylinderProductionReadinessArtifact,
  type CylinderReferenceBlockerArtifact,
  type CylinderReferenceProductionArtifact,
} from "../../src/lib/bestBottlesCylinderProductionCutover";

export type CylinderProductionCutoverInputProvenance = {
  productionManifestPath: string;
  productionManifestSha256: string;
  blockerReportPath: string;
  blockerReportSha256: string;
};

export type CylinderProductionCutoverArtifact = CylinderProductionReadinessArtifact & {
  provenance: CylinderProductionReadinessArtifact["provenance"] & {
    productionManifestSha256: string;
    blockerReportSha256: string;
  };
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseJson<T>(bytes: Uint8Array, label: string): T {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as T;
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${String(error)}`);
  }
}

export async function buildCylinderProductionCutoverArtifact(input: {
  productionManifestPath: string;
  blockerReportPath: string;
  outputPath: string;
}): Promise<{
  artifact: CylinderProductionCutoverArtifact;
  provenance: CylinderProductionCutoverInputProvenance;
  outputPath: string;
}> {
  const productionManifestPath = resolve(input.productionManifestPath);
  const blockerReportPath = resolve(input.blockerReportPath);
  const outputPath = resolve(input.outputPath);
  const [productionBytes, blockerBytes] = await Promise.all([
    readFile(productionManifestPath),
    readFile(blockerReportPath),
  ]);
  const provenance: CylinderProductionCutoverInputProvenance = {
    productionManifestPath,
    productionManifestSha256: sha256(productionBytes),
    blockerReportPath,
    blockerReportSha256: sha256(blockerBytes),
  };
  const planned = buildCylinderProductionReadiness({
    productionArtifact: parseJson<CylinderReferenceProductionArtifact>(
      productionBytes,
      "Cylinder reference production manifest",
    ),
    blockerArtifact: parseJson<CylinderReferenceBlockerArtifact>(
      blockerBytes,
      "Cylinder reference blocker report",
    ),
  });
  const artifact: CylinderProductionCutoverArtifact = {
    ...planned,
    provenance: {
      ...planned.provenance,
      productionManifestSha256: provenance.productionManifestSha256,
      blockerReportSha256: provenance.blockerReportSha256,
    },
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return { artifact, provenance, outputPath };
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const productionRoot = resolve(
  projectRoot,
  BEST_BOTTLES_CYLINDER_PRODUCTION_ROOT,
);
const defaultOutputPath = resolve(
  projectRoot,
  "public/data/best-bottles-cylinder-production-readiness.json",
);

async function main(): Promise<void> {
  const result = await buildCylinderProductionCutoverArtifact({
    productionManifestPath: resolve(
      productionRoot,
      "cylinder-reference-production-manifest.json",
    ),
    blockerReportPath: resolve(
      productionRoot,
      "cylinder-reference-blocker-report.json",
    ),
    outputPath: defaultOutputPath,
  });
  console.log(JSON.stringify({
    outputPath: result.outputPath,
    provenance: result.provenance,
    summary: result.artifact.summary,
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
