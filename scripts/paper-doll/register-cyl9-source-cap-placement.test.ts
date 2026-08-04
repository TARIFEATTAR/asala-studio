import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";

test("builds ten approved cap versions and one shared negative-three placement", async () => {
  let module: typeof import("./register-cyl9-source-cap-placement") | null = null;
  try {
    module = await import("./register-cyl9-source-cap-placement");
  } catch {
    // The first TDD run intentionally proves this production module is missing.
  }
  assert.ok(module, "Expected the CYL-9ML source-cap placement registration module.");

  const manifest = JSON.parse(await readFile(
    "outputs/paper-doll-cyl9-cap-family/source-backed-v1/manifest.json",
    "utf8",
  ));
  const bodyAssetSha256 = await Promise.all([
    "amber", "cobalt", "clear", "frosted", "swirl",
  ].map(async (variant) => createHash("sha256").update(await readFile(
    `assets/paper-doll/body-plates/body__cylinder__9ml__${variant}__70.0x20.0mm.png`,
  )).digest("hex")));
  const plan = module.buildSourceCapRegistrationPlan({
    manifest,
    organizationId: ORGANIZATION_ID,
    bodyAssetSha256,
    approvedByName: "Jordan Richter",
    approvalNote: "Approved ten CYL-9ML roll-on caps across five locked body plates at x 0, y -3, scale 1.",
  });

  assert.equal(plan.items.length, 10);
  assert.deepEqual(plan.items.map(({ variantKey }) => variantKey), [
    "BKDT", "MCPR", "MGLD", "MSLV", "PKDT", "SBLK", "SGLD", "SLDT", "SSLV", "WHT",
  ]);
  assert.equal(new Set(plan.items.map(({ authoritySha256 }) => authoritySha256)).size, 1);
  assert.ok(plan.items.every(({ version }) =>
    version.storageBucket === "paper-doll-approved"
    && version.approvalStatus === "approved"
    && version.widthPx === 2080
    && version.heightPx === 2288
  ));
  assert.ok(plan.items.every(({ qaResults }) => qaResults.length === 2));
  assert.deepEqual(plan.placement, { translateXPx: 0, translateYPx: -3, uniformScale: 1 });
  assert.equal(plan.releaseMutation, false);
  assert.equal(plan.sanityMutation, false);
});
