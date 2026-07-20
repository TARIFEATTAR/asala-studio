/* eslint-disable @typescript-eslint/no-explicit-any, no-restricted-syntax -- local evidence renderer consumes validated versioned JSON and explicit SVG review colors */
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  parseCanonicalTruthCsv,
} from "./build-psd-cap-state-audit";
import type { CanonicalTruthRow } from "../../src/lib/bestBottlesPsdIdentityJoin";

const SCALE_CONTRACT_VERSION = "best-bottles-catalog-scale-v1";
const OUTPUT_ROOT_NAME = "cylinder-applicator-curves-v1";
const SPRAY_PNG = "cylinder-spray-scale-curve.png";
const ROLL_ON_PNG = "cylinder-roll-on-scale-curve.png";
const REDUCER_PNG = "cylinder-reducer-scale-curve.png";
const MANIFEST_NAME = "cylinder-applicator-curves-manifest.json";
const INDEX_NAME = "index.html";
const OUTPUT_NAMES = [SPRAY_PNG, ROLL_ON_PNG, REDUCER_PNG, MANIFEST_NAME, INDEX_NAME] as const;
const CANONICAL_TRUTH_PATH = "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv";
const PIXELS_PER_MM = 6;
const BASELINE_Y = 1_400;
const CANVAS_HEIGHT = 1_720;
const RULER_WIDTH = 145;
const SLOT_WIDTH = 570;
const BACKGROUND = "#f5f3ef";
const INK = "#171717";
const MUTED = "#68645e";
const GREEN = "#176b4d";
const BLUE = "#2f5f85";
const RED = "#a52a2a";
const BORDER = "#c8c2b8";

const EVIDENCE_NAMES = {
  fiveMlSprayPdp: "2026-07-12-GBCylBlu5SpryBlkSh-PDP.png",
  tallNineSprayPdp: "2026-07-12-GBTallCyl9SpryBlkMatt-PDP.png",
  twentyFiveReducerPdp: "2026-07-13-GBcyl25RdcrBlkLthr-PDP-cap-on-main.png",
  regularNineSprayPdp: "2026-07-13-GBCylAmb9SpryBlk-PDP.png",
  glassRodPdp: "2026-07-12-GB09BlackCapApp-PDP.png",
  tallRectangleTenPdp: "2026-07-13-GBTallRect10SpryBlkMatt-PDP.png",
  fiveMlRollOnPdp: "2026-07-13-GBCylBlu5RollGlMatt-PDP.png",
  regularNineRollOnPdp: "2026-07-13-GBCylFrst9MtlRollMattGl-PDP.png",
  tallNineRollOnPdp: "2026-07-13-GBTallCylFrst9MtlRollGlMatt-PDP.png",
  twentyEightRollOnPdp: "2026-07-13-GBRoll28Blk-PDP.png",
  fiftyRollOnPdp: "2026-07-13-GBCyl50RollBlk-PDP.png",
  twentyFiveSprayPdp: "2026-07-13-GBcyl25SpryShnBlk-PDP.png",
} as const;

const DEFAULT_EVIDENCE: CylinderApplicatorCurveEvidenceInputs = {
  reviewVersion: "2026-07-13-user-applicator-curves-v3",
  fiveMlSprayPdp: {
    path: "/var/folders/g3/l_7f2hg57x90xzht2md1q_hm0000gn/T/TemporaryItems/NSIRD_screencaptureui_2ZVxO9/Screenshot 2026-07-12 at 8.22.28 PM.png",
    sha256: "48d3e63424a9c706d67ac8124092d7da0566fc47c55c71092874480d4d68923d",
    foregroundBounds: { left: 370, top: 128, width: 110, height: 395 },
  },
  tallNineSprayPdp: {
    path: "/var/folders/g3/l_7f2hg57x90xzht2md1q_hm0000gn/T/TemporaryItems/NSIRD_screencaptureui_hIK5jb/Screenshot 2026-07-12 at 8.23.18 PM.png",
    sha256: "b89665eb0aed69942dc2d46fe77fd84e276bccde226994902687b3e5ed1538e1",
    foregroundBounds: { left: 390, top: 140, width: 85, height: 420 },
  },
  twentyFiveReducerPdp: {
    path: "/var/folders/g3/l_7f2hg57x90xzht2md1q_hm0000gn/T/TemporaryItems/NSIRD_screencaptureui_wV03GS/Screenshot 2026-07-13 at 7.20.23 AM.png",
    sha256: "b69ec458173c72f7fbb2a8d5f736fa3cdc77d8ec2611cf959d6969ceb94842c2",
    foregroundBounds: { left: 1055, top: 315, width: 260, height: 770 },
  },
  regularNineSprayPdp: {
    path: "/var/folders/g3/l_7f2hg57x90xzht2md1q_hm0000gn/T/TemporaryItems/NSIRD_screencaptureui_LwCoLR/Screenshot 2026-07-13 at 6.59.57 AM.png",
    sha256: "7f816c862f4f2d7dd43c0f717857fb1904220070471a8acf027260a309f2f3b9",
  },
  glassRodPdp: {
    path: "tmp/best-bottles-reference-production/cylinder-body-scale-truth-v2/evidence/2026-07-13-GB09BlackCapApp-PDP.png",
    sha256: "8a1b32f840129e8b99f921763bb8ce591953cfca8e57145707a6dc5f3e704b31",
  },
  tallRectangleTenPdp: {
    path: "/var/folders/g3/l_7f2hg57x90xzht2md1q_hm0000gn/T/TemporaryItems/NSIRD_screencaptureui_rgGhYX/Screenshot 2026-07-13 at 7.00.44 AM.png",
    sha256: "24f5e3b3de958a01a83d790884d1d1968ad9192ece5c39ea70bb1d3324bc3368",
  },
  fiveMlRollOnPdp: {
    path: "/var/folders/g3/l_7f2hg57x90xzht2md1q_hm0000gn/T/TemporaryItems/NSIRD_screencaptureui_8DwwCb/Screenshot 2026-07-13 at 7.40.34 AM.png",
    sha256: "dab8f0c493ec7da6a40f4573a11c44c6e0419109274c8a683dc17b8506a97ef6",
    foregroundBounds: { left: 946, top: 278, width: 205, height: 772 },
  },
  regularNineRollOnPdp: {
    path: "/var/folders/g3/l_7f2hg57x90xzht2md1q_hm0000gn/T/TemporaryItems/NSIRD_screencaptureui_HwbdX0/Screenshot 2026-07-13 at 7.41.25 AM.png",
    sha256: "ea8ad3c65c968b1a7d32a92c470c4f4c8892d94a321d39109400d2508bf21ab4",
    foregroundBounds: { left: 987, top: 296, width: 176, height: 771 },
  },
  tallNineRollOnPdp: {
    path: "/var/folders/g3/l_7f2hg57x90xzht2md1q_hm0000gn/T/TemporaryItems/NSIRD_screencaptureui_IsvDwA/Screenshot 2026-07-13 at 7.41.53 AM.png",
    sha256: "4bbaa5e6f488c91bd704dcac6bec155249b8d6ee48bd9a1bbeb657e311cbd995",
    foregroundBounds: { left: 1027, top: 274, width: 117, height: 771 },
  },
  twentyEightRollOnPdp: {
    path: "/var/folders/g3/l_7f2hg57x90xzht2md1q_hm0000gn/T/TemporaryItems/NSIRD_screencaptureui_Soouyj/Screenshot 2026-07-13 at 7.42.43 AM.png",
    sha256: "99aa60eb117e16149c0697368ad4cd2a97439fe8141aee58d8e557ff8f54324d",
    foregroundBounds: { left: 969, top: 318, width: 234, height: 772 },
  },
  fiftyRollOnPdp: {
    path: "/var/folders/g3/l_7f2hg57x90xzht2md1q_hm0000gn/T/TemporaryItems/NSIRD_screencaptureui_HPQgLU/Screenshot 2026-07-13 at 7.46.14 AM.png",
    sha256: "efc384b09524074b67dbff8f2c07ff1a8b939da3ad3b60546530a0a0cd98e36c",
    foregroundBounds: { left: 997, top: 292, width: 232, height: 772 },
  },
  twentyFiveSprayPdp: {
    path: "/var/folders/g3/l_7f2hg57x90xzht2md1q_hm0000gn/T/TemporaryItems/NSIRD_screencaptureui_mPOG5j/Screenshot 2026-07-13 at 7.48.39 AM.png",
    sha256: "e4c77a46280b85778843e387cb8711251ae4b6ea953c2eb5cab80d16e5ab888e",
    foregroundBounds: { left: 1070, top: 300, width: 230, height: 765 },
  },
};

type UnknownRecord = Record<string, any>;
type Crop = { left: number; top: number; width: number; height: number };
type CurveKey = "sprays" | "rollOns" | "reducers";
type ApplicatorSystem = "fine-mist-or-perfume-pump-spray" | "roller-ball-roll-on" | "reducer";

