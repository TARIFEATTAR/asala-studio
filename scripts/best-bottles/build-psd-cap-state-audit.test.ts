import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, it } from "node:test";

import type { CanonicalTruthRow } from "../../src/lib/bestBottlesPsdIdentityJoin";
import type {
  InspectPsdEvidenceInput,
  PsdReadySourceEvidence,
} from "./psd-cap-state-evidence";
import {
  buildPsdCapStateAudit,
  listPsdSourceFiles,
  loadReviewedPsdAliases,
  parseCanonicalTruthCsv,
} from "./build-psd-cap-state-audit";

const canonicalRows: CanonicalTruthRow[] = [
  { website_sku: "WebA", grace_sku: "GB-A", family: "Cylinder" },
  { website_sku: "WebB", grace_sku: "GB-B", family: "Circle" },
  { website_sku: "Ambiguous", grace_sku: "GB-C", family: "Diva" },
  { website_sku: "Ambiguous", grace_sku: "GB-D", family: "Grace" },
];

const sourceFiles = [
  { sourcePath: "/archive/website-one/WebA.psd", sourceRelativePath: "website-one/WebA.psd" },
  { sourcePath: "/archive/grace/GB-B.psd", sourceRelativePath: "grace/GB-B.psd" },
  { sourcePath: "/archive/website-two/WebA.psd", sourceRelativePath: "website-two/WebA.psd" },
  { sourcePath: "/archive/other-identity/WebB.psd", sourceRelativePath: "other-identity/WebB.psd" },
  { sourcePath: "/archive/unmatched/Missing.psd", sourceRelativePath: "unmatched/Missing.psd" },
  { sourcePath: "/archive/ambiguous/Ambiguous.psd", sourceRelativePath: "ambiguous/Ambiguous.psd" },
];

const sharedHash = "a".repeat(64);
const hashesByFilename: Record<string, string> = {
  "WebA.psd": sharedHash,
  "WebB.psd": sharedHash,
  "GB-B.psd": "b".repeat(64),
  "Missing.psd": "c".repeat(64),
  "Ambiguous.psd": "d".repeat(64),
};

async function inspectEvidence(
  input: InspectPsdEvidenceInput,
): Promise<PsdReadySourceEvidence> {
  const sourceSha256 = hashesByFilename[basename(input.sourcePath)];
  return {
    extractorVersion: "best-bottles-psd-evidence-v1",
    status: "ok",
    cacheStatus: "generated",
    sourcePath: input.sourcePath,
    sourceRelativePath: input.sourceRelativePath,
    sourceSha256,
    sourceBytes: 100,
    sourceMtimeBefore: 1_000,
    sourceMtimeAfter: 1_000,
    sourceSizeBefore: 100,
    sourceSizeAfter: 100,
    previewPath: join(input.outputRoot, "previews", `${sourceSha256}.png`),
    evidencePath: join(input.outputRoot, "evidence", `${sourceSha256}.json`),
    composite: {
      width: 1_000,
      height: 1_300,
      opaque: true,
      sceneCount: 1,
      foregroundBounds: { left: 100, top: 100, width: 800, height: 1_100 },
      largeForegroundComponentCount: 1,
      whiteCornerCount: 4,
      minimumSafeMarginPct: 7.6923,
      previewPath: join(input.outputRoot, "previews", `${sourceSha256}.png`),
      evidenceSha256: "e".repeat(64),
      previewWidth: 900,
      previewHeight: 1_170,
      cornerSamples: [],
    },
    proposedClassification: "ambiguous-manual-review",
    routingHints: [],
    error: null,
  };
}

const input = {
  sourceFiles,
  canonicalRows,
  aliases: [],
  inspectEvidence,
  outputRoot: "/audit",
  writeOutputs: false,
} as const;

describe("archive-wide PSD cap-state audit builder", () => {
  it("accounts for every source while deduplicating review work only within identity", async () => {
    const result = await buildPsdCapStateAudit(input);

    assert.equal(result.summary.sourceFileCount, 6);
    assert.equal(result.summary.accountedSourceCount, 6);
    assert.equal(result.summary.unmatchedCount, 1);
    assert.equal(result.summary.ambiguousIdentityCount, 1);
    assert.equal(result.reviewUnits.length, 5);
    assert.equal(
      result.reviewUnits.find((unit) => unit.websiteSku === "WebA")?.sources.length,
      2,
    );
    assert.equal(
      result.reviewUnits.find((unit) => unit.websiteSku === "WebB")?.sourceSha256,
      sharedHash,
    );
    assert.ok(result.records.every((row) => row.reviewStatus === "pending-human-review"));
  });

  it("never changes a machine-triaged row to approved", async () => {
    const result = await buildPsdCapStateAudit(input);

    assert.equal(result.summary.approvedCount, 0);
    assert.ok(result.reviewUnits.every(
      (unit) => unit.representative.reviewStatus === "pending-human-review",
    ));
  });

  it("parses quoted canonical CSV fields without shifting identity columns", () => {
    const csv = [
      "graceSku,websiteSku,family,itemName",
      'GB-A,WebA,Cylinder,"Bottle, clear"',
      'GB-B,WebB,Circle,"A ""quoted"" name"',
    ].join("\r\n");

    assert.deepEqual(parseCanonicalTruthCsv(csv).map((row) => ({
      grace_sku: row.grace_sku,
      website_sku: row.website_sku,
      family: row.family,
      itemName: row.itemName,
    })), [
      { grace_sku: "GB-A", website_sku: "WebA", family: "Cylinder", itemName: "Bottle, clear" },
      { grace_sku: "GB-B", website_sku: "WebB", family: "Circle", itemName: 'A "quoted" name' },
    ]);
  });

  it("writes every required local artifact with CSV-safe decision rows", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "best-bottles-psd-audit-"));
    try {
      const result = await buildPsdCapStateAudit({ ...input, outputRoot, writeOutputs: true });
      const expectedArtifacts = [
        "source-inventory.json",
        "source-inventory.csv",
        "identity-join.json",
        "review-units.json",
        "review-decisions-template.csv",
        "unmatched-sources.csv",
        "ambiguous-identity.csv",
        "blocked-evidence.csv",
        "summary.json",
        "README.md",
      ];
      assert.deepEqual(result.artifactPaths.map((path) => basename(path)).sort(), expectedArtifacts.sort());
      assert.deepEqual(
        JSON.parse(await readFile(join(outputRoot, "summary.json"), "utf8")),
        result.summary,
      );
      assert.equal(
        (await readFile(join(outputRoot, "review-decisions-template.csv"), "utf8")).split("\n")[0],
        "reviewUnitKey,sourceSha256,websiteSku,graceSku,family,representativePreviewPath,proposedClassification,decision,reviewer,reviewedAt,notes",
      );
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });

  it("recursively lists only PSD files in deterministic order and treats missing aliases as empty", async () => {
    const root = await mkdtemp(join(tmpdir(), "best-bottles-psd-sources-"));
    try {
      await mkdir(join(root, "nested"));
      await Promise.all([
        writeFile(join(root, "z.PSD"), "z"),
        writeFile(join(root, "nested", "a.psd"), "a"),
        writeFile(join(root, "ignored.png"), "ignored"),
      ]);

      assert.deepEqual((await listPsdSourceFiles(root)).map((row) => row.sourceRelativePath), [
        "nested/a.psd",
        "z.PSD",
      ]);
      assert.deepEqual(await loadReviewedPsdAliases(join(root, "missing.json")), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
