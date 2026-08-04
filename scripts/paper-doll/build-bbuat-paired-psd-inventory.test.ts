import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPairedPsdInventory,
  normalizePsdPairIdentity,
  type StatefulPsdSource,
} from "./build-bbuat-paired-psd-inventory";

const sources: StatefulPsdSource[] = [
  {
    state: "capped",
    sourcePath: "/capped/16. 16 mm/1. 28ml Capped/1. GBCyl28RollBlk.psd",
    sourceRelativePath: "16. 16 mm/1. 28ml Capped/1. GBCyl28RollBlk.psd",
  },
  {
    state: "uncapped",
    sourcePath: "/uncapped/16. 16 mm/2. 28ml Uncapped/3. GBCyl28RollBlk.psd",
    sourceRelativePath: "16. 16 mm/2. 28ml Uncapped/3. GBCyl28RollBlk.psd",
  },
  {
    state: "capped",
    sourcePath: "/capped/3. 17-415 Bottles/Amber/CappedOnly.psd",
    sourceRelativePath: "3. 17-415 Bottles/Amber/CappedOnly.psd",
  },
  {
    state: "uncapped",
    sourcePath: "/uncapped/5. 13-415 Bottles/Tall/UncappedOnly.psd",
    sourceRelativePath: "5. 13-415 Bottles/Tall/UncappedOnly.psd",
  },
];

describe("BBUAT capped/uncapped PSD inventory", () => {
  it("pairs one capped and one uncapped source by family plus normalized SKU token", () => {
    const result = buildPairedPsdInventory(sources);

    assert.equal(result.summary.sourceCount, 4);
    assert.equal(result.summary.exactPairCount, 1);
    assert.equal(result.summary.cappedOnlyCount, 1);
    assert.equal(result.summary.uncappedOnlyCount, 1);
    assert.equal(result.summary.ambiguousCount, 0);

    const pair = result.groups.find((group) => group.status === "exact-pair");
    assert.equal(pair?.identityToken, "GBCYL28ROLLBLK");
    assert.equal(pair?.familyToken, "1616MM");
    assert.equal(pair?.cappedSources.length, 1);
    assert.equal(pair?.uncappedSources.length, 1);
    assert.equal(pair?.productionPolicy.detachedSidecarCap, "exclude");
    assert.equal(pair?.approvalState, "pending-human-review");
  });

  it("normalizes state labels, numbering, spaces, and punctuation without changing product identity", () => {
    assert.deepEqual(
      normalizePsdPairIdentity("16. 16 mm/1. 28ml Capped/1. GBCyl28RollBlk.psd"),
      { familyToken: "1616MM", identityToken: "GBCYL28ROLLBLK" },
    );
    assert.deepEqual(
      normalizePsdPairIdentity("16. 16 mm/2. 28ml Uncapped/3. GBCyl28RollBlk.psd"),
      { familyToken: "1616MM", identityToken: "GBCYL28ROLLBLK" },
    );
  });

  it("never treats multiple candidates as an approved pair", () => {
    const result = buildPairedPsdInventory([
      ...sources,
      {
        state: "capped",
        sourcePath: "/capped/16. 16 mm/duplicate/GBCyl28RollBlk.psd",
        sourceRelativePath: "16. 16 mm/duplicate/GBCyl28RollBlk.psd",
      },
    ]);
    const group = result.groups.find((candidate) => candidate.identityToken === "GBCYL28ROLLBLK");

    assert.equal(group?.status, "ambiguous");
    assert.equal(group?.approvalState, "pending-human-review");
  });
});
