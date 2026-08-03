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

test("placement lock scopes body membership to the explicit Current Release head", async () => {
  const source = await readFile(new URL("./index.ts", import.meta.url), "utf8").catch(() => "");

  assert.match(
    source,
    /from\("paper_doll_family_release_heads"\)[\s\S]*?eq\("family_key", placement\.familyKey\)[\s\S]*?maybeSingle\(\)/,
    "the preflight must resolve the same Current Release definition as the database transaction",
  );
  assert.match(
    source,
    /from\("paper_doll_family_release_assets"\)[\s\S]*?eq\("release_id", currentHead\.release_id\)/,
    "historical releases may reuse the same five plates and must not inflate the membership count",
  );
});
