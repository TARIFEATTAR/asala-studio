/* eslint-disable @typescript-eslint/no-explicit-any, no-restricted-syntax -- local deterministic evidence renderer uses validated JSON records and explicit SVG palette values */
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const INPUT_NAMES = [
  "cylinder-81-type-review-manifest.json",
  "cylinder-216-blocker-report.json",
  "cylinder-six-collapse-candidates.json",
] as const;

const OUTPUT_NAMES = [
  "cylinder-81-annotated-review.png",
  "cylinder-41-ready-long.png",
  "cylinder-216-blocker-report.png",
  "cylinder-six-collapse-review.png",
  "render-manifest.json",
  "index.html",
] as const;

const EXPECTED_SUMMARY = {
  canonicalIdentityCount: 377,
  typeCount: 81,
  readyTypeCount: 41,
  blockedTypeCount: 40,
  blockedIdentityCount: 216,
  collapseCandidateCount: 6,
  appliedCollapseCount: 0,
  externalWriteCount: 0,
} as const;

const MAX_SHARP_PIXELS = 268_402_689;
const SCALE_CONTRACT_VERSION = "best-bottles-catalog-scale-v1";
const GLASS_ROD_IDENTITY_KEY = "GB09BLACKCAPAPP|GBCYLCLR9MLT01";
const BACKGROUND = "#f5f3ef";
const INK = "#171717";
const MUTED = "#68645e";
const READY = "#176b4d";
const BLOCKED = "#a52a2a";
const BORDER = "#c8c2b8";

type UnknownRecord = Record<string, any>;

export type Cylinder81ReviewRenderDimensions = {
  overviewColumns: number;
  overviewCardWidth: number;
  overviewCardHeight: number;
  overviewHeaderHeight: number;
  lineupSlotWidth: number;
  lineupHeight: number;
  lineupHeaderHeight: number;
  lineupBaselineY: number;
  lineupScaleReferenceHeight: number;
  blockerColumns: number;
  blockerCardWidth: number;
  blockerCardHeight: number;
  blockerHeaderHeight: number;
  collapseColumns: number;
  collapseSectionWidth: number;
  collapseSectionHeight: number;
  collapseHeaderHeight: number;
};

const DEFAULT_DIMENSIONS: Cylinder81ReviewRenderDimensions = {
  overviewColumns: 9,
  overviewCardWidth: 520,
  overviewCardHeight: 700,
  overviewHeaderHeight: 260,
  lineupSlotWidth: 300,
  lineupHeight: 1800,
  lineupHeaderHeight: 250,
  lineupBaselineY: 1280,
  lineupScaleReferenceHeight: 1080,
  blockerColumns: 4,
  blockerCardWidth: 900,
  blockerCardHeight: 220,
  blockerHeaderHeight: 280,
  collapseColumns: 2,
  collapseSectionWidth: 1900,
  collapseSectionHeight: 1100,
  collapseHeaderHeight: 280,
};

type RenderInputOptions = {
  root: string;
  dimensions?: Cylinder81ReviewRenderDimensions;
};

export type RenderCylinder81TypeReviewOptions = RenderInputOptions & {
  generatedAt?: string;
};

type PreviewInspection = {
  typeKey: string;
  canonicalIdentityKey: string;
  path: string;
  sha256: string;
  width: number;
  height: number;
  channels: number;
  hasAlpha: boolean;
  crop: { left: number; top: number; width: number; height: number };
};

type ValidatedInputs = {
  root: string;
  dimensions: Cylinder81ReviewRenderDimensions;
  manifest: UnknownRecord;
  blockerReport: UnknownRecord;
  collapseReport: UnknownRecord;
  inputHashes: Record<(typeof INPUT_NAMES)[number], string>;
  previews: PreviewInspection[];
};

export type Cylinder81ReviewRenderPlan = {
  slots: Array<UnknownRecord>;
  readyLineup: Array<UnknownRecord>;
  lineupLayouts: Array<{ left: number; width: number }>;
  blockerCards: Array<UnknownRecord>;
  collapseSections: Array<UnknownRecord>;
  outputDimensions: Record<string, { width: number; height: number }>;
};

export type Cylinder81ReviewRenderManifest = {
  version: string;
  generatedAt: string;
  root: string;
  scaleContractVersion: string;
  summary: typeof EXPECTED_SUMMARY;
  inputs: Record<string, { path: string; sha256: string }>;
  previews: PreviewInspection[];
  outputs: Record<string, {
    path: string;
    sha256: string;
    dimensions?: { width: number; height: number };
    channels?: number;
    hasAlpha?: boolean;
  }>;
  selfPath: string;
  selfHashStatus: "excluded-self-referential";
  appliedCollapseCount: 0;
  externalWriteCount: 0;
};

export type Cylinder81ReviewRenderResult = {
  artifactPaths: Record<(typeof OUTPUT_NAMES)[number], string>;
  renderManifest: Cylinder81ReviewRenderManifest;
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseJson(bytes: Uint8Array, label: string): UnknownRecord {
  try {
    const value = JSON.parse(Buffer.from(bytes).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("root value is not an object");
    }
    return value as UnknownRecord;
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${String(error)}`);
  }
}

function assertSummary(document: UnknownRecord, label: string): void {
  for (const [field, expected] of Object.entries(EXPECTED_SUMMARY)) {
    if (document.summary?.[field] !== expected) {
      throw new Error(`${label} must have ${field}=${expected}; received ${String(document.summary?.[field])}.`);
    }
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return Number(value);
}

function validateDimensions(dimensions: Cylinder81ReviewRenderDimensions): void {
  for (const [field, value] of Object.entries(dimensions)) positiveInteger(value, field);
  if (dimensions.lineupBaselineY <= dimensions.lineupHeaderHeight) {
    throw new Error("lineupBaselineY must be below the lineup header.");
  }
  if (dimensions.lineupBaselineY >= dimensions.lineupHeight) {
    throw new Error("lineupBaselineY must be inside the lineup canvas.");
  }
}

function outputDimensions(dimensions: Cylinder81ReviewRenderDimensions): Record<string, { width: number; height: number }> {
  const values = {
    "cylinder-81-annotated-review.png": {
      width: dimensions.overviewColumns * dimensions.overviewCardWidth,
      height: dimensions.overviewHeaderHeight + Math.ceil(81 / dimensions.overviewColumns) * dimensions.overviewCardHeight,
    },
    "cylinder-41-ready-long.png": {
      width: 41 * dimensions.lineupSlotWidth,
      height: dimensions.lineupHeight,
    },
    "cylinder-216-blocker-report.png": {
      width: dimensions.blockerColumns * dimensions.blockerCardWidth,
      height: dimensions.blockerHeaderHeight + Math.ceil(216 / dimensions.blockerColumns) * dimensions.blockerCardHeight,
    },
    "cylinder-six-collapse-review.png": {
      width: dimensions.collapseColumns * dimensions.collapseSectionWidth,
      height: dimensions.collapseHeaderHeight + Math.ceil(6 / dimensions.collapseColumns) * dimensions.collapseSectionHeight,
    },
  };
  for (const [name, size] of Object.entries(values)) {
    if (size.width * size.height >= MAX_SHARP_PIXELS) {
      throw new Error(`${name} exceeds Sharp's pixel limit.`);
    }
  }
  return values;
}

