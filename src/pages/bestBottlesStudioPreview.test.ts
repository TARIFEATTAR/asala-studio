import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveInitialStudioTab } from "./bestBottlesStudioPreview";

test("paperDollPreview=1 opens Compose directly after a browser refresh", () => {
  assert.equal(resolveInitialStudioTab("?paperDollPreview=1"), "compose");
});

test("ordinary Studio URLs retain the Masters entry point", () => {
  assert.equal(resolveInitialStudioTab(""), "masters");
  assert.equal(resolveInitialStudioTab("?paperDollPreview=0"), "masters");
});

test("Compose presents the immutable ledger as Current Release", () => {
  const source = readFileSync(new URL("../components/paper-doll/ProductionCandidateWorkbench.tsx", import.meta.url), "utf8");
  assert.match(source, /Current Release/);
  assert.match(source, /Read-only active ledger snapshot/);
  assert.doesNotMatch(source, />release lock</i);
});

test("Edit Lab names the immutable approval action Approve Pixels", () => {
  const source = readFileSync(new URL("../components/paper-doll/CandidateActionPanel.tsx", import.meta.url), "utf8");
  assert.match(source, />Approve Pixels<\/button>/);
  assert.doesNotMatch(source, />Approve child<\/button>/i);
});

test("an existing immutable approval is a visible success with a Family Fit continuation", () => {
  const source = readFileSync(new URL("../components/paper-doll/CandidateActionPanel.tsx", import.meta.url), "utf8");
  assert.match(source, /Pixels Approved · Open Family Fit/);
  assert.match(source, /resolveAncestorNotice/);
});

test("Compose renews private asset URLs and retries a failed atomic canvas swap", () => {
  const source = readFileSync(new URL("../components/paper-doll/ProductionCandidateWorkbench.tsx", import.meta.url), "utf8");
  assert.match(source, /refetchInterval:\s*PRIVATE_ASSET_REFRESH_INTERVAL_MS/);
  assert.match(source, /refetchOnWindowFocus:\s*true/);
  assert.match(source, /onAssetLoadFailure=\{refreshPrivateAssetUrls\}/);
});

test("authority-mask inspection never paints the mask image over product pixels", () => {
  const source = readFileSync(new URL("../components/paper-doll/AssemblyEditCanvas.tsx", import.meta.url), "utf8");
  assert.match(source, /name:\s*"authority-mask-bounds"/);
  assert.doesNotMatch(source, /fabric\.Image\.fromURL\(selected\.geometryMaskUrl/);
  assert.doesNotMatch(source, /name:\s*"authority-mask-overlay"/);
});

test("approved roller pixels route into roller-only Family Fit with one shared transform", () => {
  const source = readFileSync(new URL("../components/paper-doll/ProductionCandidateWorkbench.tsx", import.meta.url), "utf8");
  assert.match(source, /onOpenFamilyFit=\{\(\) => enterMode\("family-fit"\)\}/);
  assert.match(source, /overcapVariantKey=\{null\}/);
  assert.match(source, /placementTransform=\{mode === "family-fit" \? familyTransform/);
  assert.match(source, /approvedCandidate\.imageUrl/);
  assert.match(source, /onApprovedVariantsChange=\{handleApprovedVariantsChange\}/);
  assert.match(source, /expectedAuthorityMaskSha256=\{approvedCandidate\?\.authorityMaskSha256 \?\? null\}/);
});
