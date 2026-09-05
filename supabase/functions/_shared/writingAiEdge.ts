import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import {
  DEFAULT_WRITING_SETTINGS,
  validateWritingSettings,
  type WritingProvider,
  type WritingSettings,
} from "./writingAiContract.ts";
import {
  writingAiContext,
  type WritingConnection,
} from "./writingAiContext.ts";
export const writingCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export class WritingHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
type WritingResource = {
  organization_id: string;
  file_url?: string;
  file_name?: string;
};
type WritingResourceScope = "worksheet" | "brand-consistency";
export function writingJson(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...writingCors, "Content-Type": "application/json" },
  });
}
export function managedWritingKey(provider: WritingProvider) {
  return Deno.env.get(
    {
      openai: "OPENAI_API_KEY",
      gemini: "GEMINI_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
    }[provider],
  )?.trim() ?? "";
}
export async function authorizeWritingRequest(
  req: Request,
  body: Record<string, unknown>,
  allowService = false,
  makeClient: typeof createClient = createClient,
  resourceScope?: WritingResourceScope,
) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new WritingHttpError(401, "Sign in to use Writing AI.");
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = makeClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const service = allowService && token === serviceKey;
  const { data, error } = service
    ? { data: { user: null }, error: null }
    : await admin.auth.getUser(token);
  if (!service && (error || !data.user)) {
    throw new WritingHttpError(401, "Your session expired. Sign in again.");
  }
  const scoped = service
    ? admin
    : makeClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
  if (
    body.organizationId && body.organization_id &&
    body.organizationId !== body.organization_id
  ) {
    throw new WritingHttpError(400, "Send one matching organization ID.");
  }
  let org = body.organizationId ?? body.organization_id;
  const resources: Record<string, WritingResource> = {};
  const resourceFields: Array<[string, string]> = [
    ["masterContentId", "master_content"],
    ["documentId", "brand_documents"],
    ["assetId", "dam_assets"],
  ];
  if (resourceScope === "worksheet") {
    resourceFields.push(["uploadId", "worksheet_uploads"]);
  }
  if (resourceScope === "brand-consistency" && body.contentId) {
    if (!["master", "derivative"].includes(body.contentType as string)) {
      throw new WritingHttpError(400, "Choose master or derivative content.");
    }
    resourceFields.push([
      "contentId",
      body.contentType === "master" ? "master_content" : "derivative_assets",
    ]);
  }
  // Some established flows send the resource ID instead of an organization ID.
  for (const [field, table] of resourceFields) {
    if (body[field]) {
      const { data: resourceData, error: resourceError } = await scoped.from(
        table,
      )
        .select(
          field === "uploadId"
            ? "organization_id, file_url, file_name"
            : "organization_id",
        )
        .eq("id", body[field]).maybeSingle();
      const resource = resourceData as unknown as WritingResource | null;
      if (resourceError || !resource) {
        throw new WritingHttpError(
          403,
          "You do not have access to this content.",
        );
      }
      if (org && org !== resource.organization_id) {
        throw new WritingHttpError(
          403,
          "The content belongs to a different organization.",
        );
      }
      if (field === "uploadId") {
        // The row itself can be edited by organization admins. Its storage path
        // must also remain inside that organization's folder before a server read.
        const path = resource.file_url;
        if (
          !path?.startsWith(`${resource.organization_id}/`) ||
          /\\|%2f|%5c/i.test(path) ||
          path.split("/").some((part) => /^(?:\.|%2e){1,2}$/i.test(part))
        ) {
          throw new WritingHttpError(
            403,
            "The worksheet file belongs to a different organization.",
          );
        }
      }
      if (
        field === "uploadId" && body.fileUrl &&
        body.fileUrl !== resource.file_url
      ) {
        throw new WritingHttpError(
          403,
          "The worksheet file does not match this upload.",
        );
      }
      resources[field] = resource;
      org = resource.organization_id;
    }
  }
  if (service) {
    if (typeof org !== "string") {
      throw new WritingHttpError(
        400,
        "An organization is required for background writing.",
      );
    }
    return { admin, organizationId: org, role: "service", resources };
  }
  let query = admin.from("organization_members").select("organization_id, role")
    .eq("user_id", data.user!.id);
  if (org) query = query.eq("organization_id", org);
  const { data: member, error: memberError } = await query.maybeSingle();
  if (memberError || !member) {
    throw new WritingHttpError(403, "Choose an organization you belong to.");
  }
  return {
    admin,
    organizationId: member.organization_id as string,
    role: member.role as string,
    resources,
  };
}
export async function loadWritingSettings(
  admin: any,
  organizationId: string,
): Promise<WritingSettings> {
  const { data, error } = await admin.from("writing_ai_settings").select(
    "provider, model, key_source",
  ).eq("organization_id", organizationId).maybeSingle();
  if (error) {
    throw new WritingHttpError(
      503,
      "Writing AI settings are not available yet. Please contact your administrator.",
    );
  }
  return data
    ? validateWritingSettings({ ...data, keySource: data.key_source })
    : { ...DEFAULT_WRITING_SETTINGS };
}
export async function resolveWritingConnection(
  admin: any,
  organizationId: string,
  settings: WritingSettings,
): Promise<WritingConnection> {
  let apiKey = managedWritingKey(settings.provider);
  if (settings.keySource === "custom") {
    const { data, error } = await admin.rpc("read_writing_ai_key", {
      p_organization_id: organizationId,
      p_provider: settings.provider,
    });
    if (error) {
      throw new WritingHttpError(
        503,
        "The saved Writing AI connection could not be loaded.",
      );
    }
    apiKey = data ?? "";
  }
  if (!apiKey) {
    throw new WritingHttpError(
      400,
      "This provider is not connected. Open Settings → Writing AI to add its key.",
    );
  }
  return { ...settings, apiKey };
}
export function withWritingAi(
  handler: (
    req: Request,
    authorization: Awaited<ReturnType<typeof authorizeWritingRequest>>,
  ) => Promise<Response>,
  resourceScope?: WritingResourceScope,
) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: writingCors });
    }
    if (req.method !== "POST") {
      return writingJson({ error: "Use POST for Writing AI." }, 405);
    }
    try {
      let body: Record<string, unknown>;
      try {
        if (
          req.headers.get("Content-Type")?.startsWith("multipart/form-data")
        ) {
          const form = await req.clone().formData();
          body = { organizationId: form.get("organizationId") };
        } else body = await req.clone().json();
      } catch {
        throw new WritingHttpError(400, "Send a valid JSON request.");
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new WritingHttpError(400, "Send a JSON object.");
      }
      const authorization = await authorizeWritingRequest(
        req,
        body,
        true,
        createClient,
        resourceScope,
      );
      const { admin, organizationId } = authorization;
      const settings = await loadWritingSettings(admin, organizationId);
      const connection = await resolveWritingConnection(
        admin,
        organizationId,
        settings,
      );
      return await writingAiContext.run(
        connection,
        () => handler(req, authorization),
      );
    } catch (error) {
      return writingJson({
        error: error instanceof WritingHttpError
          ? error.message
          : "Writing AI could not be initialized. Please retry.",
      }, error instanceof WritingHttpError ? error.status : 500);
    }
  };
}
