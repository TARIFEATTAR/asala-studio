import {
  PAPER_DOLL_STORAGE_BUCKETS,
  resolvePaperDollAssetUrls,
  type PaperDollAssetReference,
  type PaperDollStorageClient,
  type PaperDollStorageBucket,
} from "./assetStorage";

type ReleaseStatus = "draft" | "validating" | "blocked" | "ready" | "published" | "superseded";
type ApprovalStatus = "candidate" | "blocked" | "approved" | "rejected";

export interface PaperDollReleaseRpcClient extends PaperDollStorageClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export interface PaperDollReleaseWorkbenchData {
  release: {
    id: string;
    familyKey: string;
    version: string;
    status: ReleaseStatus;
    canvasWidthPx: number;
    canvasHeightPx: number;
    backgroundHex: string;
    manifestSha256: string;
    createdAt: string;
  };
  assets: Array<{
    componentVersionId: string;
    componentKey: string;
    displayName: string;
    geometryFamilyId: string;
    slot: string;
    variantKey: string;
    versionKey: string;
    materialVariant: string;
    approvalStatus: ApprovalStatus;
    imageUrl: string;
    reference: PaperDollAssetReference;
    widthPx: number;
    heightPx: number;
    alphaBounds: { left: number; top: number; right: number; bottom: number };
    mountAxisXPx: number;
    seatYPx: number;
    qa: Array<{
      id: string;
      gateKey: string;
      status: string;
      blocking: boolean;
      issues: string[];
    }>;
  }>;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Malformed ${label}.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Malformed ${label}.`);
  return value;
}

function number(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Malformed ${label}.`);
  return parsed;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Malformed ${label}.`);
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Malformed ${label}.`);
  }
  return value as T;
}

function parseBounds(value: unknown): { left: number; top: number; right: number; bottom: number } {
  const bounds = record(value, "asset alpha bounds");
  return {
    left: number(bounds.left, "asset alpha bounds left"),
    top: number(bounds.top, "asset alpha bounds top"),
    right: number(bounds.right, "asset alpha bounds right"),
    bottom: number(bounds.bottom, "asset alpha bounds bottom"),
  };
}

const RELEASE_STATUSES: readonly ReleaseStatus[] = [
  "draft", "validating", "blocked", "ready", "published", "superseded",
];
const APPROVAL_STATUSES: readonly ApprovalStatus[] = ["candidate", "blocked", "approved", "rejected"];

export async function loadPaperDollReleaseWorkbench(
  client: PaperDollReleaseRpcClient,
  organizationId: string,
  familyKey: string,
): Promise<PaperDollReleaseWorkbenchData | null> {
  const response = await client.rpc("get_paper_doll_release_workbench", {
    p_organization_id: organizationId,
    p_family_key: familyKey,
  });
  if (response.error) {
    throw new Error(`Unable to load paper-doll release: ${response.error.message}`);
  }
  if (response.data === null) return null;

  const payload = record(response.data, "release workbench payload");
  const release = record(payload.release, "release");
  if (!Array.isArray(payload.assets)) throw new Error("Malformed release assets.");

  const parsedAssets = payload.assets.map((rawAsset, index) => {
    const asset = record(rawAsset, `release asset ${index}`);
    const component = record(asset.component, `release asset ${index} component`);
    const version = record(asset.version, `release asset ${index} version`);
    const storageBucket = oneOf(
      version.storage_bucket,
      PAPER_DOLL_STORAGE_BUCKETS,
      `release asset ${index} storage bucket`,
    ) as PaperDollStorageBucket;
    const reference: PaperDollAssetReference = {
      storageBucket,
      objectPath: string(version.image_path, `release asset ${index} image path`),
      sha256: string(version.image_sha256, `release asset ${index} checksum`),
      contentType: string(version.content_type, `release asset ${index} content type`),
      byteSize: number(version.byte_size, `release asset ${index} byte size`),
    };
    const qaRows = Array.isArray(asset.qa) ? asset.qa : [];
    return {
      componentVersionId: string(version.id, `release asset ${index} version id`),
      componentKey: string(component.component_key, `release asset ${index} component key`),
      displayName: string(component.display_name, `release asset ${index} display name`),
      geometryFamilyId: string(component.geometry_family_id, `release asset ${index} geometry family`),
      slot: string(asset.slot, `release asset ${index} slot`),
      variantKey: string(asset.variantKey, `release asset ${index} variant key`),
      versionKey: string(version.version_key, `release asset ${index} version key`),
      materialVariant: string(version.material_variant, `release asset ${index} material variant`),
      approvalStatus: oneOf(version.approval_status, APPROVAL_STATUSES, `release asset ${index} approval`),
      reference,
      widthPx: number(version.width_px, `release asset ${index} width`),
      heightPx: number(version.height_px, `release asset ${index} height`),
      alphaBounds: parseBounds(version.alpha_bounds),
      mountAxisXPx: number(version.mount_axis_x_px, `release asset ${index} mount axis`),
      seatYPx: number(version.seat_y_px, `release asset ${index} seat`),
      qa: qaRows.map((rawQa, qaIndex) => {
        const qa = record(rawQa, `release asset ${index} QA ${qaIndex}`);
        return {
          id: string(qa.id, `release asset ${index} QA ${qaIndex} id`),
          gateKey: string(qa.gate_key, `release asset ${index} QA ${qaIndex} gate`),
          status: string(qa.qa_status, `release asset ${index} QA ${qaIndex} status`),
          blocking: boolean(qa.blocking, `release asset ${index} QA ${qaIndex} blocking`),
          issues: Array.isArray(qa.issues) ? qa.issues.map((issue) => String(issue)) : [],
        };
      }),
    };
  });

  const references = Object.fromEntries(
    parsedAssets.map((asset) => [asset.componentVersionId, asset.reference]),
  );
  const imageUrls = await resolvePaperDollAssetUrls(client, references, organizationId);

  return {
    release: {
      id: string(release.id, "release id"),
      familyKey: string(release.family_key, "release family key"),
      version: string(release.release_version, "release version"),
      status: oneOf(release.release_status, RELEASE_STATUSES, "release status"),
      canvasWidthPx: number(release.canvas_width_px, "release canvas width"),
      canvasHeightPx: number(release.canvas_height_px, "release canvas height"),
      backgroundHex: string(release.background_hex, "release background"),
      manifestSha256: string(release.manifest_sha256, "release manifest checksum"),
      createdAt: string(release.created_at, "release created at"),
    },
    assets: parsedAssets.map((asset) => ({
      ...asset,
      imageUrl: imageUrls[asset.componentVersionId],
    })),
  };
}