function recordedPreviewCrop(representative: UnknownRecord, previewWidth: number, previewHeight: number): PreviewInspection["crop"] {
  positiveInteger(representative.compositeWidth, "representative compositeWidth");
  positiveInteger(representative.compositeHeight, "representative compositeHeight");
  const bounds = representative.foregroundBounds;
  if (!bounds || typeof bounds !== "object") throw new Error("Representative crop bounds are missing.");
  const leftValue = Number(bounds.left);
  const topValue = Number(bounds.top);
  const widthValue = Number(bounds.width);
  const heightValue = Number(bounds.height);
  if (![leftValue, topValue, widthValue, heightValue].every(Number.isFinite)
    || leftValue < 0 || topValue < 0 || widthValue <= 0 || heightValue <= 0) {
    throw new Error("Representative crop bounds must be finite and positive.");
  }
  const crop = {
    left: Math.floor(leftValue),
    top: Math.floor(topValue),
    width: Math.ceil(widthValue),
    height: Math.ceil(heightValue),
  };
  if (crop.left < 0 || crop.top < 0 || crop.width <= 0 || crop.height <= 0
    || crop.left + crop.width > previewWidth || crop.top + crop.height > previewHeight) {
    throw new Error(`Representative crop bounds are outside preview ${previewWidth}×${previewHeight}.`);
  }
  return crop;
}

function identityKey(value: UnknownRecord): string {
  return typeof value.canonicalIdentityKey === "string" ? value.canonicalIdentityKey : "";
}

function compareReadyTypes(left: UnknownRecord, right: UnknownRecord): number {
  const a = left.canonical ?? {};
  const b = right.canonical ?? {};
  return Number(a.capacityMl) - Number(b.capacityMl)
    || Number(a.bodyHeightMm) - Number(b.bodyHeightMm)
    || String(a.applicator).localeCompare(String(b.applicator))
    || String(a.capStyle).localeCompare(String(b.capStyle))
    || String(left.typeKey).localeCompare(String(right.typeKey));
}