export type CylinderApplicatorCurveEvidenceInputs = {
  reviewVersion: "2026-07-13-user-applicator-curves-v3";
  fiveMlSprayPdp: { path: string; sha256: string; foregroundBounds: Crop };
  tallNineSprayPdp: { path: string; sha256: string; foregroundBounds: Crop };
  twentyFiveReducerPdp: { path: string; sha256: string; foregroundBounds: Crop };
  regularNineSprayPdp: { path: string; sha256: string };
  glassRodPdp: { path: string; sha256: string };
  tallRectangleTenPdp: { path: string; sha256: string };
  fiveMlRollOnPdp: { path: string; sha256: string; foregroundBounds: Crop };
  regularNineRollOnPdp: { path: string; sha256: string; foregroundBounds: Crop };
  tallNineRollOnPdp: { path: string; sha256: string; foregroundBounds: Crop };
  twentyEightRollOnPdp: { path: string; sha256: string; foregroundBounds: Crop };
  fiftyRollOnPdp: { path: string; sha256: string; foregroundBounds: Crop };
  twentyFiveSprayPdp: { path: string; sha256: string; foregroundBounds: Crop };
};

export type CylinderCurvePosition = {
  curve: CurveKey;
  displayKey: string;
  label: string;
  status: "ready" | "blocked";
  family: "Cylinder";
  applicatorSystem: ApplicatorSystem;
  capacityMl: number;
  bodyHeightMm: number;
  widthAxisMm: number;
  secondAxisMm: number;
  heightWithCapMm: number;
  targetAssembledHeightPx: number | null;
  targetBodyHeightPx: number;
  sourceTypeKeys: string[];
  collapsedSourceBodyKeys: string[];
  reviewDecision: string;
  referenceClass: "approved-psd-derived" | "user-confirmed-pdp-screenshot-scale-only" | "blocked-no-exact-reference";
  canonicalIdentityKey: string | null;
  websiteSku: string | null;
  graceSku: string | null;
  previewPath: string | null;
  previewSha256: string | null;
  foregroundBounds: Crop | null;
  blockerIdentityKeys: string[];
  blockerReason: string | null;
};

type CylinderCurve = {
  label: string;
  applicatorSystem: ApplicatorSystem;
  positions: CylinderCurvePosition[];
};

export type CylinderApplicatorCurvePlan = {
  version: "best-bottles-cylinder-applicator-curves-plan-v1";
  scaleMode: "linear-millimeters";
  pixelsPerMm: typeof PIXELS_PER_MM;
  curves: Record<CurveKey, CylinderCurve>;
  classificationReview: {
    glassWand: {
      canonicalIdentityKey: "GB09BLACKCAPAPP|GBCYLCLR9MLT01";
      currentSourceFamily: "Cylinder";
      proposedFamily: "Vial";
      decisionStatus: "candidate-not-written";
      reason: string;
    };
  };
  reconciliationFindings: {
    twentyFiveMlSpray: {
      websiteSku: "GBcyl25SpryShnBlk";
      pdpDimensions: { bodyHeightMm: number; widthAxisMm: number; secondAxisMm: number; heightWithCapMm: number; neckThreadSize: string };
      decisionStatus:
        | "canonical-measurement-ready-identity-blocked"
        | "canonical-measurement-and-identity-ready";
      measurementSource: string;
      blocker: string | null;
      productionReferencePromoted: false;
      replacesDisplayPosition: "spray|30";
      excludedThirtyMlIdentityCount: 2;
    };
    twentyFiveMlReducer: {
      websiteSku: "GBcyl25RdcrBlkLthr";
      pdpDimensions: { bodyHeightMm: 83; widthAxisMm: 32; secondAxisMm: 32; heightWithCapMm: 97; neckThreadSize: "18-415" };
      decisionStatus: "source-reconciliation-required";
      blocker: string;
      productionReferencePromoted: false;
    };
  };
  outOfFamilyEvidence: {
    tallRectangleTen: { family: "Tall Rectangular/Rectangle"; includedInCylinderCurves: false; evidenceSha256: string };
    bostonRound: { family: "Boston Round"; includedInCylinderCurves: false; canonicalBodies: string[] };
  };
};

type PreviewInspection = {
  displayKey: string;
  curve: CurveKey;
  canonicalIdentityKey: string | null;
  path: string;
  sha256: string;
  width: number;
  height: number;
  channels: number;
  hasAlpha: boolean;
  fullyOpaque: true;
  crop: Crop;
};

type OutputRecord = {
  path: string;
  sha256: string;
  dimensions?: { width: number; height: number };
  channels?: number;
  hasAlpha?: boolean;
};

export type CylinderApplicatorCurvesManifest = {
  version: "best-bottles-cylinder-applicator-curves-v1";
  generatedAt: string;
  scaleMode: "linear-millimeters";
  pixelsPerMm: typeof PIXELS_PER_MM;
  scaleContractVersion: typeof SCALE_CONTRACT_VERSION;
  sourceManifest: { path: string; sha256: string };
  reviewEvidence: Record<keyof typeof EVIDENCE_NAMES, { path: string; sha256: string; role: string; productionReferencePromoted: false }>;
  summary: {
    sourceTypeCount: 81;
    sourceReadyTypeCount: 41;
    sourceBlockedTypeCount: 40;
    sourceBlockedIdentityCount: 216;
    displayPositionCount: 18;
    readyPositionCount: 16;
    blockedPositionCount: 2;
    sprayPositionCount: 8;
    rollOnPositionCount: 7;
    reducerPositionCount: 3;
  };
  curves: CylinderApplicatorCurvePlan["curves"];
  classificationReview: CylinderApplicatorCurvePlan["classificationReview"];
  reconciliationFindings: CylinderApplicatorCurvePlan["reconciliationFindings"];
  outOfFamilyEvidence: CylinderApplicatorCurvePlan["outOfFamilyEvidence"];
  sourceBlockers: UnknownRecord[];
  previews: PreviewInspection[];
  outputs: Record<string, OutputRecord>;
  selfPath: string;
  selfHashStatus: "excluded-self-referential";
  externalWriteCount: 0;
};

export type RenderCylinderApplicatorCurvesOptions = {
  manifestPath: string;
  outputRoot: string;
  evidence: CylinderApplicatorCurveEvidenceInputs;
  generatedAt?: string;
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function number(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be a positive canonical number.`);
  return parsed;
}

function parseJson(bytes: Uint8Array, label: string): UnknownRecord {
  try {
    const parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("root value is not an object");
    return parsed;
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${String(error)}`);
  }
}

function findType(manifest: UnknownRecord, typeKey: string): UnknownRecord {
  const matches = (manifest.types ?? []).filter((type: UnknownRecord) => type.typeKey === typeKey);
  if (matches.length !== 1) throw new Error(`Expected one exact type ${typeKey}; received ${matches.length}.`);
  return matches[0];
}

function findIdentity(manifest: UnknownRecord, canonicalIdentityKey: string): { type: UnknownRecord; identity: UnknownRecord } {
  const matches = (manifest.types ?? []).flatMap((type: UnknownRecord) => (type.identities ?? [])
    .filter((identity: UnknownRecord) => identity.canonicalIdentityKey === canonicalIdentityKey)
    .map((identity: UnknownRecord) => ({ type, identity })));
  if (matches.length !== 1) throw new Error(`Expected one exact identity ${canonicalIdentityKey}; received ${matches.length}.`);
  return matches[0];
}

function canonicalFromType(type: UnknownRecord): { capacityMl: number; bodyHeightMm: number; widthAxisMm: number; secondAxisMm: number; heightWithCapMm: number } {
  return {
    capacityMl: number(type.canonical?.capacityMl, "capacityMl"),
    bodyHeightMm: number(type.canonical?.bodyHeightMm, "bodyHeightMm"),
    widthAxisMm: number(type.canonical?.widthAxisMm, "widthAxisMm"),
    secondAxisMm: number(type.canonical?.secondAxisMm, "secondAxisMm"),
    heightWithCapMm: number(type.scale?.canonical?.heightWithCapMm, "heightWithCapMm"),
  };
}

function primaryReference(identity: UnknownRecord): UnknownRecord {
  if (identity.referenceReady !== true || !identity.primaryReference) {
    throw new Error(`Identity ${String(identity.canonicalIdentityKey)} lacks an exact approved reference.`);
  }
  return identity.primaryReference;
}

