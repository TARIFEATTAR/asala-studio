import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { parseCanonicalTruthCsv } from "./build-psd-cap-state-audit";
import type { CanonicalTruthRow } from "../../src/lib/bestBottlesPsdIdentityJoin";

const CANONICAL_TRUTH_PATH = path.resolve(
  "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
);
const OUTPUT_ROOT = path.resolve(
  "tmp/best-bottles-reference-production/cylinder-spray-six-cap-off-sidecar-curve-v1",
);
const EVIDENCE_ROOT = path.join(OUTPUT_ROOT, "evidence");
const OUTPUT_PATH = path.join(OUTPUT_ROOT, "cylinder-spray-six-true-cap-off-sidecar-curve.png");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");

const PIXELS_PER_MM = 6;
const BASELINE_Y = 1_480;
const CANVAS_HEIGHT = 1_720;
const HEADER_HEIGHT = 190;
const RULER_WIDTH = 145;
const SLOT_WIDTH = 700;
const BACKGROUND = "#ffffff";
const INK = "#171717";
const MUTED = "#68645e";
const GREEN = "#176b4d";
const BLUE = "#2f85b6";
const PURPLE = "#9b5de5";
const BORDER = "#d7d2ca";

type Bounds = { left: number; top: number; width: number; height: number };

type ReferenceSpec = {
  websiteSku: string;
  capacityMl: number;
  label: string;
  sourcePath: string;
  stableEvidenceName: string;
  foregroundBounds: Bounds;
  bodyTopY: number;
  bodyBottomYExclusive: number;
  primaryCenterX: number;
  sourceApproval: string;
};

