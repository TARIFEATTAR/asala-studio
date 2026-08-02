import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Cylinder sidecar reference promotion CLI", () => {
  it("uses explicit execution, immutable uploads, a backup, and exact dual-identity updates", async () => {
    const source = await readFile(
      new URL("./promote-cylinder-sidecar-references.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /--execute/);
    assert.match(source, /sidecar-v2/);
    assert.match(source, /upsert:\s*false/);
    assert.match(source, /job-backup/);
    assert.match(source, /\.eq\("id",\s*request\.jobId\)/);
    assert.match(source, /\.eq\("organization_id",\s*ORGANIZATION_ID\)/);
    assert.match(source, /\.eq\("website_sku",\s*request\.websiteSku\)/);
    assert.match(source, /\.eq\("grace_sku",\s*request\.graceSku\)/);
    assert.match(source, /executeCylinderReferencePromotion\(/);
  });
});