function readyPosition(input: {
  manifest: UnknownRecord;
  curve: CurveKey;
  displayKey: string;
  label: string;
  applicatorSystem: ApplicatorSystem;
  typeKey: string;
  identityKey?: string;
  sourceTypeKeys?: string[];
  collapsedSourceBodyKeys: string[];
  reviewDecision: string;
  evidence?: { path: string; sha256: string; foregroundBounds: Crop };
  explicitBounds?: Crop;
}): CylinderCurvePosition {
  const type = findType(input.manifest, input.typeKey);
  const identityKey = input.identityKey ?? String(type.representative?.canonicalIdentityKey ?? "");
  const { identity } = findIdentity(input.manifest, identityKey);
  const dimensions = canonicalFromType(type);
  const identityCanonical = identity.canonical ?? {};
  const reference = input.evidence ? null : primaryReference(identity);
  const foregroundBounds = input.evidence?.foregroundBounds
    ?? input.explicitBounds
    ?? (type.representative?.canonicalIdentityKey === identityKey ? type.representative?.foregroundBounds : null);
  if (!foregroundBounds) throw new Error(`Ready position ${input.displayKey} lacks exact foreground bounds.`);
  const previewPath = path.resolve(input.evidence?.path ?? String(reference.previewPath));
  const previewSha256 = input.evidence?.sha256 ?? String(reference.previewSha256);
  return {
    curve: input.curve,
    displayKey: input.displayKey,
    label: input.label,
    status: "ready",
    family: "Cylinder",
    applicatorSystem: input.applicatorSystem,
    ...dimensions,
    targetAssembledHeightPx: dimensions.heightWithCapMm * PIXELS_PER_MM,
    targetBodyHeightPx: dimensions.bodyHeightMm * PIXELS_PER_MM,
    sourceTypeKeys: input.sourceTypeKeys ?? [input.typeKey],
    collapsedSourceBodyKeys: input.collapsedSourceBodyKeys,
    reviewDecision: input.reviewDecision,
    referenceClass: input.evidence ? "user-confirmed-pdp-screenshot-scale-only" : "approved-psd-derived",
    canonicalIdentityKey: identityKey,
    websiteSku: String(identityCanonical.websiteSku ?? ""),
    graceSku: String(identityCanonical.graceSku ?? ""),
    previewPath,
    previewSha256,
    foregroundBounds: { ...foregroundBounds },
    blockerIdentityKeys: [],
    blockerReason: null,
  };
}

function blockedPosition(input: {
  manifest: UnknownRecord;
  curve: CurveKey;
  displayKey: string;
  label: string;
  applicatorSystem: ApplicatorSystem;
  typeKeys: string[];
  collapsedSourceBodyKeys: string[];
  reviewDecision: string;
}): CylinderCurvePosition {
  const types = input.typeKeys.map((key) => findType(input.manifest, key));
  if (types.some((type) => type.status !== "blocked")) throw new Error(`Blocked position ${input.displayKey} contains a ready source type.`);
  const dimensions = canonicalFromType(types[0]);
  for (const type of types.slice(1)) {
    const candidate = canonicalFromType(type);
    if (candidate.capacityMl !== dimensions.capacityMl
      || candidate.bodyHeightMm !== dimensions.bodyHeightMm
      || candidate.widthAxisMm !== dimensions.widthAxisMm
      || candidate.secondAxisMm !== dimensions.secondAxisMm
      || candidate.heightWithCapMm !== dimensions.heightWithCapMm) {
      throw new Error(`Blocked position ${input.displayKey} mixes incompatible canonical dimensions.`);
    }
  }
  const blockerIdentityKeys = [...new Set(types.flatMap((type) => (type.identities ?? []).map((identity: UnknownRecord) => String(identity.canonicalIdentityKey))))].sort();
  if (blockerIdentityKeys.length === 0) throw new Error(`Blocked position ${input.displayKey} has no explicit source identities.`);
  return {
    curve: input.curve,
    displayKey: input.displayKey,
    label: input.label,
    status: "blocked",
    family: "Cylinder",
    applicatorSystem: input.applicatorSystem,
    ...dimensions,
    targetAssembledHeightPx: null,
    targetBodyHeightPx: dimensions.bodyHeightMm * PIXELS_PER_MM,
    sourceTypeKeys: [...input.typeKeys],
    collapsedSourceBodyKeys: [...input.collapsedSourceBodyKeys],
    reviewDecision: input.reviewDecision,
    referenceClass: "blocked-no-exact-reference",
    canonicalIdentityKey: null,
    websiteSku: null,
    graceSku: null,
    previewPath: null,
    previewSha256: null,
    foregroundBounds: null,
    blockerIdentityKeys,
    blockerReason: "No exact user-approved PSD-derived or PDP reference is available for this physical position.",
  };
}

function evidenceOnlyTwentyFiveMlReducer(
  evidence: CylinderApplicatorCurveEvidenceInputs["twentyFiveReducerPdp"],
): CylinderCurvePosition {
  return {
    curve: "reducers",
    displayKey: "reducer|25",
    label: "25 mL reducer",
    status: "ready",
    family: "Cylinder",
    applicatorSystem: "reducer",
    capacityMl: 25,
    bodyHeightMm: 83,
    widthAxisMm: 32,
    secondAxisMm: 32,
    heightWithCapMm: 97,
    targetAssembledHeightPx: 97 * PIXELS_PER_MM,
    targetBodyHeightPx: 83 * PIXELS_PER_MM,
    sourceTypeKeys: [],
    collapsedSourceBodyKeys: ["cylinder|25|83|32|32"],
    reviewDecision: "Exact user-provided live PDP establishes the 25 mL Cylinder reducer scale position; canonical/Grace identity remains unresolved.",
    referenceClass: "user-confirmed-pdp-screenshot-scale-only",
    canonicalIdentityKey: null,
    websiteSku: "GBcyl25RdcrBlkLthr",
    graceSku: null,
    previewPath: path.resolve(evidence.path),
    previewSha256: evidence.sha256,
    foregroundBounds: { ...evidence.foregroundBounds },
    blockerIdentityKeys: [],
    blockerReason: "GBcyl25RdcrBlkLthr is absent from canonical master and the 81-type Cylinder manifest; Grace SKU is unresolved and production promotion is blocked.",
  };
}

function evidenceOnlyTwentyFiveMlSpray(
  evidence: CylinderApplicatorCurveEvidenceInputs["twentyFiveSprayPdp"],
  canonical: CanonicalTruthRow,
): CylinderCurvePosition {
  const capacityMl = number(canonical.capacityMl, "GBcyl25SpryShnBlk capacityMl");
  const bodyHeightMm = number(canonical.canon_bodyHeightMm, "GBcyl25SpryShnBlk canon_bodyHeightMm");
  const widthAxisMm = number(canonical.canon_widthAxisMm, "GBcyl25SpryShnBlk canon_widthAxisMm");
  const secondAxisMm = number(canonical.canon_secondAxisMm, "GBcyl25SpryShnBlk canon_secondAxisMm");
  const heightWithCapMm = number(canonical.canon_heightWithCapMm, "GBcyl25SpryShnBlk canon_heightWithCapMm");
  const graceSku = canonical.grace_sku.trim() || null;
  return {
    curve: "sprays",
    displayKey: "spray|25",
    label: "25 mL spray",
    status: "ready",
    family: "Cylinder",
    applicatorSystem: "fine-mist-or-perfume-pump-spray",
    capacityMl,
    bodyHeightMm,
    widthAxisMm,
    secondAxisMm,
    heightWithCapMm,
    targetAssembledHeightPx: heightWithCapMm * PIXELS_PER_MM,
    targetBodyHeightPx: bodyHeightMm * PIXELS_PER_MM,
    sourceTypeKeys: [],
    collapsedSourceBodyKeys: [`cylinder|${capacityMl}|${bodyHeightMm}|${widthAxisMm}|${secondAxisMm}`],
    reviewDecision: "Canonical manual-override row and exact supplied live PDP establish the 25 mL shiny-black Cylinder perfume-spray position in the 25/50/100 mL trio; the unrelated squat 30 mL body is excluded from this controlled curve.",
    referenceClass: "user-confirmed-pdp-screenshot-scale-only",
    canonicalIdentityKey: `GBCYL25SPRYSHNBLK|${graceSku ? graceSku.toUpperCase().replace(/[^A-Z0-9]/g, "") : "GRACE-UNRESOLVED"}`,
    websiteSku: "GBcyl25SpryShnBlk",
    graceSku,
    previewPath: path.resolve(evidence.path),
    previewSha256: evidence.sha256,
    foregroundBounds: { ...evidence.foregroundBounds },
    blockerIdentityKeys: [],
    blockerReason: graceSku === null
      ? "Canonical measurements are ready; Grace SKU is unresolved and production promotion/publishing remains blocked."
      : null,
  };
}

function exactCanonicalWebsiteRow(
  rows: readonly CanonicalTruthRow[],
  websiteSku: string,
): CanonicalTruthRow {
  const normalized = websiteSku.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const matches = rows.filter((row) => row.website_sku.toUpperCase().replace(/[^A-Z0-9]/g, "") === normalized);
  if (matches.length !== 1) {
    throw new Error(`Expected one canonical row for ${websiteSku}; received ${matches.length}.`);
  }
  return matches[0];
}

