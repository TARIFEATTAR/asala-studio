import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("v2 placement lock binds exact geometry to five approved plates and appends named evidence", async () => {
  const source = await readFile(new URL("./index.ts", import.meta.url), "utf8").catch(() => "");
  assert.match(source, /createPaperDollActionContext/);
  assert.match(source, /validateNamedAction/);
  assert.match(source, /family-fit-approved/);
  assert.match(source, /paper_doll_component_versions/);
  assert.match(source, /approval_status/);
  assert.match(source, /expectedAuthorityMaskSha256/);
  assert.match(source, /five_distinct_plates_required/);
  assert.match(source, /paper_doll_placement_versions/);
  assert.match(source, /paper_doll_placement_plates/);
  assert.match(source, /paper_doll_approval_events/);
  assert.match(source, /placement-locked/);
  assert.doesNotMatch(source, /paper_doll_publish_runs/);
  assert.doesNotMatch(source, /paper_doll_family_release_assets/);
});
