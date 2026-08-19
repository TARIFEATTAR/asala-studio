import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CYL9_PRODUCTION_ROUTE_REGISTRATION } from "../../src/config/paperDoll/cyl9ProductionRouteRegistration";
import { adaptContainmentReceiptToProductionRoute } from "../../src/lib/paperDoll/productionRoute";

interface Arguments {
  sourceRepo: string;
  record: string;
  output: string;
  check: boolean;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const defaultSourceRepo = path.resolve(
  projectRoot,
  "../../Clients/Nemat-International/Best-Bottles-Website-02-20-2026",
);
const defaultOutput = path.resolve(
  projectRoot,
  "src/generated/paperDoll/cyl9ProductionRoute.generated.json",
);

function parseArguments(argv: string[]): Arguments {
  const result: Arguments = {
    sourceRepo: defaultSourceRepo,
    record: "",
    output: defaultOutput,
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") {
      result.check = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new Error(`${argument} requires a value.`);
    if (argument === "--source-repo") result.sourceRepo = path.resolve(value);
    else if (argument === "--record") result.record = path.resolve(value);
    else if (argument === "--out") result.output = path.resolve(value);
    else throw new Error(`Unknown argument '${argument}'.`);
    index += 1;
  }
  if (!result.record) {
    result.record = path.join(result.sourceRepo, CYL9_PRODUCTION_ROUTE_REGISTRATION.sourceRecordPath);
  }
  return result;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function requireHash(filePath: string, expected: string, label: string): Promise<string> {
  const bytes = await readFile(filePath);
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(`${label} checksum drift: expected ${expected}, received ${actual}.`);
  }
  return actual;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const sourceBytes = await readFile(args.record);
  const sourceRecordSha256 = sha256(sourceBytes);
  if (sourceRecordSha256 !== CYL9_PRODUCTION_ROUTE_REGISTRATION.expectedSourceRecordSha256) {
    throw new Error(
      `Source record checksum drift: expected ${CYL9_PRODUCTION_ROUTE_REGISTRATION.expectedSourceRecordSha256}, received ${sourceRecordSha256}.`,
    );
  }

  for (const evidence of CYL9_PRODUCTION_ROUTE_REGISTRATION.evidence) {
    await requireHash(
      path.join(args.sourceRepo, evidence.sourcePath),
      evidence.sourceSha256,
      `Source evidence '${evidence.id}'`,
    );
    const previewPath = path.join(projectRoot, "public", evidence.previewUrl.replace(/^\//, ""));
    await requireHash(previewPath, evidence.previewSha256, `Review proxy '${evidence.id}'`);
  }

  const receipt: unknown = JSON.parse(sourceBytes.toString("utf8"));
  const route = adaptContainmentReceiptToProductionRoute(
    receipt,
    CYL9_PRODUCTION_ROUTE_REGISTRATION,
    sourceRecordSha256,
  );
  const output = `${JSON.stringify(route, null, 2)}\n`;

  if (args.check) {
    const existing = await readFile(args.output, "utf8");
    if (existing !== output) {
      throw new Error(`Generated production route is stale: ${args.output}`);
    }
    console.log(`Production route verified: ${route.routeId}`);
  } else {
    await mkdir(path.dirname(args.output), { recursive: true });
    await writeFile(args.output, output, "utf8");
    console.log(`Production route registered: ${route.routeId}`);
  }

  console.log(`Source receipt SHA-256: ${sourceRecordSha256}`);
  console.log(`Stages represented: ${route.stages.length}/${route.stages.length}`);
  console.log(`Provenance complete: ${route.provenanceComplete}`);
  console.log(`Release ready: ${route.releaseReady}`);
  console.log(`Overall status: ${route.overallStatus}`);
}

await main();
