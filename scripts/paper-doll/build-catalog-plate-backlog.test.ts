import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCatalogPlateBacklog, parseCsv } from "./build-catalog-plate-backlog";

test("CSV parser preserves quoted commas, quotes, and newlines", () => {
  assert.deepEqual(parseCsv('a,b\n"one, two","three""four"\n"five\nsix",seven\n'), [
    { a: "one, two", b: 'three"four' },
    { a: "five\nsix", b: "seven" },
  ]);
});

test("catalog backlog preserves exact source counts and refuses inferred compatibility", async () => {
  const backlog = await buildCatalogPlateBacklog();
  assert.equal(backlog.sources.masterTruth.sha256, "94de9d5e918cea10a56577135e444f628325af17748a0a634689009c481fe348");
  assert.equal(backlog.sources.bodyGeometry.sha256, "0bcf7e650a5b94b2f6a6f789b5561b22ab8e4156530859b7d2f92584f16e565e");
  assert.equal(backlog.summary.bodyFamilyCount, 28);
  assert.equal(backlog.summary.bodyGeometryCount, 118);
  assert.equal(backlog.summary.bodyAppearanceRequirementCount, 161);
  assert.equal(backlog.summary.catalogBottleSourceRowCount, 2260);
  assert.equal(backlog.summary.catalogBottleIdentityCount, 2131);
  assert.equal(backlog.summary.componentSourceRowCount, 172);
  assert.equal(backlog.summary.componentSourceIdentityCount, 148);
  assert.equal(backlog.summary.existingLockedBodyPlateCount, 5);
  assert.equal(backlog.summary.existingLocalComponentVariantCount, 23);
  assert.equal(backlog.summary.assemblyComponentLinksResolved, 0);
  assert.deepEqual(backlog.summary.contractExtensionSlots, ["bulb-sprayer", "dropper", "glass-rod", "reducer", "stopper"]);
  assert.deepEqual(backlog.summary.sourceMissingRequiredSlots, ["glass-rod", "reducer", "stopper"]);
  assert.equal(backlog.recommendedNextPilot.familyKey, "CYL-5ML-13-415");
  assert.ok(backlog.catalogAssemblyBacklog.some((identity) => identity.issues.includes("duplicate-website-sku-source-rows")));
  assert.ok(backlog.catalogAssemblyBacklog.some((identity) => identity.issues.includes("white-body-truth-review-required")));
});