export async function inspectCylinder81ReviewInputs(
  options: RenderInputOptions,
): Promise<{ validated: ValidatedInputs }> {
  const root = path.resolve(options.root);
  if (path.basename(root) !== "cylinder-81-type-review-v1") {
    throw new Error("Cylinder 81 renderer root must be the versioned cylinder-81-type-review-v1 directory.");
  }
  const dimensions = options.dimensions ?? DEFAULT_DIMENSIONS;
  validateDimensions(dimensions);
  outputDimensions(dimensions);

  const inputPaths = INPUT_NAMES.map((name) => path.join(root, name));
  const inputBytes = await Promise.all(inputPaths.map((inputPath) => readFile(inputPath)));
  const [manifest, blockerReport, collapseReport] = inputBytes.map((bytes, index) => (
    parseJson(bytes, INPUT_NAMES[index] ?? `input-${index}`)
  ));
  assertSummary(manifest, INPUT_NAMES[0]);
  assertSummary(blockerReport, INPUT_NAMES[1]);
  assertSummary(collapseReport, INPUT_NAMES[2]);

  if (!Array.isArray(manifest.types) || manifest.types.length !== 81) {
    throw new Error("Cylinder manifest must contain exactly 81 types.");
  }
  const readyTypes = manifest.types.filter((type: UnknownRecord) => type.status === "ready");
  const blockedTypes = manifest.types.filter((type: UnknownRecord) => type.status === "blocked");
  if (readyTypes.length !== 41 || blockedTypes.length !== 40) {
    throw new Error(`Cylinder manifest must contain 41 ready and 40 blocked types; received ${readyTypes.length}/${blockedTypes.length}.`);
  }
  const typeKeys = manifest.types.map((type: UnknownRecord) => String(type.typeKey));
  if (new Set(typeKeys).size !== typeKeys.length) throw new Error("Cylinder type keys must be unique.");
  if (!blockedTypes.every((type: UnknownRecord) => type.representative === null)) {
    throw new Error("Every blocked type must have representative=null.");
  }
  if (manifest.scaleContractVersion !== SCALE_CONTRACT_VERSION) {
    throw new Error(`Cylinder manifest must use scale contract ${SCALE_CONTRACT_VERSION}.`);
  }
  if (!manifest.types.every((type: UnknownRecord) => type.scale?.contractVersion === SCALE_CONTRACT_VERSION)) {
    throw new Error(`Every Cylinder type must use scale contract ${SCALE_CONTRACT_VERSION}.`);
  }
  if (!blockedTypes.every((type: UnknownRecord) => type.scale?.status === "unavailable" && type.scale?.placement === null)) {
    throw new Error("Every blocked Cylinder type must have unavailable scale status and null placement.");
  }
  const scaleBlockedReadyTypes = readyTypes.filter((type: UnknownRecord) => type.scale?.status === "blocked");
  if (scaleBlockedReadyTypes.length !== 1) {
    throw new Error("Cylinder review must contain exactly one scale-blocked ready glass-rod type.");
  }
  const glassRodType = scaleBlockedReadyTypes[0];
  if (!(glassRodType.identities ?? []).some((identity: UnknownRecord) => identityKey(identity) === GLASS_ROD_IDENTITY_KEY)
    || glassRodType.scale?.blocker !== "canonical-with-cap-below-body"
    || glassRodType.scale?.placement !== null
    || Number(glassRodType.scale?.canonical?.bodyHeightMm) !== 79.4
    || Number(glassRodType.scale?.canonical?.heightWithCapMm) !== 50) {
    throw new Error("The exact GB09BlackCapApp glass-rod type must retain 79.4/50 canonical values and null scale placement.");
  }
  for (const type of readyTypes.filter((item: UnknownRecord) => item !== glassRodType)) {
    const placement = type.scale?.placement;
    if (type.scale?.status !== "ready"
      || !placement
      || !Number.isFinite(placement.assembledHeightPct)
      || placement.assembledHeightPct <= 0
      || placement.assembledHeightPct > 100
      || !Number.isFinite(placement.bodyToAssembledRatio)
      || placement.bodyToAssembledRatio <= 0
      || placement.bodyToAssembledRatio > 1) {
      throw new Error(`Scale-ready type ${String(type.typeKey)} must have valid approved comparative placement.`);
    }
  }

  if (!Array.isArray(manifest.blockedIdentities) || manifest.blockedIdentities.length !== 216
    || stableJson(manifest.blockedIdentities) !== stableJson(blockerReport.blockedIdentities)) {
    throw new Error("Blocked identity report does not equal the 216 manifest blockers.");
  }
  const blockerKeys = manifest.blockedIdentities.map(identityKey);
  if (blockerKeys.some((key: string) => !key) || new Set(blockerKeys).size !== 216) {
    throw new Error("Blocked identity report must contain 216 unique canonical identities.");
  }

  if (!Array.isArray(manifest.collapseCandidates) || manifest.collapseCandidates.length !== 6
    || stableJson(manifest.collapseCandidates) !== stableJson(collapseReport.collapseCandidates)) {
    throw new Error("Collapse candidate report does not equal the manifest candidates.");
  }
  const typesByKey = new Map(manifest.types.map((type: UnknownRecord) => [String(type.typeKey), type]));
  for (const candidate of manifest.collapseCandidates) {
    const left = typesByKey.get(String(candidate.leftTypeKey));
    const right = typesByKey.get(String(candidate.rightTypeKey));
    if (!left || !right || left.status !== "ready" || right.status !== "ready"
      || candidate.decision !== "pending-human-review" || candidate.applied !== false) {
      throw new Error(`Collapse candidate ${String(candidate.candidateId)} must resolve to two ready, pending, non-applied types.`);
    }
  }

  const previews: PreviewInspection[] = [];
  for (const type of readyTypes) {
    const representative = type.representative;
    if (!representative || representative.classification !== "assembled-cap-on" || representative.opaque !== true) {
      throw new Error(`Ready type ${String(type.typeKey)} must have one approved opaque assembled-cap-on representative.`);
    }
    if (typeof representative.previewPath !== "string" || typeof representative.previewSha256 !== "string") {
      throw new Error(`Ready type ${String(type.typeKey)} is missing preview lineage.`);
    }
    const previewPath = path.resolve(representative.previewPath);
    const bytes = await readFile(previewPath);
    const actualHash = sha256(bytes);
    if (actualHash !== representative.previewSha256) {
      throw new Error(`Preview SHA-256 mismatch for ${String(type.typeKey)}.`);
    }
    const metadata = await sharp(bytes).metadata();
    const width = positiveInteger(metadata.width, "preview width");
    const height = positiveInteger(metadata.height, "preview height");
    const stats = await sharp(bytes).stats();
    const alphaChannel = metadata.hasAlpha ? stats.channels[metadata.channels - 1] : null;
    if (metadata.hasAlpha && (!alphaChannel || alphaChannel.min < 255 || alphaChannel.max < 255)) {
      throw new Error(`Preview for ${String(type.typeKey)} must be opaque.`);
    }
    const crop = recordedPreviewCrop(representative, width, height);
    const matchingIdentity = Array.isArray(type.identities)
      ? type.identities.find((identity: UnknownRecord) => identityKey(identity) === representative.canonicalIdentityKey)
      : null;
    if (!matchingIdentity || matchingIdentity.referenceReady !== true) {
      throw new Error(`Representative identity mismatch for ${String(type.typeKey)}.`);
    }
    if (type.scale?.status === "blocked" && type.scale?.placement !== null) {
      throw new Error(`Scale-blocked type ${String(type.typeKey)} must have null comparative placement.`);
    }
    previews.push({
      typeKey: String(type.typeKey),
      canonicalIdentityKey: String(representative.canonicalIdentityKey),
      path: previewPath,
      sha256: actualHash,
      width,
      height,
      channels: metadata.channels,
      hasAlpha: metadata.hasAlpha,
      crop,
    });
  }

  const inputHashes = Object.fromEntries(INPUT_NAMES.map((name, index) => [name, sha256(inputBytes[index] ?? Buffer.alloc(0))])) as ValidatedInputs["inputHashes"];
  return {
    validated: { root, dimensions, manifest, blockerReport, collapseReport, inputHashes, previews },
  };
}

