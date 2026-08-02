import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { parseCsv } from "../../src/lib/bestBottlesGapWorklist";
import {
  buildCylinderSixRolePilot,
  type CylinderPilotReferenceInput,
  type CylinderSixRolePilotProductInput,
} from "../../src/lib/bestBottlesCylinderSixRolePilot";
import { BEST_BOTTLES_LANE_LOCKED_MATERIAL_CALIBRATIONS } from "../../src/lib/bestBottlesCylinderLaneLockedRemediation";
import type {
  CylinderReferenceRole,
  CylinderRoleAwareReadinessArtifact,
} from "../../src/lib/bestBottlesCylinderRoleAwareReadiness";
import { compileCylinderSixRoleMaterialPilot } from "./cylinder-six-role-material-pilot";
import {
  cropGlassOnlyMaterialCalibration,
  GLASS_ONLY_MATERIAL_CROP,
} from "./build-glass-only-material-calibration";
import { conditionWholeRoleReference } from "./condition-whole-role-reference";
import { buildMaterialPilotCanonicalBodyScaleContract } from "../../supabase/functions/_shared/bestBottlesMaterialPilot";

const CANONICAL_PATH =
  "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv";
const ROLE_AWARE_PATH = "public/data/best-bottles-cylinder-sidecar-promotion.json";
const OUTPUT_ROOT =
  "tmp/best-bottles-reference-production/cylinder-six-role-pilot-v1";

const PILOT_IDENTITIES = [
  { capacityMl: 3, websiteSku: "GBSpry3mlClBlk" },
  { capacityMl: 5, websiteSku: "GBCylBlu5SpryBlkSh" },
  { capacityMl: 9, websiteSku: "GBCylAmb9SpryBlk" },
  { capacityMl: 25, websiteSku: "GBcyl25SpryShnBlk" },
  { capacityMl: 50, websiteSku: "GBCyl50SpryShnBlk" },
  { capacityMl: 100, websiteSku: "GBCyl100SpryShnBlk" },
] as const;

const LIVE_ROLE_SUPPLEMENTS: Record<5 | 25, {
  identityCapOn: string;
  pdpCapOffSidecar: string;
}> = {
  5: {
    identityCapOn:
      "https://www.bestbottles.com/images/store/capped/GBCylBlu5SpryBlkSh.gif",
    pdpCapOffSidecar:
      "https://www.bestbottles.com/images/store/enlarged_pics/GBCylBlu5SpryBlkSh.gif",
  },
  25: {
    identityCapOn:
      "https://www.bestbottles.com/images/store/capped/GBcyl25SpryShnBlk.gif",
    pdpCapOffSidecar:
      "https://www.bestbottles.com/images/store/enlarged_pics/GBcyl25SpryShnBlk.gif",
  },
};

const SIDECAR_SOURCE_GEOMETRY = {
  3: {
    foregroundBounds: { left: 67, top: 30, width: 226, height: 420 },
    bodyLeftX: 185,
    bodyRightXExclusive: 292,
    bodyTopY: 222,
    bodyBottomYExclusive: 450,
    primaryCenterX: 238,
  },
  5: {
    foregroundBounds: { left: 58, top: 31, width: 243, height: 418 },
    bodyLeftX: 58,
    bodyRightXExclusive: 161,
    bodyTopY: 202,
    bodyBottomYExclusive: 449,
    primaryCenterX: 109,
  },
  9: {
    foregroundBounds: { left: 126, top: 362, width: 492, height: 1158 },
    bodyLeftX: 128,
    bodyRightXExclusive: 359,
    bodyTopY: 770,
    bodyBottomYExclusive: 1520,
    primaryCenterX: 243,
  },
  25: {
    foregroundBounds: { left: 91, top: 50, width: 418, height: 700 },
    bodyLeftX: 92,
    bodyRightXExclusive: 300,
    bodyTopY: 303,
    bodyBottomYExclusive: 750,
    primaryCenterX: 197,
  },
  50: {
    foregroundBounds: { left: 88, top: 30, width: 184, height: 419 },
    bodyLeftX: 88,
    bodyRightXExclusive: 186,
    bodyTopY: 147,
    bodyBottomYExclusive: 449,
    primaryCenterX: 137,
  },
  100: {
    foregroundBounds: { left: 101, top: 29, width: 157, height: 421 },
    bodyLeftX: 101,
    bodyRightXExclusive: 182,
    bodyTopY: 119,
    bodyBottomYExclusive: 450,
    primaryCenterX: 141,
  },
} as const;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}


