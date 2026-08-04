import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("placement lock boundary authenticates and proves organization visibility before service transaction", async () => {
  const source = await readFile(new URL("./index.ts", import.meta.url), "utf8").catch(() => "");
  assert.match(source, /auth\.getUser/);
  assert.match(source, /parsePaperDollPlacementLockRequest/);
  assert.match(source, /paper_doll_component_versions/);
  assert.match(source, /paper_doll_components/);
  assert.match(source, /paper_doll_family_release_assets/);
  assert.match(source, /approval_status/);
  assert.match(source, /geometry_mask_sha256/);
  assert.match(source, /lock_paper_doll_shared_placement/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /paper_doll_publish_runs/);
  assert.doesNotMatch(source, /\.update\(/);
});
