import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCanonicalIdentityIndex, joinPsdSourceIdentity } from "./bestBottlesPsdIdentityJoin";

const rows = [
  { website_sku: "WebA", grace_sku: "GB-A", family: "Cylinder" },
  { website_sku: "WebB", grace_sku: "GB-B", family: "Circle" },
];

describe("PSD canonical identity join", () => {
  it("prefers exact website SKU over Grace SKU", () => {
    const index = buildCanonicalIdentityIndex(rows);
    const result = joinPsdSourceIdentity({ websiteSku: "WebA", graceSku: "GB-B", index, aliases: [] });
    assert.equal(result.status, "exact-website-sku");
    assert.equal(result.row?.grace_sku, "GB-A");
    assert.match(result.reasons.join(" "), /grace sku.*different canonical row/i);
  });

  it("uses exact Grace SKU only when website SKU is absent", () => {
    const index = buildCanonicalIdentityIndex(rows);
    const result = joinPsdSourceIdentity({ websiteSku: null, graceSku: "gb-b", index, aliases: [] });
    assert.equal(result.status, "exact-grace-sku");
  });

  it("does not use substring or fuzzy identity", () => {
    const index = buildCanonicalIdentityIndex(rows);
    const result = joinPsdSourceIdentity({ websiteSku: "Web", graceSku: null, index, aliases: [] });
    assert.equal(result.status, "unmatched");
  });

  it("fails closed when an exact key maps to conflicting canonical rows", () => {
    const index = buildCanonicalIdentityIndex([...rows, { website_sku: "WebA", grace_sku: "GB-X", family: "Diva" }]);
    const result = joinPsdSourceIdentity({ websiteSku: "WebA", graceSku: null, index, aliases: [] });
    assert.equal(result.status, "ambiguous");
    assert.match(result.reasons.join(" "), /duplicate website sku/i);
  });

  it("does not let an exact Grace SKU override a supplied unmatched website SKU", () => {
    const index = buildCanonicalIdentityIndex(rows);
    const result = joinPsdSourceIdentity({ websiteSku: "Missing", graceSku: "GB-B", index, aliases: [] });
    assert.equal(result.status, "unmatched");
    assert.equal(result.row, null);
    assert.match(result.reasons.join(" "), /website sku.*did not match/i);
    assert.match(result.reasons.join(" "), /grace sku.*lower-priority/i);
  });

  it("applies an exact reviewed alias with complete provenance", () => {
    const index = buildCanonicalIdentityIndex(rows);
    const result = joinPsdSourceIdentity({
      websiteSku: null,
      graceSku: null,
      sourceToken: "Legacy A",
      index,
      aliases: [{
        sourceToken: "legacy-a",
        websiteSku: "WebA",
        graceSku: "GB-A",
        reviewedBy: "Jordan Richter",
        reviewedAt: "2026-07-12T00:00:00.000Z",
      }],
    });
    assert.equal(result.status, "reviewed-alias");
    assert.equal(result.row?.website_sku, "WebA");
  });

  it("ignores an alias without complete explicit provenance", () => {
    const index = buildCanonicalIdentityIndex(rows);
    const result = joinPsdSourceIdentity({
      websiteSku: null,
      graceSku: null,
      sourceToken: "Legacy A",
      index,
      aliases: [{
        sourceToken: "Legacy A",
        websiteSku: "WebA",
        graceSku: "GB-A",
        reviewedBy: "",
        reviewedAt: "2026-07-12T00:00:00.000Z",
      }],
    });
    assert.equal(result.status, "unmatched");
    assert.equal(result.row, null);
    assert.match(result.reasons.join(" "), /incomplete provenance/i);
  });

  it("fails closed when an alias identifies different canonical rows", () => {
    const index = buildCanonicalIdentityIndex(rows);
    const result = joinPsdSourceIdentity({
      websiteSku: null,
      graceSku: null,
      sourceToken: "Legacy A",
      index,
      aliases: [{
        sourceToken: "Legacy A",
        websiteSku: "WebA",
        graceSku: "GB-B",
        reviewedBy: "Jordan Richter",
        reviewedAt: "2026-07-12T00:00:00.000Z",
      }],
    });
    assert.equal(result.status, "conflict");
    assert.equal(result.row, null);
    assert.match(result.reasons.join(" "), /alias.*different canonical rows/i);
  });
});