/**
 * Automatic subject recognition for SIDECAR references (2026-07-18): the
 * group = ALL foreground components (bottle with attached applicator + the
 * detached cap beside stays in frame). The glass-body box lives inside the
 * TALLEST component (the bottle); its top is the neutral-dark hardware seam
 * (sprayer/collar sits ON TOP of the glass in the cap-off state, so the seam
 * is the true glass top), cross-checked against canon proportions.
 */
async function deriveSidecarSourceGeometry(absolutePath: string, canon: {
  bodyMm: number; widthMm: number; websiteSku: string;
}): Promise<{
  foregroundBounds: { left: number; top: number; width: number; height: number };
  bodyLeftX: number; bodyRightXExclusive: number;
  bodyTopY: number; bodyBottomYExclusive: number; primaryCenterX: number;
}> {
  const { data, info } = await sharp(absolutePath).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const S = Math.max(1, Math.round(info.width / 400));
  const gw = Math.ceil(info.width / S), gh = Math.ceil(info.height / S);
  const bg = [data[0], data[1], data[2]];
  const fg = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = ((gy * S) * info.width + (gx * S)) * ch;
    if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 40) fg[gy * gw + gx] = 1;
  }
  const label = new Int32Array(gw * gh).fill(-1);
  const comps: Array<{ minX: number; maxX: number; minY: number; maxY: number; size: number }> = [];
  const queue = new Int32Array(gw * gh);
  for (let start = 0; start < gw * gh; start++) {
    if (!fg[start] || label[start] !== -1) continue;
    let head = 0, tail = 0; queue[tail++] = start; label[start] = comps.length;
    let minX = gw, maxX = -1, minY = gh, maxY = -1, size = 0;
    while (head < tail) {
      const pp = queue[head++]; size++;
      const px = pp % gw, py = (pp / gw) | 0;
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
      for (const q of [pp - 1, pp + 1, pp - gw, pp + gw]) {
        if (q < 0 || q >= gw * gh || Math.abs((q % gw) - px) > 1) continue;
        if (fg[q] && label[q] === -1) { label[q] = comps.length; queue[tail++] = q; }
      }
    }
    comps.push({ minX, maxX, minY, maxY, size });
  }
  const real = comps.filter((c) => c.size > (gw * gh) * 0.001);
  if (!real.length) throw new Error(`No foreground in sidecar reference for ${canon.websiteSku}.`);
  const uMinX = Math.min(...real.map((c) => c.minX)) * S, uMaxX = (Math.max(...real.map((c) => c.maxX)) + 1) * S;
  const uMinY = Math.min(...real.map((c) => c.minY)) * S, uMaxY = (Math.max(...real.map((c) => c.maxY)) + 1) * S;
  const bottle = real.reduce((a, b) => ((b.maxY - b.minY) > (a.maxY - a.minY) ? b : a));
  const bTopPx = bottle.minY * S, bBotPx = (bottle.maxY + 1) * S - 1;
  const bcx = Math.min(info.width - 1, Math.round(((bottle.minX + bottle.maxX + 1) / 2) * S));
  let lastDark = -1;
  const seamLimit = bTopPx + Math.round((bBotPx - bTopPx) * 0.75);
  for (let y = bTopPx; y < seamLimit; y++) {
    const i = (y * info.width + bcx) * ch;
    const mx = Math.max(data[i], data[i + 1], data[i + 2]);
    const mn = Math.min(data[i], data[i + 1], data[i + 2]);
    if (mx < 70 && mx - mn < 25) lastDark = y;
  }
  const bodyTopY = lastDark > 0 ? lastDark + 2 : Math.round(bBotPx - (bBotPx - bTopPx) * 0.62);
  let bLeft = info.width, bRight = -1;
  for (let y = Math.round(bodyTopY + (bBotPx - bodyTopY) * 0.3); y < bBotPx; y += 2) {
    for (let x = bottle.minX * S; x <= (bottle.maxX + 1) * S - 1; x++) {
      const i = (y * info.width + x) * ch;
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 40) {
        if (x < bLeft) bLeft = x; if (x > bRight) bRight = x;
      }
    }
  }
  const derived = (bRight - bLeft + 1) / (bBotPx - bodyTopY + 1);
  const canonRatio = canon.widthMm / canon.bodyMm;
  if (Math.abs(derived - canonRatio) / canonRatio > 0.3) {
    throw new Error(`Sidecar geometry for ${canon.websiteSku} disagrees with canon (derived ${derived.toFixed(3)} vs ${canonRatio.toFixed(3)}); flag for human review.`);
  }
  return {
    foregroundBounds: { left: uMinX, top: uMinY, width: uMaxX - uMinX, height: uMaxY - uMinY },
    bodyLeftX: bLeft, bodyRightXExclusive: bRight + 1,
    bodyTopY, bodyBottomYExclusive: bBotPx + 1,
    primaryCenterX: Math.round((bLeft + bRight) / 2),
  };
}