function typeKeysFor(manifest: UnknownRecord, predicate: (type: UnknownRecord) => boolean): string[] {
  return (manifest.types ?? []).filter(predicate).map((type: UnknownRecord) => String(type.typeKey)).sort();
}

export function buildCylinderApplicatorCurvePlan(
  manifest: UnknownRecord,
  evidence: CylinderApplicatorCurveEvidenceInputs,
  canonicalRows: readonly CanonicalTruthRow[],
): CylinderApplicatorCurvePlan {
  if (manifest.scaleContractVersion !== SCALE_CONTRACT_VERSION) throw new Error(`Source manifest must use ${SCALE_CONTRACT_VERSION}.`);
  if (manifest.summary?.typeCount !== 81 || manifest.summary?.readyTypeCount !== 41
    || manifest.summary?.blockedTypeCount !== 40 || manifest.summary?.blockedIdentityCount !== 216) {
    throw new Error("Source manifest must retain 81 types, 41 ready types, 40 blocked types, and 216 blocked identities.");
  }
  if (evidence.reviewVersion !== "2026-07-13-user-applicator-curves-v3") throw new Error("Unsupported Cylinder applicator review evidence version.");

  const spraySystem: ApplicatorSystem = "fine-mist-or-perfume-pump-spray";
  const rollOnSystem: ApplicatorSystem = "roller-ball-roll-on";
  const reducerSystem: ApplicatorSystem = "reducer";
  const twentyFiveSprayCanonical = exactCanonicalWebsiteRow(canonicalRows, "GBcyl25SpryShnBlk");
  const sprayRegularNineTypes = typeKeysFor(manifest, (type) => type.canonical?.capacityMl === 9
    && [70, 74].includes(Number(type.canonical?.bodyHeightMm))
    && ["fine mist sprayer"].includes(String(type.canonical?.applicator ?? "").toLowerCase()));
  const rollOnFiveTypes = typeKeysFor(manifest, (type) => type.status === "blocked" && type.canonical?.capacityMl === 5
    && String(type.canonical?.applicator ?? "").toLowerCase().includes("roller"));
  const rollOnClassicTwentyTypes = typeKeysFor(manifest, (type) => type.status === "blocked" && type.canonical?.capacityMl === 9
    && Number(type.canonical?.bodyHeightMm) === 70 && Number(type.canonical?.widthAxisMm) === 20
    && String(type.canonical?.applicator ?? "").toLowerCase().includes("roller"));
  const rollOnClassicTwentyOneTypes = typeKeysFor(manifest, (type) => type.status === "blocked" && type.canonical?.capacityMl === 9
    && Number(type.canonical?.bodyHeightMm) === 70 && Number(type.canonical?.widthAxisMm) === 21
    && String(type.canonical?.applicator ?? "").toLowerCase().includes("roller"));
  const rollOnTallNineTypes = typeKeysFor(manifest, (type) => type.status === "blocked" && type.canonical?.capacityMl === 9
    && Number(type.canonical?.bodyHeightMm) === 106 && String(type.canonical?.applicator ?? "").toLowerCase().includes("roller"));
  const rollOnTwentyEightTypes = typeKeysFor(manifest, (type) => type.status === "blocked" && type.canonical?.capacityMl === 28
    && String(type.canonical?.applicator ?? "").toLowerCase().includes("roller"));
  const rollOnFiftyTypes = typeKeysFor(manifest, (type) => type.status === "blocked" && type.canonical?.capacityMl === 50
    && Number(type.canonical?.bodyHeightMm) === 98 && String(type.canonical?.applicator ?? "").toLowerCase().includes("roller"));

  const sprays: CylinderCurvePosition[] = [
    readyPosition({ manifest, curve: "sprays", displayKey: "spray|3", label: "3 mL spray", applicatorSystem: spraySystem, typeKey: "cylinder|3|37|14|14|12mm|fine mist sprayer|spray", collapsedSourceBodyKeys: ["cylinder|3|37|14|14"], reviewDecision: "One exact approved fine-mist representative for the 3 mL body." }),
    readyPosition({ manifest, curve: "sprays", displayKey: "spray|4", label: "4 mL spray", applicatorSystem: spraySystem, typeKey: "cylinder|4|49|14|14|12mm|fine mist sprayer|spray", collapsedSourceBodyKeys: ["cylinder|4|49|14|14"], reviewDecision: "One exact approved fine-mist representative for the 4 mL body." }),
    readyPosition({ manifest, curve: "sprays", displayKey: "spray|5", label: "5 mL spray", applicatorSystem: spraySystem, typeKey: "cylinder|5|53|17|17|13-415|fine mist sprayer|spray", identityKey: "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK", sourceTypeKeys: ["cylinder|5|53|17|17|13-415|fine mist sprayer|spray", "cylinder|5|54.2|17|17|13-415|fine mist sprayer|spray"], collapsedSourceBodyKeys: ["cylinder|5|53|17|17", "cylinder|5|54.2|17|17"], reviewDecision: "User selected the exact 53 mm-body 5 mL fine-mist PDP; the 54.2 mm source body remains preserved but is not a second display position.", evidence: evidence.fiveMlSprayPdp }),
    readyPosition({ manifest, curve: "sprays", displayKey: "spray|9|regular", label: "9 mL regular spray", applicatorSystem: spraySystem, typeKey: "cylinder|9|70|20|20|17-415|fine mist sprayer|spray", identityKey: "GBCYLAMB9SPRYBLK|GBCYLAMB9MLSPRBLK", sourceTypeKeys: sprayRegularNineTypes, collapsedSourceBodyKeys: ["cylinder|9|70|20|20", "cylinder|9|74|20|20", "cylinder|9|74|21|21"], reviewDecision: "User confirmed the copper-top and two sprayer variants represent one regular 9 mL scale body; exact amber/black 70/96 mm spray selected." }),
    readyPosition({ manifest, curve: "sprays", displayKey: "spray|9|tall", label: "9 mL tall spray", applicatorSystem: spraySystem, typeKey: "cylinder|9|106|18|18|13-415|fine mist sprayer|tall", identityKey: "GBTALLCYL9SPRYBLKMATT|GBCYLCLR9MLSPRMBLK", collapsedSourceBodyKeys: ["cylinder|9|106|18|18"], reviewDecision: "Exact user-confirmed tall Cylinder fine-mist PDP selected; no regular 9 mL reference substituted.", evidence: evidence.tallNineSprayPdp }),
    evidenceOnlyTwentyFiveMlSpray(
      evidence.twentyFiveSprayPdp,
      twentyFiveSprayCanonical,
    ),
    readyPosition({ manifest, curve: "sprays", displayKey: "spray|50", label: "50 mL spray", applicatorSystem: spraySystem, typeKey: "cylinder|50|117|32|32|18-415|perfume spray pump|spray", identityKey: "GBCYL50SPRYSHNBLK|GBCYLCLR50MLSPRSBLK", collapsedSourceBodyKeys: ["cylinder|50|117|32|32"], reviewDecision: "Exact approved shiny-black perfume-pump representative selected to hold spray appearance constant.", explicitBounds: { left: 274, top: 63, width: 254, height: 1117 } }),
    readyPosition({ manifest, curve: "sprays", displayKey: "spray|100", label: "100 mL spray", applicatorSystem: spraySystem, typeKey: "cylinder|100|154|35|35|18-415|perfume spray pump|spray", identityKey: "GBCYL100SPRYSHNBLK|GBCYLCLR100MLSPRSBLK", collapsedSourceBodyKeys: ["cylinder|100|154|35|35"], reviewDecision: "Exact approved shiny-black perfume-pump representative selected to hold spray appearance constant.", explicitBounds: { left: 275, top: 15, width: 220, height: 1160 } }),
  ];

  const rollOns: CylinderCurvePosition[] = [
    readyPosition({ manifest, curve: "rollOns", displayKey: "roll-on|5", label: "5 mL regular roll-on", applicatorSystem: rollOnSystem, typeKey: "cylinder|5|53|17|17|13-415|plastic roller ball|screw cap", identityKey: "GBCYLBLU5ROLLGLMATT|GBCYLBLU5MLROLMGLD", sourceTypeKeys: rollOnFiveTypes, collapsedSourceBodyKeys: ["cylinder|5|53|17|17"], reviewDecision: "Exact supplied 5 mL regular roll-on PDP establishes the 53×17 mm body / 65 mm assembled position; sibling finishes share this body but are not substituted as images.", evidence: evidence.fiveMlRollOnPdp }),
    blockedPosition({ manifest, curve: "rollOns", displayKey: "roll-on|9|classic-20", label: "9 mL classic 20 mm roll-on", applicatorSystem: rollOnSystem, typeKeys: rollOnClassicTwentyTypes, collapsedSourceBodyKeys: ["cylinder|9|70|20|20"], reviewDecision: "Distinct canonical 70×20 mm classic roll-on shell retained with all 33 identities; no exact supplied or approved reference exists." }),
    blockedPosition({ manifest, curve: "rollOns", displayKey: "roll-on|9|classic-21", label: "9 mL classic 21 mm roll-on", applicatorSystem: rollOnSystem, typeKeys: rollOnClassicTwentyOneTypes, collapsedSourceBodyKeys: ["cylinder|9|70|21|21"], reviewDecision: "Distinct canonical 70×21 mm classic roll-on shell retained with all 27 identities; no exact supplied or approved reference exists." }),
    readyPosition({ manifest, curve: "rollOns", displayKey: "roll-on|9|regular", label: "9 mL regular frosted roll-on", applicatorSystem: rollOnSystem, typeKey: "cylinder|9|74|21|21|17-415|metal roller ball|screw cap", identityKey: "GBCYLFRST9MTLROLLMATTGL|GBCYLFRS9MLMRLMGLD", collapsedSourceBodyKeys: ["cylinder|9|74|21|21"], reviewDecision: "Exact supplied PDP confirms the 74×21 mm regular frosted roll-on at 87 mm assembled height; the approved identity-locked PSD-derived PNG supplies the plate image." }),
    readyPosition({ manifest, curve: "rollOns", displayKey: "roll-on|9|tall", label: "9 mL tall roll-on", applicatorSystem: rollOnSystem, typeKey: "cylinder|9|106|18|18|13-415|metal roller ball|tall", identityKey: "GBTALLCYLFRST9MTLROLLGLMATT|GBCYLFRS9MLT05", sourceTypeKeys: rollOnTallNineTypes, collapsedSourceBodyKeys: ["cylinder|9|106|18|18"], reviewDecision: "Exact supplied tall 9 mL PDP establishes the 106×18 mm body / 118 mm assembled position; live PDP matte-gold closure evidence is preserved without rewriting conflicting source metadata.", evidence: evidence.tallNineRollOnPdp }),
    readyPosition({ manifest, curve: "rollOns", displayKey: "roll-on|28", label: "28 mL roll-on", applicatorSystem: rollOnSystem, typeKey: "cylinder|28|81|31|31|16mm|plastic roller ball|roll-on", identityKey: "GBROLL28BLK|GBCYLCLR28MLRBL", sourceTypeKeys: rollOnTwentyEightTypes, collapsedSourceBodyKeys: ["cylinder|28|81|31|31"], reviewDecision: "Exact supplied 28 mL PDP establishes the 81×31 mm body / 100 mm assembled position and black cap; stale conflicting cap-color metadata is not silently treated as image truth.", evidence: evidence.twentyEightRollOnPdp }),
    readyPosition({ manifest, curve: "rollOns", displayKey: "roll-on|50", label: "50 mL roll-on", applicatorSystem: rollOnSystem, typeKey: "cylinder|50|98|37|37|16mm|plastic roller ball|roll-on", identityKey: "GBCYL50ROLLBLK|GBCYLBLK50MLROLBLK", sourceTypeKeys: rollOnFiftyTypes, collapsedSourceBodyKeys: ["cylinder|50|98|37|37"], reviewDecision: "Exact supplied 50 mL PDP establishes the clear-glass 98×37 mm body / 116 mm assembled position with black cap; no spray or reducer reference is substituted.", evidence: evidence.fiftyRollOnPdp }),
  ];

  const reducers: CylinderCurvePosition[] = [
    evidenceOnlyTwentyFiveMlReducer(evidence.twentyFiveReducerPdp),
    readyPosition({ manifest, curve: "reducers", displayKey: "reducer|50", label: "50 mL reducer", applicatorSystem: reducerSystem, typeKey: "cylinder|50|117|32|32|18-415|reducer|faux leather", identityKey: "GBCYL50RDCRBLKLTHR|GBCYLCLR50MLRDCBKLT", collapsedSourceBodyKeys: ["cylinder|50|117|32|32"], reviewDecision: "Exact approved black faux-leather reducer selected to match the user-confirmed 25 mL cap topology." }),
    readyPosition({ manifest, curve: "reducers", displayKey: "reducer|100", label: "100 mL reducer", applicatorSystem: reducerSystem, typeKey: "cylinder|100|154|35|35|18-415|reducer|faux leather", identityKey: "GBCYL100RDCRBLKLTHR|GBCYLCLR100MLRDCBKLT", collapsedSourceBodyKeys: ["cylinder|100|154|35|35"], reviewDecision: "Exact approved black faux-leather reducer selected to match the user-confirmed 25 mL cap topology." }),
  ];

  const all = [...sprays, ...rollOns, ...reducers];
  if (all.length !== 18 || all.filter((position) => position.status === "ready").length !== 16
    || all.filter((position) => position.status === "blocked").length !== 2) {
    throw new Error("Controlled Cylinder review must contain 18 positions: 16 ready and 2 blocked.");
  }
  return {
    version: "best-bottles-cylinder-applicator-curves-plan-v1",
    scaleMode: "linear-millimeters",
    pixelsPerMm: PIXELS_PER_MM,
    curves: {
      sprays: { label: "Cylinder sprays only", applicatorSystem: spraySystem, positions: sprays },
      rollOns: { label: "Cylinder roll-ons only", applicatorSystem: rollOnSystem, positions: rollOns },
      reducers: { label: "Cylinder reducers only", applicatorSystem: reducerSystem, positions: reducers },
    },
    classificationReview: {
      glassWand: {
        canonicalIdentityKey: "GB09BLACKCAPAPP|GBCYLCLR9MLT01",
        currentSourceFamily: "Cylinder",
        proposedFamily: "Vial",
        decisionStatus: "candidate-not-written",
        reason: "18-400 glass-wand construction is vial-like; excluded from controlled Cylinder applicator curves",
      },
    },
    reconciliationFindings: {
      twentyFiveMlSpray: {
        websiteSku: "GBcyl25SpryShnBlk",
        pdpDimensions: {
          bodyHeightMm: number(twentyFiveSprayCanonical.canon_bodyHeightMm, "GBcyl25SpryShnBlk canon_bodyHeightMm"),
          widthAxisMm: number(twentyFiveSprayCanonical.canon_widthAxisMm, "GBcyl25SpryShnBlk canon_widthAxisMm"),
          secondAxisMm: number(twentyFiveSprayCanonical.canon_secondAxisMm, "GBcyl25SpryShnBlk canon_secondAxisMm"),
          heightWithCapMm: number(twentyFiveSprayCanonical.canon_heightWithCapMm, "GBcyl25SpryShnBlk canon_heightWithCapMm"),
          neckThreadSize: twentyFiveSprayCanonical.neckThreadSize,
        },
        decisionStatus: twentyFiveSprayCanonical.grace_sku.trim()
          ? "canonical-measurement-and-identity-ready"
          : "canonical-measurement-ready-identity-blocked",
        measurementSource: twentyFiveSprayCanonical.measurementSource,
        blocker: twentyFiveSprayCanonical.grace_sku.trim()
          ? null
          : "Canonical measurements are ready; Grace SKU is unresolved for production promotion/publishing.",
        productionReferencePromoted: false,
        replacesDisplayPosition: "spray|30",
        excludedThirtyMlIdentityCount: 2,
      },
      twentyFiveMlReducer: {
        websiteSku: "GBcyl25RdcrBlkLthr",
        pdpDimensions: { bodyHeightMm: 83, widthAxisMm: 32, secondAxisMm: 32, heightWithCapMm: 97, neckThreadSize: "18-415" },
        decisionStatus: "source-reconciliation-required",
        blocker: "Exact live PDP is missing from canonical master and the 81-type Cylinder manifest; Grace SKU is unresolved.",
        productionReferencePromoted: false,
      },
    },
    outOfFamilyEvidence: {
      tallRectangleTen: { family: "Tall Rectangular/Rectangle", includedInCylinderCurves: false, evidenceSha256: evidence.tallRectangleTenPdp.sha256 },
      bostonRound: {
        family: "Boston Round",
        includedInCylinderCurves: false,
        canonicalBodies: [
          "15 mL — 68×25×25 mm",
          "30 mL — 68×33×33 mm (single quarantined outlier)",
          "30 mL — 78×33×33 mm",
          "60 mL — 94×39×39 mm",
        ],
      },
    },
  };
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) throw new Error(`${label} must be a positive integer.`);
  return Number(value);
}