export function buildCylinder81ReviewRenderPlan(validated: ValidatedInputs): Cylinder81ReviewRenderPlan {
  const previewByType = new Map(validated.previews.map((preview) => [preview.typeKey, preview]));
  const slots = validated.manifest.types.map((type: UnknownRecord, index: number) => {
    const blockerCodes = [...new Set((type.identities ?? []).flatMap((identity: UnknownRecord) => identity.blockers ?? []))];
    return {
      ...type,
      ordinal: index + 1,
      placeholderLabel: type.status === "blocked" ? `BLOCKED — ${blockerCodes.join(" + ")}` : null,
      preview: previewByType.get(String(type.typeKey)) ?? null,
      blockerCodes,
    };
  });
  const readyLineup = slots
    .filter((slot) => slot.status === "ready")
    .sort((left, right) => {
      const scaleOrder = (left.scale?.status === "blocked" ? 1 : 0) - (right.scale?.status === "blocked" ? 1 : 0);
      return scaleOrder || compareReadyTypes(left, right);
    })
    .map((slot) => ({
      ...slot,
      scaleStatus: slot.scale?.status,
      comparativePlacement: slot.scale?.status === "ready" ? slot.scale?.placement : null,
      scaleWarning: slot.scale?.status === "blocked"
        ? `SCALE BLOCKED — canonical with-cap ${slot.scale?.canonical?.heightWithCapMm} mm < body ${slot.scale?.canonical?.bodyHeightMm} mm`
        : null,
    }));
  const blockerCards = validated.manifest.blockedIdentities.map((identity: UnknownRecord, index: number) => ({
    ...identity,
    ordinal: index + 1,
  }));
  const typeByKey = new Map(slots.map((slot) => [String(slot.typeKey), slot]));
  const collapseSections = validated.manifest.collapseCandidates.map((candidate: UnknownRecord, index: number) => ({
    ...candidate,
    ordinal: index + 1,
    left: typeByKey.get(String(candidate.leftTypeKey)),
    right: typeByKey.get(String(candidate.rightTypeKey)),
  }));
  let lineupLeft = 0;
  const lineupLayouts = readyLineup.map((slot) => {
    const scaleRatio = slot.scaleStatus === "ready"
      ? Number(slot.comparativePlacement?.assembledHeightPct) / 79
      : 0.67;
    const targetHeight = validated.dimensions.lineupScaleReferenceHeight * Math.max(0.35, Math.min(1, scaleRatio));
    const requiredWidth = Math.ceil(targetHeight * slot.preview.crop.width / slot.preview.crop.height) + 60;
    const width = Math.max(validated.dimensions.lineupSlotWidth, requiredWidth);
    const layout = { left: lineupLeft, width };
    lineupLeft += width;
    return layout;
  });
  const dimensions = outputDimensions(validated.dimensions);
  dimensions["cylinder-41-ready-long.png"] = {
    width: lineupLeft,
    height: validated.dimensions.lineupHeight,
  };
  if (lineupLeft * validated.dimensions.lineupHeight >= MAX_SHARP_PIXELS || lineupLeft > 32_767) {
    throw new Error("cylinder-41-ready-long.png exceeds renderer limits.");
  }
  return {
    slots,
    readyLineup,
    lineupLayouts,
    blockerCards,
    collapseSections,
    outputDimensions: dimensions,
  };
}

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function truncate(value: unknown, maximum: number): string {
  const text = String(value ?? "");
  return text.length <= maximum ? text : `${text.slice(0, Math.max(0, maximum - 1))}…`;
}

function svgText(input: {
  x: number;
  y: number;
  value: unknown;
  size: number;
  color?: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
}): string {
  return `<text x="${input.x}" y="${input.y}" font-family="Arial, Helvetica, sans-serif" font-size="${input.size}" font-weight="${input.weight ?? 400}" fill="${input.color ?? INK}" text-anchor="${input.anchor ?? "start"}">${escapeXml(input.value)}</text>`;
}

function svgDocument(width: number, height: number, body: string): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${BACKGROUND}"/>
    ${body}
  </svg>`);
}

async function opaqueSvg(svg: Buffer): Promise<Buffer> {
  return sharp(svg)
    .flatten({ background: BACKGROUND })
    .removeAlpha()
    .toColourspace("srgb")
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function scaledProductSize(
  crop: PreviewInspection["crop"],
  maximumWidth: number,
  targetHeight: number,
): { width: number; height: number } {
  let height = Math.max(1, Math.round(targetHeight));
  let width = Math.max(1, Math.round(height * crop.width / crop.height));
  if (width > maximumWidth) {
    const ratio = maximumWidth / width;
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }
  return { width, height };
}

async function productImage(
  preview: PreviewInspection,
  size: { width: number; height: number },
): Promise<Buffer> {
  return sharp(preview.path)
    .extract(preview.crop)
    .resize({
      width: size.width,
      height: size.height,
      fit: "contain",
      background: { r: 255, g: 255, b: 255 },
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .toColourspace("srgb")
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function composeOpaque(
  baseSvg: Buffer,
  composites: Array<{ input: Buffer; left: number; top: number }>,
): Promise<Buffer> {
  return sharp(baseSvg)
    .flatten({ background: BACKGROUND })
    .composite(composites)
    .flatten({ background: BACKGROUND })
    .removeAlpha()
    .toColourspace("srgb")
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function overviewBase(plan: Cylinder81ReviewRenderPlan, dimensions: Cylinder81ReviewRenderDimensions): Buffer {
  const size = plan.outputDimensions["cylinder-81-annotated-review.png"];
  const body: string[] = [
    svgText({ x: 60, y: 78, value: "BEST BOTTLES — CYLINDER CANONICAL 81-TYPE REVIEW", size: 50, weight: 700 }),
    svgText({ x: 60, y: 140, value: "41 READY • 40 BLOCKED • 216 BLOCKED IDENTITIES • 81 CANONICAL TYPES", size: 32, color: MUTED, weight: 700 }),
    svgText({ x: 60, y: 198, value: "Approved opaque PSD-derived references only. Blocked positions are never substituted.", size: 27, color: MUTED }),
  ];
  for (const slot of plan.slots) {
    const index = Number(slot.ordinal) - 1;
    const column = index % dimensions.overviewColumns;
    const row = Math.floor(index / dimensions.overviewColumns);
    const x = column * dimensions.overviewCardWidth;
    const y = dimensions.overviewHeaderHeight + row * dimensions.overviewCardHeight;
    const blocked = slot.status === "blocked";
    body.push(`<rect x="${x + 7}" y="${y + 7}" width="${dimensions.overviewCardWidth - 14}" height="${dimensions.overviewCardHeight - 14}" rx="14" fill="${blocked ? "#f6e8e6" : "#ffffff"}" stroke="${blocked ? BLOCKED : BORDER}" stroke-width="3"/>`);
    body.push(svgText({ x: x + 26, y: y + 50, value: `TYPE ${String(slot.ordinal).padStart(2, "0")} • ${blocked ? "BLOCKED" : "READY"}`, size: 24, color: blocked ? BLOCKED : READY, weight: 700 }));
    const canonical = slot.canonical ?? {};
    body.push(svgText({ x: x + 26, y: y + 88, value: `${canonical.capacityMl} ml • ${canonical.bodyHeightMm}×${canonical.widthAxisMm}×${canonical.secondAxisMm} mm`, size: 22, weight: 700 }));
    if (blocked) {
      body.push(svgText({ x: x + dimensions.overviewCardWidth / 2, y: y + 255, value: "BLOCKED", size: 48, color: BLOCKED, weight: 700, anchor: "middle" }));
      body.push(svgText({ x: x + dimensions.overviewCardWidth / 2, y: y + 304, value: truncate(slot.blockerCodes.join(" + "), 38), size: 21, color: BLOCKED, anchor: "middle" }));
    }
    const labelStart = y + dimensions.overviewCardHeight - 190;
    body.push(svgText({ x: x + 26, y: labelStart, value: `Neck: ${canonical.neckThreadSize || "—"}`, size: 20 }));
    body.push(svgText({ x: x + 26, y: labelStart + 32, value: truncate(`Applicator: ${canonical.applicator || "—"}`, 42), size: 20 }));
    body.push(svgText({ x: x + 26, y: labelStart + 64, value: truncate(`Cap style: ${canonical.capStyle || "—"}`, 42), size: 20 }));
    if (blocked) {
      body.push(svgText({ x: x + 26, y: labelStart + 100, value: `${slot.identities.length} blocked identity${slot.identities.length === 1 ? "" : "ies"}`, size: 19, color: BLOCKED, weight: 700 }));
      body.push(svgText({ x: x + 26, y: labelStart + 132, value: truncate(slot.typeKey, 48), size: 16, color: MUTED }));
    } else {
      const representativeIdentity = slot.identities.find((identity: UnknownRecord) => identity.canonicalIdentityKey === slot.representative?.canonicalIdentityKey);
      body.push(svgText({ x: x + 26, y: labelStart + 100, value: truncate(`Web: ${representativeIdentity?.canonical?.websiteSku ?? "—"}`, 48), size: 18, weight: 700 }));
      body.push(svgText({ x: x + 26, y: labelStart + 128, value: truncate(`Grace: ${representativeIdentity?.canonical?.graceSku ?? "—"}`, 48), size: 16, color: MUTED }));
      body.push(svgText({ x: x + 26, y: labelStart + 158, value: `${slot.identities.filter((identity: UnknownRecord) => identity.referenceReady).length} reference-ready identities`, size: 17, color: READY, weight: 700 }));
      if (slot.scale?.status === "blocked") {
        body.push(`<rect x="${x + 18}" y="${y + 104}" width="${dimensions.overviewCardWidth - 36}" height="42" rx="8" fill="#a52a2a"/>`);
        body.push(svgText({ x: x + dimensions.overviewCardWidth / 2, y: y + 133, value: "SCALE BLOCKED — 50 mm < 79.4 mm body", size: 18, color: "#ffffff", weight: 700, anchor: "middle" }));
      }
    }
  }
  return svgDocument(size.width, size.height, body.join("\n"));
}

