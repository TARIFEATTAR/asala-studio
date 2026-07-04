import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applySmokePromptAddendum,
  getSmokePromptAddendum,
} from "./smoke-prompt-addendums";

describe("Best Bottles smoke prompt addendums", () => {
  it("returns no addendum when no smoke addendum id is supplied", () => {
    assert.equal(getSmokePromptAddendum(undefined), null);
    assert.equal(getSmokePromptAddendum(""), null);
  });

  it("defines the clear glass polish addendum as material-only and geometry-safe", () => {
    const addendum = getSmokePromptAddendum("clear-glass-polish-v1");

    assert.equal(addendum?.id, "clear-glass-polish-v1");
    assert.match(addendum?.text ?? "", /clear transparent glass/i);
    assert.match(addendum?.text ?? "", /do not change geometry/i);
    assert.match(addendum?.text ?? "", /do not create literal/i);
    assert.match(addendum?.text ?? "", /no fog/i);
    assert.match(addendum?.text ?? "", /no liquid/i);
  });

  it("retires the Kinfolk/Aesop v1 studio direction because it is too loose for production", () => {
    assert.throws(
      () => getSmokePromptAddendum("kinfolk-aesop-studio-v1"),
      /Retired Best Bottles smoke prompt addendum: kinfolk-aesop-studio-v1/,
    );
  });

  it("defines the Kinfolk/Aesop v2 studio direction without loosening the catalog contract", () => {
    const addendum = getSmokePromptAddendum("kinfolk-aesop-studio-v2");
    const text = addendum?.text ?? "";

    assert.equal(addendum?.id, "kinfolk-aesop-studio-v2");
    assert.match(text, /Kinfolk/);
    assert.match(text, /Aesop/);
    assert.match(text, /mood reference/i);
    assert.match(text, /fill-height target/i);
    assert.match(text, /shared baseline/i);
    assert.match(text, /centerline/i);
    assert.match(text, /contact-only/i);
    assert.match(text, /Do not add props/i);
    assert.doesNotMatch(text, /negative space/i);
    assert.doesNotMatch(text, /editorial/i);
  });

  it("appends the addendum under an explicit test-only section", () => {
    const addendum = getSmokePromptAddendum("clear-glass-polish-v1");
    const prompt = applySmokePromptAddendum("CANON PROMPT", addendum);

    assert.match(prompt, /^CANON PROMPT\n\nTEST-ONLY MATERIAL POLISH ADDENDUM/);
    assert.match(prompt, /clear-glass-polish-v1/);
    assert.match(prompt, /CANON PROMPT/);
  });

  it("rejects unknown smoke addendum ids", () => {
    assert.throws(
      () => getSmokePromptAddendum("unknown-addendum"),
      /Unknown Best Bottles smoke prompt addendum/,
    );
  });
});
