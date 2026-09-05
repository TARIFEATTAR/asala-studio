import assert from "node:assert/strict";
import { authorizeWritingRequest } from "./writingAiEdge.ts";
import { createCompetitiveIntelligenceHandler } from "../competitive-intelligence/handler.ts";

Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "server-only-key");
Deno.env.set("SUPABASE_ANON_KEY", "public-key");

Deno.test("competitive scans stay within the verified organization for omitted, aliased and service request bodies", async () => {
  for (
    const [body, token] of [
      [{}, "user-token"],
      [{ organization_id: "org-a" }, "user-token"],
      [{ organizationId: "org-a" }, "server-only-key"],
    ] as const
  ) {
    const filters: Array<[string, unknown]> = [];
    const memberships = {
      select: () => memberships,
      eq: () => memberships,
      maybeSingle: async () => ({
        data: { organization_id: "org-a", role: "member" },
        error: null,
      }),
    };
    const authClient = {
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-a" } },
          error: null,
        }),
      },
      from: () => memberships,
    };
    const req = new Request("https://example.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const authorization = await authorizeWritingRequest(
      req,
      body,
      true,
      (() => authClient) as any,
    );
    const query = {
      select: () => query,
      eq: (field: string, value: unknown) => {
        filters.push([field, value]);
        return query;
      },
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: [], error: null }),
    };
    const handler = createCompetitiveIntelligenceHandler({
      createClient: (() => ({
        from: (table: string) => {
          assert.equal(table, "agent_preferences");
          return query;
        },
      })) as any,
      generateGeminiContent: async () => {
        throw new Error("An empty scan must not call a provider");
      },
      extractTextFromGeminiResponse: () => "",
    });
    const response = await handler(req, authorization);
    assert.equal(response.status, 200);
    assert.ok(
      filters.some(([field, value]) =>
        field === "organization_id" && value === "org-a"
      ),
    );
    assert.ok(
      filters.some(([field, value]) =>
        field === "competitive_intelligence_enabled" && value === true
      ),
    );
    assert.deepEqual((await response.json()).results, []);
  }
});
