import { generateWriting } from "./writingAi.ts";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";


type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "file"; filename: string; data: string }
  | { type: "image_url"; image_url: { url: string } };

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenAIContentPart[];
};

interface GeminiRequestOptions {
  model?: string;
  systemPrompt?: string;
  messages: OpenAIMessage[];
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  safetySettings?: Record<string, unknown>[];
  // Gemini 2.5+ thinking models reserve part of maxOutputTokens for internal
  // chain-of-thought. Pass 0 to disable thinking when the response should be
  // a direct, structured output (e.g. multi-part email sequences).
  thinkingBudget?: number;
}

interface GeminiTextOptions extends GeminiRequestOptions {
  chunkSize?: number;
}

function ensureGeminiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return key;
}

export function getGeminiApiKey(): string {
  return ensureGeminiKey();
}

function toArrayContent(content: OpenAIMessage["content"]): OpenAIContentPart[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (Array.isArray(content)) {
    return content;
  }
  return [];
}

function convertDataUrl(
  url: string,
): { mimeType: string; data: string } | null {
  if (!url.startsWith("data:")) return null;
  const commaIndex = url.indexOf(",");
  if (commaIndex === -1) return null;
  const meta = url.slice(5, commaIndex); // remove "data:"
  const data = url.slice(commaIndex + 1);
  const mimeType = meta.split(";")[0] || "application/octet-stream";
  return { mimeType, data };
}

function convertPart(part: OpenAIContentPart) {
  if (part.type === "text") {
    return { text: part.text };
  }
  if (part.type === "file") {
    const dataUrl = convertDataUrl(part.data);
    if (dataUrl) return { inlineData: dataUrl };
    throw new Error("Attach the file as a data URL.");
  }
  if (part.type === "image_url" && part.image_url?.url) {
    const dataUrl = convertDataUrl(part.image_url.url);
    if (dataUrl) {
      return {
        inlineData: {
          mimeType: dataUrl.mimeType,
          data: dataUrl.data,
        },
      };
    }
    // Remote URLs are not supported yet; fall back to textual reference
    return { text: `Image reference: ${part.image_url.url}` };
  }
  return { text: "" };
}

export async function generateGeminiContent(options: GeminiRequestOptions) {
  const result = await generateWriting(options);
  if (result.finishReason !== "STOP") throw new Error("Writing AI response was incomplete. Please retry with a shorter request.");
  // Preserve the established caller contract while routing through Writing AI.
  return { candidates: [{ content: { parts: [{ text: result.text }] }, finishReason: result.finishReason }], modelVersion: result.model, provider: result.provider };
}

export function extractTextFromGeminiResponse(data: any): string {
  if (data?.candidates?.[0]?.finishReason === "MAX_TOKENS") throw new Error("Writing AI response was incomplete. Please retry with a shorter request.");
  if (!data?.candidates?.length) return "";
  for (const candidate of data.candidates) {
    const parts = candidate?.content?.parts;
    if (Array.isArray(parts)) {
      const textParts = parts
        .filter((part: any) => typeof part.text === "string")
        .map((part: any) => part.text as string);
      if (textParts.length > 0) {
        return textParts.join("\n").trim();
      }
    }
  }
  return "";
}

function chunkText(text: string, chunkSize = 200) {
  if (!text) return [];
  const chunks: string[] = [];
  let pointer = 0;
  while (pointer < text.length) {
    chunks.push(text.slice(pointer, pointer + chunkSize));
    pointer += chunkSize;
  }
  return chunks;
}

export function createOpenAISSEStream(text: string, chunkSize = 200) {
  const encoder = new TextEncoder();
  const chunks = chunkText(text, chunkSize);

  return new ReadableStream({
    start(controller) {
      if (chunks.length === 0) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }

      for (const chunk of chunks) {
        const payload = {
          id: "chatcmpl-gemini",
          object: "chat.completion.chunk",
          created: Date.now(),
          choices: [
            {
              delta: { content: chunk },
              index: 0,
              finish_reason: null,
            },
          ],
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

export async function streamGeminiTextResponse(
  options: GeminiTextOptions,
  headers: HeadersInit,
) {
  const result = await generateWriting(options);
  if (result.finishReason !== 'STOP') throw new Error('Writing AI response was incomplete. Please retry.');
  return new Response(createOpenAISSEStream(result.text, options.chunkSize), { headers });
}

export function convertContentToGeminiParts(
  content: OpenAIMessage["content"],
) {
  return toArrayContent(content).map(convertPart);
}