/**
 * Automatic subject recognition for cap-on references (2026-07-18): find the
 * PRIMARY product component (largest connected foreground region — stray
 * detached caps beside the bottle are separate components and are dropped),
 * derive the glass-body box via the canonical body/assembled ratio with a
 * dark-cap seam refinement, and cross-check proportions against canon. Throws
 * (fail-closed) when the derived box disagrees with catalog proportions.
 */
async function deriveCapOnSourceGeometry(absolutePath: string, canon: {
  bodyMm: number; asmMm: number; widthMm: number; websiteSku: string;
}): Promise<{
  foregroundBounds: { left: number; top: number; width: number; height: number };
  bodyLeftX: number; bodyRightXExclusive: number;
  bodyTopY: number; bodyBottomYExclusive: number; primaryCenterX: number;
  droppedComponents: number;
}> {
  const { data, info } = await sharp(absolutePath).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const S = 4; // analysis stride
  const gw = Math.ceil(info.width / S), gh = Math.ceil(info.height / S);
  const bg = [data[0], data[1], data[2]];
  const fg = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = ((gy * S) * info.width + (gx * S)) * ch;
    if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 40) {
      fg[gy * gw + gx] = 1;
    }
  }
  // connected components (4-neighbour BFS)
  const label = new Int32Array(gw * gh).fill(-1);
  const sizes: number[] = [];
  const boxes: Array<{ minX: number; maxX: number; minY: number; maxY: number }> = [];
  const queue = new Int32Array(gw * gh);
  for (let start = 0; start < gw * gh; start++) {
    if (!fg[start] || label[start] !== -1) continue;
    const id = sizes.length;
    let head = 0, tail = 0; queue[tail++] = start; label[start] = id;
    let minX = gw, maxX = -1, minY = gh, maxY = -1, size = 0;
    while (head < tail) {
      const p = queue[head++]; size++;
      const px = p % gw, py = (p / gw) | 0;
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
      for (const q of [p - 1, p + 1, p - gw, p + gw]) {
        if (q < 0 || q >= gw * gh) continue;
        if (Math.abs((q % gw) - px) > 1) continue;
        if (fg[q] && label[q] === -1) { label[q] = id; queue[tail++] = q; }
      }
    }
    sizes.push(size); boxes.push({ minX, maxX, minY, maxY });
  }
  if (!sizes.length) throw new Error(`No foreground found in cap-on reference for ${canon.websiteSku}.`);
  const primary = sizes.indexOf(Math.max(...sizes));
  const b = boxes[primary];
  const left = b.minX * S, top = b.minY * S;
  const width = (b.maxX - b.minX + 1) * S, height = (b.maxY - b.minY + 1) * S;
  const bottom = top + height - 1;
  // body top: canonical ratio ONLY. Over-caps slide down over the glass
  // shoulder, hiding real glass under the cap, so the visible cap/glass seam
  // must never shrink the body box (lesson recorded 2026-07-17 on the 5 mL
  // overlay: the ratio-derived top matched canon within 0.2%).
  const bodyTopY = Math.round(bottom - height * (canon.bodyMm / canon.asmMm));
  // body width: widest span in the lower body region (within primary bbox)
  let bLeft = info.width, bRight = -1;
  for (let y = Math.round(bodyTopY + (bottom - bodyTopY) * 0.3); y < bottom; y += 4) {
    for (let x = left; x < left + width; x++) {
      const i = (y * info.width + x) * ch;
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 40) {
        if (x < bLeft) bLeft = x; if (x > bRight) bRight = x;
      }
    }
  }
  const bodyW = bRight - bLeft + 1, bodyH = bottom - bodyTopY + 1;
  const derivedRatio = bodyW / bodyH, canonRatio = canon.widthMm / canon.bodyMm;
  if (Math.abs(derivedRatio - canonRatio) / canonRatio > 0.3) {
    throw new Error(
      `Cap-on geometry for ${canon.websiteSku} disagrees with canon proportions ` +
      `(derived ${derivedRatio.toFixed(3)} vs canon ${canonRatio.toFixed(3)}); flag for human review.`,
    );
  }
  return {
    foregroundBounds: { left, top, width, height },
    bodyLeftX: bLeft, bodyRightXExclusive: bRight + 1,
    bodyTopY, bodyBottomYExclusive: bottom + 1,
    primaryCenterX: Math.round((bLeft + bRight) / 2),
    droppedComponents: sizes.length - 1,
  };
}

