import assert from "node:assert/strict";
import {
  authorizeWritingRequest,
  loadWritingSettings,
  resolveWritingConnection,
} from "./writingAiEdge.ts";
Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "server-only-key");
Deno.env.set("SUPABASE_ANON_KEY", "public-key");
const request = (token = "user-token") =>
  new Request("https://example.test", {
    headers: { Authorization: `Bearer ${token}` },
  });
function clientFor(
  member: unknown,
  resource: unknown = null,
  authUser: unknown = { id: "user-a" },
) {
  const filters: Array<[string, unknown]> = [];
  const tables: string[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: authUser }, error: null }) },
    from: (table: string) => {
      tables.push(table);
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        maybeSingle: async () => ({
          data: table === "organization_members" ? member : resource,
          error: null,
        }),
      };
      return query;
    },
  };
  return { factory: (() => client) as any, filters, tables };
}
Deno.test("anonymous and expired sessions cannot resolve writing credentials", async () => {
  await assert.rejects(
    authorizeWritingRequest(new Request("https://example.test"), {}),
    /Sign in/,
  );
  const { factory } = clientFor(null, null, null);
  await assert.rejects(
    authorizeWritingRequest(request(), {}, false, factory),
    /expired/,
  );
});
Deno.test("organization access is checked against authenticated user, not request user fields", async () => {
  const { factory, filters } = clientFor({
    organization_id: "org-a",
    role: "member",
  });
  const auth = await authorizeWritingRequest(
    request(),
    { organizationId: "org-a", userId: "user-b" },
    false,
    factory,
  );
  assert.equal(auth.role, "member");
  assert.ok(filters.some(([k, v]) => k === "user_id" && v === "user-a"));
  assert.ok(filters.some(([k, v]) => k === "organization_id" && v === "org-a"));
});
Deno.test("cross-organization requests fail when no membership matches", async () => {
  const { factory } = clientFor(null);
  await assert.rejects(
    authorizeWritingRequest(
      request(),
      { organizationId: "org-b" },
      false,
      factory,
    ),
    /belong to/,
  );
});
Deno.test("resource organization must match any explicit organization", async () => {
  const { factory } = clientFor({ organization_id: "org-a" }, {
    organization_id: "org-b",
  });
  await assert.rejects(
    authorizeWritingRequest(
      request(),
      { organizationId: "org-a", masterContentId: "content-b" },
      false,
      factory,
    ),
    /different organization/,
  );
});
Deno.test("inaccessible document fails before settings or secrets are loaded", async () => {
  const { factory } = clientFor({ organization_id: "org-a" }, null);
  await assert.rejects(
    authorizeWritingRequest(
      request(),
      { documentId: "private-doc" },
      false,
      factory,
    ),
    /access to this content/,
  );
});
Deno.test("background service requests require explicit organization scope", async () => {
  const { factory } = clientFor(null);
  await assert.rejects(
    authorizeWritingRequest(request("server-only-key"), {}, true, factory),
    /organization is required/,
  );
  const auth = await authorizeWritingRequest(
    request("server-only-key"),
    { organizationId: "org-a" },
    true,
    factory,
  );
  assert.equal(auth.organizationId, "org-a");
});
Deno.test("missing settings migration fails closed instead of changing provider silently", async () => {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ error: { code: "42P01" } }),
  };
  await assert.rejects(
    loadWritingSettings({ from: () => query }, "org-a"),
    /not available yet/,
  );
});
Deno.test("missing custom key never falls back to the managed paid key", async () => {
  Deno.env.set("OPENAI_API_KEY", "managed-key-must-not-be-used");
  try {
    await assert.rejects(
      resolveWritingConnection({ rpc: async () => ({ data: null }) }, "org-a", {
        provider: "openai",
        model: "gpt-5-mini",
        keySource: "custom",
      }),
      /not connected/,
    );
  } finally {
    Deno.env.delete("OPENAI_API_KEY");
  }
});

