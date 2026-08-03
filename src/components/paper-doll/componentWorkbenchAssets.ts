const sourceModules = import.meta.glob(
  "../../../outputs/paper-doll-plates/cap-regen-sources/*.png",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

export function componentSourceUrl(path: string): string | null {
  const normalized = path.replace(/^\.\//, "");
  const match = Object.entries(sourceModules).find(([modulePath]) =>
    modulePath.endsWith(normalized.replace(/^outputs\//, "../../../outputs/")) ||
    modulePath.endsWith(`/${normalized.split("/").at(-1)}`)
  );
  return match?.[1] ?? null;
}

export function releaseAssetUrl(
  path: string | null | undefined,
  assetUrlsByPath: Readonly<Record<string, string>>,
): string | null {
  return path ? assetUrlsByPath[path] ?? null : null;
}
