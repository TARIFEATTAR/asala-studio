import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadCyl9ComponentFactory } from "../../src/lib/paperDoll/cyl9ComponentFactory";
import {
  buildCappedDispenserRegistrationPlan,
  buildReleaseAssemblyMappings,
  buildReleaseReadiness,
} from "./register-cyl9-capped-dispenser-release";

const ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";

test("approved capped dispenser plan contains nine immutable versions and two geometry authorities", async () => {
  const [sourceManifest, placementLock] = await Promise.all([
    readFile("outputs/paper-doll-dispenser-17-415/capped-source-swatches-v3/manifest.json", "utf8").then(JSON.parse),
    readFile("docs/paper-doll-rig/cyl9-capped-dispenser-v3-placement-lock.json", "utf8").then(JSON.parse),
  ]);
  const plan = buildCappedDispenserRegistrationPlan({
    sourceManifest,
    placementLock,
    organizationId: ORGANIZATION_ID,
  });

  assert.equal(plan.length, 9);
  assert.equal(plan.filter(({ lane }) => lane === "sprayer").length, 6);
  assert.equal(plan.filter(({ lane }) => lane === "pump").length, 3);
  assert.equal(new Set(plan.map(({ authoritySha256 }) => authoritySha256)).size, 2);
  assert.ok(plan.every(({ qaResults }) => qaResults.length === 3));
  assert.ok(plan.every(({ version }) => version.approvalStatus === "approved"));
  assert.ok(plan.every(({ version }) => version.storageBucket === "paper-doll-approved"));
});

test("reconciled release carries all 145 catalog mappings and exposes partial readiness honestly", () => {
  const mappings = buildReleaseAssemblyMappings(loadCyl9ComponentFactory());
  const available = new Set([
    "body:AMB", "body:BLU", "body:CLR", "body:FRS", "body:SWL",
    "roller:PLASTIC", "roller:METAL",
    "sprayer:GLD", "sprayer:MSLV", "sprayer:BLK", "sprayer:SSLV", "sprayer:RED", "sprayer:TUR",
    "pump:MSLV", "pump:GLD", "pump:BLK",
  ]);
  const readiness = buildReleaseReadiness(mappings, available);

  assert.equal(mappings.length, 145);
  assert.equal(new Set(mappings.map(({ mappingKey }) => mappingKey)).size, 145);
  assert.equal(readiness.filter(({ status }) => status === "ready").length, 45);
  assert.equal(readiness.filter(({ status }) => status === "incomplete").length, 100);
  assert.deepEqual(
    [...new Set(readiness.flatMap(({ missingReasons }) => missingReasons))].sort(),
    ["cap:BKDT", "cap:MCPR", "cap:MGLD", "cap:MSLV", "cap:PKDT", "cap:SBLK", "cap:SGLD", "cap:SLDT", "cap:SSLV", "cap:WHT"].sort(),
  );
});