async function renderOverview(plan: Cylinder81ReviewRenderPlan, dimensions: Cylinder81ReviewRenderDimensions): Promise<Buffer> {
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const slot of plan.slots.filter((item) => item.status === "ready")) {
    const index = Number(slot.ordinal) - 1;
    const column = index % dimensions.overviewColumns;
    const row = Math.floor(index / dimensions.overviewColumns);
    const cardX = column * dimensions.overviewCardWidth;
    const cardY = dimensions.overviewHeaderHeight + row * dimensions.overviewCardHeight;
    const maximumHeight = Math.max(80, dimensions.overviewCardHeight - 330);
    const percentage = slot.scale?.status === "ready"
      ? Number(slot.scale?.placement?.assembledHeightPct) / 79
      : 0.72;
    const targetHeight = maximumHeight * Math.max(0.35, Math.min(1, percentage));
    const size = scaledProductSize(slot.preview.crop, dimensions.overviewCardWidth * 0.72, targetHeight);
    const left = Math.round(cardX + (dimensions.overviewCardWidth - size.width) / 2);
    const bottom = cardY + dimensions.overviewCardHeight - 215;
    composites.push({ input: await productImage(slot.preview, size), left, top: Math.max(cardY + 150, Math.round(bottom - size.height)) });
  }
  return composeOpaque(overviewBase(plan, dimensions), composites);
}

function lineupBase(plan: Cylinder81ReviewRenderPlan, dimensions: Cylinder81ReviewRenderDimensions): Buffer {
  const size = plan.outputDimensions["cylinder-41-ready-long.png"];
  const comparativeWidth = plan.lineupLayouts.at(-1)?.left ?? size.width;
  const body: string[] = [
    svgText({ x: 50, y: 72, value: "41 READY CYLINDER TYPES — APPROVED CATALOG-SCALE CURVE", size: 48, weight: 700 }),
    svgText({ x: 50, y: 130, value: "One shared baseline • approved opaque PSD-derived previews • best-bottles-catalog-scale-v1", size: 28, color: MUTED }),
    `<line x1="20" y1="${dimensions.lineupBaselineY}" x2="${comparativeWidth - 20}" y2="${dimensions.lineupBaselineY}" stroke="#6f6a62" stroke-width="4"/>`,
  ];
  for (let index = 0; index < plan.readyLineup.length; index += 1) {
    const slot = plan.readyLineup[index];
    const layout = plan.lineupLayouts[index];
    const x = layout.left;
    const slotWidth = layout.width;
    const blocked = slot.scaleStatus === "blocked";
    body.push(`<rect x="${x + 3}" y="${dimensions.lineupHeaderHeight}" width="${slotWidth - 6}" height="${dimensions.lineupHeight - dimensions.lineupHeaderHeight - 4}" fill="${blocked ? "#f6e8e6" : index % 2 ? "#f8f6f2" : "#ffffff"}" stroke="${blocked ? BLOCKED : BORDER}" stroke-width="2"/>`);
    body.push(svgText({ x: x + slotWidth / 2, y: dimensions.lineupHeaderHeight + 38, value: `TYPE ${String(slot.ordinal).padStart(2, "0")}`, size: 20, color: blocked ? BLOCKED : READY, weight: 700, anchor: "middle" }));
    if (!blocked) {
      const pct = Number(slot.comparativePlacement?.assembledHeightPct);
      body.push(svgText({ x: x + slotWidth / 2, y: dimensions.lineupBaselineY + 54, value: `${slot.canonical.capacityMl} ml • ${pct}% curve`, size: 18, weight: 700, anchor: "middle" }));
    } else {
      body.push(svgText({ x: x + slotWidth / 2, y: dimensions.lineupBaselineY + 54, value: "FIT ONLY — NOT ON BASELINE", size: 17, color: BLOCKED, weight: 700, anchor: "middle" }));
    }
    body.push(svgText({ x: x + slotWidth / 2, y: dimensions.lineupBaselineY + 88, value: truncate(`${slot.canonical.bodyHeightMm}×${slot.canonical.widthAxisMm} mm • ${slot.canonical.neckThreadSize || "—"}`, 28), size: 16, anchor: "middle" }));
    body.push(svgText({ x: x + slotWidth / 2, y: dimensions.lineupBaselineY + 120, value: truncate(slot.canonical.applicator || "—", 28), size: 16, anchor: "middle" }));
    body.push(svgText({ x: x + slotWidth / 2, y: dimensions.lineupBaselineY + 150, value: truncate(slot.canonical.capStyle || "—", 28), size: 16, color: MUTED, anchor: "middle" }));
    if (blocked) {
      body.push(svgText({ x: x + slotWidth / 2, y: dimensions.lineupHeight - 85, value: "SCALE BLOCKED", size: 24, color: BLOCKED, weight: 700, anchor: "middle" }));
      body.push(svgText({ x: x + slotWidth / 2, y: dimensions.lineupHeight - 48, value: "50 mm cap < 79.4 mm body", size: 15, color: BLOCKED, anchor: "middle" }));
    }
  }
  return svgDocument(size.width, size.height, body.join("\n"));
}

