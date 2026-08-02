import type { AssemblyEditMode } from "./assemblyEditModel";

export function shouldMountCandidatePreview(mode: AssemblyEditMode, candidateImageUrl: string | null): boolean {
  return mode === "edit-lab" && Boolean(candidateImageUrl);
}
