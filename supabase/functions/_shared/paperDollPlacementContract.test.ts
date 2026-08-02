import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ORG = "11111111-1111-4111-8111-111111111111";
const BODY_IDS = [
  "33333333-3333-4333-8333-333333333331",
  "33333333-3333-4333-8333-333333333332",
  "33333333-3333-4333-8333-333333333333",
  "33333333-3333-4333-8333-333333333334",
  "33333333-3333-4333-8333-333333333335",
];

test("edge placement parser preserves the exact approved geometry decision", async () => {
  const contract = await import("./paperDollPlacementContract").catch(() => ({}));
  const parse = (contract as { parsePaperDollPlacementLockRequest?: (value: unknown) => Record<string, unknown> }).parsePaperDollPlacementLockRequest;
  assert.ok(parse, "parsePaperDollPlacementLockRequest must exist");
  const parsed = parse({
    organizationId: ORG,
    familyKey: "CYL-9ML",
    fitmentGeometryKey: "fitment__roller-ball__17-415__v1",
    calibrationComponentVersionId: "22222222-2222-4222-8222-222222222222",
    expectedAuthorityMaskSha256: "a".repeat(64),
    canvas: { widthPx: 2080, heightPx: 2288 },
    transform: { translateXPx: 27.066, translateYPx: -134.132, uniformScale: 0.974 },
    compatibleBodyComponentVersionIds: BODY_IDS,
    approverDisplayName: " Jordan Richter ",
    approvalNote: " Flush across all five plates ",
  });
  assert.equal(parsed.approverDisplayName, "Jordan Richter");
  assert.equal(parsed.approvalNote, "Flush across all five plates");
  assert.deepEqual(parsed.compatibleBodyComponentVersionIds, BODY_IDS);
});

test("edge placement parser rejects duplicate bodies and the wrong canvas", async () => {
  const contract = await import("./paperDollPlacementContract").catch(() => ({}));
  const parse = (contract as { parsePaperDollPlacementLockRequest?: (value: unknown) => Record<string, unknown> }).parsePaperDollPlacementLockRequest;
  assert.ok(parse, "parsePaperDollPlacementLockRequest must exist");
  const base = {
    organizationId: ORG,
    familyKey: "CYL-9ML",
    fitmentGeometryKey: "fitment__roller-ball__17-415__v1",
    calibrationComponentVersionId: "22222222-2222-4222-8222-222222222222",
    expectedAuthorityMaskSha256: "a".repeat(64),
    canvas: { widthPx: 2080, heightPx: 2288 },
    transform: { translateXPx: 27.066, translateYPx: -134.132, uniformScale: 0.974 },
    compatibleBodyComponentVersionIds: BODY_IDS,
    approverDisplayName: "Jordan Richter",
    approvalNote: "Flush",
  };
  assert.throws(() => parse({ ...base, compatibleBodyComponentVersionIds: [...BODY_IDS.slice(0, 4), BODY_IDS[0]] }));
  assert.throws(() => parse({ ...base, canvas: { widthPx: 1000, heightPx: 1300 } }));
});

test("placement ledger is immutable, organization-scoped, and release-neutral", async () => {
  const sql = await readFile(
    new URL("../../migrations/20260802211000_paper_doll_shared_placements.sql", import.meta.url),
    "utf8",
  ).catch(() => "");
  assert.match(sql, /CREATE TABLE public\.paper_doll_placement_versions/i);
  assert.match(sql, /CREATE TABLE public\.paper_doll_placement_reviews/i);
  assert.match(sql, /CREATE TABLE public\.paper_doll_placement_approvals/i);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /GRANT SELECT[\s\S]+authenticated/i);
  assert.match(sql, /lock_paper_doll_shared_placement/i);
  assert.match(sql, /TO service_role/i);
  assert.match(sql, /approval_status\s*<>\s*'approved'/i);
  assert.match(sql, /geometry_mask_sha256\s*<>\s*p_expected_authority_mask_sha256/i);
  assert.match(sql, /cardinality\(p_compatible_body_component_version_ids\)\s*<>\s*5/i);
  assert.match(sql, /releaseChanged', false/i);
  assert.match(sql, /sanityPublished', false/i);
  assert.doesNotMatch(sql, /INSERT INTO public\.paper_doll_family_release_assets/i);
  assert.doesNotMatch(sql, /INSERT INTO public\.paper_doll_publish_runs/i);
});
