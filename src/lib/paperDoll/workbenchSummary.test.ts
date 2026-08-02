import assert from "node:assert/strict";
import test from "node:test";

import { summarizePaperDollWorkbench } from "./workbenchSummary";
import type { PaperDollReleaseWorkbenchData } from "./releaseRepository";

function fixture(): PaperDollReleaseWorkbenchData {
  return {
    release: {
      id: "release",
      familyKey: "CYL-9ML",
      version: "1.0.0-draft.1",
      status: "blocked",
      canvasWidthPx: 2080,
      canvasHeightPx: 2288,
      backgroundHex: "#F5F3EF",
      manifestSha256: "a".repeat(64),
      createdAt: "2026-08-01T00:00:00.000Z",
    },
    assets: [
      {
        componentVersionId: "body",
        componentKey: "body-clear",
        displayName: "Clear body",
        geometryFamilyId: "CYL-9ML",
        slot: "body",
        variantKey: "clear",
        versionKey: "1",
        materialVariant: "clear-glass",
        approvalStatus: "approved",
        imageUrl: "https://example.com/body.png",
        reference: {
          storageBucket: "paper-doll-approved",
          objectPath: `10000000-0000-4000-8000-000000000001/CYL-9ML/body/${"a".repeat(64)}.png`,
          sha256: "a".repeat(64),
          contentType: "image/png",
          byteSize: 100,
        },
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: { left: 1, top: 1, right: 2, bottom: 2 },
        mountAxisXPx: 1040,
        seatYPx: 2100,
        qa: [{ id: "qa-body", gateKey: "geometry-lock", status: "passed", blocking: true, issues: [] }],
      },
      {
        componentVersionId: "cap",
        componentKey: "cap-translucent",
        displayName: "Translucent cap",
        geometryFamilyId: "closure-17-415",
        slot: "cap",
        variantKey: "translucent",
        versionKey: "1",
        materialVariant: "translucent-plastic",
        approvalStatus: "blocked",
        imageUrl: "https://example.com/cap.png",
        reference: {
          storageBucket: "paper-doll-candidates",
          objectPath: `10000000-0000-4000-8000-000000000001/CYL-9ML/cap/${"b".repeat(64)}.png`,
          sha256: "b".repeat(64),
          contentType: "image/png",
          byteSize: 100,
        },
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: { left: 1, top: 1, right: 2, bottom: 2 },
        mountAxisXPx: 1040,
        seatYPx: 750,
        qa: [{
          id: "qa-cap",
          gateKey: "assembly-context",
          status: "blocked",
          blocking: true,
          issues: ["assembly_context_required"],
        }],
      },
    ],
  };
}

test("summarizePaperDollWorkbench keeps blocked assets out of dry-run eligibility", () => {
  assert.deepEqual(summarizePaperDollWorkbench(fixture()), {
    totalAssets: 2,
    approvedAssets: 1,
    blockedAssets: 1,
    passedBlockingGates: 1,
    failedBlockingGates: 1,
    dryRunEligible: false,
    blockers: ["Translucent cap: assembly_context_required"],
  });
});

test("summarizePaperDollWorkbench only marks a ready, fully approved release dry-run eligible", () => {
  const data = fixture();
  data.release.status = "ready";
  data.assets[1].approvalStatus = "approved";
  data.assets[1].qa[0].status = "passed";
  data.assets[1].qa[0].issues = [];

  assert.equal(summarizePaperDollWorkbench(data).dryRunEligible, true);
});