function number(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} is not a positive canonical value.`);
  }
  return parsed;
}

function verifiedRoleReference(
  role: CylinderReferenceRole,
  expectedRole: "identity-cap-on" | "pdp-cap-off-sidecar",
): { url: string; sha256: string } | null {
  if (
    role.roleId !== expectedRole
    || role.status !== "verified"
    || role.remoteStatus !== "verified"
    || role.productionStatus !== "generation-authorized"
    || !role.publicUrl
    || !role.exportSha256
  ) {
    return null;
  }
  return { url: role.publicUrl, sha256: role.exportSha256 };
}

async function fetchBytes(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Reference fetch failed (${response.status}) for ${url}.`);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

async function materializeReference(input: {
  workspaceRoot: string;
  outputDirectory: string;
  websiteSku: string;
  role: "identity-cap-on" | "pdp-cap-off-sidecar";
  sourceUrl: string;
  expectedSourceSha256?: string;
  sourceLane: string;
}): Promise<CylinderPilotReferenceInput> {
  const fetched = await fetchBytes(input.sourceUrl);
  const sourceSha256 = sha256(fetched.bytes);
  if (input.expectedSourceSha256 && sourceSha256 !== input.expectedSourceSha256) {
    throw new Error(
      `${input.websiteSku} ${input.role} remote bytes no longer match the approved hash.`,
    );
  }
  const pngBytes = fetched.contentType.includes("png")
    ? fetched.bytes
    : await sharp(fetched.bytes, { animated: false }).png().toBuffer();
  const pngSha256 = sha256(pngBytes);
  const filename = `${input.websiteSku}__${input.role}__${pngSha256}.png`;
  const absolutePath = path.join(input.outputDirectory, "references", filename);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, pngBytes);
  const locator = path.relative(input.workspaceRoot, absolutePath).split(path.sep).join("/");
  return {
    locator,
    sha256: pngSha256,
    topology: input.role === "identity-cap-on"
      ? "assembled-cap-on"
      : "fitment-attached-detached-sidecar",
    sourceLane: input.sourceLane,
  };
}

