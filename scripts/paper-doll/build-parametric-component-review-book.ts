import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const familyIndexPath = path.join(workspaceRoot, "docs/paper-doll-rig/parametric-component-family-index.json");
const defaultOutputRoot = path.join(workspaceRoot, "outputs/paper-doll-parametric-overcaps/catalog-review-book-v1");

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function relativeWorkspacePath(absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath);
}

function compareNeckFinishes(left: string, right: string): number {
  const leftNumber = Number.parseInt(left, 10);
  const rightNumber = Number.parseInt(right, 10);
  return leftNumber - rightNumber || left.localeCompare(right);
}

type ReviewFamily = {
  recipeId: string;
  familyKey: string;
  neckFinish: string;
  geometryFamilyId: string;
  dimensionsMm: { outsideDiameter: number; height: number; verified: boolean };
  candidateOutputCount: number;
  catalogIdentityCount: number;
  geometryLocked: false;
  productionPlateEligible: false;
  authorityReviewRequired: true;
  recipe: { path: string; sha256: string };
  candidateManifest: { path: string; sha256: string };
  reviewContactSheet: { path: string; sha256: string; width: number; height: number };
};

type ReviewBookManifest = {
  schemaVersion: 1;
  title: string;
  sourceIndex: { path: string; sha256: string };
  summary: { geometryFamilyCount: number; candidateOutputCount: number; catalogIdentityCount: number; neckFinishReviewGroupCount: number };
  families: ReviewFamily[];
  reviewGroups: Array<{
    neckFinish: string;
    geometryFamilyCount: number;
    candidateOutputCount: number;
    catalogIdentityCount: number;
    familyKeys: string[];
    page: { path: string; sha256: string; width: number; height: number };
  }>;
  overview: { path: string; sha256: string; width: number; height: number };
  interpretation: string;
  mutationPolicy: {
    candidatePixelsChanged: false;
    approvalWritten: false;
    remoteWritesPerformed: false;
    currentReleaseChanged: false;
    sanityChanged: false;
  };
};

async function loadReviewFamilies(): Promise<{ indexText: string; families: ReviewFamily[] }> {
  const indexText = await readFile(familyIndexPath, "utf8");
  const index = JSON.parse(indexText) as { families: Array<{ recipePath: string; localCandidateManifestPath: string; reviewContactSheetPath: string }> };
  const families: ReviewFamily[] = [];

  for (const entry of index.families) {
    const recipeAbsolutePath = path.join(workspaceRoot, entry.recipePath);
    const manifestAbsolutePath = path.join(workspaceRoot, entry.localCandidateManifestPath);
    const sheetAbsolutePath = path.join(workspaceRoot, entry.reviewContactSheetPath);
    const [recipeText, manifestText, sheetBuffer, sheetMetadata] = await Promise.all([
      readFile(recipeAbsolutePath, "utf8"),
      readFile(manifestAbsolutePath, "utf8"),
      readFile(sheetAbsolutePath),
      sharp(sheetAbsolutePath).metadata(),
    ]);
    const recipe = JSON.parse(recipeText) as any;
    const candidateManifest = JSON.parse(manifestText) as any;
    if (candidateManifest.recipeId !== recipe.recipeId) throw new Error(`Candidate manifest recipe mismatch for ${entry.recipePath}.`);
    if (candidateManifest.geometryFamilyId !== recipe.geometryFamilyId) throw new Error(`Candidate manifest geometry mismatch for ${entry.recipePath}.`);
    if (candidateManifest.summary.geometryLocked !== false
      || candidateManifest.summary.productionPlateEligible !== false
      || candidateManifest.summary.authorityReviewRequired !== true) {
      throw new Error(`Review book accepts review-only candidates, not promoted authority: ${entry.recipePath}.`);
    }
    const catalogIdentities = recipe.variants.flatMap((variant: any) => [variant.sourceIdentity, ...(variant.sourceIdentityAliases ?? [])]);
    families.push({
      recipeId: recipe.recipeId,
      familyKey: recipe.familyKey,
      neckFinish: recipe.neckFinish,
      geometryFamilyId: recipe.geometryFamilyId,
      dimensionsMm: {
        outsideDiameter: recipe.nominalDimensionsMm.outsideDiameter,
        height: recipe.nominalDimensionsMm.height,
        verified: recipe.nominalDimensionsMm.verified,
      },
      candidateOutputCount: candidateManifest.outputs.length,
      catalogIdentityCount: catalogIdentities.length,
      geometryLocked: false,
      productionPlateEligible: false,
      authorityReviewRequired: true,
      recipe: { path: entry.recipePath, sha256: sha256(recipeText) },
      candidateManifest: { path: entry.localCandidateManifestPath, sha256: sha256(manifestText) },
      reviewContactSheet: {
        path: entry.reviewContactSheetPath,
        sha256: sha256(sheetBuffer),
        width: sheetMetadata.width ?? 0,
        height: sheetMetadata.height ?? 0,
      },
    });
  }

  return { indexText, families };
}

