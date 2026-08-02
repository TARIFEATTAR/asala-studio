import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCyl9BodyReleasePlan,
  type BodyPlateRegistry,
} from "./cyl9BodyRelease.node";

const ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";

const fixtures = [
  ["clear", "CLR", "97cfe967a4ab02ba4de51c07416c80df54244adf8dfab95406a36f4fe90e933f", 4_587_451, 2086],
  ["amber", "AMB", "c84db213449da4ef6afbcb67fad0da5811ae937c3c9c1234be801cb473ea31c3", 4_551_405, 2089],
  ["cobalt", "BLU", "87804d45a242795aaecf10d677ad469b22803e2f2476421ffbce5d4d944f148c", 4_677_657, 2089],
  ["frosted", "FRS", "c844fb9f3a6ffb467daa02d17cb2378b659fc2e0be166f13073bb7b4f8422956", 4_542_106, 2092],
  ["swirl", "SWL", "c2b67ee9151dc89d44d3a8d65a112b908bb84a2c833ba0bcf643b16586371e68", 2_736_270, 2091],
] as const;

function registry(): BodyPlateRegistry {
  return {
    version: 1,
    updatedAt: "2026-08-01T14:13:22.446Z",
    entries: fixtures.map(([colorway, , sha256, , baselineY]) => ({
      id: `body__cylinder__9ml__${colorway}__70.0x20.0mm`,
      role: "body-plate",
      bodyKey: {
        family: "Cylinder",
        capacityMl: 9,
        colorway,
        heightMm: 70,
        diameterMm: 20,
        neckThreadSize: "17-415",
      },
      asset: {
        path: `assets/paper-doll/body-plates/body__cylinder__9ml__${colorway}__70.0x20.0mm.png`,
        sha256,
        widthPx: 2080,
        heightPx: 2288,
        hasAlpha: false,
      },
      registration: {
        canvas: "2080x2288",
        background: "#F5F3EF",
        neckTopY: 760,
        neckBaseY: 968,
        baselineY,
        centerX: 1041,
        threadCrestPx: 269,
        threadCrestMm: 17,
      },
      provenance: {
        source: "gpt-image-2 shadow pass over Nano-Banana material lock",
        intakeDate: "2026-08-01T00:00:00.000Z",
        intakeBy: "claude-code",
      },
      status: "approved",
      reviewedBy: "jordan",
      reviewedAt: "2026-08-01T00:00:00.000Z",
      notes: "Locked body plate.",
    })),
  };
}

function facts() {
  return Object.fromEntries(fixtures.map(([colorway, , sha256, byteSize]) => [
    `body__cylinder__9ml__${colorway}__70.0x20.0mm`,
    { sha256, widthPx: 2080, heightPx: 2288, byteSize },
  ]));
}

test("builds one blocked CYL-9ML release containing only the five locked body plates", () => {
  const plan = buildCyl9BodyReleasePlan({
    organizationId: ORGANIZATION_ID,
    registry: registry(),
    assetFactsById: facts(),
  });

  assert.equal(plan.release.familyKey, "CYL-9ML");
  assert.equal(plan.release.releaseVersion, "1.0.0-body-plates.1");
  assert.equal(plan.release.releaseStatus, "blocked");
  assert.deepEqual(plan.assets.map((asset) => asset.variantKey), ["CLR", "AMB", "BLU", "FRS", "SWL"]);
  assert.deepEqual(new Set(plan.assets.map((asset) => asset.slot)), new Set(["body"]));
  assert.deepEqual(new Set(plan.assets.map((asset) => asset.storageBucket)), new Set(["paper-doll-approved"]));
  assert.equal(plan.assets.length, 5);
  assert.equal(plan.qaResults.length, 5);
  assert.ok(plan.qaResults.every((result) => result.blocking && result.qaStatus === "passed"));
  assert.ok(plan.assets.every((asset) => asset.objectPath.startsWith(`${ORGANIZATION_ID}/CYL-9ML/`)));
  assert.ok(plan.assets.every((asset) => asset.objectPath.endsWith(`${asset.imageSha256}.png`)));
  assert.match(plan.release.manifestSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(plan.release.manifest.blockers, ["closures_and_fitments_not_registered"]);
  assert.equal(plan.release.manifest.assets.length, 5);
});

test("fails closed when the registry contains anything beyond the exact five locked plates", () => {
  const unsafeRegistry = registry();
  unsafeRegistry.entries.push({
    ...unsafeRegistry.entries[0],
    id: "closure__17-415__unreviewed",
    role: "cap",
  });

  assert.throws(() => buildCyl9BodyReleasePlan({
    organizationId: ORGANIZATION_ID,
    registry: unsafeRegistry,
    assetFactsById: facts(),
  }), /exactly the five locked CYL-9ML body plates/i);
});

test("fails closed when measured file facts disagree with the frozen registry", () => {
  const corruptedFacts = facts();
  corruptedFacts["body__cylinder__9ml__clear__70.0x20.0mm"] = {
    sha256: "0".repeat(64),
    widthPx: 2080,
    heightPx: 2288,
    byteSize: 100,
  };

  assert.throws(() => buildCyl9BodyReleasePlan({
    organizationId: ORGANIZATION_ID,
    registry: registry(),
    assetFactsById: corruptedFacts,
  }), /measured file facts/i);
});
