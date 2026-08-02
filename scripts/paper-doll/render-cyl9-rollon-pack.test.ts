import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_CYL9_ROLLON_SCENE,
  inspectRenderPack,
} from "./render-cyl9-rollon-pack";

test("the Blender pack defines ten finishes over one non-AR geometry recipe", async () => {
  const scene = JSON.parse(readFileSync(DEFAULT_CYL9_ROLLON_SCENE, "utf8"));
  assert.deepEqual(scene.variants.map(({ variantKey }: { variantKey: string }) => variantKey), [
    "SHN-SL", "SHN-GL", "MAT-CU", "SHN-BLK", "MAT-SL",
    "MAT-GL", "WHT", "SL-DOT", "BLK-DOT", "PNK-DOT",
  ]);
  assert.equal(scene.physicalEvidence.arReady, false);
  assert.equal(scene.physicalEvidence.verificationStatus, "catalog-reported-unconfirmed");
  assert.equal(new Set(scene.variants.map(({ geometryKey }: { geometryKey: string }) => geometryKey)).size, 1);
});

test("material module cannot mutate mesh, camera, modifiers, or transforms", () => {
  const source = readFileSync(new URL(
    "../../workers/paper-doll-renderer/blender/materials.py",
    import.meta.url,
  ), "utf8");
  assert.doesNotMatch(source, /\b(modifier|displace|bevel|camera|transform)\b/i);
});

test("real render-pack inspection requires ten shared geometry and mask hashes", async () => {
  const fixtureDir = process.env.CYL9_RENDER_PACK_DIR;
  if (!fixtureDir) return;

  const pack = await inspectRenderPack(fixtureDir);
  assert.equal(pack.assets.length, 10);
  assert.equal(pack.geometryLocked, true);
  assert.equal(new Set(pack.assets.map((asset) => asset.geometryRecipeSha256)).size, 1);
  assert.equal(new Set(pack.assets.map((asset) => asset.maskSha256)).size, 1);
  assert.ok(pack.assets.every((asset) => asset.mountAxisXPx === 1041 && asset.seatYPx === 1002));
  assert.equal(pack.mask.isBinary, true);
  assert.equal(pack.mask.touchesFrame, false);
});

test("measured evidence never promotes renderer output to catalog approval", () => {
  const report = JSON.parse(readFileSync(new URL(
    "../../docs/paper-doll-rig/cyl9-rollon-render-report.json",
    import.meta.url,
  ), "utf8"));
  assert.equal(report.qualification.geometryLocked, true);
  assert.equal(report.qualification.geometryGate, "exact-authoritative-mask-alpha");
  assert.equal(report.qualification.visualStatus, "candidate-not-approved");
  assert.equal(report.qualification.catalogApproval, false);
});
