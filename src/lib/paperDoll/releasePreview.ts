import type { PaperDollReleaseWorkbenchData } from "./releaseRepository";

interface LocalPaperDollPreviewOptions {
  familyKey: string;
  isDevelopment: boolean;
  search: string;
  assetBaseUrl?: string;
}

const PREVIEW_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000000";

const BODY_PLATES = [
  { key: "clear", label: "Clear body plate" },
  { key: "amber", label: "Amber body plate" },
  { key: "cobalt", label: "Cobalt body plate" },
  { key: "frosted", label: "Frosted body plate" },
  { key: "swirl", label: "Swirl body plate" },
] as const;

export function getLocalPaperDollPreview({
  familyKey,
  isDevelopment,
  search,
  assetBaseUrl = "",
}: LocalPaperDollPreviewOptions): PaperDollReleaseWorkbenchData | null {
  if (!isDevelopment || new URLSearchParams(search).get("paperDollPreview") !== "1") return null;

  const normalizedAssetBaseUrl = assetBaseUrl.replace(/\/$/, "");

  return {
    release: {
      id: "local-preview-release",
      familyKey,
      version: "locked-plates-preview",
      status: "blocked",
      canvasWidthPx: 2080,
      canvasHeightPx: 2288,
      backgroundHex: "#F5F3EF",
      manifestSha256: "0".repeat(64),
      createdAt: "2026-08-01T00:00:00.000Z",
    },
    assets: BODY_PLATES.map((plate, index) => {
      const checksum = String(index + 1).repeat(64);
      return {
        componentVersionId: `local-preview-body-${plate.key}`,
        componentKey: `body__cylinder__9ml__${plate.key}`,
        displayName: plate.label,
        geometryFamilyId: familyKey,
        slot: "body",
        variantKey: plate.key,
        versionKey: "sha-frozen",
        materialVariant: `${plate.key}-glass`,
        approvalStatus: "approved" as const,
        imageUrl: `${normalizedAssetBaseUrl}/body__cylinder__9ml__${plate.key}__70.0x20.0mm.png`,
        reference: {
          storageBucket: "paper-doll-approved" as const,
          objectPath: `${PREVIEW_ORGANIZATION_ID}/${familyKey}/body-${plate.key}/${checksum}.png`,
          sha256: checksum,
          contentType: "image/png",
          byteSize: 0,
        },
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: { left: 858, top: 476, right: 1222, bottom: 2068 },
        mountAxisXPx: 1040,
        seatYPx: 1002,
        qa: [{
          id: `local-preview-body-qa-${index + 1}`,
          gateKey: "body-plate-mutual-geometry",
          status: "passed",
          blocking: true,
          issues: [],
        }],
      };
    }),
  };
}
