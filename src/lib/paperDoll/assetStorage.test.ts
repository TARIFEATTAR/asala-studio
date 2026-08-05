import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaperDollObjectPath,
  resolvePaperDollAssetUrls,
  validatePaperDollAssetReference,
} from "./assetStorage";

const ORGANIZATION_ID = "10000000-0000-4000-8000-000000000001";
const SHA256 = "a".repeat(64);

test("buildPaperDollObjectPath produces a content-addressed organization path", () => {
  assert.equal(
    buildPaperDollObjectPath({
      organizationId: ORGANIZATION_ID,
      familyKey: "CYL-9ML",
      assetId: "body clear/v1",
      sha256: SHA256,
      extension: ".PNG",
    }),
    `${ORGANIZATION_ID}/CYL-9ML/body-clear-v1/${SHA256}.png`,
  );
});

test("validatePaperDollAssetReference rejects URLs and cross-organization paths", () => {
  assert.throws(
    () => validatePaperDollAssetReference({
      storageBucket: "paper-doll-approved",
      objectPath: "https://example.com/signed.png",
      sha256: SHA256,
      contentType: "image/png",
      byteSize: 100,
    }, ORGANIZATION_ID),
    /relative object path/i,
  );

  assert.throws(
    () => validatePaperDollAssetReference({
      storageBucket: "paper-doll-approved",
      objectPath: `20000000-0000-4000-8000-000000000002/CYL-9ML/body/${SHA256}.png`,
      sha256: SHA256,
      contentType: "image/png",
      byteSize: 100,
    }, ORGANIZATION_ID),
    /organization/i,
  );
});

test("validatePaperDollAssetReference rejects a filename that does not match its checksum", () => {
  assert.throws(
    () => validatePaperDollAssetReference({
      storageBucket: "paper-doll-approved",
      objectPath: `${ORGANIZATION_ID}/CYL-9ML/body/${"b".repeat(64)}.png`,
      sha256: SHA256,
      contentType: "image/png",
      byteSize: 100,
    }, ORGANIZATION_ID),
    /content-addressed/i,
  );
});

test("resolvePaperDollAssetUrls signs validated private objects without mutating references", async () => {
  const calls: Array<{ bucket: string; path: string; expiresIn: number }> = [];
  const client = {
    storage: {
      from(bucket: string) {
        return {
          async createSignedUrl(path: string, expiresIn: number) {
            calls.push({ bucket, path, expiresIn });
            return {
              data: { signedUrl: `https://signed.example/${bucket}/${path}` },
              error: null,
            };
          },
        };
      },
    },
  };
  const reference = {
    storageBucket: "paper-doll-approved" as const,
    objectPath: `${ORGANIZATION_ID}/CYL-9ML/body/${SHA256}.png`,
    sha256: SHA256,
    contentType: "image/png",
    byteSize: 100,
  };

  const urls = await resolvePaperDollAssetUrls(
    client,
    { "body-clear": reference },
    ORGANIZATION_ID,
  );

  assert.deepEqual(calls, [{
    bucket: "paper-doll-approved",
    path: reference.objectPath,
    expiresIn: 300,
  }]);
  assert.equal(urls["body-clear"], `https://signed.example/paper-doll-approved/${reference.objectPath}`);
  assert.equal(reference.objectPath, `${ORGANIZATION_ID}/CYL-9ML/body/${SHA256}.png`);
});

test("resolvePaperDollAssetUrls fails closed when Storage cannot sign an object", async () => {
  const client = {
    storage: {
      from() {
        return {
          async createSignedUrl() {
            return { data: null, error: { message: "denied" } };
          },
        };
      },
    },
  };

  await assert.rejects(
    resolvePaperDollAssetUrls(client, {
      cap: {
        storageBucket: "paper-doll-candidates",
        objectPath: `${ORGANIZATION_ID}/CYL-9ML/cap/${SHA256}.png`,
        sha256: SHA256,
        contentType: "image/png",
        byteSize: 100,
      },
    }, ORGANIZATION_ID),
    /unable to resolve cap.*denied/i,
  );
});