function validatedCrop(bounds: Crop, width: number, height: number): Crop {
  const crop = { left: Math.floor(bounds.left), top: Math.floor(bounds.top), width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) };
  if (![crop.left, crop.top, crop.width, crop.height].every(Number.isFinite)
    || crop.left < 0 || crop.top < 0 || crop.width <= 0 || crop.height <= 0
    || crop.left + crop.width > width || crop.top + crop.height > height) {
    throw new Error(`Foreground bounds exceed preview ${width}×${height}.`);
  }
  return crop;
}

async function inspectPreviews(plan: CylinderApplicatorCurvePlan): Promise<PreviewInspection[]> {
  const positions = Object.values(plan.curves).flatMap((curve) => curve.positions).filter((position) => position.status === "ready");
  const inspections: PreviewInspection[] = [];
  for (const position of positions) {
    if (!position.previewPath || !position.previewSha256 || !position.foregroundBounds
      || (!position.canonicalIdentityKey && !position.websiteSku)) {
      throw new Error(`Ready position ${position.displayKey} lacks exact preview evidence.`);
    }
    const bytes = await readFile(position.previewPath);
    const actualHash = sha256(bytes);
    if (actualHash !== position.previewSha256) throw new Error(`Preview SHA-256 mismatch for ${position.displayKey}.`);
    const metadata = await sharp(bytes).metadata();
    const width = positiveInteger(metadata.width, "preview width");
    const height = positiveInteger(metadata.height, "preview height");
    const channels = positiveInteger(metadata.channels, "preview channels");
    const stats = await sharp(bytes).stats();
    const alpha = metadata.hasAlpha ? stats.channels[channels - 1] : null;
    if (metadata.hasAlpha && (!alpha || alpha.min !== 255 || alpha.max !== 255)) throw new Error(`Preview for ${position.displayKey} must be fully opaque.`);
    inspections.push({ displayKey: position.displayKey, curve: position.curve, canonicalIdentityKey: position.canonicalIdentityKey, path: position.previewPath, sha256: actualHash, width, height, channels, hasAlpha: Boolean(metadata.hasAlpha), fullyOpaque: true, crop: validatedCrop(position.foregroundBounds, width, height) });
  }
  if (inspections.length !== 16 || new Set(inspections.map((preview) => preview.displayKey)).size !== 16) {
    throw new Error("Controlled Cylinder curves require sixteen unique exact preview inspections.");
  }
  return inspections;
}