async function renderLineup(plan: Cylinder81ReviewRenderPlan, dimensions: Cylinder81ReviewRenderDimensions): Promise<Buffer> {
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  for (let index = 0; index < plan.readyLineup.length; index += 1) {
    const slot = plan.readyLineup[index];
    const layout = plan.lineupLayouts[index];
    const blocked = slot.scaleStatus === "blocked";
    const pct = blocked ? 0.67 : Number(slot.comparativePlacement.assembledHeightPct) / 79;
    const targetHeight = dimensions.lineupScaleReferenceHeight * Math.max(0.35, Math.min(1, pct));
    const size = scaledProductSize(slot.preview.crop, layout.width - 40, targetHeight);
    const left = Math.round(layout.left + (layout.width - size.width) / 2);
    const bottom = blocked ? dimensions.lineupBaselineY - 90 : dimensions.lineupBaselineY;
    composites.push({ input: await productImage(slot.preview, size), left, top: Math.max(dimensions.lineupHeaderHeight + 70, Math.round(bottom - size.height)) });
  }
  return composeOpaque(lineupBase(plan, dimensions), composites);
}

function blockerClass(blockers: string[]): { label: string; fill: string; ink: string } {
  const ambiguous = blockers.includes("ambiguous-canonical-body-geometry");
  const missing = blockers.includes("no-approved-exact-reference");
  if (ambiguous && missing) return { label: "OVERLAP: BODY AMBIGUOUS + MISSING REF", fill: "#5d394d", ink: "#ffffff" };
  if (ambiguous) return { label: "BODY AMBIGUOUS", fill: "#7a5529", ink: "#ffffff" };
  return { label: missing ? "MISSING APPROVED EXACT REFERENCE" : "BLOCKED", fill: "#a52a2a", ink: "#ffffff" };
}

async function renderBlockerReport(plan: Cylinder81ReviewRenderPlan, dimensions: Cylinder81ReviewRenderDimensions): Promise<Buffer> {
  const size = plan.outputDimensions["cylinder-216-blocker-report.png"];
  const typeOrdinal = new Map(plan.slots.map((slot) => [String(slot.typeKey), Number(slot.ordinal)]));
  const body: string[] = [
    svgText({ x: 50, y: 72, value: "CYLINDER BLOCKER REPORT — ALL 216 EXACT IDENTITIES", size: 48, weight: 700 }),
    svgText({ x: 50, y: 132, value: "No sibling references, catalog substitutions, fuzzy identity matches, or invented geometry.", size: 28, color: MUTED }),
    svgText({ x: 50, y: 188, value: "RED = missing exact reference • OCHRE = ambiguous body • PURPLE = both", size: 24, color: MUTED, weight: 700 }),
  ];
  for (const card of plan.blockerCards) {
    const index = Number(card.ordinal) - 1;
    const column = index % dimensions.blockerColumns;
    const row = Math.floor(index / dimensions.blockerColumns);
    const x = column * dimensions.blockerCardWidth;
    const y = dimensions.blockerHeaderHeight + row * dimensions.blockerCardHeight;
    const blockers = Array.isArray(card.blockers) ? card.blockers : [];
    const classification = blockerClass(blockers);
    const canonical = card.canonical ?? {};
    const ordinal = typeOrdinal.get(String(card.typeKey));
    body.push(`<rect x="${x + 6}" y="${y + 6}" width="${dimensions.blockerCardWidth - 12}" height="${dimensions.blockerCardHeight - 12}" rx="10" fill="#ffffff" stroke="${classification.fill}" stroke-width="3"/>`);
    body.push(`<rect x="${x + 6}" y="${y + 6}" width="${dimensions.blockerCardWidth - 12}" height="40" rx="10" fill="${classification.fill}"/>`);
    body.push(svgText({ x: x + 22, y: y + 34, value: `#${String(card.ordinal).padStart(3, "0")} • TYPE ${ordinal ? String(ordinal).padStart(2, "0") : "—"} • ${classification.label}`, size: 18, color: classification.ink, weight: 700 }));
    body.push(svgText({ x: x + 22, y: y + 76, value: truncate(`Website: ${canonical.websiteSku || "—"}`, 58), size: 20, weight: 700 }));
    body.push(svgText({ x: x + 22, y: y + 108, value: truncate(`Grace: ${canonical.graceSku || "—"}`, 64), size: 18 }));
    body.push(svgText({ x: x + 22, y: y + 140, value: `${canonical.capacityMl || "—"} ml • body ${canonical.canon_bodyHeightMm || "unresolved"}×${canonical.canon_widthAxisMm || "—"}×${canonical.canon_secondAxisMm || "—"} mm`, size: 17, color: MUTED }));
    body.push(svgText({ x: x + 22, y: y + 171, value: truncate(`Blockers: ${blockers.join(" + ")}`, 76), size: 16, color: classification.fill, weight: 700 }));
    body.push(svgText({ x: x + 22, y: y + 198, value: truncate(String(card.typeKey), 86), size: 14, color: MUTED }));
  }
  return opaqueSvg(svgDocument(size.width, size.height, body.join("\n")));
}

