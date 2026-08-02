import assert from "node:assert/strict";
import test from "node:test";

import { provisionPaperDollBuckets } from "./storageProvisioning.node";

test("provisionPaperDollBuckets creates all missing buckets as private", async () => {
  const creates: Array<{ id: string; options: Record<string, unknown> }> = [];
  const admin = {
    storage: {
      async listBuckets() {
        return { data: [], error: null };
      },
      async createBucket(id: string, options: Record<string, unknown>) {
        creates.push({ id, options });
        return { data: { name: id }, error: null };
      },
    },
  };

  const result = await provisionPaperDollBuckets(admin);

  assert.deepEqual(result, {
    created: ["paper-doll-sources", "paper-doll-candidates", "paper-doll-approved"],
    existing: [],
  });
  assert.equal(creates.length, 3);
  assert.ok(creates.every((entry) => entry.options.public === false));
});

test("provisionPaperDollBuckets refuses an existing public bucket", async () => {
  const admin = {
    storage: {
      async listBuckets() {
        return {
          data: [{ id: "paper-doll-approved", name: "paper-doll-approved", public: true }],
          error: null,
        };
      },
      async createBucket() {
        throw new Error("must not create after a safety failure");
      },
    },
  };

  await assert.rejects(provisionPaperDollBuckets(admin), /paper-doll-approved.*public/i);
});