function escapeXml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function svgText(input: { x: number; y: number; value: unknown; size: number; color?: string; weight?: number; anchor?: "start" | "middle" | "end" }): string {
  return `<text x="${input.x}" y="${input.y}" font-family="Arial, Helvetica, sans-serif" font-size="${input.size}" font-weight="${input.weight ?? 400}" fill="${input.color ?? INK}" text-anchor="${input.anchor ?? "start"}">${escapeXml(input.value)}</text>`;
}

function truncate(value: unknown, maximum: number): string {
  const text = String(value ?? "");
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`;
}

function dimensionBracket(input: { x: number; top: number; bottom: number; color: string; label: string; anchor: "start" | "end" }): string {
  const direction = input.anchor === "start" ? 1 : -1;
  return [
    `<line x1="${input.x}" y1="${input.top}" x2="${input.x}" y2="${input.bottom}" stroke="${input.color}" stroke-width="4"/>`,
    `<line x1="${input.x}" y1="${input.top}" x2="${input.x + direction * 18}" y2="${input.top}" stroke="${input.color}" stroke-width="4"/>`,
    `<line x1="${input.x}" y1="${input.bottom}" x2="${input.x + direction * 18}" y2="${input.bottom}" stroke="${input.color}" stroke-width="4"/>`,
    svgText({ x: input.x + direction * 24, y: input.top + 22, value: input.label, size: 17, color: input.color, weight: 700, anchor: input.anchor }),
  ].join("\n");
}

function plateBase(curve: CylinderCurve, width: number): Buffer {
  const body: string[] = [
    `<rect width="100%" height="100%" fill="${BACKGROUND}"/>`,
    svgText({ x: 46, y: 60, value: curve.label.toUpperCase(), size: 42, weight: 700 }),
    svgText({ x: 46, y: 104, value: "ONE REPRESENTATIVE PER PHYSICAL BODY • LINEAR 6 PX/MM • NO CROSS-APPLICATOR SUBSTITUTION", size: 22, color: MUTED, weight: 700 }),
    svgText({ x: 46, y: 142, value: "Blocked cards retain canonical dimensions and identities but intentionally show no borrowed product image.", size: 20, color: MUTED }),
    `<line x1="${RULER_WIDTH}" y1="${BASELINE_Y}" x2="${width - 25}" y2="${BASELINE_Y}" stroke="#504d48" stroke-width="5"/>`,
  ];
  for (let millimeters = 0; millimeters <= 200; millimeters += 25) {
    const y = BASELINE_Y - millimeters * PIXELS_PER_MM;
    body.push(`<line x1="${RULER_WIDTH - 32}" y1="${y}" x2="${RULER_WIDTH}" y2="${y}" stroke="#504d48" stroke-width="3"/>`);
    body.push(svgText({ x: RULER_WIDTH - 40, y: y + 7, value: `${millimeters} mm`, size: 17, color: MUTED, weight: 700, anchor: "end" }));
  }
  curve.positions.forEach((position, index) => {
    const left = RULER_WIDTH + index * SLOT_WIDTH;
    const center = left + SLOT_WIDTH / 2;
    const blocked = position.status === "blocked";
    body.push(`<rect x="${left + 5}" y="176" width="${SLOT_WIDTH - 10}" height="${CANVAS_HEIGHT - 198}" rx="12" fill="${blocked ? "#fff0ee" : index % 2 ? "#faf9f6" : "#ffffff"}" stroke="${blocked ? RED : BORDER}" stroke-width="3"/>`);
    body.push(svgText({ x: center, y: 220, value: position.label, size: 25, color: blocked ? RED : GREEN, weight: 700, anchor: "middle" }));
    if (blocked) {
      body.push(svgText({ x: center, y: 285, value: "BLOCKED — NO EXACT REFERENCE", size: 20, color: RED, weight: 700, anchor: "middle" }));
      body.push(svgText({ x: center, y: 320, value: `${position.blockerIdentityKeys.length} blocked SKU ${position.blockerIdentityKeys.length === 1 ? "identity" : "identities"}`, size: 18, color: RED, anchor: "middle" }));
    }
    body.push(dimensionBracket({ x: center - 115, top: BASELINE_Y - position.bodyHeightMm * PIXELS_PER_MM, bottom: BASELINE_Y, color: BLUE, label: `BODY ${position.bodyHeightMm} mm`, anchor: "end" }));
    body.push(dimensionBracket({ x: center + 115, top: BASELINE_Y - position.heightWithCapMm * PIXELS_PER_MM, bottom: BASELINE_Y, color: blocked ? RED : GREEN, label: `WITH CAP ${position.heightWithCapMm} mm`, anchor: "start" }));
    body.push(svgText({ x: center, y: BASELINE_Y + 54, value: `${position.capacityMl} mL • ${position.bodyHeightMm}×${position.widthAxisMm}×${position.secondAxisMm} mm body`, size: 19, weight: 700, anchor: "middle" }));
    body.push(svgText({ x: center, y: BASELINE_Y + 88, value: blocked ? "NO PRODUCT IMAGE SUBSTITUTED" : `with applicator/closure ${position.heightWithCapMm} mm`, size: 17, color: blocked ? RED : GREEN, weight: 700, anchor: "middle" }));
    body.push(svgText({ x: center, y: BASELINE_Y + 120, value: truncate(blocked ? position.blockerIdentityKeys[0] : `Web: ${position.websiteSku}`, 58), size: 15, color: MUTED, anchor: "middle" }));
    body.push(svgText({ x: center, y: BASELINE_Y + 150, value: truncate(blocked ? position.displayKey : `Grace: ${position.graceSku}`, 58), size: 15, color: MUTED, anchor: "middle" }));
  });
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${width} ${CANVAS_HEIGHT}">${body.join("\n")}</svg>`);
}

async function productImage(preview: PreviewInspection, targetHeight: number): Promise<{ bytes: Buffer; width: number; height: number }> {
  const height = Math.max(1, Math.round(targetHeight));
  const width = Math.max(1, Math.round(height * preview.crop.width / preview.crop.height));
  const bytes = await sharp(preview.path).extract(preview.crop).resize({ width, height, fit: "fill" })
    .flatten({ background: { r: 255, g: 255, b: 255 } }).removeAlpha().toColourspace("srgb").png({ compressionLevel: 9 }).toBuffer();
  return { bytes, width, height };
}

async function renderCurve(curve: CylinderCurve, previews: PreviewInspection[]): Promise<Buffer> {
  const width = RULER_WIDTH + curve.positions.length * SLOT_WIDTH;
  const previewByKey = new Map(previews.filter((preview) => preview.curve === curve.positions[0]?.curve).map((preview) => [preview.displayKey, preview]));
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  for (let index = 0; index < curve.positions.length; index += 1) {
    const position = curve.positions[index];
    if (position.status === "blocked") continue;
    const preview = previewByKey.get(position.displayKey);
    if (!preview || position.targetAssembledHeightPx === null) throw new Error(`Missing inspected preview for ${position.displayKey}.`);
    const rendered = await productImage(preview, position.targetAssembledHeightPx);
    composites.push({ input: rendered.bytes, left: Math.round(RULER_WIDTH + index * SLOT_WIDTH + (SLOT_WIDTH - rendered.width) / 2), top: BASELINE_Y - rendered.height });
  }
  return sharp(plateBase(curve, width)).flatten({ background: BACKGROUND }).composite(composites)
    .flatten({ background: BACKGROUND }).removeAlpha().toColourspace("srgb").png({ compressionLevel: 9 }).toBuffer();
}

