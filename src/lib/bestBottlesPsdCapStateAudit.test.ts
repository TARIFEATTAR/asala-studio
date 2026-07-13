import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PSD_CAP_STATE_CLASSIFICATIONS,
  assertMachineCannotApprove,
  buildPsdReviewUnitKey,
  groupPsdAuditRecords,
  type PsdAuditRecord,
} from "./bestBottlesPsdCapStateAudit";

type PendingExactWebsiteRecord = Extract<
  PsdAuditRecord,
  { identityStatus: "exact-website-sku"; reviewStatus: "pending-human-review" }
>;

const base: PendingExactWebsiteRecord = {
  sourcePath: "/archive/A.psd",
  sourceRelativePath: "Cylinder/A.psd",
  sourceSha256: "a".repeat(64),
  sourceBytes: 100,
  websiteSku: "WebA",
  graceSku: "GB-A",
  family: "Cylinder",
  canonicalReviewMetadata: null,
  identityStatus: "exact-website-sku",
  identityReasons: [],
  aliasProvenance: null,
  composite: null,
  machineTriage: {
    proposedClassification: "ambiguous-manual-review",
    confidence: "low",
    reasons: ["visual_review_required"],
  },
  reviewStatus: "pending-human-review",
  reviewer: null,
  reviewedAt: null,
};

