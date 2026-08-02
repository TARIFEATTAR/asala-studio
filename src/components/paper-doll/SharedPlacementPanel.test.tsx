import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SharedPlacementPanel } from "./SharedPlacementPanel";
import { sharedPlacementLockEligible } from "./sharedPlacementPanelModel";

const MASK = "a".repeat(64);
const bodies = ["Amber", "Cobalt", "Clear", "Frosted", "Swirl"].map((displayName, index) => ({
  componentVersionId: `33333333-3333-4333-8333-33333333333${index + 1}`,
  displayName,
  materialVariant: `${displayName} glass`,
}));
const approved = {
  componentVersionId: "22222222-2222-4222-8222-222222222222",
  imageUrl: "https://example.test/approved.png",
  imageSha256: "b".repeat(64),
  authorityMaskSha256: MASK,
  alphaBounds: { left: 907, top: 675, right: 1175, bottom: 918 },
};
const transform = { translateXPx: 27.066, translateYPx: -134.132, scaleX: 0.974, scaleY: 0.974 };

test("shared placement lock requires exact geometry, five plates, and named approval", () => {
  assert.equal(sharedPlacementLockEligible({
    approved,
    expectedAuthorityMaskSha256: MASK,
    bodyPlates: bodies,
    transform,
    approverDisplayName: "Jordan Richter",
    approvalNote: "Flush on all five plates",
  }), true);
  assert.equal(sharedPlacementLockEligible({
    approved,
    expectedAuthorityMaskSha256: "c".repeat(64),
    bodyPlates: bodies,
    transform,
    approverDisplayName: "Jordan Richter",
    approvalNote: "Flush on all five plates",
  }), false);
  assert.equal(sharedPlacementLockEligible({
    approved,
    expectedAuthorityMaskSha256: MASK,
    bodyPlates: bodies.slice(0, 4),
    transform,
    approverDisplayName: "Jordan Richter",
    approvalNote: "Flush on all five plates",
  }), false);
});

test("panel makes the five-plate consequence and inherited variants explicit", () => {
  const html = renderToStaticMarkup(<SharedPlacementPanel
    approved={approved}
    expectedAuthorityMaskSha256={MASK}
    bodyPlates={bodies}
    inheritedVariantLabels={["Natural plastic", "Metal roller"]}
    transform={transform}
    lockedPlacement={null}
    approverDisplayName="Jordan Richter"
    approvalNote="Flush on all five plates"
    lockPending={false}
    lockError={null}
    onApproverDisplayNameChange={() => undefined}
    onApprovalNoteChange={() => undefined}
    onLock={() => undefined}
  />);
  for (const body of bodies) assert.match(html, new RegExp(body.displayName));
  assert.match(html, /Natural plastic/);
  assert.match(html, /Metal roller/);
  assert.match(html, /27\.066/);
  assert.match(html, /-134\.132/);
  assert.match(html, /Jordan Richter/);
  assert.match(html, /Lock Shared Placement/);
});
