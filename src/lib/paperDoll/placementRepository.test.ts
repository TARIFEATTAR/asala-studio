import assert from "node:assert/strict";
import test from "node:test";

import type { SharedPlacementLockRequest } from "./placementContract";

const ORG = "11111111-1111-4111-8111-111111111111";
const MASK = "a".repeat(64);
const BODY_IDS = [
  "33333333-3333-4333-8333-333333333331",
  "33333333-3333-4333-8333-333333333332",
  "33333333-3333-4333-8333-333333333333",
  "33333333-3333-4333-8333-333333333334",
  "33333333-3333-4333-8333-333333333335",
];

const record = {
  id: "44444444-4444-4444-8444-444444444444",
  familyKey: "CYL-9ML",
  fitmentGeometryKey: "fitment__roller-ball__17-415__v1",
  authorityMaskSha256: MASK,
  canvas: { widthPx: 2080, heightPx: 2288 },
  transform: { translateXPx: 27.066, translateYPx: -134.132, uniformScale: 0.974 },
  compatibleBodyComponentVersionIds: BODY_IDS,
  approverDisplayName: "Jordan Richter",
  approvalNote: "Flush",
  approvedAt: "2026-08-02T22:00:00.000Z",
};

test("placement repository reads one exact geometry fingerprint", async () => {
  const repository = await import("./placementRepository").catch(() => ({}));
  const load = (repository as { loadSharedPlacement?: Function }).loadSharedPlacement;
  assert.ok(load, "loadSharedPlacement must exist");
  let called: { name: string; args: Record<string, unknown> } | null = null;
  const result = await load({ rpc: async (name: string, args: Record<string, unknown>) => {
    called = { name, args };
    return { data: record, error: null };
  } }, {
    organizationId: ORG,
    familyKey: "CYL-9ML",
    fitmentGeometryKey: "fitment__roller-ball__17-415__v1",
    authorityMaskSha256: MASK,
  });
  assert.deepEqual(called, {
    name: "get_paper_doll_family_placement",
    args: {
      p_organization_id: ORG,
      p_family_key: "CYL-9ML",
      p_fitment_geometry_key: "fitment__roller-ball__17-415__v1",
      p_authority_mask_sha256: MASK,
    },
  });
  assert.deepEqual(result, record);
});

test("placement repository sends one exact named lock request", async () => {
  const repository = await import("./placementRepository").catch(() => ({}));
  const lock = (repository as { lockSharedPlacement?: Function }).lockSharedPlacement;
  assert.ok(lock, "lockSharedPlacement must exist");
  const request: SharedPlacementLockRequest = {
    organizationId: ORG,
    familyKey: "CYL-9ML",
    fitmentGeometryKey: "fitment__roller-ball__17-415__v1",
    calibrationComponentVersionId: "22222222-2222-4222-8222-222222222222",
    expectedAuthorityMaskSha256: MASK,
    canvas: { widthPx: 2080, heightPx: 2288 },
    transform: record.transform,
    compatibleBodyComponentVersionIds: BODY_IDS,
    approverDisplayName: "Jordan Richter",
    approvalNote: "Flush",
  };
  let call: { name: string; body: unknown } | null = null;
  const result = await lock({ functions: { invoke: async (name: string, options: { body: unknown }) => {
    call = { name, body: options.body };
    return { data: record, error: null };
  } } }, request);
  assert.deepEqual(call, { name: "lock-paper-doll-placement", body: request });
  assert.deepEqual(result, record);
});

test("placement repository rejects malformed ledger output", async () => {
  const repository = await import("./placementRepository").catch(() => ({}));
  const load = (repository as { loadSharedPlacement?: Function }).loadSharedPlacement;
  assert.ok(load, "loadSharedPlacement must exist");
  await assert.rejects(() => load({ rpc: async () => ({ data: { ...record, compatibleBodyComponentVersionIds: [] }, error: null }) }, {
    organizationId: ORG,
    familyKey: "CYL-9ML",
    fitmentGeometryKey: "fitment__roller-ball__17-415__v1",
    authorityMaskSha256: MASK,
  }), /Malformed shared placement/);
});
