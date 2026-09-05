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
  let org = body.organizationId ?? body.organization_id;
  // Some established flows send the resource ID instead of an organization ID.
  for (
    const [field, table] of [["masterContentId", "master_content"], [
      "documentId",
      "brand_documents",
    ], ["assetId", "dam_assets"]] as const
  ) {
    if (body[field]) {
      const { data: resource, error: resourceError } = await scoped.from(table)
        .select("organization_id").eq("id", body[field]).maybeSingle();
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
    return { admin, organizationId: org, role: "service" };
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
export function withWritingAi(handler: (req: Request) => Promise<Response>) {
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
      const { admin, organizationId } = await authorizeWritingRequest(
        req,
        body,
        true,
      );
      const settings = await loadWritingSettings(admin, organizationId);
      const connection = await resolveWritingConnection(
        admin,
        organizationId,
        settings,
      );
      return await writingAiContext.run(connection, () => handler(req));
    } catch (error) {
      return writingJson({
        error: error instanceof WritingHttpError
          ? error.message
          : "Writing AI could not be initialized. Please retry.",
      }, error instanceof WritingHttpError ? error.status : 500);
    }
  };
}
