import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildCyl9RollonRequirementSnapshot,
  canonicalizeCyl9RollonSnapshot,
  loadCyl9RollonRequirements,
} from "./rollonRequirements";

test("snapshot contains the five locked bodies, ten catalog finishes, and two rollers", () => {
  const snapshot = loadCyl9RollonRequirements();

  assert.deepEqual(snapshot.bodyVariantKeys, ["CLR", "AMB", "BLU", "FRS", "SWL"]);
  assert.deepEqual(snapshot.overcapVariantKeys, [
    "SHN-SL",
    "SHN-GL",
    "MAT-CU",
    "SHN-BLK",
    "MAT-SL",
    "MAT-GL",
    "WHT",
    "SL-DOT",
    "BLK-DOT",
    "PNK-DOT",
  ]);
  assert.deepEqual(snapshot.rollerVariantKeys, ["PLASTIC", "METAL"]);
  assert.equal(snapshot.requirements.length, 17);
});

test("all 100 catalog assemblies resolve through exact SKU rules without item-name fallback", () => {
  const snapshot = loadCyl9RollonRequirements();

  assert.equal(snapshot.assemblyMappings.length, 100);
  assert.equal(new Set(snapshot.assemblyMappings.map(({ websiteSku }) => websiteSku)).size, 100);

  for (const mapping of snapshot.assemblyMappings) {
    assert.ok(mapping.websiteSku);
    assert.ok(mapping.graceSku);
    assert.match(mapping.mappingKey, /^CYL-9ML:/);
    assert.equal(mapping.identitySource, "websiteSku-exact-token-map");
    assert.ok(snapshot.bodyVariantKeys.includes(mapping.bodyVariantKey));
    assert.ok(snapshot.rollerVariantKeys.includes(mapping.rollerVariantKey));
    assert.ok(snapshot.overcapVariantKeys.includes(mapping.overcapVariantKey));
  }
});

test("snapshot records known catalog conflicts and keeps blocked metal roller out of release-ready counts", () => {
  const snapshot = loadCyl9RollonRequirements();
  const metal = snapshot.requirements.find(({ requirementKey }) => (
    requirementKey === "CYL-9ML:ROLLER:METAL"
  ));

  assert.equal(snapshot.evidenceSummary.dimensionConflictCount, 42);
  assert.equal(snapshot.evidenceSummary.unresolvedIdentityCount, 0);
  assert.equal(metal?.releaseStatus, "blocked");
  assert.match(metal?.blockers.join(" ") ?? "", /72\.8% opaque white/i);
});

test("stored snapshot hash matches the canonical payload", () => {
  const snapshot = loadCyl9RollonRequirements();
  const actual = createHash("sha256")
    .update(canonicalizeCyl9RollonSnapshot(snapshot))
    .digest("hex");

  assert.equal(actual, snapshot.snapshotSha256);
});

test("generator rejects duplicate website SKUs inside the CYL-9ML scope", () => {
  const duplicate = {
    websiteSku: "GBCyl9MtlRollShnSl",
    graceSku: "GB-CYL-CLR-9ML-T-08",
    family: "Cylinder",
    capacityMl: 9,
    heightWithoutCap: "70",
    diameter: "20",
    neckThreadSize: "17-415",
    applicator: "Metal Roller Ball",
  };

  assert.throws(() => buildCyl9RollonRequirementSnapshot({
    catalog: { products: [duplicate, duplicate] },
    sourceGeneratedAt: "2026-08-02T00:00:00.000Z",
    sourcePath: "fixture.json",
    sourceSha256: "a".repeat(64),
  }), /Duplicate websiteSku in CYL-9ML catalog scope/);
});