function collapseBase(plan: Cylinder81ReviewRenderPlan, dimensions: Cylinder81ReviewRenderDimensions): Buffer {
  const size = plan.outputDimensions["cylinder-six-collapse-review.png"];
  const body: string[] = [
    svgText({ x: 50, y: 72, value: "SIX POSSIBLE TYPE COLLAPSES — VISUAL DECISION SHEET", size: 48, weight: 700 }),
    svgText({ x: 50, y: 132, value: "Every pair remains PENDING HUMAN REVIEW. No collapse has been applied to the canonical 81.", size: 28, color: BLOCKED, weight: 700 }),
    svgText({ x: 50, y: 188, value: "Compare only whether each pair is genuinely the same physical type; cap-style taxonomy is the recorded difference.", size: 24, color: MUTED }),
  ];
  for (const section of plan.collapseSections) {
    const index = Number(section.ordinal) - 1;
    const column = index % dimensions.collapseColumns;
    const row = Math.floor(index / dimensions.collapseColumns);
    const x = column * dimensions.collapseSectionWidth;
    const y = dimensions.collapseHeaderHeight + row * dimensions.collapseSectionHeight;
    const shared = section.sharedCanonical ?? {};
    body.push(`<rect x="${x + 8}" y="${y + 8}" width="${dimensions.collapseSectionWidth - 16}" height="${dimensions.collapseSectionHeight - 16}" rx="18" fill="#ffffff" stroke="${BORDER}" stroke-width="3"/>`);
    body.push(`<rect x="${x + 8}" y="${y + 8}" width="${dimensions.collapseSectionWidth - 16}" height="62" rx="18" fill="#a52a2a"/>`);
    body.push(svgText({ x: x + dimensions.collapseSectionWidth / 2, y: y + 49, value: `CANDIDATE ${section.ordinal} — PENDING HUMAN REVIEW — NOT APPLIED`, size: 24, color: "#ffffff", weight: 700, anchor: "middle" }));
    body.push(svgText({ x: x + 36, y: y + 106, value: `${shared.capacityMl} ml • body ${shared.bodyHeightMm}×${shared.widthAxisMm}×${shared.secondAxisMm} mm • ${shared.neckThreadSize || "—"}`, size: 23, weight: 700 }));
    body.push(svgText({ x: x + 36, y: y + 142, value: truncate(`Shared applicator: ${shared.applicator || "—"}`, 100), size: 21, color: MUTED }));
    body.push(`<line x1="${x + dimensions.collapseSectionWidth / 2}" y1="${y + 170}" x2="${x + dimensions.collapseSectionWidth / 2}" y2="${y + dimensions.collapseSectionHeight - 24}" stroke="${BORDER}" stroke-width="3"/>`);
    const sides = [section.left, section.right];
    for (let sideIndex = 0; sideIndex < sides.length; sideIndex += 1) {
      const slot = sides[sideIndex];
      const center = x + dimensions.collapseSectionWidth * (sideIndex === 0 ? 0.25 : 0.75);
      const identity = slot.identities.find((item: UnknownRecord) => item.canonicalIdentityKey === slot.representative.canonicalIdentityKey);
      body.push(svgText({ x: center, y: y + 205, value: sideIndex === 0 ? "A" : "B", size: 26, color: READY, weight: 700, anchor: "middle" }));
      body.push(svgText({ x: center, y: y + 244, value: truncate(`Cap style: ${slot.canonical.capStyle || "—"}`, 46), size: 22, weight: 700, anchor: "middle" }));
      body.push(svgText({ x: center, y: y + dimensions.collapseSectionHeight - 126, value: truncate(`Web: ${identity?.canonical?.websiteSku ?? "—"}`, 54), size: 18, weight: 700, anchor: "middle" }));
      body.push(svgText({ x: center, y: y + dimensions.collapseSectionHeight - 94, value: truncate(`Grace: ${identity?.canonical?.graceSku ?? "—"}`, 58), size: 16, color: MUTED, anchor: "middle" }));
      body.push(svgText({ x: center, y: y + dimensions.collapseSectionHeight - 62, value: `Canonical type ${slot.ordinal}`, size: 17, color: READY, weight: 700, anchor: "middle" }));
    }
  }
  return svgDocument(size.width, size.height, body.join("\n"));
}

async function renderCollapseReview(plan: Cylinder81ReviewRenderPlan, dimensions: Cylinder81ReviewRenderDimensions): Promise<Buffer> {
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const section of plan.collapseSections) {
    const index = Number(section.ordinal) - 1;
    const column = index % dimensions.collapseColumns;
    const row = Math.floor(index / dimensions.collapseColumns);
    const sectionX = column * dimensions.collapseSectionWidth;
    const sectionY = dimensions.collapseHeaderHeight + row * dimensions.collapseSectionHeight;
    for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
      const slot = sideIndex === 0 ? section.left : section.right;
      const maximumHeight = dimensions.collapseSectionHeight - 475;
      const size = scaledProductSize(slot.preview.crop, dimensions.collapseSectionWidth * 0.31, maximumHeight);
      const center = sectionX + dimensions.collapseSectionWidth * (sideIndex === 0 ? 0.25 : 0.75);
      const left = Math.round(center - size.width / 2);
      const top = sectionY + 275 + Math.round((maximumHeight - size.height) / 2);
      composites.push({ input: await productImage(slot.preview, size), left, top });
    }
  }
  return composeOpaque(collapseBase(plan, dimensions), composites);
}

