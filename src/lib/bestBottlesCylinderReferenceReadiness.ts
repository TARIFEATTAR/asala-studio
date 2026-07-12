import type { CylinderPublicationTarget } from "./bestBottlesCylinderCloseout";

const SUPPORTED_REFERENCE_EXT = /\.(png|jpe?g|webp)(?:[?#].*)?$/i;
const BEST_BOTTLES_MIN_CANONICAL_REFERENCE_PIXELS = 1_000_000;

export interface BestBottlesCanonicalReferenceArtifact {
  sourcePath: string;
  expectedSkuTokens: string[];
  width: number | null;
  height: number | null;
  opaque: boolean | null;
  provenance: string | null | undefined;
}

function referenceFilenameTokens(sourcePath: string): string[] {
  const withoutQuery = sourcePath.split(/[?#]/, 1)[0] ?? "";
  const filename = decodeURIComponent(withoutQuery.split(/[\\/]/).pop() ?? "")
    .replace(/\.(png|jpe?g|webp)$/i, "")
    .trim();
  return filename
    .split("__")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

export function getBestBottlesCanonicalReferenceArtifactIssues(
  artifact: BestBottlesCanonicalReferenceArtifact,
): string[] {
  const issues: string[] = [];
  const sourcePath = String(artifact.sourcePath ?? "").trim();
  const expected = new Set(
    artifact.expectedSkuTokens
      .map((token) => String(token).trim().toLowerCase())
      .filter(Boolean),
  );
  if (
    expected.size > 0 &&
    !referenceFilenameTokens(sourcePath).some((token) => expected.has(token))
  ) {
    issues.push(
      "Reference filename does not contain an exact canonical or website SKU token.",
    );
  }
  if (!SUPPORTED_REFERENCE_EXT.test(sourcePath)) {
    issues.push("Reference must be a PNG, JPG, or WebP raster.");
  }
  if (
    artifact.width === null ||
    artifact.height === null ||
    artifact.width * artifact.height < BEST_BOTTLES_MIN_CANONICAL_REFERENCE_PIXELS
  ) {
    issues.push("Reference must have verified dimensions totaling at least 1 megapixel.");
  }
  if (artifact.opaque !== true) {
    issues.push(
      "Reference contains transparent pixels; Cylinder generation requires an opaque flattened raster.",
    );
  }
  if (
    !["flattened-product-truth", "reviewed-local-canonical"].includes(
      String(artifact.provenance ?? "").trim().toLowerCase(),
    )
  ) {
    issues.push("Reference has no approved flattened product-truth provenance.");
  }
  if (/bestbottles\.com\/images\/store\//i.test(sourcePath)) {
    issues.push(
      "Live BestBottles product images are commercial evidence, not canonical generation references.",
    );
  }
  if (
    /(?:^|[\\/_-])(transparent|mask|paper[-_ ]?doll|background[-_ ]?removed|retired)(?:[\\/_-]|$)/i.test(
      sourcePath,
    )
  ) {
    issues.push(
      "Reference uses prohibited transparent, mask, paper-doll, background-removed, or retired lineage.",
    );
  }
  return issues;
}

export const CYLINDER_REFERENCE_MANIFEST_VERSION =
  "cylinder-v6.1-reference-manifest-v1" as const;

export type CylinderReferenceStatus =
  | "eligible"
  | "recover-from-psd"
  | "manual-source-match"
  | "blocked";

export interface CylinderFlattenedReferenceCandidate {
  sourcePath: string;
  provenance: string | null;
  width: number | null;
  height: number | null;
  opaque: boolean | null;
  sha256: string | null;
}

export interface CylinderPsdCandidate {
  sourcePath: string;
  pathClass:
    | "capped_product"
    | "cap_state_unspecified"
    | "uncapped_only"
    | "component_only"
    | "alternate_view"
    | string;
}

export interface CylinderPsdPathHints {
  sampleCappedPsd?: string | null;
  sampleUncappedPsd?: string | null;
  sampleUnspecifiedPsd?: string | null;
  recoveryCoverageLabel?: string | null;
}

export function classifyCylinderPsdPath(
  sourcePath: string,
  hints: CylinderPsdPathHints,
): CylinderPsdCandidate["pathClass"] {
  const normalized = sourcePath.trim().toLowerCase();
  if (normalized === String(hints.sampleCappedPsd ?? "").trim().toLowerCase()) {
    return "capped_product";
  }
  if (normalized === String(hints.sampleUncappedPsd ?? "").trim().toLowerCase()) {
    return "uncapped_only";
  }
  if (
    normalized === String(hints.sampleUnspecifiedPsd ?? "").trim().toLowerCase()
  ) {
    return "cap_state_unspecified";
  }
  if (/component|caps? only/.test(normalized)) return "component_only";
  if (/uncapped/.test(normalized)) return "uncapped_only";
  if (/capped/.test(normalized)) return "capped_product";
  if (/alternate|alt[ ._-]*view/.test(normalized)) return "alternate_view";

  const label = String(hints.recoveryCoverageLabel ?? "");
  if (label === "component_psd_only") return "component_only";
  if (label === "uncapped_psd_only") return "uncapped_only";
  if (label === "capped_psd_candidate_available") return "capped_product";
  return "cap_state_unspecified";
}

export interface CylinderReferenceQualificationInput {
  target: CylinderPublicationTarget;
  reference: CylinderFlattenedReferenceCandidate | null;
  psdCandidates: CylinderPsdCandidate[];
}

export interface CylinderReferenceDecision {
  graceSku: string;
  websiteSku: string;
  sourceGraceSkus: string[];
  status: CylinderReferenceStatus;
  sourcePath: string | null;
  sourcePsdPath: string | null;
  sha256: string | null;
  width: number | null;
  height: number | null;
  opaque: boolean | null;
  reasons: string[];
}

export interface CylinderReferenceManifest {
  version: typeof CYLINDER_REFERENCE_MANIFEST_VERSION;
  generatedAt: string;
  ledgerHash: string;
  decisions: CylinderReferenceDecision[];
  summary: Record<CylinderReferenceStatus, number>;
  sha256: string;
}

export interface BuildCylinderReferenceManifestInput {
  ledgerHash: string;
  targets: CylinderPublicationTarget[];
  referencesByWebsiteSku: Record<
    string,
    CylinderFlattenedReferenceCandidate | null | undefined
  >;
  psdCandidatesByWebsiteSku: Record<
    string,
    CylinderPsdCandidate[] | null | undefined
  >;
  generatedAt?: string;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function baseDecision(
  input: CylinderReferenceQualificationInput,
): Omit<CylinderReferenceDecision, "status" | "reasons"> {
  return {
    graceSku: input.target.graceSku,
    websiteSku: input.target.websiteSku,
    sourceGraceSkus: [...input.target.sourceGraceSkus].sort(),
    sourcePath: input.reference?.sourcePath ?? null,
    sourcePsdPath: null,
    sha256: input.reference?.sha256 ?? null,
    width: input.reference?.width ?? null,
    height: input.reference?.height ?? null,
    opaque: input.reference?.opaque ?? null,
  };
}

export function qualifyCylinderReference(
  input: CylinderReferenceQualificationInput,
): CylinderReferenceDecision {
  const base = baseDecision(input);
  if (input.reference) {
    const issues = getBestBottlesCanonicalReferenceArtifactIssues({
      sourcePath: input.reference.sourcePath,
      expectedSkuTokens: [
        input.target.graceSku,
        input.target.websiteSku,
        ...input.target.sourceGraceSkus,
        ...input.target.aliases,
      ],
      width: input.reference.width,
      height: input.reference.height,
      opaque: input.reference.opaque,
      provenance: input.reference.provenance,
    });
    if (issues.length === 0 && /^[a-f0-9]{64}$/i.test(input.reference.sha256 ?? "")) {
      return { ...base, status: "eligible", reasons: [] };
    }

    const reasons = [...issues];
    if (!/^[a-f0-9]{64}$/i.test(input.reference.sha256 ?? "")) {
      reasons.push("Reference SHA-256 is missing or invalid.");
    }
    const prohibited = reasons.some((reason) =>
      /commercial evidence|transparent pixels|prohibited|unsupported|must be a PNG/i.test(
        reason,
      ),
    );
    return {
      ...base,
      status: prohibited ? "blocked" : "manual-source-match",
      reasons,
    };
  }

  const sortedPsd = [...input.psdCandidates].sort((left, right) =>
    left.sourcePath.localeCompare(right.sourcePath),
  );
  const capped = sortedPsd.find((candidate) => candidate.pathClass === "capped_product");
  if (capped) {
    return {
      ...base,
      status: "recover-from-psd",
      sourcePsdPath: capped.sourcePath,
      reasons: ["Matched capped-product PSD requires a reviewed opaque flattened export."],
    };
  }
  if (
    sortedPsd.length > 0 &&
    sortedPsd.every((candidate) => candidate.pathClass === "component_only")
  ) {
    return {
      ...base,
      status: "blocked",
      sourcePsdPath: sortedPsd[0].sourcePath,
      reasons: ["Only component-only PSD evidence is available; it cannot represent the sellable product."],
    };
  }
  if (
    sortedPsd.length > 0 &&
    sortedPsd.every((candidate) => candidate.pathClass === "uncapped_only")
  ) {
    return {
      ...base,
      status: "blocked",
      sourcePsdPath: sortedPsd[0].sourcePath,
      reasons: ["Only uncapped PSD evidence is available for a capped publication target."],
    };
  }
  return {
    ...base,
    status: "manual-source-match",
    sourcePsdPath: sortedPsd[0]?.sourcePath ?? null,
    reasons: [
      sortedPsd.length > 0
        ? "PSD cap state or product composition requires manual inspection before export."
        : "No approved flattened reference or exact PSD recovery candidate was found.",
    ],
  };
}

export async function buildCylinderReferenceManifest(
  input: BuildCylinderReferenceManifestInput,
): Promise<CylinderReferenceManifest> {
  const decisions = input.targets
    .map((target) =>
      qualifyCylinderReference({
        target,
        reference: input.referencesByWebsiteSku[target.websiteSku] ?? null,
        psdCandidates: input.psdCandidatesByWebsiteSku[target.websiteSku] ?? [],
      }),
    )
    .sort(
      (left, right) =>
        left.graceSku.localeCompare(right.graceSku) ||
        left.websiteSku.localeCompare(right.websiteSku),
    );
  const summary: Record<CylinderReferenceStatus, number> = {
    eligible: 0,
    "recover-from-psd": 0,
    "manual-source-match": 0,
    blocked: 0,
  };
  for (const decision of decisions) summary[decision.status] += 1;
  const hashPayload = {
    version: CYLINDER_REFERENCE_MANIFEST_VERSION,
    ledgerHash: input.ledgerHash,
    decisions,
    summary,
  };

  return {
    ...hashPayload,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sha256: await sha256(stableJson(hashPayload)),
  };
}
