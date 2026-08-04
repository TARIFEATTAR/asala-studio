import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_BBUAT_CAPPED_ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/BBUAT-Upload-Files/2. PSD Capped ";
export const DEFAULT_BBUAT_UNCAPPED_ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/BBUAT-Upload-Files/1. PSD Uncapped ";
export const DEFAULT_BBUAT_PAIR_OUTPUT =
  "docs/paper-doll-rig/bbuat-paired-psd-source-audit.json";

export type PsdAssemblyState = "capped" | "uncapped";

export interface StatefulPsdSource {
  state: PsdAssemblyState;
  sourcePath: string;
  sourceRelativePath: string;
}

export interface PsdPairIdentity {
  familyToken: string;
  identityToken: string;
}

export type PsdPairStatus =
  | "exact-pair"
  | "capped-only"
  | "uncapped-only"
  | "ambiguous";

export interface PsdPairGroup extends PsdPairIdentity {
  pairKey: string;
  status: PsdPairStatus;
  cappedSources: StatefulPsdSource[];
  uncappedSources: StatefulPsdSource[];
  pairingBasis: "directory-family-and-filename-token";
  approvalState: "pending-human-review";
  productionPolicy: {
    cappedComposite: "assembly-placement-evidence";
    uncappedComposite: "separable-layer-evidence";
    detachedSidecarCap: "exclude";
  };
}

export interface PairedPsdInventory {
  schemaVersion: "bbuat-paired-psd-source-audit-v1";
  summary: {
    sourceCount: number;
    cappedSourceCount: number;
    uncappedSourceCount: number;
    groupCount: number;
    exactPairCount: number;
    cappedOnlyCount: number;
    uncappedOnlyCount: number;
    ambiguousCount: number;
    approvedPairCount: 0;
  };
  groups: PsdPairGroup[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizedToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sourceIdentityToken(sourceRelativePath: string): string {
  return normalizedToken(
    basename(sourceRelativePath)
      .replace(/\.psd$/i, "")
      .replace(/^\s*\d+\s*[.)_-]\s*/, "")
      .replace(/\b(?:un)?capped\b/gi, ""),
  );
}

export function normalizePsdPairIdentity(
  sourceRelativePath: string,
): PsdPairIdentity {
  const firstSegment = sourceRelativePath.split(/[\\/]/)[0] ?? "";
  const familyToken = normalizedToken(firstSegment);
  const identityToken = sourceIdentityToken(sourceRelativePath);
  if (familyToken === "" || identityToken === "") {
    throw new Error(`Cannot derive a stable PSD pair identity from ${sourceRelativePath}.`);
  }
  return { familyToken, identityToken };
}

function pairStatus(
  cappedCount: number,
  uncappedCount: number,
): PsdPairStatus {
  if (cappedCount === 1 && uncappedCount === 1) return "exact-pair";
  if (cappedCount === 1 && uncappedCount === 0) return "capped-only";
  if (cappedCount === 0 && uncappedCount === 1) return "uncapped-only";
  return "ambiguous";
}

export function buildPairedPsdInventory(
  sources: readonly StatefulPsdSource[],
): PairedPsdInventory {
  const grouped = new Map<string, {
    identity: PsdPairIdentity;
    cappedSources: StatefulPsdSource[];
    uncappedSources: StatefulPsdSource[];
  }>();

  for (const source of sources) {
    const identity = normalizePsdPairIdentity(source.sourceRelativePath);
    const pairKey = `${identity.familyToken}|${identity.identityToken}`;
    const current = grouped.get(pairKey) ?? {
      identity,
      cappedSources: [],
      uncappedSources: [],
    };
    current[`${source.state}Sources`].push(source);
    grouped.set(pairKey, current);
  }

  const groups = [...grouped.entries()].map(([pairKey, group]): PsdPairGroup => {
    const cappedSources = [...group.cappedSources].sort((left, right) => (
      compareText(left.sourceRelativePath, right.sourceRelativePath)
    ));
    const uncappedSources = [...group.uncappedSources].sort((left, right) => (
      compareText(left.sourceRelativePath, right.sourceRelativePath)
    ));
    return {
      ...group.identity,
      pairKey,
      status: pairStatus(cappedSources.length, uncappedSources.length),
      cappedSources,
      uncappedSources,
      pairingBasis: "directory-family-and-filename-token",
      approvalState: "pending-human-review",
      productionPolicy: {
        cappedComposite: "assembly-placement-evidence",
        uncappedComposite: "separable-layer-evidence",
        detachedSidecarCap: "exclude",
      },
    };
  }).sort((left, right) => compareText(left.pairKey, right.pairKey));

  const summary = {
    sourceCount: sources.length,
    cappedSourceCount: sources.filter((source) => source.state === "capped").length,
    uncappedSourceCount: sources.filter((source) => source.state === "uncapped").length,
    groupCount: groups.length,
    exactPairCount: groups.filter((group) => group.status === "exact-pair").length,
    cappedOnlyCount: groups.filter((group) => group.status === "capped-only").length,
    uncappedOnlyCount: groups.filter((group) => group.status === "uncapped-only").length,
    ambiguousCount: groups.filter((group) => group.status === "ambiguous").length,
    approvedPairCount: 0 as const,
  };

  return {
    schemaVersion: "bbuat-paired-psd-source-audit-v1",
    summary,
    groups,
  };
}

export async function listStatefulPsdSources(
  sourceRoot: string,
  state: PsdAssemblyState,
): Promise<StatefulPsdSource[]> {
  const absoluteRoot = resolve(sourceRoot);
  const sources: StatefulPsdSource[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const sourcePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(sourcePath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".psd")) {
        sources.push({
          state,
          sourcePath,
          sourceRelativePath: relative(absoluteRoot, sourcePath),
        });
      }
    }
  }

  await visit(absoluteRoot);
  return sources.sort((left, right) => compareText(left.sourceRelativePath, right.sourceRelativePath));
}

async function runCli(): Promise<void> {
  const cappedRoot = process.env.BEST_BOTTLES_BBUAT_CAPPED_ROOT
    ?? DEFAULT_BBUAT_CAPPED_ROOT;
  const uncappedRoot = process.env.BEST_BOTTLES_BBUAT_UNCAPPED_ROOT
    ?? DEFAULT_BBUAT_UNCAPPED_ROOT;
  const outputPath = resolve(
    process.cwd(),
    process.env.BEST_BOTTLES_BBUAT_PAIR_OUTPUT ?? DEFAULT_BBUAT_PAIR_OUTPUT,
  );
  const [capped, uncapped] = await Promise.all([
    listStatefulPsdSources(cappedRoot, "capped"),
    listStatefulPsdSources(uncappedRoot, "uncapped"),
  ]);
  const inventory = buildPairedPsdInventory([...capped, ...uncapped]);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, ...inventory.summary }, null, 2)}\n`);
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;
if (isDirectExecution) {
  runCli().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