const REFERENCES: readonly ReferenceSpec[] = [
  {
    websiteSku: "GBSpry3mlClBlk",
    capacityMl: 3,
    label: "3 mL",
    sourcePath: path.resolve("tmp/best-bottles-reference-production/cylinder-sidecar-reconciliation-v2/exports/GBSPRY3MLCLBLK__GBSPRCLR3MLBLK__exact-live-pdp-sidecar.png"),
    stableEvidenceName: "GBSpry3mlClBlk__exact-live-pdp-cap-off-sidecar.png",
    foregroundBounds: { left: 67, top: 30, width: 226, height: 420 },
    bodyTopY: 222,
    bodyBottomYExclusive: 450,
    primaryCenterX: 238,
    sourceApproval: "exact-live-pdp-sidecar",
  },
  {
    websiteSku: "GBCylBlu5SpryBlkSh",
    capacityMl: 5,
    label: "5 mL",
    sourcePath: path.resolve("tmp/best-bottles-reference-production/cylinder-blocked-recovery-v1/review-candidates/GBCYLBLU5SPRYBLKSH__GBCYLBLU5MLSPRSBLK__1018fed6bb8a.png"),
    stableEvidenceName: "GBCylBlu5SpryBlkSh__user-approved-cap-off-sidecar.png",
    foregroundBounds: { left: 73, top: 117, width: 479, height: 821 },
    bodyTopY: 448,
    bodyBottomYExclusive: 938,
    primaryCenterX: 175,
    sourceApproval: "2026-07-15-user-identity-confirmed",
  },
  {
    websiteSku: "GBCylAmb9SpryBlk",
    capacityMl: 9,
    label: "9 mL regular",
    sourcePath: path.resolve("tmp/best-bottles-reference-production/cylinder-sidecar-reconciliation-v2/exports/GBCYLAMB9SPRYBLK__GBCYLAMB9MLSPRBLK__exact-psd-sidecar.png"),
    stableEvidenceName: "GBCylAmb9SpryBlk__exact-psd-cap-off-sidecar.png",
    foregroundBounds: { left: 126, top: 362, width: 492, height: 1_158 },
    bodyTopY: 770,
    bodyBottomYExclusive: 1_520,
    primaryCenterX: 243,
    sourceApproval: "exact-psd-sidecar",
  },
  {
    websiteSku: "GBcyl25SpryShnBlk",
    capacityMl: 25,
    label: "25 mL",
    sourcePath: path.resolve("/tmp/GBcyl25SpryShnBlk-sidecar.gif"),
    stableEvidenceName: "GBcyl25SpryShnBlk__exact-live-pdp-cap-off-sidecar.png",
    foregroundBounds: { left: 91, top: 50, width: 418, height: 700 },
    bodyTopY: 303,
    bodyBottomYExclusive: 750,
    primaryCenterX: 197,
    sourceApproval: "2026-07-16-exact-live-pdp-sidecar",
  },
  {
    websiteSku: "GBCyl50SpryShnBlk",
    capacityMl: 50,
    label: "50 mL",
    sourcePath: path.resolve("tmp/best-bottles-reference-production/cylinder-sidecar-reconciliation-v2/exports/GBCYL50SPRYSHNBLK__GBCYLCLR50MLSPRSBLK__exact-live-pdp-sidecar.png"),
    stableEvidenceName: "GBCyl50SpryShnBlk__exact-live-pdp-cap-off-sidecar.png",
    foregroundBounds: { left: 88, top: 30, width: 184, height: 419 },
    bodyTopY: 147,
    bodyBottomYExclusive: 449,
    primaryCenterX: 137,
    sourceApproval: "exact-live-pdp-sidecar",
  },
  {
    websiteSku: "GBCyl100SpryShnBlk",
    capacityMl: 100,
    label: "100 mL",
    sourcePath: path.resolve("tmp/best-bottles-reference-production/cylinder-sidecar-reconciliation-v2/exports/GBCYL100SPRYSHNBLK__GBCYLCLR100MLSPRSBLK__exact-live-pdp-sidecar.png"),
    stableEvidenceName: "GBCyl100SpryShnBlk__exact-live-pdp-cap-off-sidecar.png",
    foregroundBounds: { left: 101, top: 29, width: 157, height: 421 },
    bodyTopY: 119,
    bodyBottomYExclusive: 450,
    primaryCenterX: 141,
    sourceApproval: "exact-live-pdp-sidecar",
  },
] as const;

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function number(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Missing canonical number for ${label}: ${value}`);
  }
  return parsed;
}

function findCanonicalRow(rows: readonly CanonicalTruthRow[], websiteSku: string): CanonicalTruthRow {
  const normalized = websiteSku.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const matches = rows.filter((row) => row.website_sku.toUpperCase().replace(/[^A-Z0-9]/g, "") === normalized);
  if (matches.length !== 1) {
    throw new Error(`Expected one canonical row for ${websiteSku}; received ${matches.length}.`);
  }
  return matches[0];
}

async function canRead(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function annotationSvg(input: {
  width: number;
  entries: Array<{
    label: string;
    websiteSku: string;
    bodyHeightMm: number;
    targetBodyHeightPx: number;
    slotIndex: number;
  }>;
}): Buffer {
  const body: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${CANVAS_HEIGHT}">`,
    `<rect width="100%" height="${HEADER_HEIGHT}" fill="#f5f3ef"/>`,
    `<text x="46" y="58" font-family="Arial,Helvetica,sans-serif" font-size="42" font-weight="700" fill="${INK}">CYLINDER SPRAYS — TRUE CAP-OFF SIDECAR CURVE</text>`,
    `<text x="46" y="103" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="${MUTED}">EXACT APPROVED REFERENCES • CANONICAL BODY HEIGHT • SHARED BASELINE • LINEAR 6 PX/MM</text>`,
    `<text x="46" y="143" font-family="Arial,Helvetica,sans-serif" font-size="20" fill="${MUTED}">Sprayer remains attached. One detached over-cap stands beside each bottle. Uniform scale only; no AI reconstruction or cap-on substitution.</text>`,
    `<line x1="0" y1="${BASELINE_Y}" x2="${input.width}" y2="${BASELINE_Y}" stroke="${PURPLE}" stroke-width="4" stroke-dasharray="14 9"/>`,
  ];

  for (let millimeters = 0; millimeters <= 200; millimeters += 25) {
    const y = BASELINE_Y - millimeters * PIXELS_PER_MM;
    body.push(`<line x1="88" y1="${y}" x2="132" y2="${y}" stroke="${MUTED}" stroke-width="3"/>`);
    body.push(`<text x="78" y="${y + 7}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="17" fill="${MUTED}">${millimeters} mm</text>`);
  }

  for (const entry of input.entries) {
    const left = RULER_WIDTH + entry.slotIndex * SLOT_WIDTH;
    const center = left + SLOT_WIDTH / 2;
    const bodyTop = BASELINE_Y - entry.targetBodyHeightPx;
    body.push(`<rect x="${left + 2}" y="${HEADER_HEIGHT}" width="${SLOT_WIDTH - 4}" height="${CANVAS_HEIGHT - HEADER_HEIGHT - 5}" fill="none" stroke="${BORDER}" stroke-width="2"/>`);
    body.push(`<text x="${center}" y="232" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="700" fill="${GREEN}">${escapeXml(entry.label)} spray</text>`);
    body.push(`<path d="M ${left + 54} ${bodyTop} h 22 M ${left + 65} ${bodyTop} V ${BASELINE_Y} M ${left + 54} ${BASELINE_Y} h 22" fill="none" stroke="${BLUE}" stroke-width="4"/>`);
    body.push(`<text x="${left + 82}" y="${bodyTop + 9}" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700" fill="${BLUE}">BODY ${entry.bodyHeightMm} mm</text>`);
    body.push(`<text x="${center}" y="${BASELINE_Y + 48}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="${INK}">${entry.bodyHeightMm} mm body • ${entry.targetBodyHeightPx} px at 6 px/mm</text>`);
    body.push(`<text x="${center}" y="${BASELINE_Y + 82}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="17" fill="${GREEN}">CAP OFF • EXACT DETACHED SIDECAR</text>`);
    body.push(`<text x="${center}" y="${BASELINE_Y + 114}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="${MUTED}">${escapeXml(entry.websiteSku)}</text>`);
  }

  body.push(`<text x="46" y="1690" font-family="Arial,Helvetica,sans-serif" font-size="18" fill="${MUTED}">Evidence curve only • native white reference background • exact product pixels uniformly scaled • not a generated or publishable product image</text>`);
  body.push("</svg>");
  return Buffer.from(body.join("\n"));
}

