import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  buildCandidateStoragePaths,
  buildProviderPlan,
  clampDecodedMaterialToAuthority,
  validateOriginalFilename,
} from "./paperDollComponentGeneration.ts";

Deno.test("generated framing is discarded and authority alpha is copied exactly", () => {
  const material = {
    width: 4,
    height: 4,
    rgba: new Uint8Array(
      Array.from({ length: 16 }, (_, index) => [
        index,
        100 + index,
        200 - index,
        index % 2 ? 0 : 255,
      ]).flat(),
    ),
  };
  const authorityAlpha = new Uint8Array([
    0,
    0,
    0,
    0,
    0,
    128,
    255,
    0,
    0,
    255,
    64,
    0,
    0,
    0,
    0,
    0,
  ]);
  const result = clampDecodedMaterialToAuthority({
    material,
    sourceBounds: { left: 1, top: 1, width: 2, height: 2 },
    authority: {
      width: 4,
      height: 4,
      alpha: authorityAlpha,
      bounds: { left: 1, top: 1, width: 2, height: 2 },
    },
  });

  assertEquals(result.alpha, authorityAlpha);
  assertEquals(result.qa, {
    geometryLocked: true,
    minIoU: 1,
    mismatchedPixels: 0,
  });
  assertEquals(result.rgba[3], 0);
  assertEquals(result.rgba[(1 * 4 + 1) * 4 + 3], 128);
});

Deno.test("candidate paths are content-addressed and preserve filename only as metadata", () => {
  const paths = buildCandidateStoragePaths({
    organizationId: "org-1",
    familyKey: "CYL-9ML",
    candidateId: "candidate-1",
    sourceSha256: "a".repeat(64),
  });
  assertEquals(paths.raw, `org-1/CYL-9ML/raw/${"a".repeat(64)}`);
  assertEquals(paths.candidate, "org-1/CYL-9ML/candidates/candidate-1.png");
  assertEquals(paths.layer, "org-1/CYL-9ML/layers/candidate-1.png");
  assertEquals(paths.review, "org-1/CYL-9ML/review/candidate-1.png");
});

Deno.test("manual intake does not invoke a provider and invalid filenames fail before queueing", () => {
  assertEquals(
    buildProviderPlan({ provider: "manual", model: "manual-v1" })
      .invokeProvider,
    false,
  );
  assertEquals(
    buildProviderPlan({ provider: "openai", model: "gpt-image-2" })
      .invokeProvider,
    true,
  );
  assertEquals(
    validateOriginalFilename("physical-cap.png"),
    "physical-cap.png",
  );
  assertThrows(
    () => validateOriginalFilename("library/path/physical-cap.png"),
    Error,
    "path separators",
  );
});
