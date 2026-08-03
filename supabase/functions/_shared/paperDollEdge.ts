// deno-lint-ignore-file no-import-prefix
import {
  createClient,
  type SupabaseClient,
  type User,
} from "https://esm.sh/@supabase/supabase-js@2.104.0";

import { actionErrorBody, PaperDollActionError } from "./paperDollLifecycle.ts";

export const paperDollCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
};

export interface PaperDollActionContext {
  user: User;
  service: SupabaseClient;
  organizationId: string;
}

function cleanSecret(value: string | undefined): string {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...paperDollCorsHeaders, "Content-Type": "application/json" },
  });
}

export function requireString(
  value: unknown,
  field: string,
  message = `${field} is required.`,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PaperDollActionError(422, "invalid_request", message, [
      { field, message },
    ]);
  }
  return value.trim();
}

export function requireRecord(
  value: unknown,
  field = "body",
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PaperDollActionError(
      422,
      "invalid_request",
      `${field} must be an object.`,
      [
        { field, message: `${field} must be an object.` },
      ],
    );
  }
  return value as Record<string, unknown>;
}

export function requireArray<T = unknown>(value: unknown, field: string): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PaperDollActionError(
      422,
      "invalid_request",
      `${field} must be a non-empty array.`,
      [
        { field, message: `${field} must be a non-empty array.` },
      ],
    );
  }
  return value as T[];
}

export async function sha256Hex(
  value: Uint8Array | string | unknown,
): Promise<string> {
  const source = value instanceof Uint8Array ? value : new TextEncoder().encode(
    typeof value === "string" ? value : stableJson(value),
  );
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
        .join(",")
    }}`;
  }
  return JSON.stringify(value);
}

export async function createPaperDollActionContext(
  request: Request,
  organizationId: string,
): Promise<PaperDollActionContext> {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    throw new PaperDollActionError(
      403,
      "authentication_required",
      "Authenticated user is required.",
      [
        { field: "authorization", message: "Bearer token is required." },
      ],
    );
  }
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = cleanSecret(Deno.env.get("SUPABASE_URL"));
  const anonKey = cleanSecret(Deno.env.get("SUPABASE_ANON_KEY"));
  const serviceRoleKey = cleanSecret(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Paper-doll action service is not configured.");
  }

  const auth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await auth.auth.getUser(token);
  if (userError || !user) {
    throw new PaperDollActionError(
      403,
      "authentication_required",
      "Authenticated user is required.",
      [
        {
          field: "authorization",
          message: "Bearer token is invalid or expired.",
        },
      ],
    );
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: member, error: memberError } = await service
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError) {
    throw new Error(
      `Organization membership lookup failed: ${memberError.message}`,
    );
  }
  if (!member) {
    throw new PaperDollActionError(
      403,
      "organization_forbidden",
      "Organization membership is required.",
      [
        {
          field: "organizationId",
          message: "User is not a member of this organization.",
        },
      ],
    );
  }
  return { user, service, organizationId };
}

export async function runPaperDollAction(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: paperDollCorsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, {
      code: "method_not_allowed",
      message: "POST is required.",
      issues: [{ field: "method", message: "POST is required." }],
    });
  }
  try {
    return await handler();
  } catch (error) {
    if (!(error instanceof PaperDollActionError)) {
      console.error("[paper-doll action]", error);
    }
    const normalized = actionErrorBody(error);
    return jsonResponse(normalized.status, normalized.body);
  }
}

export function databaseError(
  error: { message: string; code?: string } | null,
  message: string,
  status: 409 | 422 = 409,
): never {
  throw new PaperDollActionError(status, "ledger_conflict", message, [
    { field: "ledger", message: error?.message ?? message },
  ]);
}
