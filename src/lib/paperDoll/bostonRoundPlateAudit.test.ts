import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildBostonRoundPlateAuditFromCsv,
  writeBostonRoundPlateAuditArtifacts,
} from "./bostonRoundPlateAudit";

const canonicalCsv = readFileSync(
  "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
  "utf8",
);

test("collapses the 123 Boston Round catalog rows into nine body appearance lanes", () => {
  const audit = buildBostonRoundPlateAuditFromCsv(canonicalCsv);

  assert.equal(audit.catalogRowCount, 123);
  assert.deepEqual(audit.catalogRowsByCapacityMl, { "15": 16, "30": 53, "60": 54 });
  assert.deepEqual(audit.catalogRowsByNeckFinish, { "18-400": 16, "20-400": 107 });
  assert.equal(audit.bodyAppearances.length, 9);
  assert.deepEqual(
    audit.bodyAppearances.map(({ capacityMl, color, bodyHeightMm, diameterMm }) => ({
      capacityMl,
      color,
      bodyHeightMm,
      diameterMm,
    })),
    [
      { capacityMl: 15, color: "amber", bodyHeightMm: 68, diameterMm: 25 },
      { capacityMl: 15, color: "clear", bodyHeightMm: 68, diameterMm: 25 },
      { capacityMl: 15, color: "cobalt-blue", bodyHeightMm: 68, diameterMm: 25 },
      { capacityMl: 30, color: "amber", bodyHeightMm: 78, diameterMm: 33 },
      { capacityMl: 30, color: "clear", bodyHeightMm: 78, diameterMm: 33 },
      { capacityMl: 30, color: "cobalt-blue", bodyHeightMm: 78, diameterMm: 33 },
      { capacityMl: 60, color: "amber", bodyHeightMm: 94, diameterMm: 39 },
      { capacityMl: 60, color: "clear", bodyHeightMm: 94, diameterMm: 39 },
      { capacityMl: 60, color: "cobalt-blue", bodyHeightMm: 94, diameterMm: 39 },
    ],
  );
});

test("quarantines the conflicting 30 ml clear height instead of inventing another body authority", () => {
  const audit = buildBostonRoundPlateAuditFromCsv(canonicalCsv);

  assert.deepEqual(audit.truthConflicts, [
    {
      websiteSku: "GBBstn1ozBlkCapSht",
      graceSku: "GB-BSR-CLR-30ML-BLK-S",
      capacityMl: 30,
      color: "clear",
      field: "canon_bodyHeightMm",
      observed: 68,
      familyMode: 78,
      disposition: "manual-review-required",
    },
  ]);
});

test("normalizes physical component responsibilities without inferring rollers for 15 ml", () => {
  const audit = buildBostonRoundPlateAuditFromCsv(canonicalCsv);

  assert.deepEqual(audit.compatibilityByCapacityMl, {
    "15": {
      neckFinish: "18-400",
      responsibilities: ["dropper", "short-cap"],
    },
    "30": {
      neckFinish: "20-400",
      responsibilities: ["dropper", "metal-roller", "plastic-roller", "short-cap"],
    },
    "60": {
      neckFinish: "20-400",
      responsibilities: ["dropper", "metal-roller", "plastic-roller", "short-cap"],
    },
  });
  assert.deepEqual(audit.dropperAppearanceKeys, [
    "black:none",
    "black:shiny-gold",
    "black:shiny-silver",
    "white:none",
    "white:shiny-gold",
    "white:shiny-silver",
  ]);
  assert.deepEqual(audit.rollerFitmentKeys, ["metal", "plastic"]);
  assert.deepEqual(audit.rollerOvercapFinishKeys, [
    "matte-black",
    "matte-gold",
    "matte-silver",
    "shiny-black",
    "shiny-gold",
    "shiny-silver",
  ]);
});

test("writes a machine-readable audit and a human review brief without production claims", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "boston-round-plate-audit-"));
  const result = await writeBostonRoundPlateAuditArtifacts({
    csv: canonicalCsv,
    outputRoot,
    generatedAt: "2026-08-04T12:00:00.000Z",
  });

  assert.equal(existsSync(result.jsonPath), true);
  assert.equal(existsSync(result.markdownPath), true);
  const json = JSON.parse(await readFile(result.jsonPath, "utf8"));
  const markdown = await readFile(result.markdownPath, "utf8");

  assert.equal(json.generatedAt, "2026-08-04T12:00:00.000Z");
  assert.equal(json.productionEligible, false);
  assert.equal(json.geometryLocked, false);
  assert.equal(json.audit.catalogRowCount, 123);
  assert.match(markdown, /123 catalog rows/);
  assert.match(markdown, /nine body appearance lanes/);
  assert.match(markdown, /GBBstn1ozBlkCapSht/);
});
