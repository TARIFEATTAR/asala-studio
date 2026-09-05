import assert from "node:assert/strict";
import { createWritingSettingsHandler } from "../writing-ai-settings/handler.ts";
const settings = {
  provider: "openai" as const,
  model: "gpt-5-mini",
  keySource: "managed" as const,
};
function setup(role = "owner") {
  const calls: Array<{ method: string; args: unknown }> = [];
  const admin = {
    rpc: async (method: string, args: unknown) => {
      calls.push({ method, args });
      return {
        data: method === "writing_ai_key_status"
          ? [{ provider: "openai" }]
          : null,
        error: null,
      };
    },
  };
  const handler = createWritingSettingsHandler({
    authorizeWritingRequest: async () => ({
      role,
      admin,
      organizationId: "org-a",
    }),
    loadWritingSettings: async () => settings,
    managedWritingKey: () => "a-secret-that-must-never-be-returned",
    resolveWritingConnection: async (
      _admin: unknown,
      _org: string,
      value: typeof settings,
    ) => ({ ...value, apiKey: "secret" }),
    generateWriting: async () => ({
      text: "Connected",
      finishReason: "STOP",
      provider: "openai",
      model: "gpt-5-mini",
    }),
  } as any);
  const send = (body: unknown) =>
    handler(
      new Request("https://example.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  return { send, calls };
}
Deno.test("settings metadata returns connection booleans, never saved or managed keys", async () => {
  const { send } = setup();
  const response = await send({ action: "get" });
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.ok(!text.includes("secret"));
  assert.ok(!text.includes("apiKey"));
  assert.equal(JSON.parse(text).connections.openai.custom, true);
});
Deno.test("members can view selection but cannot change keys, models or trigger tests", async () => {
  const { send, calls } = setup("member");
  assert.equal((await (await send({ action: "get" })).json()).canEdit, false);
  for (const action of ["save", "test"]) {
    assert.equal((await send({ action, settings })).status, 403);
  }
  assert.ok(calls.every((c) => c.method === "writing_ai_key_status"));
});
Deno.test("saving a replacement key is scoped to verified organization and never echoed", async () => {
  const { send, calls } = setup();
  const response = await send({
    action: "save",
    organizationId: "untrusted-org",
    settings: { ...settings, keySource: "custom" },
    apiKey: "new-private-key-value",
  });
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes("new-private-key-value"));
  assert.equal((calls[0].args as any).p_organization_id, "org-a");
  assert.equal((calls[0].args as any).p_api_key, "new-private-key-value");
});
Deno.test("blank replacement preserves stored key", async () => {
  const { send, calls } = setup();
  assert.equal(
    (await send({
      action: "save",
      settings: { ...settings, keySource: "custom" },
      apiKey: "",
    })).status,
    200,
  );
  assert.equal((calls[0].args as any).p_api_key, null);
});
Deno.test("managed connection cannot accidentally store a pasted custom key", async () => {
  const { send, calls } = setup();
  assert.equal(
    (await send({ action: "save", settings, apiKey: "private-key-value" }))
      .status,
    400,
  );
  assert.equal(calls.length, 0);
});
Deno.test("connection testing does not save settings", async () => {
  const { send, calls } = setup();
  assert.equal((await send({ action: "test", settings })).status, 200);
  assert.equal(calls.length, 0);
});