function indexHtml(manifestName = MANIFEST_NAME): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Best Bottles Cylinder controlled curves</title><style>
body{margin:0;background:#111;color:#f5f3ef;font-family:Arial,Helvetica,sans-serif}main{max-width:1800px;margin:auto;padding:36px}h1{font-size:42px;margin:0 0 12px}h2{font-size:30px;margin:42px 0 8px}p,li{font-size:20px;line-height:1.5;color:#c8c2b8}strong{color:#9de0bd}.blocked{color:#ff9c92}a{color:#fff}img{display:block;width:100%;height:auto;background:#f5f3ef;border:1px solid #4b4945;margin-top:20px}
</style></head><body><main>
<h1>Cylinder controlled applicator curves</h1>
<p><strong>Three comparisons, never mixed:</strong> conventional pump sprays, roller-ball roll-ons, and reducer bottles. Each uses one representative per physical body and the same linear 6 px/mm height scale.</p>
<p><strong>The 25 mL Cylinder spray is present</strong> at its PDP-confirmed 83×32×32 mm body / 108 mm assembled position, completing the straight 25/50/100 mL perfume-spray trio. The unrelated squat 30 mL body is excluded from this curve; its two identities remain preserved in the source blocker report.</p>
<p><strong>Five supplied roll-on references are reconciled:</strong> 5 mL regular, 9 mL regular frosted, 9 mL tall, 28 mL, and 50 mL. Each occupies its own canonical body position; the 9 mL regular frosted plate image comes from its approved identity-locked PSD-derived PNG.</p>
<p class="blocked"><strong>Two additional 9 mL classic bodies remain blocked:</strong> the 70×20×20 mm shell (33 identities) and the 70×21×21 mm shell (27 identities). They are not collapsed into the supplied 74×21×21 mm frosted bottle and no reference is borrowed. All 216 source-blocked SKU identities remain in the evidence manifest.</p>
<p><strong>The 25 mL Cylinder reducer is present</strong> at its PDP-confirmed 83×32×32 mm body / 97 mm assembled position. Its exact website identity is absent from the canonical master and its Grace SKU is unresolved, so the screenshot is scale-test evidence only and production promotion remains blocked.</p>
<p><strong>Vial reclassification candidate:</strong> GB09BlackCapApp is excluded from these curves because its 18-400 glass-wand construction is vial-like. This is recorded as a candidate only; canonical source data was not rewritten.</p>
<p><strong>Boston Round is a separate canonical family.</strong> Its 15, 30, and 60 mL rounded-shoulder bodies are accounted for as out-of-family evidence and must receive their own family comparison. The attached 10 mL Tall Rectangular spray is likewise preserved but excluded from Cylinder.</p>
<a href="${manifestName}">Evidence manifest</a>
<h2>Cylinder sprays only</h2><a href="${SPRAY_PNG}"><img src="${SPRAY_PNG}" alt="Cylinder spray scale curve"></a>
<h2>Cylinder roll-ons only</h2><a href="${ROLL_ON_PNG}"><img src="${ROLL_ON_PNG}" alt="Cylinder roll-on scale curve"></a>
<h2>Cylinder reducers only</h2><a href="${REDUCER_PNG}"><img src="${REDUCER_PNG}" alt="Cylinder reducer scale curve"></a>
</main></body></html>\n`;
}

async function outputRecord(bytes: Buffer, outputPath: string): Promise<OutputRecord> {
  if (!outputPath.endsWith(".png")) return { path: outputPath, sha256: sha256(bytes) };
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height || metadata.channels !== 3 || metadata.hasAlpha) throw new Error("Cylinder curve PNG must be opaque RGB with dimensions.");
  return { path: outputPath, sha256: sha256(bytes), dimensions: { width: metadata.width, height: metadata.height }, channels: metadata.channels, hasAlpha: metadata.hasAlpha };
}

async function pathExists(target: string): Promise<boolean> {
  try { await access(target); return true; } catch { return false; }
}

async function preserveEvidenceSnapshot(input: { sourcePath: string; expectedSha256: string; targetPath: string }): Promise<string> {
  const targetPath = path.resolve(input.targetPath);
  if (await pathExists(targetPath)) {
    if (sha256(await readFile(targetPath)) !== input.expectedSha256) throw new Error(`Preserved evidence hash mismatch at ${targetPath}; refusing to overwrite it.`);
    return targetPath;
  }
  const sourcePath = path.resolve(input.sourcePath);
  const bytes = await readFile(sourcePath);
  if (sha256(bytes) !== input.expectedSha256) throw new Error(`Incoming evidence hash mismatch for ${sourcePath}.`);
  await mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  try { await writeFile(temporaryPath, bytes, { flag: "wx" }); await rename(temporaryPath, targetPath); }
  finally { await rm(temporaryPath, { force: true }); }
  return targetPath;
}

async function preserveReviewEvidence(outputRoot: string, evidence: CylinderApplicatorCurveEvidenceInputs): Promise<CylinderApplicatorCurveEvidenceInputs> {
  if (evidence.reviewVersion !== "2026-07-13-user-applicator-curves-v3") throw new Error("Unsupported Cylinder applicator review evidence version.");
  const preserved = { ...evidence } as CylinderApplicatorCurveEvidenceInputs;
  for (const key of Object.keys(EVIDENCE_NAMES) as Array<keyof typeof EVIDENCE_NAMES>) {
    const item = evidence[key];
    const targetPath = await preserveEvidenceSnapshot({ sourcePath: item.path, expectedSha256: item.sha256, targetPath: path.join(outputRoot, "evidence", EVIDENCE_NAMES[key]) });
    preserved[key] = { ...item, path: targetPath } as never;
  }
  return preserved;
}

async function promoteOutputs(outputRoot: string, stagedDirectory: string): Promise<void> {
  const backupDirectory = path.join(outputRoot, `.render-backup-${process.pid}-${Date.now()}`);
  await mkdir(backupDirectory);
  const existing = new Set<string>();
  const promoted: string[] = [];
  let preserveBackup = false;
  try {
    for (const name of OUTPUT_NAMES) {
      const target = path.join(outputRoot, name);
      if (await pathExists(target)) { await copyFile(target, path.join(backupDirectory, name)); existing.add(name); }
    }
    for (const name of OUTPUT_NAMES) { await rename(path.join(stagedDirectory, name), path.join(outputRoot, name)); promoted.push(name); }
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const name of [...promoted].reverse()) {
      try { const target = path.join(outputRoot, name); if (existing.has(name)) await rename(path.join(backupDirectory, name), target); else await rm(target, { force: true }); }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) { preserveBackup = true; throw new AggregateError([error, ...rollbackErrors], `Output rollback was incomplete; backup preserved at ${backupDirectory}.`); }
    throw error;
  } finally {
    if (!preserveBackup) await rm(backupDirectory, { recursive: true, force: true });
  }
}

export async function renderCylinderApplicatorCurves(options: RenderCylinderApplicatorCurvesOptions): Promise<{ artifactPaths: Record<(typeof OUTPUT_NAMES)[number], string>; manifest: CylinderApplicatorCurvesManifest }> {
  const manifestPath = path.resolve(options.manifestPath);
  const outputRoot = path.resolve(options.outputRoot);
  if (path.basename(outputRoot) !== OUTPUT_ROOT_NAME) throw new Error(`Output root must be the versioned ${OUTPUT_ROOT_NAME} directory.`);
  await mkdir(outputRoot, { recursive: true });
  const preservedEvidence = await preserveReviewEvidence(outputRoot, options.evidence);
  const sourceBytes = await readFile(manifestPath);
  const sourceManifest = parseJson(sourceBytes, path.basename(manifestPath));
  const canonicalRows = parseCanonicalTruthCsv(
    await readFile(path.resolve(CANONICAL_TRUTH_PATH), "utf8"),
  );
  const plan = buildCylinderApplicatorCurvePlan(sourceManifest, preservedEvidence, canonicalRows);
  const previews = await inspectPreviews(plan);
  const [sprayPng, rollOnPng, reducerPng] = await Promise.all([
    renderCurve(plan.curves.sprays, previews),
    renderCurve(plan.curves.rollOns, previews),
    renderCurve(plan.curves.reducers, previews),
  ]);
  const html = Buffer.from(indexHtml());
  const siblingBytes: Record<string, Buffer> = { [SPRAY_PNG]: sprayPng, [ROLL_ON_PNG]: rollOnPng, [REDUCER_PNG]: reducerPng, [INDEX_NAME]: html };
  const outputs: Record<string, OutputRecord> = {};
  for (const [name, bytes] of Object.entries(siblingBytes)) outputs[name] = await outputRecord(bytes, path.join(outputRoot, name));
  const positions = Object.values(plan.curves).flatMap((curve) => curve.positions);
  const manifest: CylinderApplicatorCurvesManifest = {
    version: "best-bottles-cylinder-applicator-curves-v1",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scaleMode: "linear-millimeters",
    pixelsPerMm: PIXELS_PER_MM,
    scaleContractVersion: SCALE_CONTRACT_VERSION,
    sourceManifest: { path: manifestPath, sha256: sha256(sourceBytes) },
    reviewEvidence: {
      fiveMlSprayPdp: { path: preservedEvidence.fiveMlSprayPdp.path, sha256: preservedEvidence.fiveMlSprayPdp.sha256, role: "Exact GBCylBlu5SpryBlkSh 53/72 mm spray, scale-test-only reference", productionReferencePromoted: false },
      tallNineSprayPdp: { path: preservedEvidence.tallNineSprayPdp.path, sha256: preservedEvidence.tallNineSprayPdp.sha256, role: "Exact GBTallCyl9SpryBlkMatt 106/111 mm spray, scale-test-only reference", productionReferencePromoted: false },
      twentyFiveReducerPdp: { path: preservedEvidence.twentyFiveReducerPdp.path, sha256: preservedEvidence.twentyFiveReducerPdp.sha256, role: "Exact cap-on main PDP image for website-only GBcyl25RdcrBlkLthr 83/97 mm reducer; canonical/Grace identity unresolved", productionReferencePromoted: false },
      regularNineSprayPdp: { path: preservedEvidence.regularNineSprayPdp.path, sha256: preservedEvidence.regularNineSprayPdp.sha256, role: "Exact GBCylAmb9SpryBlk 70/96 mm PDP corroboration; approved PSD supplies plate image", productionReferencePromoted: false },
      glassRodPdp: { path: preservedEvidence.glassRodPdp.path, sha256: preservedEvidence.glassRodPdp.sha256, role: "Exact GB09BlackCapApp evidence; recorded as Vial reclassification candidate and excluded from curves", productionReferencePromoted: false },
      tallRectangleTenPdp: { path: preservedEvidence.tallRectangleTenPdp.path, sha256: preservedEvidence.tallRectangleTenPdp.sha256, role: "Exact GBTallRect10SpryBlkMatt evidence; Tall Rectangular/Rectangle family, excluded from Cylinder", productionReferencePromoted: false },
      fiveMlRollOnPdp: { path: preservedEvidence.fiveMlRollOnPdp.path, sha256: preservedEvidence.fiveMlRollOnPdp.sha256, role: "Exact GBCylBlu5RollGlMatt 53×17 mm body / 65 mm assembled regular roll-on, scale-test-only reference", productionReferencePromoted: false },
      regularNineRollOnPdp: { path: preservedEvidence.regularNineRollOnPdp.path, sha256: preservedEvidence.regularNineRollOnPdp.sha256, role: "Exact GBCylFrst9MtlRollMattGl 74×21 mm body / 87 mm assembled PDP corroboration; approved identity-locked PSD-derived PNG supplies plate image", productionReferencePromoted: false },
      tallNineRollOnPdp: { path: preservedEvidence.tallNineRollOnPdp.path, sha256: preservedEvidence.tallNineRollOnPdp.sha256, role: "Exact GBTallCylFrst9MtlRollGlMatt 106×18 mm body / 118 mm assembled tall roll-on, scale-test-only reference", productionReferencePromoted: false },
      twentyEightRollOnPdp: { path: preservedEvidence.twentyEightRollOnPdp.path, sha256: preservedEvidence.twentyEightRollOnPdp.sha256, role: "Exact GBRoll28Blk 81×31 mm body / 100 mm assembled roll-on with black cap, scale-test-only reference", productionReferencePromoted: false },
      fiftyRollOnPdp: { path: preservedEvidence.fiftyRollOnPdp.path, sha256: preservedEvidence.fiftyRollOnPdp.sha256, role: "Exact GBCyl50RollBlk clear-glass 98×37 mm body / 116 mm assembled roll-on with black cap, scale-test-only reference", productionReferencePromoted: false },
      twentyFiveSprayPdp: { path: preservedEvidence.twentyFiveSprayPdp.path, sha256: preservedEvidence.twentyFiveSprayPdp.sha256, role: "Exact website-only GBcyl25SpryShnBlk 83×32 mm body / 108 mm assembled shiny-black perfume spray; canonical measurements reconciled by manual override; Madison Grace identity GB-CYL-CLR-25ML-SPR-SBLK assigned manually because no Convex row exists", productionReferencePromoted: false },
    },
    summary: {
      sourceTypeCount: 81,
      sourceReadyTypeCount: 41,
      sourceBlockedTypeCount: 40,
      sourceBlockedIdentityCount: 216,
      displayPositionCount: 18,
      readyPositionCount: positions.filter((position) => position.status === "ready").length as 16,
      blockedPositionCount: positions.filter((position) => position.status === "blocked").length as 2,
      sprayPositionCount: plan.curves.sprays.positions.length as 8,
      rollOnPositionCount: plan.curves.rollOns.positions.length as 7,
      reducerPositionCount: plan.curves.reducers.positions.length as 3,
    },
    curves: plan.curves,
    classificationReview: plan.classificationReview,
    reconciliationFindings: plan.reconciliationFindings,
    outOfFamilyEvidence: plan.outOfFamilyEvidence,
    sourceBlockers: structuredClone(sourceManifest.blockedIdentities),
    previews,
    outputs,
    selfPath: path.join(outputRoot, MANIFEST_NAME),
    selfHashStatus: "excluded-self-referential",
    externalWriteCount: 0,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const allBytes = { ...siblingBytes, [MANIFEST_NAME]: manifestBytes };
  const temporaryDirectory = path.join(outputRoot, `.render-tmp-${process.pid}-${Date.now()}`);
  await mkdir(temporaryDirectory);
  try {
    await Promise.all(Object.entries(allBytes).map(([name, bytes]) => writeFile(path.join(temporaryDirectory, name), bytes)));
    await promoteOutputs(outputRoot, temporaryDirectory);
  } finally { await rm(temporaryDirectory, { recursive: true, force: true }); }
  return { artifactPaths: Object.fromEntries(OUTPUT_NAMES.map((name) => [name, path.join(outputRoot, name)])) as Record<(typeof OUTPUT_NAMES)[number], string>, manifest };
}

async function main(): Promise<void> {
  const argument = (flag: string): string | null => {
    const index = process.argv.indexOf(flag);
    return index >= 0 && process.argv[index + 1] ? path.resolve(process.argv[index + 1]) : null;
  };
  const manifestPath = argument("--manifest") ?? path.resolve("tmp/best-bottles-reference-production/cylinder-81-type-review-v1/cylinder-81-type-review-manifest.json");
  const outputRoot = argument("--output-root") ?? path.resolve(`tmp/best-bottles-reference-production/${OUTPUT_ROOT_NAME}`);
  const evidence = structuredClone(DEFAULT_EVIDENCE);
  for (const [flag, key] of [
    ["--five-ml-spray-pdp", "fiveMlSprayPdp"],
    ["--tall-nine-spray-pdp", "tallNineSprayPdp"],
    ["--twenty-five-reducer-pdp", "twentyFiveReducerPdp"],
    ["--regular-nine-spray-pdp", "regularNineSprayPdp"],
    ["--glass-rod-pdp", "glassRodPdp"],
    ["--tall-rectangle-ten-pdp", "tallRectangleTenPdp"],
    ["--five-ml-roll-on-pdp", "fiveMlRollOnPdp"],
    ["--regular-nine-roll-on-pdp", "regularNineRollOnPdp"],
    ["--tall-nine-roll-on-pdp", "tallNineRollOnPdp"],
    ["--twenty-eight-roll-on-pdp", "twentyEightRollOnPdp"],
    ["--fifty-roll-on-pdp", "fiftyRollOnPdp"],
    ["--twenty-five-spray-pdp", "twentyFiveSprayPdp"],
  ] as const) {
    const custom = argument(flag);
    const preserved = path.join(outputRoot, "evidence", EVIDENCE_NAMES[key]);
    evidence[key].path = custom ?? (await pathExists(preserved) ? preserved : path.resolve(evidence[key].path));
  }
  const result = await renderCylinderApplicatorCurves({ manifestPath, outputRoot, evidence });
  process.stdout.write(`${JSON.stringify({ summary: result.manifest.summary, outputs: result.manifest.outputs }, null, 2)}\n`);
}

const directPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (directPath === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1; });