function indexHtml(): string {
  const imageSections = [
    ["81-type annotated review", "cylinder-81-annotated-review.png"],
    ["41-ready catalog-scale lineup", "cylinder-41-ready-long.png"],
    ["216-identity blocker report", "cylinder-216-blocker-report.png"],
    ["Six possible collapse decisions", "cylinder-six-collapse-review.png"],
  ];
  const links = [
    "cylinder-81-type-review-manifest.json",
    "cylinder-216-blocker-report.json",
    "cylinder-six-collapse-candidates.json",
    "render-manifest.json",
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Best Bottles Cylinder 81-Type Review</title>
<style>
body{margin:0;background:#111;color:#f5f3ef;font-family:Arial,Helvetica,sans-serif}main{max-width:1500px;margin:auto;padding:36px}h1{font-size:42px;margin:0 0 12px}p{color:#c8c2b8;font-size:20px;line-height:1.5}nav{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0 38px}a{color:#fff;background:#2d664e;padding:10px 14px;border-radius:8px;text-decoration:none}section{margin:0 0 54px}h2{font-size:28px}img{display:block;width:100%;height:auto;background:#f5f3ef;border:1px solid #4b4945}strong{color:#ffb2aa}
</style>
</head>
<body><main>
<h1>Best Bottles — Cylinder canonical review</h1>
<p><strong>The 81 count remains canonical</strong> until you explicitly approve a collapse. This local review contains 41 exact approved PSD-derived representatives, 40 visibly blocked type positions, all 216 blocked identities, and six unapplied visual comparisons.</p>
<nav>${links.map((name) => `<a href="${name}">${name}</a>`).join("")}</nav>
${imageSections.map(([label, name]) => `<section><h2>${label}</h2><a href="${name}"><img src="${name}" alt="${label}"></a></section>`).join("\n")}
</main></body></html>\n`;
}

async function pngOutputRecord(bytes: Buffer, outputPath: string): Promise<Cylinder81ReviewRenderManifest["outputs"][string]> {
  const metadata = await sharp(bytes).metadata();
  if (metadata.hasAlpha || metadata.channels !== 3 || !metadata.width || !metadata.height) {
    throw new Error(`Rendered PNG ${outputPath} must be opaque RGB with dimensions.`);
  }
  return {
    path: outputPath,
    sha256: sha256(bytes),
    dimensions: { width: metadata.width, height: metadata.height },
    channels: metadata.channels,
    hasAlpha: metadata.hasAlpha,
  };
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function promoteCylinder81ReviewOutputs(input: {
  root: string;
  stagedDirectory: string;
  renameOutput?: (source: string, target: string) => Promise<void>;
  restoreOutput?: (source: string, target: string) => Promise<void>;
}): Promise<void> {
  const root = path.resolve(input.root);
  const stagedDirectory = path.resolve(input.stagedDirectory);
  if (path.dirname(stagedDirectory) !== root) {
    throw new Error("Cylinder review staged directory must be a direct child of the versioned root.");
  }
  const backupDirectory = path.join(root, `.render-backup-${process.pid}-${Date.now()}`);
  await mkdir(backupDirectory);
  const previouslyExisting = new Set<string>();
  const promoted: string[] = [];
  let preserveBackup = false;
  try {
    for (const name of OUTPUT_NAMES) {
      const target = path.join(root, name);
      if (await pathExists(target)) {
        await copyFile(target, path.join(backupDirectory, name));
        previouslyExisting.add(name);
      }
    }
    for (const name of OUTPUT_NAMES) {
      await (input.renameOutput ?? rename)(path.join(stagedDirectory, name), path.join(root, name));
      promoted.push(name);
    }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const name of [...promoted].reverse()) {
      try {
        const target = path.join(root, name);
        if (previouslyExisting.has(name)) {
          await (input.restoreOutput ?? rename)(path.join(backupDirectory, name), target);
        } else {
          await rm(target, { force: true });
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      preserveBackup = true;
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Cylinder review promotion failed and rollback was incomplete. Recovery backup preserved at ${backupDirectory}.`,
      );
    }
    throw error;
  } finally {
    if (!preserveBackup) await rm(backupDirectory, { recursive: true, force: true });
  }
}

export async function renderCylinder81TypeReview(
  options: RenderCylinder81TypeReviewOptions,
): Promise<Cylinder81ReviewRenderResult> {
  const inspection = await inspectCylinder81ReviewInputs(options);
  const validated = inspection.validated;
  const plan = buildCylinder81ReviewRenderPlan(validated);
  const dimensions = validated.dimensions;

  const [overview, lineup, blockerReport, collapseReview] = await Promise.all([
    renderOverview(plan, dimensions),
    renderLineup(plan, dimensions),
    renderBlockerReport(plan, dimensions),
    renderCollapseReview(plan, dimensions),
  ]);
  const html = Buffer.from(indexHtml());
  const siblingBytes: Record<string, Buffer> = {
    "cylinder-81-annotated-review.png": overview,
    "cylinder-41-ready-long.png": lineup,
    "cylinder-216-blocker-report.png": blockerReport,
    "cylinder-six-collapse-review.png": collapseReview,
    "index.html": html,
  };
  const outputs: Cylinder81ReviewRenderManifest["outputs"] = {};
  for (const [name, bytes] of Object.entries(siblingBytes)) {
    const outputPath = path.join(validated.root, name);
    outputs[name] = name.endsWith(".png")
      ? await pngOutputRecord(bytes, outputPath)
      : { path: outputPath, sha256: sha256(bytes) };
  }

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const renderManifest: Cylinder81ReviewRenderManifest = {
    version: "best-bottles-cylinder-81-type-render-v1",
    generatedAt,
    root: validated.root,
    scaleContractVersion: SCALE_CONTRACT_VERSION,
    summary: { ...EXPECTED_SUMMARY },
    inputs: Object.fromEntries(INPUT_NAMES.map((name) => [name, {
      path: path.join(validated.root, name),
      sha256: validated.inputHashes[name],
    }])),
    previews: validated.previews,
    outputs,
    selfPath: path.join(validated.root, "render-manifest.json"),
    selfHashStatus: "excluded-self-referential",
    appliedCollapseCount: 0,
    externalWriteCount: 0,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(renderManifest, null, 2)}\n`);
  const allBytes: Record<string, Buffer> = { ...siblingBytes, "render-manifest.json": manifestBytes };
  const temporaryDirectory = path.join(validated.root, `.render-tmp-${process.pid}-${Date.now()}`);
  await mkdir(temporaryDirectory);
  try {
    await Promise.all(Object.entries(allBytes).map(([name, bytes]) => writeFile(path.join(temporaryDirectory, name), bytes)));
    await promoteCylinder81ReviewOutputs({ root: validated.root, stagedDirectory: temporaryDirectory });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  const artifactPaths = Object.fromEntries(OUTPUT_NAMES.map((name) => [name, path.join(validated.root, name)])) as Cylinder81ReviewRenderResult["artifactPaths"];
  return { artifactPaths, renderManifest };
}

async function main(): Promise<void> {
  const rootFlag = process.argv.indexOf("--root");
  const root = rootFlag >= 0 && process.argv[rootFlag + 1]
    ? path.resolve(process.argv[rootFlag + 1])
    : path.resolve("tmp/best-bottles-reference-production/cylinder-81-type-review-v1");
  const result = await renderCylinder81TypeReview({ root });
  process.stdout.write(`${JSON.stringify({
    summary: result.renderManifest.summary,
    scaleContractVersion: result.renderManifest.scaleContractVersion,
    outputs: result.renderManifest.outputs,
    selfPath: result.renderManifest.selfPath,
    selfHashStatus: result.renderManifest.selfHashStatus,
  }, null, 2)}\n`);
}

const directPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (directPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
