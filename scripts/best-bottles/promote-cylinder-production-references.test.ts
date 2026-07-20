import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Cylinder production-reference promotion CLI source contract", () => {
  it("requires explicit execution, never overwrites storage, and scopes exact job updates", async () => {
    const source = await readFile(
      new URL("./promote-cylinder-production-references.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /--execute/);
    assert.match(source, /upsert:\s*false/);
    assert.match(source, /\.eq\("id",\s*request\.jobId\)/);
    assert.match(source, /\.eq\("organization_id",\s*ORGANIZATION_ID\)/);
    assert.match(source, /\.eq\("website_sku",\s*request\.websiteSku\)/);
    assert.match(source, /\.eq\("grace_sku",\s*request\.graceSku\)/);
    assert.match(source, /reference_source:\s*request\.referenceSource/);
    assert.match(source, /reference_source_path:\s*null/);
    assert.match(source, /reference_source_url:\s*request\.targetPublicUrl/);
  });
});
