import assert from "node:assert/strict";
import test from "node:test";

import { loadPaperDollReleaseWorkbench } from "./releaseRepository";

const ORGANIZATION_ID = "10000000-0000-4000-8000-000000000001";
const SHA256 = "a".repeat(64);
const MASK_SHA256 = "c".repeat(64);

function releasePayload() {
  return {
    release: {
      id: "50000000-0000-4000-8000-000000000001",
      family_key: "CYL-9ML",
      release_version: "1.0.0-draft.1",
      release_status: "blocked",
      canvas_width_px: 2080,
      canvas_height_px: 2288,
      background_hex: "#F5F3EF",
      manifest_sha256: "b".repeat(64),
      created_at: "2026-08-01T00:00:00.000Z",
    },
    releaseCut: null,
    readiness: [],
    publishRuns: [],
    assets: [{
      slot: "body",
      variantKey: "clear",
      component: {
        id: "20000000-0000-4000-8000-000000000001",
        component_key: "body-clear",
        display_name: "Clear body",
        geometry_family_id: "CYL-9ML",
      },
      version: {
        id: "30000000-0000-4000-8000-000000000001",
        version_key: "1",
        material_variant: "clear-glass",
        storage_bucket: "paper-doll-approved",
        image_path: `${ORGANIZATION_ID}/CYL-9ML/body/${SHA256}.png`,
        image_sha256: SHA256,
        geometry_mask_path: `${ORGANIZATION_ID}/CYL-9ML/body-mask/${MASK_SHA256}.png`,
        geometry_mask_sha256: MASK_SHA256,
        content_type: "image/png",
        byte_size: 1234,
        width_px: 2080,
        height_px: 2288,
        alpha_bounds: { left: 860, top: 740, right: 1225, bottom: 2115 },
        mount_axis_x_px: 1040,
        seat_y_px: 750,
        approval_status: "approved",
      },
      qa: [{
        id: "40000000-0000-4000-8000-000000000001",
        gate_key: "geometry-lock",
        qa_status: "passed",
        blocking: true,
        issues: [],
      }],
    }],
  };
}

test("loadPaperDollReleaseWorkbench reads the RLS API and resolves private image URLs", async () => {
  const rpcCalls: unknown[] = [];
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      return { data: releasePayload(), error: null };
    },
    storage: {
      from(bucket: string) {
        return {
          async createSignedUrl(path: string) {
            return { data: { signedUrl: `https://signed.example/${bucket}/${path}` }, error: null };
          },
        };
      },
    },
  };

  const result = await loadPaperDollReleaseWorkbench(client, ORGANIZATION_ID, "CYL-9ML");

  assert.deepEqual(rpcCalls, [{
    name: "get_paper_doll_release_workbench",
    args: { p_organization_id: ORGANIZATION_ID, p_family_key: "CYL-9ML" },
  }]);
  assert.equal(result?.release.status, "blocked");
  assert.deepEqual(result?.readiness, { ready: 0, incomplete: 0, total: 0 });
  assert.equal(result?.assets[0].displayName, "Clear body");
  assert.equal(result?.assets[0].componentId, "20000000-0000-4000-8000-000000000001");
  assert.match(result?.assets[0].imageUrl ?? "", /^https:\/\/signed\.example\/paper-doll-approved\//);
  assert.match(result?.assets[0].geometryMaskUrl ?? "", /body-mask/);
  assert.equal(result?.assets[0].geometryMaskReference?.sha256, MASK_SHA256);
  assert.equal(result?.assets[0].qa[0].status, "passed");
});

test("loadPaperDollReleaseWorkbench returns null when a family has no release", async () => {
  const client = {
    async rpc() {
      return { data: null, error: null };
    },
    storage: {
      from() {
        throw new Error("storage must not be called");
      },
    },
  };

  assert.equal(await loadPaperDollReleaseWorkbench(client, ORGANIZATION_ID, "CYL-9ML"), null);
});

test("loadPaperDollReleaseWorkbench rejects malformed ledger payloads", async () => {
  const client = {
    async rpc() {
      return { data: { release: { id: "missing-fields" }, assets: [] }, error: null };
    },
    storage: {
      from() {
        throw new Error("storage must not be called");
      },
    },
  };

  await assert.rejects(
    loadPaperDollReleaseWorkbench(client, ORGANIZATION_ID, "CYL-9ML"),
    /malformed release/i,
  );
});
