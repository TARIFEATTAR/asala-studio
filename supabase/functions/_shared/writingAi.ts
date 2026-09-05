import { getWritingConnection } from "./writingAiContext.ts";
export type WritingMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
      { type: "text"; text: string } | {
        type: "image_url";
        image_url: { url: string };
      } | { type: "file"; filename: string; data: string }
    >;
};
export type WritingOptions = {
  messages: WritingMessage[];
  systemPrompt?: string;
  maxOutputTokens?: number;
  temperature?: number;
  responseMimeType?: string;
  thinkingBudget?: number;
};
export type WritingResult = {
  text: string;
  finishReason: string;
  provider: string;
  model: string;
};

export async function generateWriting(
  options: WritingOptions,
  connection = getWritingConnection(),
  request = fetch,
): Promise<WritingResult> {
  const { provider, model, apiKey } = connection;
  if (!apiKey) {
    throw new Error("Writing AI is not connected. Open Settings → Writing AI.");
  }
  const maxTokens = Math.min(
    Math.max(options.maxOutputTokens ?? 4096, 128),
    32768,
  );
  const system = [
    options.systemPrompt,
    ...options.messages.filter((m) => m.role === "system").map((m) =>
      typeof m.content === "string"
        ? m.content
        : m.content.filter((p) => p.type === "text").map((p) => p.text).join(
          "\n",
        )
    ),
  ].filter(Boolean).join("\n\n");
  const messages = options.messages.filter((m) => m.role !== "system");
  let url: string;
  let body: Record<string, unknown>;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (provider === "openai") {
    url = "https://api.openai.com/v1/responses";
    headers.Authorization = `Bearer ${apiKey}`;
    const reasoning = /^(gpt-5|gpt-6|o[1-9])/.test(model);
    body = {
      model,
      store: false,
      instructions: system,
      // Reserve room for reasoning in addition to the existing visible-output budget.
      max_output_tokens: reasoning
        ? Math.min(maxTokens + 1024, 32768)
        : maxTokens,
      input: messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string"
          ? m.content
          : m.content.map((p) =>
            p.type === "text"
              ? {
                type: m.role === "assistant" ? "output_text" : "input_text",
                text: p.text,
              }
              : p.type === "file"
              ? { type: "input_file", filename: p.filename, file_data: p.data }
              : { type: "input_image", image_url: p.image_url.url }
          ),
      })),
      ...(reasoning
        ? { reasoning: { effort: "low" } }
        : { temperature: options.temperature ?? 0.7 }),
      ...(options.responseMimeType === "application/json"
        ? { text: { format: { type: "json_object" } } }
        : {}),
    };
  } else if (provider === "gemini") {
    url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    headers["x-goog-api-key"] = apiKey;
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: typeof m.content === "string"
          ? [{ text: m.content }]
          : m.content.map((p) => {
            if (p.type === "text") return { text: p.text };
            const match = (p.type === "file" ? p.data : p.image_url.url).match(
              /^data:([^;]+);base64,(.+)$/s,
            );
            if (!match) {
              throw new Error(
                "This Gemini writing request requires an attached image, rather than an image URL.",
              );
            }
            return { inlineData: { mimeType: match[1], data: match[2] } };
          }),
      })),
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: options.temperature ?? 0.7,
        ...(options.responseMimeType
          ? { responseMimeType: options.responseMimeType }
          : {}),
        ...(options.thinkingBudget !== undefined &&
            model.startsWith("gemini-2.5")
          ? { thinkingConfig: { thinkingBudget: options.thinkingBudget } }
          : {}),
      },
    };
  } else {
    if (
      messages.some((m) =>
        Array.isArray(m.content) && m.content.some((p) => p.type === "file")
      )
    ) {
      throw new Error(
        "PDF scans require an OpenAI or Gemini writing model. Free text generation remains available with OpenRouter.",
      );
    }
    if (model !== "openrouter/free" && !model.endsWith(":free")) {
      throw new Error("Only free OpenRouter models are supported.");
    }
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers.Authorization = `Bearer ${apiKey}`;
    body = {
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: maxTokens,
      temperature: options.temperature ?? 0.7,
      provider: { max_price: { prompt: 0, completion: 0 } },
      ...(options.responseMimeType === "application/json"
        ? { response_format: { type: "json_object" } }
        : {}),
    };
  }
  let response: Response;
  let data: any;
  try {
    response = await request(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    if (!response.ok) {
      // Do not expose provider payloads: they may echo prompts or credentials.
      await response.body?.cancel();
      if (response.status === 429) {
        throw new Error(
          `${provider} usage limit reached. Try later or change Writing AI settings. No other provider was charged.`,
        );
      }
      if ([401, 403].includes(response.status)) {
        throw new Error(
          `${provider} rejected this key or model access. Check Writing AI settings.`,
        );
      }
      if (response.status === 402) {
        throw new Error(
          `${provider} requires available API credit. Check Writing AI settings.`,
        );
      }
      throw new Error(
        `${provider} request failed (${response.status}). Check the selected model in Writing AI settings.`,
      );
    }
    try {
      data = await response.json();
    } catch {
      throw new Error("Writing AI returned an invalid response. Please retry.");
    }
  } catch (error) {
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    ) throw new Error("Writing AI timed out. Please retry.");
    if (error instanceof TypeError) {
      throw new Error("Writing AI could not connect. Please retry.");
    }
    throw error;
  }
  let text = "";
  let finishReason = "STOP";
  if (provider === "openai") {
    if (data.status === "failed" || data.error) {
      throw new Error("OpenAI could not complete this writing request.");
    }
    text = (data.output ?? []).filter((item: any) => item.type === "message")
      .flatMap((item: any) => item.content ?? []).filter((part: any) =>
        part.type === "output_text"
      ).map((part: any) => part.text).join("\n");
    if (data.status === "incomplete") {
      finishReason = data.incomplete_details?.reason === "max_output_tokens"
        ? "MAX_TOKENS"
        : "INCOMPLETE";
    }
  } else if (provider === "gemini") {
    const candidate = data.candidates?.[0];
    text = (candidate?.content?.parts ?? []).filter((p: any) =>
      p.text && !p.thought
    ).map((p: any) => p.text).join("\n");
    finishReason = candidate?.finishReason ?? "UNKNOWN";
  } else {
    if (data.error) {
      throw new Error("The free model is unavailable. Try again later.");
    }
    text = data.choices?.[0]?.message?.content ?? "";
    finishReason = data.choices?.[0]?.finish_reason === "length"
      ? "MAX_TOKENS"
      : data.choices?.[0]?.finish_reason === "stop"
      ? "STOP"
      : "INCOMPLETE";
  }
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(
      "Writing AI returned no usable text. Try another model or a larger output budget.",
    );
  }
  if (!["STOP", "MAX_TOKENS"].includes(finishReason)) {
    throw new Error(
      "Writing AI could not complete the response. Please revise the request or choose another model.",
    );
  }
  return { text, finishReason, provider, model: data.model ?? model };
}