async function renderGroupPage(outputRoot: string, neckFinish: string, families: ReviewFamily[]) {
  const width = 1280;
  const margin = 60;
  const contentWidth = width - margin * 2;
  const headerHeight = 170;
  const labelHeight = 110;
  const sectionGap = 40;
  const sections: Array<{ family: ReviewFamily; image: Buffer; imageHeight: number }> = [];
  for (const family of families) {
    const imageHeight = Math.round(family.reviewContactSheet.height * (contentWidth / family.reviewContactSheet.width));
    const image = await sharp(path.join(workspaceRoot, family.reviewContactSheet.path)).resize({ width: contentWidth }).png().toBuffer();
    sections.push({ family, image, imageHeight });
  }
  const height = headerHeight + sections.reduce((sum, section) => sum + labelHeight + section.imageHeight + sectionGap, 0) + margin;
  const base = sharp({ create: { width, height, channels: 4, background: "#11110f" } });
  const composites: sharp.OverlayOptions[] = [{
    input: Buffer.from(`<svg width="${width}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
      <text x="${margin}" y="68" fill="#f4c46c" font-size="42" font-family="Arial, sans-serif" font-weight="700">${escapeXml(neckFinish)} COMPONENT FAMILIES</text>
      <text x="${margin}" y="112" fill="#ddd6c8" font-size="22" font-family="Arial, sans-serif">Dimension-calibrated profile review · exact family alpha · named authority review required</text>
      <text x="${margin}" y="145" fill="#e07b69" font-size="18" font-family="monospace">NOT GEOMETRY LOCKED · NOT PRODUCTION ELIGIBLE</text>
    </svg>`), left: 0, top: 0,
  }];
  let top = headerHeight;
  for (const section of sections) {
    const family = section.family;
    composites.push({
      input: Buffer.from(`<svg width="${contentWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" rx="10" fill="#1d1c19"/>
        <text x="24" y="40" fill="#f2efe9" font-size="25" font-family="Arial, sans-serif" font-weight="700">${escapeXml(family.familyKey)}</text>
        <text x="24" y="72" fill="#bcb4a6" font-size="17" font-family="monospace">${family.dimensionsMm.outsideDiameter} × ${family.dimensionsMm.height} mm · ${family.candidateOutputCount} outputs · ${family.catalogIdentityCount} catalog identities</text>
        <text x="24" y="98" fill="#70dcca" font-size="16" font-family="monospace">${escapeXml(family.geometryFamilyId)}</text>
      </svg>`), left: margin, top,
    });
    top += labelHeight;
    composites.push({ input: section.image, left: margin, top });
    top += section.imageHeight + sectionGap;
  }
  const relativePath = `groups/${neckFinish}.png`;
  const absolutePath = path.join(outputRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = await base.composite(composites).png().toBuffer();
  await writeFile(absolutePath, buffer);
  return { path: relativePath, sha256: sha256(buffer), width, height };
}

async function renderOverview(outputRoot: string, families: ReviewFamily[]) {
  const width = 1280;
  const margin = 40;
  const gap = 24;
  const tileWidth = 588;
  const tileHeight = 610;
  const headerHeight = 210;
  const rows = Math.ceil(families.length / 2);
  const height = headerHeight + rows * tileHeight + (rows - 1) * gap + margin;
  const base = sharp({ create: { width, height, channels: 4, background: "#11110f" } });
  const composites: sharp.OverlayOptions[] = [{
    input: Buffer.from(`<svg width="${width}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
      <text x="${margin}" y="66" fill="#f4c46c" font-size="42" font-family="Arial, sans-serif" font-weight="700">BEST BOTTLES PARAMETRIC CAP REVIEW</text>
      <text x="${margin}" y="112" fill="#ddd6c8" font-size="23" font-family="Arial, sans-serif">12 geometry families · 37 outputs · 38 catalog identities</text>
      <text x="${margin}" y="152" fill="#e07b69" font-size="20" font-family="monospace">REVIEW CANDIDATES ONLY · NO AUTHORITY OR RELEASE PROMOTION</text>
      <text x="${margin}" y="184" fill="#8f897f" font-size="17" font-family="Arial, sans-serif">Approve physical profile separately from material pixels and family fit.</text>
    </svg>`), left: 0, top: 0,
  }];
  for (const [index, family] of families.entries()) {
    const left = margin + (index % 2) * (tileWidth + gap);
    const top = headerHeight + Math.floor(index / 2) * (tileHeight + gap);
    const image = await sharp(path.join(workspaceRoot, family.reviewContactSheet.path))
      .resize({ width: tileWidth - 32, height: 430, fit: "contain", background: "#F5F3EF" })
      .png()
      .toBuffer();
    composites.push({
      input: Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="${tileWidth - 2}" height="${tileHeight - 2}" rx="12" fill="#1d1c19" stroke="#826a3d" stroke-width="2"/>
        <text x="20" y="36" fill="#f4c46c" font-size="22" font-family="Arial, sans-serif" font-weight="700">${escapeXml(family.familyKey)}</text>
        <text x="20" y="66" fill="#c8c0b2" font-size="16" font-family="monospace">${escapeXml(family.neckFinish)} · ${family.dimensionsMm.outsideDiameter} × ${family.dimensionsMm.height} mm</text>
        <text x="20" y="532" fill="#f2efe9" font-size="17" font-family="monospace">${family.candidateOutputCount} outputs · ${family.catalogIdentityCount} identities</text>
        <text x="20" y="566" fill="#e07b69" font-size="14" font-family="monospace">PROFILE REVIEW · NOT GEOMETRY LOCKED</text>
      </svg>`), left, top,
    });
    composites.push({ input: image, left: left + 16, top: top + 82 });
  }
  const relativePath = "overview.png";
  const buffer = await base.composite(composites).png().toBuffer();
  await writeFile(path.join(outputRoot, relativePath), buffer);
  return { path: relativePath, sha256: sha256(buffer), width, height };
}

export async function buildParametricComponentReviewBook(options: { outputRoot?: string } = {}): Promise<ReviewBookManifest> {
  const outputRoot = options.outputRoot ?? defaultOutputRoot;
  await mkdir(outputRoot, { recursive: true });
  const { indexText, families } = await loadReviewFamilies();
  const grouped = new Map<string, ReviewFamily[]>();
  for (const family of families) grouped.set(family.neckFinish, [...(grouped.get(family.neckFinish) ?? []), family]);
  const reviewGroups = [];
  for (const neckFinish of [...grouped.keys()].sort(compareNeckFinishes)) {
    const groupFamilies = grouped.get(neckFinish)!;
    reviewGroups.push({
      neckFinish,
      geometryFamilyCount: groupFamilies.length,
      candidateOutputCount: groupFamilies.reduce((sum, family) => sum + family.candidateOutputCount, 0),
      catalogIdentityCount: groupFamilies.reduce((sum, family) => sum + family.catalogIdentityCount, 0),
      familyKeys: groupFamilies.map((family) => family.familyKey),
      page: await renderGroupPage(outputRoot, neckFinish, groupFamilies),
    });
  }
  const overview = await renderOverview(outputRoot, families);
  const manifest: ReviewBookManifest = {
    schemaVersion: 1,
    title: "Best Bottles parametric component geometry review book",
    sourceIndex: { path: relativeWorkspacePath(familyIndexPath), sha256: sha256(indexText) },
    summary: {
      geometryFamilyCount: families.length,
      candidateOutputCount: families.reduce((sum, family) => sum + family.candidateOutputCount, 0),
      catalogIdentityCount: families.reduce((sum, family) => sum + family.catalogIdentityCount, 0),
      neckFinishReviewGroupCount: reviewGroups.length,
    },
    families,
    reviewGroups,
    overview,
    interpretation: "Combined visual index for named physical-profile review. Exact alpha is proven only within each candidate family. No family is geometry locked or production eligible until named authority review and compatible family fit pass.",
    mutationPolicy: {
      candidatePixelsChanged: false,
      approvalWritten: false,
      remoteWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
  await writeFile(path.join(outputRoot, "review-book-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

async function main() {
  const manifest = await buildParametricComponentReviewBook();
  console.log(JSON.stringify({ outputRoot: relativeWorkspacePath(defaultOutputRoot), summary: manifest.summary, overview: manifest.overview, mutationPolicy: manifest.mutationPolicy }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