describe("Best Bottles PSD cap-state audit domain", () => {
  it("uses the complete evidence-preserving taxonomy", () => {
    assert.deepEqual(PSD_CAP_STATE_CLASSIFICATIONS, [
      "assembled-cap-on",
      "cap-off-applicator-exposed",
      "detached-cap-or-sidecar",
      "component-only",
      "multi-product-layout",
      "ambiguous-manual-review",
      "blocked-identity-conflict",
    ]);
  });

  it("keeps duplicate pixels separate across canonical identities", () => {
    const groups = groupPsdAuditRecords([
      base,
      { ...base, sourcePath: "/archive/A copy.psd" },
      { ...base, sourcePath: "/archive/B.psd", websiteSku: "WebB", graceSku: "GB-B" },
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups.find((group) => group.websiteSku === "WebA")?.sources.length, 2);
  });

  it("uses source path to break representative relative-path ties", () => {
    const [group] = groupPsdAuditRecords([
      { ...base, sourcePath: "/archive/Z.psd" },
      { ...base, sourcePath: "/archive/A.psd" },
    ]);

    assert.equal(group.representative.sourcePath, "/archive/A.psd");
  });

  it("keeps unresolved identities in source-specific review units", () => {
    const groups = groupPsdAuditRecords([
      {
        ...base,
        sourcePath: "/archive/Unmatched.psd",
        sourceRelativePath: "Cylinder/Unmatched.psd",
        websiteSku: null,
        graceSku: null,
        identityStatus: "unmatched",
      },
      {
        ...base,
        sourcePath: "/archive/Ambiguous.psd",
        sourceRelativePath: "Cylinder/Ambiguous.psd",
        websiteSku: null,
        graceSku: null,
        identityStatus: "ambiguous",
      },
      {
        ...base,
        sourcePath: "/archive/Conflict.psd",
        sourceRelativePath: "Cylinder/Conflict.psd",
        websiteSku: null,
        graceSku: null,
        identityStatus: "conflict",
      },
      {
        ...base,
        sourcePath: "/second-archive/Unmatched.psd",
        sourceRelativePath: "Cylinder/Unmatched.psd",
        websiteSku: null,
        graceSku: null,
        identityStatus: "unmatched",
      },
    ]);

    assert.equal(groups.length, 4);
    assert.deepEqual(groups.map((group) => group.sources.length), [1, 1, 1, 1]);
  });

  it("requires the matching canonical SKU for exact identity states", () => {
    assert.throws(() => groupPsdAuditRecords([{
      ...base,
      identityStatus: "exact-website-sku",
      websiteSku: null,
    } as unknown as PsdAuditRecord]), /exact website identity requires a valid website SKU/i);
    assert.throws(() => groupPsdAuditRecords([{
      ...base,
      identityStatus: "exact-website-sku",
      websiteSku: "---",
    } as unknown as PsdAuditRecord]), /exact website identity requires a valid website SKU/i);
    assert.throws(() => groupPsdAuditRecords([{
      ...base,
      identityStatus: "exact-grace-sku",
      graceSku: null,
    } as unknown as PsdAuditRecord]), /exact Grace identity requires a valid Grace SKU/i);
    assert.throws(() => groupPsdAuditRecords([{
      ...base,
      identityStatus: "exact-grace-sku",
      graceSku: "---",
    } as unknown as PsdAuditRecord]), /exact Grace identity requires a valid Grace SKU/i);

    assert.equal(groupPsdAuditRecords([{
      ...base,
      identityStatus: "exact-grace-sku",
      websiteSku: null,
      graceSku: "GB-A",
    }]).length, 1);
  });

  it("builds a stable hash plus identity review key", () => {
    assert.equal(
      buildPsdReviewUnitKey(base),
      `${"a".repeat(64)}|WEBA|GBA`,
    );
  });

  it("rejects empty and non-human approval reviewers", () => {
    assert.throws(() => assertMachineCannotApprove({
      reviewStatus: "approved",
      reviewer: { kind: "human", identity: " " },
      reviewedAt: "2026-07-12T18:00:00.000Z",
    }), /human reviewer/i);
    assert.throws(() => assertMachineCannotApprove({
      reviewStatus: "approved",
      reviewer: { kind: "machine", identity: "triage-v1" },
      reviewedAt: "2026-07-12T18:00:00.000Z",
    }), /human reviewer/i);
    assert.throws(() => groupPsdAuditRecords([{
      ...base,
      reviewStatus: "approved",
      reviewer: { kind: "machine", identity: "triage-v1" },
      reviewedAt: "2026-07-12T18:00:00.000Z",
    } as unknown as PsdAuditRecord]), /human reviewer/i);
  });

  it("requires a valid reviewed-at timestamp for human approval", () => {
    assert.throws(() => assertMachineCannotApprove({
      reviewStatus: "approved",
      reviewer: { kind: "human", identity: "Jordan Richter" },
      reviewedAt: "not-a-timestamp",
    }), /reviewed-at timestamp/i);
    assert.doesNotThrow(() => assertMachineCannotApprove({
      reviewStatus: "approved",
      reviewer: { kind: "human", identity: "Jordan Richter" },
      reviewedAt: "2026-07-12T18:00:00.000Z",
    }));
  });

  it("requires human provenance for blocked decisions", () => {
    assert.throws(() => groupPsdAuditRecords([{
      ...base,
      reviewStatus: "blocked",
      reviewer: null,
      reviewedAt: null,
    } as unknown as PsdAuditRecord]), /blocked.*named human reviewer/i);
    assert.throws(() => groupPsdAuditRecords([{
      ...base,
      reviewStatus: "blocked",
      reviewer: { kind: "machine", identity: "triage-v1" },
      reviewedAt: "2026-07-12T18:00:00.000Z",
    } as unknown as PsdAuditRecord]), /blocked.*named human reviewer/i);
    assert.throws(() => groupPsdAuditRecords([{
      ...base,
      reviewStatus: "blocked",
      reviewer: { kind: "human", identity: "Jordan Richter" },
      reviewedAt: "not-a-timestamp",
    } as unknown as PsdAuditRecord]), /blocked.*reviewed-at timestamp/i);

    assert.equal(groupPsdAuditRecords([{
      ...base,
      reviewStatus: "blocked",
      reviewer: { kind: "human", identity: "Jordan Richter" },
      reviewedAt: "2026-07-12T18:00:00.000Z",
    }]).length, 1);
    assert.doesNotThrow(() => assertMachineCannotApprove({
      reviewStatus: "pending-human-review",
      reviewer: { kind: "machine", identity: "triage-v1" },
      reviewedAt: null,
    }));
  });

  it("requires structured provenance for every reviewed alias", () => {
    const aliasProvenance = {
      observedAliasToken: "web-a-legacy",
      canonicalWebsiteSku: "WebA",
      canonicalGraceSku: "GB-A",
      reviewer: { kind: "human" as const, identity: "Jordan Richter" },
      reviewedAt: "2026-07-12T18:00:00.000Z",
    };
    const reviewedAlias = {
      ...base,
      websiteSku: "WebA",
      graceSku: "GB-A",
      identityStatus: "reviewed-alias" as const,
      aliasProvenance,
    } satisfies PsdAuditRecord;

    assert.equal(groupPsdAuditRecords([reviewedAlias]).length, 1);
    assert.deepEqual(reviewedAlias.aliasProvenance, aliasProvenance);

    for (const field of [
      "observedAliasToken",
      "canonicalWebsiteSku",
      "canonicalGraceSku",
      "reviewer",
      "reviewedAt",
    ] as const) {
      const incompleteProvenance: Record<string, unknown> = { ...aliasProvenance };
      delete incompleteProvenance[field];
      assert.throws(() => groupPsdAuditRecords([{
        ...reviewedAlias,
        aliasProvenance: incompleteProvenance,
      } as unknown as PsdAuditRecord]), /reviewed alias requires structured provenance/i);
    }
  });
});
