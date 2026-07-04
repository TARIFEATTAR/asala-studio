import type { PromptRecord, PromptSku } from "../../src/lib/bestBottlesPromptCompiler";
import { buildBestBottlesCatalogCanonPrompt } from "../../src/lib/bestBottlesCatalogCanonPrompt";

export type CylinderSmokePromptMode = "canon-framing" | "canon-only";
export type CylinderSmokeResolution = "standard" | "high" | "4k";

export function getCylinderSmokePromptMode(value: string | undefined): CylinderSmokePromptMode {
  const normalized = value?.trim();
  if (!normalized) return "canon-framing";
  if (normalized === "canon-framing" || normalized === "canon-only") return normalized;
  throw new Error(
    `Invalid BB_SMOKE_PROMPT_MODE=${value}. Expected canon-framing or canon-only.`,
  );
}

export function getCylinderSmokeResolution(value: string | undefined): CylinderSmokeResolution {
  const normalized = value?.trim();
  if (!normalized) return "standard";
  if (normalized === "standard" || normalized === "high" || normalized === "4k") return normalized;
  throw new Error(
    `Invalid BB_SMOKE_RESOLUTION=${value}. Expected standard, high, or 4k.`,
  );
}

export function buildCylinderSmokePromptRecord(input: {
  record: PromptRecord;
  sku: PromptSku;
  mode: CylinderSmokePromptMode;
}): PromptRecord {
  const qaModeTag = `smoke-prompt-mode:${input.mode}`;
  const qaChecklist = Array.from(new Set([...input.record.qa_checklist, qaModeTag]));

  if (input.mode === "canon-framing") {
    return {
      ...input.record,
      qa_checklist: qaChecklist,
    };
  }

  return {
    ...input.record,
    final_prompt: buildBestBottlesCatalogCanonPrompt(input.sku),
    qa_checklist: qaChecklist,
  };
}