export async function buildCylinderSixRolePilotArtifact(input: {
  workspaceRoot: string;
  generatedAt?: string;
}): Promise<{
  artifactPath: string;
  artifactSha256: string;
  materialPilotPath: string;
  materialPilotSha256: string;
}> {
  const canonicalBytes = await readFile(path.join(input.workspaceRoot, CANONICAL_PATH));
  const canonicalSha256 = sha256(canonicalBytes);
  const canonicalRows = parseCsv(canonicalBytes.toString("utf8")).records;
  const roleAware = JSON.parse(
    await readFile(path.join(input.workspaceRoot, ROLE_AWARE_PATH), "utf8"),
  ) as CylinderRoleAwareReadinessArtifact;
  const roleRows = new Map(roleAware.rows.map((row) => [row.websiteSku, row]));
  const canonicalBySku = new Map(canonicalRows.map((row) => [row.websiteSku, row]));
  const outputDirectory = path.join(input.workspaceRoot, OUTPUT_ROOT, canonicalSha256);
  await mkdir(outputDirectory, { recursive: true });

  const products: CylinderSixRolePilotProductInput[] = [];
  for (const identity of PILOT_IDENTITIES) {
    const canonical = canonicalBySku.get(identity.websiteSku);
    if (!canonical) throw new Error(`Canonical row missing for ${identity.websiteSku}.`);
    if (canonical.family !== "Cylinder") {
      throw new Error(`${identity.websiteSku} is not canonically Cylinder.`);
    }
    const roleRow = roleRows.get(identity.websiteSku);
    const verifiedCapOn = roleRow
      ? verifiedRoleReference(roleRow.references.identityCapOn, "identity-cap-on")
      : null;
    const verifiedSidecar = roleRow
      ? verifiedRoleReference(roleRow.references.pdpCapOffSidecar, "pdp-cap-off-sidecar")
      : null;
    const supplement = identity.capacityMl === 5 || identity.capacityMl === 25
      ? LIVE_ROLE_SUPPLEMENTS[identity.capacityMl]
      : null;
    if ((!verifiedCapOn || !verifiedSidecar) && !supplement) {
      throw new Error(`${identity.websiteSku} is missing an exact role reference.`);
    }

    const identityCapOn = await materializeReference({
      workspaceRoot: input.workspaceRoot,
      outputDirectory,
      websiteSku: identity.websiteSku,
      role: "identity-cap-on",
      sourceUrl: verifiedCapOn?.url ?? supplement!.identityCapOn,
      expectedSourceSha256: verifiedCapOn?.sha256,
      sourceLane: verifiedCapOn ? "role-aware-readiness" : "exact-live-pdp-capped",
    });
    const rawPdpCapOffSidecar = await materializeReference({
      workspaceRoot: input.workspaceRoot,
      outputDirectory,
      websiteSku: identity.websiteSku,
      role: "pdp-cap-off-sidecar",
      sourceUrl: verifiedSidecar?.url ?? supplement!.pdpCapOffSidecar,
      expectedSourceSha256: verifiedSidecar?.sha256,
      sourceLane: verifiedSidecar ? "role-aware-readiness" : "exact-live-pdp-sidecar",
    });
    const bodyHeightMm = number(
      canonical.canon_bodyHeightMm,
      `${identity.websiteSku} body height`,
    );
    const widthMm = number(
      canonical.canon_widthAxisMm,
      `${identity.websiteSku} width`,
    );
    const depthMm = number(
      canonical.canon_secondAxisMm,
      `${identity.websiteSku} depth`,
    );
    const heightWithCapMm = number(
      canonical.canon_heightWithCapMm,
      `${identity.websiteSku} height with cap`,
    );
    const sidecarScale = buildMaterialPilotCanonicalBodyScaleContract({
      capacityMl: identity.capacityMl,
      canonBodyHeightMm: bodyHeightMm,
      canonBodyWidthMm: widthMm,
      canonAssembledHeightMm: heightWithCapMm,
    });
    const conditioningDirectory = path.join(outputDirectory, "conditioned-references");
    await mkdir(conditioningDirectory, { recursive: true });
    // Cap-on deterministic conditioning (2026-07-18): code places the real
    // photo at exact canonical scale/baseline; geometry is never delegated to
    // the model. Source geometry is auto-derived (primary component only, so
    // stray detached caps in mixed studio shots are dropped).
    const capOnAbsolute = path.join(input.workspaceRoot, identityCapOn.locator);
    const capOnGeometry = await deriveCapOnSourceGeometry(capOnAbsolute, {
      bodyMm: bodyHeightMm, asmMm: heightWithCapMm, widthMm, websiteSku: identity.websiteSku,
    });
    if (capOnGeometry.droppedComponents > 0) {
      console.warn(`[cap-on screen] ${identity.websiteSku}: dropped ${capOnGeometry.droppedComponents} stray component(s) from mixed-composition source`);
    }
    const conditionedCapOnPath = path.join(conditioningDirectory, `${identity.websiteSku}__cap-on__canonical-body-scale-v1.png`);
    const conditionedCapOnRecord = await conditionWholeRoleReference({
      websiteSku: identity.websiteSku,
      assetRole: "cap-on",
      sourcePath: capOnAbsolute,
      sourceSha256: identityCapOn.sha256,
      outputPath: conditionedCapOnPath,
      maskPath: path.join(conditioningDirectory, `${identity.websiteSku}__cap-on__canonical-body-scale-v1-mask.png`),
      identityOverlayPath: path.join(conditioningDirectory, `${identity.websiteSku}__cap-on__canonical-body-scale-v1-identity-overlay.png`),
      recordPath: path.join(conditioningDirectory, `${identity.websiteSku}__cap-on__canonical-body-scale-v1.json`),
      sourceGeometry: capOnGeometry,
      canvas: { widthPx: 2080, heightPx: 2288, boneHex: "#F5F3EF" },
      target: {
        bodyHeightPx: sidecarScale.bodyTargetPx,
        bodyWidthPx: sidecarScale.bodyWidthTargetPx,
        baselineYPx: sidecarScale.baselineYPx,
        primaryCenterXPx: 1040,
      },
    });
    const conditionedIdentityCapOn: CylinderPilotReferenceInput = {
      locator: path.relative(input.workspaceRoot, conditionedCapOnPath).split(path.sep).join("/"),
      sha256: conditionedCapOnRecord.outputSha256,
      topology: "assembled-cap-on",
      sourceLane: `${identityCapOn.sourceLane}+canonical-body-scale-conditioned`,
      conditioning: {
        sourceLocator: identityCapOn.locator,
        sourceSha256: identityCapOn.sha256,
        evidenceRecordLocator: path.relative(input.workspaceRoot, path.join(conditioningDirectory, `${identity.websiteSku}__cap-on__canonical-body-scale-v1.json`)).split(path.sep).join("/"),
        maskLocator: path.relative(input.workspaceRoot, path.join(conditioningDirectory, `${identity.websiteSku}__cap-on__canonical-body-scale-v1-mask.png`)).split(path.sep).join("/"),
        maskSha256: conditionedCapOnRecord.maskSha256,
        maskSemantics: conditionedCapOnRecord.maskSemantics,
        identityOverlayLocator: path.relative(input.workspaceRoot, path.join(conditioningDirectory, `${identity.websiteSku}__cap-on__canonical-body-scale-v1-identity-overlay.png`)).split(path.sep).join("/"),
        identityOverlaySha256: conditionedCapOnRecord.identityOverlaySha256,
        identityOverlaySemantics: conditionedCapOnRecord.identityOverlaySemantics,
        operation: "pre-generation-whole-role-uniform-conditioning",
        postGenerationMutationAllowed: false,
      },
    };
    const conditionedSidecarPath = path.join(
      conditioningDirectory,
      `${identity.websiteSku}__sidecar__canonical-body-scale-v2.png`,
    );
    const conditionedSidecarRecordPath = path.join(
      conditioningDirectory,
      `${identity.websiteSku}__sidecar__canonical-body-scale-v2.json`,
    );
    const conditionedSidecarMaskPath = path.join(
      conditioningDirectory,
      `${identity.websiteSku}__sidecar__canonical-body-scale-v2-mask.png`,
    );
    const conditionedSidecarIdentityOverlayPath = path.join(
      conditioningDirectory,
      `${identity.websiteSku}__sidecar__canonical-body-scale-v2-identity-overlay.png`,
    );
    const conditionedSidecarRecord = await conditionWholeRoleReference({
      websiteSku: identity.websiteSku,
      assetRole: "sidecar",
      sourcePath: path.join(input.workspaceRoot, rawPdpCapOffSidecar.locator),
      sourceSha256: rawPdpCapOffSidecar.sha256,
      outputPath: conditionedSidecarPath,
      maskPath: conditionedSidecarMaskPath,
      identityOverlayPath: conditionedSidecarIdentityOverlayPath,
      recordPath: conditionedSidecarRecordPath,
      sourceGeometry: await deriveSidecarSourceGeometry(path.join(input.workspaceRoot, rawPdpCapOffSidecar.locator), { bodyMm: bodyHeightMm, widthMm, websiteSku: identity.websiteSku }),
      canvas: { widthPx: 2080, heightPx: 2288, boneHex: "#F5F3EF" },
      target: {
        bodyHeightPx: sidecarScale.bodyTargetPx,
        bodyWidthPx: sidecarScale.bodyWidthTargetPx,
        baselineYPx: sidecarScale.baselineYPx,
        primaryCenterXPx: 1040,
      },
    });
    const pdpCapOffSidecar: CylinderPilotReferenceInput = {
      locator: path.relative(input.workspaceRoot, conditionedSidecarPath).split(path.sep).join("/"),
      sha256: conditionedSidecarRecord.outputSha256,
      topology: "fitment-attached-detached-sidecar",
      sourceLane: `${rawPdpCapOffSidecar.sourceLane}+canonical-body-scale-conditioned`,
      conditioning: {
        sourceLocator: rawPdpCapOffSidecar.locator,
        sourceSha256: rawPdpCapOffSidecar.sha256,
        evidenceRecordLocator: path.relative(
          input.workspaceRoot,
          conditionedSidecarRecordPath,
        ).split(path.sep).join("/"),
        maskLocator: path.relative(
          input.workspaceRoot,
          conditionedSidecarMaskPath,
        ).split(path.sep).join("/"),
        maskSha256: conditionedSidecarRecord.maskSha256,
        maskSemantics: conditionedSidecarRecord.maskSemantics,
        identityOverlayLocator: path.relative(
          input.workspaceRoot,
          conditionedSidecarIdentityOverlayPath,
        ).split(path.sep).join("/"),
        identityOverlaySha256: conditionedSidecarRecord.identityOverlaySha256,
        identityOverlaySemantics: conditionedSidecarRecord.identityOverlaySemantics,
        operation: "pre-generation-whole-role-uniform-conditioning",
        postGenerationMutationAllowed: false,
      },
    };
    products.push({
      websiteSku: canonical.websiteSku,
      graceSku: canonical.graceSku,
      family: "Cylinder",
      capacityMl: identity.capacityMl,
      bodyHeightMm,
      widthMm,
      depthMm,
      heightWithCapMm,
      references: { identityCapOn: conditionedIdentityCapOn, pdpCapOffSidecar },
    });
  }

  const artifact = buildCylinderSixRolePilot({
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    canonicalMaster: { path: CANONICAL_PATH, sha256: canonicalSha256 },
    products,
  });
  const artifactPath = path.join(outputDirectory, "cylinder-six-role-pilot.json");
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  const fullMaterial = BEST_BOTTLES_LANE_LOCKED_MATERIAL_CALIBRATIONS.glass;
  const materialDirectory = path.join(outputDirectory, "material-calibration");
  await mkdir(materialDirectory, { recursive: true });
  const materialSourcePath = path.join(
    materialDirectory,
    `approved-full-reference__${fullMaterial.bytesSha256}.png`,
  );
  const materialSource = await fetchBytes(fullMaterial.url);
  if (sha256(materialSource.bytes) !== fullMaterial.bytesSha256) {
    throw new Error("Approved glass material reference hash no longer matches.");
  }
  await writeFile(materialSourcePath, materialSource.bytes);
  const materialOutputPath = path.join(
    materialDirectory,
    "clear-glass-sidewall-only-v2.png",
  );
  const materialRecordPath = path.join(
    materialDirectory,
    "clear-glass-sidewall-only-v2.json",
  );
  const materialRecord = await cropGlassOnlyMaterialCalibration({
    sourcePath: materialSourcePath,
    sourceSha256: fullMaterial.bytesSha256,
    outputPath: materialOutputPath,
    recordPath: materialRecordPath,
    crop: GLASS_ONLY_MATERIAL_CROP,
  });
  // Human-selected material canon (2026-07-18): per-subfamily x lane glass
  // swatches supersede the single shared calibration when present; nearest
  // clear-size swatch covers the 25 mL (no dedicated canon subfamily yet).
  const CANON_ROOT = "tmp/best-bottles-reference-production/cylinder-reference-loop/material-canon";
  const canonRegistry = JSON.parse(await readFile(
    path.join(input.workspaceRoot, CANON_ROOT, "material-canon-registry.json"), "utf8",
  )) as { swatches?: Array<{ subfamily: string; lane: string; swatchFile: string; sha256: string }> };
  const CANON_SUBFAMILY: Record<number, string> = {
    3: "3ml-clear", 5: "5ml-cobalt-blue", 9: "9ml-amber",
    25: "28ml-clear", 50: "50ml-clear", 100: "100ml-clear",
  };
  const resolveMaterialCalibration = (
    product: { websiteSku: string; capacityMl: number },
    assetRole: "cap-on" | "sidecar",
  ) => {
    const sub = CANON_SUBFAMILY[product.capacityMl];
    const lane = assetRole === "cap-on" ? "cap-on" : "cap-off";
    const swatch = canonRegistry.swatches?.find((s) => s.subfamily === sub && s.lane === lane);
    if (!swatch) return null;
    return {
      locator: `${CANON_ROOT}/swatches/${swatch.swatchFile}`,
      sha256: swatch.sha256,
      evidenceRecordLocator: `${CANON_ROOT}/material-canon-registry.json`,
    };
  };
  const materialPilot = await compileCylinderSixRoleMaterialPilot(artifact, {
    materialCalibration: {
      locator: path.relative(input.workspaceRoot, materialOutputPath).split(path.sep).join("/"),
      sha256: materialRecord.outputSha256,
      evidenceRecordLocator: path.relative(input.workspaceRoot, materialRecordPath).split(path.sep).join("/"),
    },
    resolveMaterialCalibration,
  });
  const materialPilotPath = path.join(
    outputDirectory,
    "cylinder-six-role-material-pilot.json",
  );
  await writeFile(
    materialPilotPath,
    `${JSON.stringify(materialPilot, null, 2)}\n`,
    "utf8",
  );
  return {
    artifactPath,
    artifactSha256: artifact.sha256,
    materialPilotPath,
    materialPilotSha256: materialPilot.sha256,
  };
}

const isCli = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isCli) {
  const workspaceRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
  process.stdout.write(`${JSON.stringify(
    await buildCylinderSixRolePilotArtifact({ workspaceRoot }),
    null,
    2,
  )}\n`);
}
