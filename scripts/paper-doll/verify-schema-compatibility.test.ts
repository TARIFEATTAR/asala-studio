import assert from "node:assert/strict";
import test from "node:test";

import { findDuplicateCreatedRelations } from "./verify-schema-compatibility.ts";

test("paper-doll migrations never create the same public relation twice", async () => {
  const duplicates = await findDuplicateCreatedRelations("supabase/migrations", "paper_doll_");
  assert.deepEqual(duplicates, []);
});
