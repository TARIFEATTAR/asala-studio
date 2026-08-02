import assert from "node:assert/strict";
import { test } from "node:test";

import sharp from "sharp";

import { buildCandidateQaEvidence } from "./candidateQaEvidence.node";

test("metal roller finalization includes calibrated passing opaque-white evidence", async () => {
  const output = await sharp({
    create: { width: 10, height: 10, channels: 4, background: { r: 180, g: 182, b: 185, alpha: 1 } },
  }).png().toBuffer();
  const qa = await buildCandidateQaEvidence({
    requirementKey: "CYL-9ML:ROLLER:METAL",
    output,
    expectedMaskSha256: "a".repeat(64),
    actualMaskSha256: "a".repeat(64),
    normalization: { mode: "authority-bounds-contain" },
  });
  const white = qa.find((row) => row.gateKey === "opaque-white-fraction");
  assert.equal(white?.qaStatus, "passed");
  assert.equal(white?.blocking, true);
  assert.equal(white?.measurements.maximum, 0.05);
});

test("metal roller white-junk evidence fails closed", async () => {
  const output = await sharp({
    create: { width: 10, height: 10, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).png().toBuffer();
  const qa = await buildCandidateQaEvidence({
    requirementKey: "CYL-9ML:ROLLER:METAL",
    output,
    expectedMaskSha256: "a".repeat(64),
    actualMaskSha256: "a".repeat(64),
    normalization: { mode: "authority-bounds-contain" },
  });
  assert.equal(qa.find((row) => row.gateKey === "opaque-white-fraction")?.qaStatus, "failed");
});
