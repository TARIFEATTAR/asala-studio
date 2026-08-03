import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePaperDollComponentAuthorityQueue, type PaperDollComponentAuthorityQueue } from "./componentAuthorityIntakeContract";

const SHA = "a".repeat(64);

function fixture(): PaperDollComponentAuthorityQueue {
  return {
    schemaVersion: 1,
    sourceBacklogPath: "docs/backlog.json",
    sourceBacklogSha256: SHA,
    summary: { sourceIdentityCount: 1, exactWebsiteSkuCount: 1, localPilotAuthorityIdentityCount: 0, sourceReferenceObservedCount: 1, manualReviewIdentityCount: 0 },
    items: [{
      authorityQueueKey: "component__sprayer__13-415__source",
      sourceIdentity: "source",
      websiteSkus: ["source"],
      graceSkus: ["GRACE"],
      slotProposals: ["sprayer"],
      familyLabels: ["Sprayer"],
      neckFinishEvidence: ["13-415"],
      applicatorEvidence: ["Fine Mist Sprayer"],
      capStyleEvidence: ["Spray"],
      finishEvidence: ["Shiny Gold"],
      trimEvidence: [],
      materialEvidence: ["Plastic"],
      assemblyEvidence: ["2-part"],
      itemNameEvidence: ["Fine mist sprayer"],
      referenceUrls: ["https://example.com/image.png"],
      productUrls: [],
      localPlateVariants: [],
      sourceReferenceStatus: "reference-url-observed",
      authorityStatus: "missing",
      geometryGroupingStatus: "unresolved",
      compatibilityStatus: "unverified",
      issues: [],
      mutationPolicy: { candidatesGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
    }],
    missingSourceResponsibilities: [],
    mutationPolicy: { candidatesGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
}

test("component authority queue proves summary counts", () => {
  const queue = fixture();
  assert.equal(parsePaperDollComponentAuthorityQueue(queue).items.length, 1);
  queue.summary.sourceIdentityCount = 2;
  assert.throws(() => parsePaperDollComponentAuthorityQueue(queue), /does not match component evidence/i);
});
