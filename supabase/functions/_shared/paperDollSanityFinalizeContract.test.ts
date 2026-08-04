import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Sanity writes finalize lifecycle evidence and ledger success in one database transaction", async () => {
  const [draftSource, publicSource, sql] = await Promise.all([
    readFile(new URL("../sync-paper-doll-sanity-draft/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../publish-paper-doll-sanity-public/index.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../migrations/20260803190000_paper_doll_atomic_sanity_finalize.sql", import.meta.url),
      "utf8",
    ),
  ]);

  for (const source of [draftSource, publicSource]) {
    assert.match(source, /paper_doll_finalize_sanity_sync_atomic/);
    assert.doesNotMatch(source, /sync_status:\s*"success"/);
    assert.match(source, /lifecycle finalization is pending; retry safely/i);
  }
  assert.match(sql, /INSERT INTO public\.paper_doll_approval_events/);
  assert.match(sql, /UPDATE public\.paper_doll_component_candidates/);
  assert.match(sql, /SET sync_status = 'success'/);
  assert.match(sql, /ON CONFLICT \(candidate_id, action\) DO NOTHING/);
});
