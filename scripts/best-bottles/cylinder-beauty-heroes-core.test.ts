import assert from "node:assert/strict";
import test from "node:test";

import {
  CYLINDER_BEAUTY_HEROES,
  buildClearMasterPrompt,
  buildGeminiImageRequest,
  buildVariantPrompt,
  extractGeminiImage,
  requiresExistingClearMaster,
} from "./cylinder-beauty-heroes-core";

test("registers the five approved Cylinder glass beauty heroes", () => {
  assert.deepEqual(
    CYLINDER_BEAUTY_HEROES.map((hero) => hero.glassKey),
    ["CLR", "AMB", "BLU", "FRS", "SWL"],
  );
  assert.equal(new Set(CYLINDER_BEAUTY_HEROES.map((hero) => hero.outputSlug)).size, 5);
});

test("builds a stable Nano Banana Pro 4K request with references before the prompt", () => {
  const request = buildGeminiImageRequest({
    prompt: "Create an empty glass bottle on sandstone.",
    references: [
      { mimeType: "image/png", data: "reference-one" },
      { mimeType: "image/jpeg", data: "reference-two" },
    ],
  });

  assert.equal(request.model, "gemini-3-pro-image");
  assert.deepEqual(request.body.generationConfig, {
    responseModalities: ["IMAGE"],
    imageConfig: { aspectRatio: "4:5", imageSize: "4K" },
  });
  assert.deepEqual(request.body.contents[0].parts.slice(0, 2), [
    { inlineData: { mimeType: "image/png", data: "reference-one" } },
    { inlineData: { mimeType: "image/jpeg", data: "reference-two" } },
  ]);
  assert.deepEqual(request.body.contents[0].parts.at(-1), {
    text: "Create an empty glass bottle on sandstone.",
  });
});

test("locks every material variant to an empty bottle and the approved sandstone session", () => {
  const prompt = buildVariantPrompt(CYLINDER_BEAUTY_HEROES[2]);

  assert.match(prompt, /EMPTY/i);
  assert.match(prompt, /no liquid/i);
  assert.match(prompt, /natural warm sandstone/i);
  assert.match(prompt, /matte-silver cap/i);
  assert.match(prompt, /2080 × 2288/i);
  assert.match(prompt, /Cobalt Blue/i);
});

test("locks the Clear calibration to the approved visual master and separate geometry truth", () => {
  const prompt = buildClearMasterPrompt();

  assert.match(prompt, /IMAGE 1 is the approved visual master/i);
  assert.match(prompt, /IMAGE 2 is geometry truth/i);
  assert.match(prompt, /IMAGE 3 is product truth/i);
  assert.match(prompt, /IMAGE 4 is sandstone material direction/i);
  assert.match(prompt, /do not elongate/i);
});

test("extracts the first inline image and rejects text-only responses", () => {
  assert.deepEqual(extractGeminiImage({
    candidates: [{ content: { parts: [{ text: "done" }, { inlineData: { mimeType: "image/png", data: "abc" } }] } }],
  }), { mimeType: "image/png", data: "abc" });

  assert.throws(
    () => extractGeminiImage({ candidates: [{ content: { parts: [{ text: "no image" }] } }] }),
    /no image/i,
  );
});

test("allows the complete sequential batch to create Clear before its variants", () => {
  assert.equal(requiresExistingClearMaster(["CLR", "AMB", "BLU", "FRS", "SWL"]), false);
  assert.equal(requiresExistingClearMaster(["AMB"]), true);
  assert.equal(requiresExistingClearMaster(["CLR"]), false);
});
