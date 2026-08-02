import assert from "node:assert/strict";
import test from "node:test";

import type { CylinderCloseoutLedger, CylinderPublicationTarget } from "./bestBottlesCylinderCloseout";
import type { CylinderReferenceManifest } from "./bestBottlesCylinderReferenceReadiness";
import {
  buildCylinderSmokeMatrix,
  CYLINDER_SMOKE_REQUIRED_COVERAGE,
} from "./bestBottlesCylinderSmokeMatrix";

const fixtures = [
  ["GB-SPR-CLR-3ML-BLK", "Web3", "cylinder-3ml-clear-12mm-finemist"],
  ["GB-SPR-CLR-4ML-BLK", "Web4", "cylinder-4ml-clear-12mm-finemist"],
  ["GB-CYL-BLU-5ML-SPR-BLK", "Web5", "cylinder-5ml-cobalt-blue-13-415-finemist"],
  ["GB-CYL-AMB-9ML-MRL-BLK", "Web9A", "cylinder-9ml-amber-17-415-rollon"],
  ["GB-CYL-FRS-9ML-ROL-BLK", "Web9F", "cylinder-9ml-frosted-17-415-rollon"],
  ["GB-CYL-CLR-28ML-CAP", "Web28", "cylinder-28ml-clear-16mm"],
  ["GB-CYL-WHT-50ML-PMP-WHT", "Web50", "cylinder-50ml-white-18-415-lotionpump"],
  ["GB-CYL-CLR-100ML-RDC-WHT", "Web100R", "cylinder-100ml-clear-18-415-reducer"],
  ["GB-CYL-CLR-100ML-ASP-BLK", "Web100A", "cylinder-100ml-clear-18-415-antiquespray"],
  ["GB-CYL-CLR-100ML-AST-BLK", "Web100T", "cylinder-100ml-clear-18-415-antiquespray-tassel"],
  ["GB-CYL-CLR-9ML-SPR-BLK", "WebSwirl", "cylinder-9ml-swirl-17-415-finemist"],
  ["PB-CYL-454ML-WFLP", "WebLarge", "cylinder-454ml-clear"],
] as const;

const targets = fixtures.map<CylinderPublicationTarget>(([graceSku, websiteSku, productGroupSlug]) => ({
  graceSku,
  websiteSku,
  productGroupSlug,
  aliases: [],
  sourceGraceSkus: [graceSku],
  status: "ready",
  issues: [],
}));
const ledger = {
  version: "cylinder-v6.1-closeout-v2",
  generatedAt: "2026-07-12T00:00:00.000Z",
  rows: [],
  publicationTargets: targets,
  aliases: {},
  sha256: "ledger-hash",
} as CylinderCloseoutLedger;
const references = {
  version: "cylinder-v6.1-reference-manifest-v1",
  generatedAt: "2026-07-12T00:00:00.000Z",
  ledgerHash: ledger.sha256,
  decisions: targets.map((target, index) => ({
    graceSku: target.graceSku,
    websiteSku: target.websiteSku,
    sourceGraceSkus: target.sourceGraceSkus,
    status: "eligible" as const,
    sourcePath: `/approved/${target.graceSku}.png`,
    sourcePsdPath: null,
    sha256: index.toString(16).padStart(64, "0"),
    width: 1200,
    height: 1200,
    opaque: true,
    reasons: [],
  })),
  summary: { eligible: targets.length, "recover-from-psd": 0, "manual-source-match": 0, blocked: 0 },
  sha256: "reference-hash",
} as CylinderReferenceManifest;

test("builds an eligible deterministic matrix covering every required archetype", () => {
  const matrix = buildCylinderSmokeMatrix(ledger, references);
  const selected = new Set(matrix.map((entry) => entry.websiteSku));
  const eligible = new Set(references.decisions.filter((entry) => entry.status === "eligible").map((entry) => entry.websiteSku));
  assert.ok([...selected].every((sku) => eligible.has(sku)));

  for (const [dimension, required] of Object.entries(CYLINDER_SMOKE_REQUIRED_COVERAGE)) {
    const actual = new Set(matrix.map((entry) => entry.coverage[dimension as keyof typeof entry.coverage]));
    for (const value of required) assert.ok(actual.has(value), `${dimension}:${value}`);
  }
  assert.deepEqual(
    matrix.map((entry) => entry.graceSku),
    buildCylinderSmokeMatrix(ledger, references).map((entry) => entry.graceSku),
  );
});

test("rejects a matrix built from a different ledger", () => {
  assert.throws(
    () => buildCylinderSmokeMatrix(ledger, { ...references, ledgerHash: "stale" }),
    /ledger hash/,
  );
});
