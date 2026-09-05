export const WRITING_PROVIDERS = ["openai", "gemini", "openrouter"] as const;
export type WritingProvider = typeof WRITING_PROVIDERS[number];
export type WritingSettings = {
  provider: WritingProvider;
  model: string;
  keySource: "managed" | "custom";
};
export const DEFAULT_WRITING_SETTINGS: WritingSettings = {
  provider: "openai",
  model: "gpt-5-mini",
  keySource: "managed",
};
export const WRITING_MODELS = {
  openai: [{ id: "gpt-5-mini", label: "GPT-5 mini" }, {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
  }],
  gemini: [{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }, {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
  }],
  openrouter: [{ id: "openrouter/free", label: "Free models router" }],
};
export function validateWritingSettings(value: unknown): WritingSettings {
  const v = value as WritingSettings;
  if (
    !v || !WRITING_PROVIDERS.includes(v.provider) ||
    !["managed", "custom"].includes(v.keySource)
  ) throw new Error("Choose a valid provider and connection.");
  if (
    typeof v.model !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,149}$/.test(v.model)
  ) throw new Error("Enter a valid model ID.");
  if (
    v.provider === "openrouter" && v.model !== "openrouter/free" &&
    !v.model.endsWith(":free")
  ) throw new Error("Only free OpenRouter models are supported.");
  if (v.provider === "openai" && !/^(gpt-|o[1-9])/.test(v.model)) {
    throw new Error("Choose an OpenAI text model.");
  }
  if (
    v.provider === "gemini" &&
    (!v.model.startsWith("gemini-") || /image|tts|audio/.test(v.model))
  ) throw new Error("Choose a Gemini text model.");
  return { provider: v.provider, model: v.model, keySource: v.keySource };
}
