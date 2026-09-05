import {
  validateWritingSettings,
  WRITING_PROVIDERS,
} from "../_shared/writingAiContract.ts";
import {
  authorizeWritingRequest,
  loadWritingSettings,
  managedWritingKey,
  resolveWritingConnection,
  writingCors,
  WritingHttpError,
  writingJson,
} from "../_shared/writingAiEdge.ts";
import { generateWriting } from "../_shared/writingAi.ts";

const defaultDependencies = {
  authorizeWritingRequest,
  loadWritingSettings,
  managedWritingKey,
  resolveWritingConnection,
  generateWriting,
};
export function createWritingSettingsHandler(
  dependencies = defaultDependencies,
) {
  const {
    authorizeWritingRequest,
    loadWritingSettings,
    managedWritingKey,
    resolveWritingConnection,
    generateWriting,
  } = dependencies;
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: writingCors });
    }
    if (req.method !== "POST") {
      return writingJson({ error: "Method not allowed." }, 405);
    }
    try {
      const body = await req.json();
      const { admin, organizationId, role } = await authorizeWritingRequest(
        req,
        body,
      );
      const canEdit = ["owner", "admin"].includes(role);
      if (body.action !== "get" && !canEdit) {
        throw new WritingHttpError(
          403,
          "Only organization owners and admins can change Writing AI.",
        );
      }
      if (body.action === "get") {
        const settings = await loadWritingSettings(admin, organizationId);
        const { data, error } = await admin.rpc("writing_ai_key_status", {
          p_organization_id: organizationId,
        });
        if (error) {
          throw new WritingHttpError(
            503,
            "Writing AI connections are not available yet.",
          );
        }
        return writingJson({
          settings,
          canEdit,
          connections: Object.fromEntries(
            WRITING_PROVIDERS.map(
              (provider) => [provider, {
                managed: !!managedWritingKey(provider),
                custom: (data ?? []).some((k: { provider: string }) =>
                  k.provider === provider
                ),
              }],
            ),
          ),
        });
      }
      if (!["save", "test"].includes(body.action)) {
        throw new WritingHttpError(400, "Unknown settings action.");
      }
      let settings;
      try {
        settings = validateWritingSettings(body.settings);
      } catch (e) {
        throw new WritingHttpError(400, (e as Error).message);
      }
      const key = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
      if (key && (key.length < 10 || key.length > 4096 || /\s/.test(key))) {
        throw new WritingHttpError(400, "Enter a valid API key.");
      }
      if (key && settings.keySource !== "custom") {
        throw new WritingHttpError(
          400,
          "Choose your own key connection before adding a key.",
        );
      }
      const connection = key
        ? { ...settings, apiKey: key }
        : await resolveWritingConnection(admin, organizationId, settings);
      if (body.action === "test") {
        try {
          const result = await generateWriting({
            messages: [{
              role: "user",
              content: "Reply with the word Connected.",
            }],
            maxOutputTokens: 1024,
          }, connection);
          return writingJson({
            ok: true,
            provider: result.provider,
            model: result.model,
          });
        } catch (e) {
          throw new WritingHttpError(400, (e as Error).message);
        }
      }
      const { error } = await admin.rpc("save_writing_ai_settings", {
        p_organization_id: organizationId,
        p_provider: settings.provider,
        p_model: settings.model,
        p_key_source: settings.keySource,
        p_api_key: key || null,
      });
      if (error) {
        throw new WritingHttpError(
          500,
          "Writing AI settings could not be saved. Please retry.",
        );
      }
      return writingJson({ ok: true });
    } catch (e) {
      return writingJson({
        error: e instanceof WritingHttpError
          ? e.message
          : "Writing AI settings could not be loaded. Please retry.",
      }, e instanceof WritingHttpError ? e.status : 500);
    }
  };
}
