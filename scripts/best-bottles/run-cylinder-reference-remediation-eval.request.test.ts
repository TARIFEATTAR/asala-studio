import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

describe("Cylinder remediation OpenAI request contract", () => {
  it("does not send the unsupported input_fidelity field to gpt-image-2", () => {
    const source = readFileSync(
      path.resolve("scripts/best-bottles/run-cylinder-reference-remediation-eval.ts"),
      "utf8",
    );
    assert.match(source, /const OPENAI_MODEL = "gpt-image-2"/);
    assert.doesNotMatch(source, /form\.append\("input_fidelity"/);
  });
});
