import assert from "node:assert/strict";
import test from "node:test";

import { buildComponentMaterialPrompt } from "./componentMaterialPrompt";

test("material prompts constrain GPT to surface pixels without claiming generated geometry is locked", () => {
  const prompt = buildComponentMaterialPrompt({
    componentLabel: "17-415 roll-on over-cap",
    materialClass: "mirror",
    physicalSubstrate: "molded phenolic plastic",
    finishDescription: "vacuum-metallized champagne-gold coating with a high-gloss clear coat",
  });

  assert.match(prompt, /change surface pixels only/i);
  assert.match(prompt, /molded phenolic plastic/i);
  assert.match(prompt, /vacuum-metallized/i);
  assert.doesNotMatch(prompt, /reference.*geometry locked/i);
  assert.doesNotMatch(prompt, /solid (gold|metal)|machined|anodized|brushed aluminum/i);
});

test("rhinestone prompts preserve stable stone placement", () => {
  const prompt = buildComponentMaterialPrompt({
    componentLabel: "17-415 rhinestone roll-on over-cap",
    materialClass: "rhinestone",
    physicalSubstrate: "molded phenolic plastic",
    finishDescription: "glossy black coating with clear stones",
    rhinestoneIds: ["stone-top-left", "stone-top-right", "stone-lower-center"],
  });

  assert.match(prompt, /stone-top-left, stone-top-right, stone-lower-center/);
  assert.match(prompt, /do not add, remove, move, resize, or reorder/i);
});

test("translucent prompts require assembly-context review", () => {
  const prompt = buildComponentMaterialPrompt({
    componentLabel: "17-415 spray overcap",
    materialClass: "translucent",
    physicalSubstrate: "translucent molded plastic",
    finishDescription: "clear neutral protective overcap",
  });

  assert.match(prompt, /assembly-context review/i);
  assert.match(prompt, /do not flatten transparency/i);
});
