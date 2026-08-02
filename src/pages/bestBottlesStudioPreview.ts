export type BestBottlesStudioTab = "masters" | "components" | "compose";

export function resolveInitialStudioTab(search: string): BestBottlesStudioTab {
  const params = new URLSearchParams(search);
  return params.get("paperDollPreview") === "1" ? "compose" : "masters";
}