Deno.test("worksheet authorization rejects foreign upload rows and mismatched storage paths", async () => {
  const foreign = clientFor({ organization_id: "org-a" }, {
    organization_id: "org-b",
    file_url: "org-b/private.pdf",
  });
  await assert.rejects(
    authorizeWritingRequest(
      request(),
      {
        organizationId: "org-a",
        uploadId: "foreign-upload",
        fileUrl: "org-b/private.pdf",
      },
      false,
      foreign.factory,
      "worksheet",
    ),
    /different organization/,
  );
  const local = clientFor({ organization_id: "org-a" }, {
    organization_id: "org-a",
    file_url: "org-a/own.pdf",
  });
  await assert.rejects(
    authorizeWritingRequest(
      request(),
      {
        organizationId: "org-a",
        uploadId: "own-upload",
        fileUrl: "org-b/private.pdf",
      },
      false,
      local.factory,
      "worksheet",
    ),
    /does not match/,
  );
  const inaccessible = clientFor({ organization_id: "org-a" }, null);
  await assert.rejects(
    authorizeWritingRequest(
      request(),
      { organizationId: "org-a", uploadId: "restricted-upload" },
      false,
      inaccessible.factory,
      "worksheet",
    ),
    /access to this content/,
  );
});
Deno.test("worksheet authorized row supplies the canonical file and organization", async () => {
  const local = clientFor({ organization_id: "org-a", role: "owner" }, {
    organization_id: "org-a",
    file_url: "org-a/own.pdf",
    file_name: "own.pdf",
  });
  const auth = await authorizeWritingRequest(
    request(),
    { uploadId: "own-upload", fileUrl: "org-a/own.pdf" },
    false,
    local.factory,
    "worksheet",
  );
  assert.equal(auth.organizationId, "org-a");
  assert.equal(auth.resources.uploadId.file_url, "org-a/own.pdf");
  assert.ok(local.tables.includes("worksheet_uploads"));
});

Deno.test("editable worksheet rows cannot point to another organization's storage", async () => {
  for (
    const file_url of [
      "org-b/private.pdf",
      "org-a/../org-b/private.pdf",
      "org-a/%2e%2e/org-b/private.pdf",
      "org-a/%2fprivate.pdf",
    ]
  ) {
    const local = clientFor({ organization_id: "org-a", role: "owner" }, {
      organization_id: "org-a",
      file_url,
    });
    await assert.rejects(
      authorizeWritingRequest(
        request(),
        { organizationId: "org-a", uploadId: "own-upload", fileUrl: file_url },
        false,
        local.factory,
        "worksheet",
      ),
      /different organization/,
    );
  }
});
Deno.test("brand consistency authorizes master and derivative IDs and rejects foreign resources", async () => {
  for (
    const [contentType, table] of [["master", "master_content"], [
      "derivative",
      "derivative_assets",
    ]]
  ) {
    const local = clientFor({ organization_id: "org-a", role: "member" }, {
      organization_id: "org-a",
    });
    const auth = await authorizeWritingRequest(
      request(),
      { organizationId: "org-a", contentId: "own-content", contentType },
      false,
      local.factory,
      "brand-consistency",
    );
    assert.equal(auth.organizationId, "org-a");
    assert.ok(local.tables.includes(table));
    const foreign = clientFor({ organization_id: "org-a" }, {
      organization_id: "org-b",
    });
    await assert.rejects(
      authorizeWritingRequest(
        request(),
        { organizationId: "org-a", contentId: "foreign-content", contentType },
        false,
        foreign.factory,
        "brand-consistency",
      ),
      /different organization/,
    );
  }
  const local = clientFor({ organization_id: "org-a" }, {
    organization_id: "org-a",
  });
  await assert.rejects(
    authorizeWritingRequest(
      request(),
      {
        organizationId: "org-a",
        contentId: "own-content",
        contentType: "organizations",
      },
      false,
      local.factory,
      "brand-consistency",
    ),
    /master or derivative/,
  );
});
Deno.test("organization inference and aliases resolve one verified scope; conflicting aliases fail", async () => {
  for (const body of [{}, { organization_id: "org-a" }]) {
    const local = clientFor({ organization_id: "org-a", role: "member" });
    const auth = await authorizeWritingRequest(
      request(),
      body,
      false,
      local.factory,
    );
    assert.equal(auth.organizationId, "org-a");
  }
  const local = clientFor({ organization_id: "org-a" });
  await assert.rejects(
    authorizeWritingRequest(
      request(),
      { organizationId: "org-a", organization_id: "org-b" },
      false,
      local.factory,
    ),
    /matching organization/,
  );
});

Deno.test("writing content metadata is not interpreted as a brand-analysis resource", async () => {
  const local = clientFor({ organization_id: "org-a", role: "member" });
  const auth = await authorizeWritingRequest(
    request(),
    {
      organizationId: "org-a",
      contentId: "draft",
      contentType: "blog_article",
    },
    false,
    local.factory,
  );
  assert.equal(auth.organizationId, "org-a");
  assert.deepEqual(local.tables, ["organization_members"]);
});
