import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const SOURCE_PATH = path.resolve(
  "tmp/best-bottles-reference-production/cylinder-applicator-curves-v1/cylinder-spray-scale-curve.png",
);
const OUTPUT_ROOT = path.resolve(
  "tmp/best-bottles-reference-production/cylinder-spray-six-cap-on-curve-v1",
);
const OUTPUT_PATH = path.join(
  OUTPUT_ROOT,
  "cylinder-spray-six-cap-on-comparative-curve.png",
);
const RECORD_PATH = path.join(OUTPUT_ROOT, "manifest.json");

const SOURCE_WIDTH = 4_705;
const HEIGHT = 1_720;
const RULER_WIDTH = 145;
const SLOT_WIDTH = 570;
const PANEL_TOP = 176;
const BACKGROUND = { r: 245, g: 243, b: 239 };

const SELECTED_SOURCE_PANELS = [
  { sourceIndex: 0, label: "3 mL spray — source panel" },
  { sourceIndex: 2, label: "5 mL spray — source panel" },
  { sourceIndex: 3, label: "9 mL regular spray — cap on" },
  { sourceIndex: 5, label: "25 mL spray — cap on" },
  { sourceIndex: 6, label: "50 mL spray — cap on" },
  { sourceIndex: 7, label: "100 mL spray — cap on" },
] as const;

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

const headerSvg = (width: number) => Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${PANEL_TOP}">
    <rect width="100%" height="100%" fill="#f5f3ef"/>
    <text x="46" y="60" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#171717">CYLINDER SPRAYS — PRESERVED COMPARATIVE CURVE</text>
    <text x="46" y="104" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#68645e">APPROVED PRODUCT PANELS • SHARED BASELINE • LINEAR 6 PX/MM • NO CROSS-APPLICATOR SUBSTITUTION</text>
    <text x="46" y="142" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#68645e">Preserved source panels. User-confirmed cap-on state: regular 9, 25, 50, and 100 mL. This is not the cap-off sidecar contract.</text>
  </svg>
`);

async function main(): Promise<void> {
  const sourceBytes = await readFile(SOURCE_PATH);
  const metadata = await sharp(sourceBytes).metadata();
  if (metadata.width !== SOURCE_WIDTH || metadata.height !== HEIGHT) {
    throw new Error(
      `Unexpected approved curve dimensions: ${metadata.width}×${metadata.height}.`,
    );
  }

  const outputWidth = RULER_WIDTH + SELECTED_SOURCE_PANELS.length * SLOT_WIDTH;
  const composites: sharp.OverlayOptions[] = [
    { input: headerSvg(outputWidth), left: 0, top: 0 },
    {
      input: await sharp(sourceBytes).extract({
        left: 0,
        top: PANEL_TOP,
        width: RULER_WIDTH,
        height: HEIGHT - PANEL_TOP,
      }).png().toBuffer(),
      left: 0,
      top: PANEL_TOP,
    },
  ];

  for (let outputIndex = 0; outputIndex < SELECTED_SOURCE_PANELS.length; outputIndex += 1) {
    const panel = SELECTED_SOURCE_PANELS[outputIndex];
    composites.push({
      input: await sharp(sourceBytes).extract({
        left: RULER_WIDTH + panel.sourceIndex * SLOT_WIDTH,
        top: PANEL_TOP,
        width: SLOT_WIDTH,
        height: HEIGHT - PANEL_TOP,
      }).png().toBuffer(),
      left: RULER_WIDTH + outputIndex * SLOT_WIDTH,
      top: PANEL_TOP,
    });
  }

  await mkdir(OUTPUT_ROOT, { recursive: true });
  const outputBytes = await sharp({
    create: {
      width: outputWidth,
      height: HEIGHT,
      channels: 3,
      background: BACKGROUND,
    },
  }).composite(composites).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
  await writeFile(OUTPUT_PATH, outputBytes);
  await writeFile(
    RECORD_PATH,
    `${JSON.stringify({
      version: "best-bottles-cylinder-spray-six-cap-on-curve-v1",
      generatedAt: new Date().toISOString(),
      source: {
        path: SOURCE_PATH,
        sha256: sha256(sourceBytes),
        dimensions: { width: SOURCE_WIDTH, height: HEIGHT },
      },
      operation: "lossless-panel-selection-no-product-resize",
      selectedPanels: SELECTED_SOURCE_PANELS,
      excludedSourcePanels: [
        { sourceIndex: 1, label: "4 mL spray" },
        { sourceIndex: 4, label: "9 mL tall spray" },
      ],
      output: {
        path: OUTPUT_PATH,
        sha256: sha256(outputBytes),
        dimensions: { width: outputWidth, height: HEIGHT },
      },
      constraints: {
        family: "Cylinder",
        applicator: "spray",
        capState: "mixed-source-panels-four-right-cap-on",
        productPixelMutation: false,
        crossApplicatorSubstitution: false,
      },
    }, null, 2)}\n`,
  );

  process.stdout.write(`${JSON.stringify({ outputPath: OUTPUT_PATH, recordPath: RECORD_PATH, sha256: sha256(outputBytes) }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
