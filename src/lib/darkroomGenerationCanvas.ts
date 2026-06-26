import type { PreserveSourceCanvasConstraints } from "./imageCanvasMetadata";

export type DarkroomGenerationCanvasMode = "preserve-source" | "selected-aspect";

export interface ResolveDarkroomGenerationCanvasInput {
  mode: DarkroomGenerationCanvasMode;
  sourceAspectRatio: string | null | undefined;
  sourceImageConstraints: PreserveSourceCanvasConstraints | undefined;
  selectedAspectRatio: string | null | undefined;
  fallbackAspectRatio: string;
  backgroundPlateMode?: boolean;
}

export interface ResolvedDarkroomGenerationCanvas {
  aspectRatio: string;
  imageConstraints: PreserveSourceCanvasConstraints | undefined;
  modeApplied: DarkroomGenerationCanvasMode;
}

function cleanAspectRatio(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveDarkroomGenerationCanvas(
  input: ResolveDarkroomGenerationCanvasInput,
): ResolvedDarkroomGenerationCanvas {
  const selectedAspectRatio =
    cleanAspectRatio(input.selectedAspectRatio) || input.fallbackAspectRatio;

  if (input.backgroundPlateMode || input.mode === "selected-aspect") {
    return {
      aspectRatio: selectedAspectRatio,
      imageConstraints: undefined,
      modeApplied: "selected-aspect",
    };
  }

  return {
    aspectRatio:
      cleanAspectRatio(input.sourceAspectRatio) ||
      selectedAspectRatio,
    imageConstraints: input.sourceImageConstraints,
    modeApplied: "preserve-source",
  };
}
