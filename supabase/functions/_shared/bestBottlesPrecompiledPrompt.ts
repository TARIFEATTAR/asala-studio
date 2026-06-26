export interface BestBottlesPrecompiledPromptResolutionOptions {
  isBestBottlesStudioMasterRequest: boolean;
}

export interface BestBottlesPrecompiledPromptResolution {
  prompt: string | null;
  error: string | null;
  sku: string | null;
  referenceImagePath: string | null;
  qaChecklist: string[];
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function errorResult(message: string): BestBottlesPrecompiledPromptResolution {
  return {
    prompt: null,
    error: message,
    sku: null,
    referenceImagePath: null,
    qaChecklist: [],
  };
}

const LEGACY_PDP_MASTER_PREFIX = "REFERENCE-LOCKED BEST BOTTLES PDP MASTER";
const CATALOG_CANON_PREFIX = "You are ENHANCING an existing product reference photograph";
const CATALOG_CANON_PROMPT_FLAGS = new Set([
  "catalog_canon_v1_prompt",
  "catalog_canon_v1_1_draft_prompt",
]);

function isAcceptedPromptPrefix(prompt: string, qaChecklist: string[]): boolean {
  if (prompt.startsWith(LEGACY_PDP_MASTER_PREFIX)) return true;
  return prompt.startsWith(CATALOG_CANON_PREFIX) && qaChecklist.some((item) => CATALOG_CANON_PROMPT_FLAGS.has(item));
}

export function resolveBestBottlesPrecompiledPrompt(
  input: unknown,
  options: BestBottlesPrecompiledPromptResolutionOptions,
): BestBottlesPrecompiledPromptResolution {
  if (input == null) {
    return {
      prompt: null,
      error: null,
      sku: null,
      referenceImagePath: null,
      qaChecklist: [],
    };
  }
  if (!options.isBestBottlesStudioMasterRequest) {
    return errorResult("Precompiled prompts are only supported for Best Bottles Studio masters.");
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return errorResult("Precompiled prompt record must be an object.");
  }

  const record = input as Record<string, unknown>;
  const prompt = readString(record, "final_prompt");
  const sku = readString(record, "sku");
  const referenceImagePath = readString(record, "reference_image_path");
  const qaChecklist = readStringArray(record, "qa_checklist");

  if (!sku) return errorResult("Precompiled prompt record is missing sku.");
  if (!referenceImagePath) return errorResult(`Precompiled prompt record for ${sku} is missing reference_image_path.`);
  if (qaChecklist.length === 0) return errorResult(`Precompiled prompt record for ${sku} is missing qa_checklist.`);
  if (!prompt) return errorResult(`Precompiled prompt record for ${sku} is missing final_prompt.`);
  if (!isAcceptedPromptPrefix(prompt, qaChecklist)) {
    return errorResult(`Precompiled prompt record for ${sku} is missing the PDP master header or catalog canon marker.`);
  }
  if (prompt.length < 500) {
    return errorResult(`Precompiled prompt record for ${sku} is too short to be the compiled PDP prompt.`);
  }

  return {
    prompt,
    error: null,
    sku,
    referenceImagePath,
    qaChecklist,
  };
}