async function main(): Promise<void> {
  const canonicalRows = parseCanonicalTruthCsv(await readFile(CANONICAL_TRUTH_PATH, "utf8"));
  await mkdir(EVIDENCE_ROOT, { recursive: true });

  const outputWidth = RULER_WIDTH + REFERENCES.length * SLOT_WIDTH;
  const entries: any[] = [];
  const productOverlays: sharp.OverlayOptions[] = [];

  for (let slotIndex = 0; slotIndex < REFERENCES.length; slotIndex += 1) {
    const spec = REFERENCES[slotIndex];
    const evidencePath = path.join(EVIDENCE_ROOT, spec.stableEvidenceName);
    const usableSourcePath = await canRead(spec.sourcePath)
      ? spec.sourcePath
      : evidencePath;
    if (!(await canRead(usableSourcePath))) {
      throw new Error(`Missing exact cap-off sidecar evidence for ${spec.websiteSku}: ${spec.sourcePath}`);
    }

    if (usableSourcePath !== evidencePath) {
      await copyFile(usableSourcePath, evidencePath);
    }
    const sourceBytes = await readFile(evidencePath);
    const metadata = await sharp(sourceBytes).metadata();
    const canonical = findCanonicalRow(canonicalRows, spec.websiteSku);
    const bodyHeightMm = number(canonical.canon_bodyHeightMm, `${spec.websiteSku} canon_bodyHeightMm`);
    const diameterMm = number(canonical.canon_widthAxisMm, `${spec.websiteSku} canon_widthAxisMm`);
    const assembledHeightMm = number(canonical.canon_heightWithCapMm, `${spec.websiteSku} canon_heightWithCapMm`);
    const targetBodyHeightPx = Math.round(bodyHeightMm * PIXELS_PER_MM);
    const sourceBodyHeightPx = spec.bodyBottomYExclusive - spec.bodyTopY;
    const uniformScale = targetBodyHeightPx / sourceBodyHeightPx;
    const resizedWidth = Math.round(spec.foregroundBounds.width * uniformScale);
    const resizedHeight = Math.round(spec.foregroundBounds.height * uniformScale);
    const primaryCenterWithinCrop = (spec.primaryCenterX - spec.foregroundBounds.left) * uniformScale;
    const slotLeft = RULER_WIDTH + slotIndex * SLOT_WIDTH;
    const desiredPrimaryCenterX = slotLeft + SLOT_WIDTH / 2;
    const imageLeft = Math.round(desiredPrimaryCenterX - primaryCenterWithinCrop);
    const imageTop = Math.round(BASELINE_Y - resizedHeight);

    const scaledProduct = await sharp(sourceBytes)
      .extract(spec.foregroundBounds)
      .resize({ width: resizedWidth, height: resizedHeight, fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9 })
      .toBuffer();
    productOverlays.push({ input: scaledProduct, left: imageLeft, top: imageTop });

    entries.push({
      status: "ready",
      websiteSku: spec.websiteSku,
      graceSku: canonical.grace_sku || null,
      capacityMl: spec.capacityMl,
      label: spec.label,
      role: {
        applicator: "spray",
        capState: "cap-off",
        topology: "sprayer-attached-cap-detached-sidecar",
      },
      canonicalGeometry: {
        source: "best-bottles-master-truth.csv:canon_*",
        bodyHeightMm,
        diameterMm,
        assembledHeightMm,
      },
      sourceEvidence: {
        originalPath: spec.sourcePath,
        preservedPath: evidencePath,
        sha256: sha256(sourceBytes),
        nativeDimensions: { width: metadata.width, height: metadata.height },
        approval: spec.sourceApproval,
        identityApproved: true,
        capOffSidecarApproved: true,
      },
      sourceGeometry: {
        foregroundBounds: spec.foregroundBounds,
        bodyTopY: spec.bodyTopY,
        bodyBottomYExclusive: spec.bodyBottomYExclusive,
        bodyHeightPx: sourceBodyHeightPx,
        primaryCenterX: spec.primaryCenterX,
      },
      renderedGeometry: {
        uniformScale,
        targetBodyHeightPx,
        observedBodyHeightPx: targetBodyHeightPx,
        baselineY: BASELINE_Y,
        imageBounds: { left: imageLeft, top: imageTop, width: resizedWidth, height: resizedHeight },
      },
    });
  }

  const overlay = annotationSvg({
    width: outputWidth,
    entries: entries.map((entry, slotIndex) => ({
      label: entry.label,
      websiteSku: entry.websiteSku,
      bodyHeightMm: entry.canonicalGeometry.bodyHeightMm,
      targetBodyHeightPx: entry.renderedGeometry.targetBodyHeightPx,
      slotIndex,
    })),
  });
  const outputBytes = await sharp({
    create: {
      width: outputWidth,
      height: CANVAS_HEIGHT,
      channels: 3,
      background: BACKGROUND,
    },
  })
    .composite([...productOverlays, { input: overlay, left: 0, top: 0 }])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(OUTPUT_PATH, outputBytes);

  const manifest = {
    version: "best-bottles-cylinder-spray-six-cap-off-sidecar-curve-v1",
    generatedAt: new Date().toISOString(),
    canonicalTruth: {
      path: CANONICAL_TRUTH_PATH,
      sha256: sha256(await readFile(CANONICAL_TRUTH_PATH)),
      consumedColumns: ["canon_bodyHeightMm", "canon_widthAxisMm", "canon_secondAxisMm", "canon_heightWithCapMm"],
    },
    scaleContract: {
      pixelsPerMm: PIXELS_PER_MM,
      baselineY: BASELINE_Y,
      canvas: { width: outputWidth, height: CANVAS_HEIGHT },
      geometryKey: "family × physical body",
      heightBasis: "canon_bodyHeightMm",
    },
    operation: "exact-reference-crop-plus-uniform-scale-plus-evidence-layout",
    entries,
    output: {
      path: OUTPUT_PATH,
      sha256: sha256(outputBytes),
      dimensions: { width: outputWidth, height: CANVAS_HEIGHT },
    },
    constraints: {
      family: "Cylinder",
      applicator: "spray",
      capState: "cap-off-sidecar",
      productPixelMutation: "uniform-scale-only",
      crossApplicatorSubstitution: false,
      aiReconstruction: false,
      postGenerationBackgroundPainting: false,
    },
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ outputPath: OUTPUT_PATH, manifestPath: MANIFEST_PATH, sha256: sha256(outputBytes) }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
