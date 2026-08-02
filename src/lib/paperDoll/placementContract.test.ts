import assert from "node:assert/strict";
import test from "node:test";

const ORG = "11111111-1111-4111-8111-111111111111";
const CALIBRATION = "22222222-2222-4222-8222-222222222222";
const BODY_IDS = [
  "33333333-3333-4333-8333-333333333331",
  "33333333-3333-4333-8333-333333333332",
  "33333333-3333-4333-8333-333333333333",
  "33333333-3333-4333-8333-333333333334",
  "33333333-3333-4333-8333-333333333335",
];
const MASK_SHA = "a".repeat(64);

const validRequest = {
  organizationId: ORG,
  familyKey: "CYL-9ML",
  fitmentGeometryKey: "fitment__roller-ball__17-415__v1",
  calibrationComponentVersionId: CALIBRATION,
  expectedAuthorityMaskSha256: MASK_SHA,
  canvas: { widthPx: 2080, heightPx: 2288 },
  transform: { translateXPx: 27.066, translateYPx: -134.132, uniformScale: 0.974 },
  compatibleBodyComponentVersionIds: BODY_IDS,
  approverDisplayName: "Jordan Richter",
  approvalNote: "Flush across all five CYL-9ML plates",
};

test("shared placement request binds one exact geometry to five unique CYL-9ML bodies", async () => {
  const contract = await import("./placementContract").catch(() => ({}));
  const schema = (contract as { SharedPlacementLockRequestSchema?: { parse(value: unknown): unknown } }).SharedPlacementLockRequestSchema;
  assert.ok(schema, "SharedPlacementLockRequestSchema must exist");
  assert.deepEqual(schema.parse(validRequest), validRequest);
});

test("shared placement request rejects geometry drift and ambiguous body scope", async () => {
  const contract = await import("./placementContract").catch(() => ({}));
  const schema = (contract as { SharedPlacementLockRequestSchema?: { parse(value: unknown): unknown } }).SharedPlacementLockRequestSchema;
  assert.ok(schema, "SharedPlacementLockRequestSchema must exist");
  const invalid = [
    { ...validRequest, expectedAuthorityMaskSha256: "bad" },
    { ...validRequest, canvas: { widthPx: 1000, heightPx: 1300 } },
    { ...validRequest, transform: { ...validRequest.transform, uniformScale: 0 } },
    { ...validRequest, transform: { ...validRequest.transform, translateXPx: Number.NaN } },
    { ...validRequest, compatibleBodyComponentVersionIds: BODY_IDS.slice(0, 4) },
    { ...validRequest, compatibleBodyComponentVersionIds: [...BODY_IDS.slice(0, 4), BODY_IDS[0]] },
    { ...validRequest, approverDisplayName: " " },
    { ...validRequest, approvalNote: " " },
  ];
  for (const request of invalid) assert.throws(() => schema.parse(request));
});
