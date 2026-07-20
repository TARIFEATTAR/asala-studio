import assert from "node:assert/strict";
import test from "node:test";

import {
  canSkipRenderedEntry,
  isSystemicQaFailure,
  type FamilyBatchGenerationIdentity,
  type FamilyBatchRenderedEntryLike,
} from "./family-batch-resume";

const v61Identity: FamilyBatchGenerationIdentity = {
  ledgerHash: "ledger-v2",
  referenceHash: "reference-a",
  promptHash: "prompt-a",
  promptVersion: "best-bottles-reference-locked-v6.1",
  shadowOwner: "model",
  shadowContract: "contact-back-right-v1",
  shadowTopology: "assembled",
  scaleContractVersion: "best-bottles-catalog-scale-v1",
  calibrationRegistryKey: "cylinder:9:group-cylinder-9",
  resolvedAssembledTargetPct: 69,
  resolvedBodyTargetPx: 1320,
};

const rendered: FamilyBatchRenderedEntryLike = {
  status: "rendered",
  imageUrl: "https://example.test/final.png",
  rawImageUrl: "https://example.test/raw.png",
  geometryQa: { pass: true },
  shadowQa: { pass: true },
  lifecycle: "qa-passed",
  generationIdentity: v61Identity,
};

test("does not skip a historical V6.0 rendered entry", () => {
  assert.equal(
    canSkipRenderedEntry(
      {
        ...rendered,
        generationIdentity: {
          ...v61Identity,
          promptVersion: "best-bottles-reference-locked-v6.0",
        },
      },
      v61Identity,
    ),
    false,
  );
});

test("classifies cohort-stopping QA failures separately from provider failures", () => {
  assert.equal(isSystemicQaFailure("SKU rig postprocess failed: shadow missing"), true);
  assert.equal(isSystemicQaFailure("generation failed: provider rate limit"), false);
});

test("does not skip when the canonical reference hash changes", () => {
  assert.equal(
    canSkipRenderedEntry(
      {
        ...rendered,
        generationIdentity: { ...v61Identity, referenceHash: "reference-old" },
      },
      v61Identity,
    ),
    false,
  );
});

test("does not skip when the global scale contract or resolved target changes", () => {
  assert.equal(
    canSkipRenderedEntry({
      ...rendered,
      generationIdentity: { ...v61Identity, scaleContractVersion: "historical-scale-v0" },
    }, v61Identity),
    false,
  );
  assert.equal(
    canSkipRenderedEntry({
      ...rendered,
      generationIdentity: { ...v61Identity, resolvedAssembledTargetPct: 68 },
    }, v61Identity),
    false,
  );
});

test("skips only an exact rendered identity with passing QA", () => {
  assert.equal(canSkipRenderedEntry(rendered, v61Identity), true);
  assert.equal(
    canSkipRenderedEntry({ ...rendered, shadowQa: { pass: false } }, v61Identity),
    false,
  );
});
