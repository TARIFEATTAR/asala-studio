import {
  ComponentSourceIntakeRequestSchema,
  ComponentSourceIntakeResultSchema,
  type ComponentSourceIntakeRequest,
} from "./componentSourceContract";

interface FunctionClient {
  functions: {
    invoke(name: string, options: { body: unknown }): Promise<{
      data: unknown;
      error: { message: string; context?: { json?: () => Promise<unknown> } } | null;
    }>;
  };
}

export async function registerPaperDollComponentSource(
  client: FunctionClient,
  request: ComponentSourceIntakeRequest,
) {
  const exact = ComponentSourceIntakeRequestSchema.parse(request);
  const { data, error } = await client.functions.invoke("register-paper-doll-component-source", { body: exact });
  if (error) {
    let message = error.message;
    try {
      const body = await error.context?.json?.();
      if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
        message = (body as { error: string }).error;
      }
    } catch { /* retain the SDK message */ }
    throw new Error(`Unable to register proposed component: ${message}`);
  }
  return ComponentSourceIntakeResultSchema.parse(data);
}

