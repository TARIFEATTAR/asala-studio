const REVOKED_AUTHORITY_MASKS = new Map<string, string>([
  [
    "d2d1bd4a29e949c2dd824c95f60607ee36954381084fe5bb5e7570000c65cbfa",
    "Authority mask revoked: measured 15 connected components (one closure plus 14 detached islands). Register and approve a clean replacement mask before geometry lock.",
  ],
]);

export function authorityMaskBlocker(sha256: string | null | undefined): string | null {
  return sha256 ? REVOKED_AUTHORITY_MASKS.get(sha256) ?? null : null;
}
