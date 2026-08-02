import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { buildCylinderProductionCutoverArtifact } from "./build-cylinder-production-cutover";

const hash = (character: string) => character.repeat(64);
const canonical = {
  websiteSku: "WebReady",
  graceSku: "Grace-Ready",
  family: "Cylinder",
  productGroupSlug: "cylinder-9ml-clear-17-415",
  capacityMl: "9",
  canon_bodyHeightMm: "70",
  canon_widthAxisMm: "20",
  canon_secondAxisMm: "20",
  canon_heightWithCapMm: "96",
};

describe("build Cylinder production cutover artifact", () => {
  it("writes a source-path-free local artifact with hashed provenance and zero external writes", async () => {
    const root = await mkdtemp(join(tmpdir(), "bb-cylinder-cutover-"));
    try {
      const productionPath = join(root, "production.json");
      const blockerPath = join(root, "blockers.json");
      const outputPath = join(root, "readiness.json");
      const provenance = {
        inputs: {
          coverageManifest: { path: "/private/coverage.json", sha256: hash("a") },
          reviewedManifest: { path: "/private/reviewed.json", sha256: hash("b") },
        },
      };
      const summary = {
        canonicalIdentityCount: 1,
        exportQualifiedCount: 1,
        blockedIdentityCount: 0,
        externalWriteCount: 0,
      };
      await writeFile(productionPath, JSON.stringify({
        version: "reference-v2",
        provenance,
        summary,
        planVersion: "plan-v1",
        exports: [{
          canonicalIdentityKey: "WEBREADY|GRACEREADY",
          canonical,
          source: {
            sourcePath: "/private/source.psd",
            sourceRelativePath: "source.psd",
            sourceSha256: hash("c"),
            reviewer: "Reviewer",
            reviewedAt: "2026-07-13T00:00:00.000Z",
            capState: "assembled-cap-on",
          },
          output: {
            path: "/private/output.png",
            filename: "WEBREADY__GRACEREADY__cccccccccccc.png",
            sha256: hash("d"),
            bytes: 1,
            format: "PNG",
            width: 1000,
            height: 1300,
            opaque: true,
            colorspace: "sRGB",
            primaryBounds: { left: 0, top: 0, width: 500, height: 900 },
          },
        }],
      }));
      await writeFile(blockerPath, JSON.stringify({
        version: "reference-v2",
        provenance,
        summary,
        planVersion: "plan-v1",
        blockedIdentities: [],
      }));

      const result = await buildCylinderProductionCutoverArtifact({
        productionManifestPath: productionPath,
        blockerReportPath: blockerPath,
        outputPath,
      });

      assert.equal(result.artifact.summary.productionQualifiedCount, 1);
      assert.equal(result.artifact.summary.externalWriteCount, 0);
      assert.match(result.provenance.productionManifestSha256, /^[a-f0-9]{64}$/);
      assert.match(result.provenance.blockerReportSha256, /^[a-f0-9]{64}$/);
      const output = await readFile(outputPath, "utf8");
      assert.equal(output.endsWith("\n"), true);
      assert.equal(output.includes("/private/"), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
