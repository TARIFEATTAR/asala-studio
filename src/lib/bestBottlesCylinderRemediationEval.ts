import { PRESERVE } from "../config/bestBottlesCatalogCanon";
import type {
  CylinderReferenceRemediationPlan,
  CylinderReferenceRemediationRow,
} from "./bestBottlesCylinderReferenceRemediation";

export const CYLINDER_REMEDIATION_EVAL_WORKFLOW_VERSION = "reference-remediation-v1" as const;
export const SEALED_CYLINDER_REMEDIATION_PLAN_SHA256 =
  "c167ba5618c575af50fa3044167ee4f0941376d69823eb8c3fe6f87c9fb3d23b" as const;

export interface CylinderRemediationEvalProduct {
  graceSku: string;
  websiteSku: string;
  itemName: string | null;
  itemDescription: string | null;
  bottleCollection: string | null;
  family: "Cylinder";
  category: string | null;
  color: string | null;
  capacityMl: number;
  applicator: string | null;
  capColor: string | null;
  trimColor: string | null;
  capStyle: string | null;
  heightWithoutCap: string;
  heightWithCap: string;
  diameter: string;
  capState: "assembled";
  topologyReferenceId: string;
  productUrl: string | null;
}

function exactText(record: Record<string, string>, key: string): string | null {
  const value = record[key]?.trim();
  return value ? value : null;
}

export function assertCylinderRemediationPlanSeal(
  plan: CylinderReferenceRemediationPlan,
): void {
  if (plan.sha256 !== SEALED_CYLINDER_REMEDIATION_PLAN_SHA256) {
    throw new Error(
      `Expected sealed remediation plan SHA ${SEALED_CYLINDER_REMEDIATION_PLAN_SHA256}; received ${plan.sha256}.`,
    );
  }
  if (
    plan.summary.generationReadyCount !== 96
    || plan.summary.geometryBlockedCount !== 0
    || plan.rows.length !== 96
    || plan.rows.some((row) => row.status !== "ready-for-remediation-eval")
  ) {
    throw new Error("Sealed remediation plan must contain exactly 96 ready Cylinder rows and zero geometry blockers.");
  }
}

export function buildCylinderRemediationEvalProduct(
  row: CylinderReferenceRemediationRow,
  canonicalMasterRows: Array<Record<string, string>>,
): CylinderRemediationEvalProduct {
  const matches = canonicalMasterRows.filter((candidate) =>
    candidate.graceSku?.trim() === row.graceSku
    && candidate.websiteSku?.trim() === row.websiteSku);
  if (matches.length !== 1) {
    throw new Error(
      `${row.graceSku} requires one exact canonical master identity joined by both Grace and website SKU; found ${matches.length}.`,
    );
  }
  const master = matches[0];
  const family = exactText(master, "family");
  if (family !== "Cylinder" && family !== "Tall Cylinder") {
    throw new Error(`${row.graceSku} canonical family is ${family ?? "missing"}, not Cylinder.`);
  }
  const bodyHeightMm = row.canonicalGeometry.bodyHeightMm;
  if (bodyHeightMm == null || bodyHeightMm <= 0) {
    throw new Error(`${row.graceSku} remediation evaluation requires positive canonical body height.`);
  }
  const capacityMl = Number(master.capacityMl);
  if (!Number.isFinite(capacityMl) || capacityMl <= 0 || capacityMl !== row.capacityMl) {
    throw new Error(`${row.graceSku} canonical capacity does not match the sealed remediation plan.`);
  }

  return {
    graceSku: row.graceSku,
    websiteSku: row.websiteSku,
    itemName: exactText(master, "itemName"),
    itemDescription: exactText(master, "itemName"),
    bottleCollection: exactText(master, "bottleCollection"),
    family: "Cylinder",
    category: exactText(master, "category"),
    color: exactText(master, "color"),
    capacityMl,
    applicator: exactText(master, "applicator"),
    capColor: exactText(master, "capColor"),
    trimColor: exactText(master, "trimColor"),
    capStyle: exactText(master, "capStyle"),
    // Only the sealed plan's canonical/overridden geometry enters generation.
    // Raw catalog and Convex copy-of-diameter fields are deliberately ignored.
    heightWithoutCap: `${bodyHeightMm} mm`,
    heightWithCap: `${row.canonicalGeometry.assembledHeightMm} mm`,
    diameter: `${row.canonicalGeometry.widthAxisMm} mm`,
    capState: "assembled",
    topologyReferenceId: row.sourcePsdSha256,
    productUrl: exactText(master, "productUrl"),
  };
}

const DETACHED_SIDECAR_FRAMING_LINE =
  "- If a detached cap or applicator is present, keep it as a right-sidecar component on the same baseline; it must not shift the primary bottle off center.";

const ASSEMBLY_REMEDIATION_IDENTITY_LOCK = `REFERENCE REMEDIATION — ASSEMBLED OUTPUT (reference-remediation-v1):
The attached PNG is exact, approved product evidence exported from the identity-locked Photoshop source. It shows the correct bottle and its matching closure/applicator as detached components only because the legacy source is an exploded catalog composite.

Create exactly one fully assembled cap-on product. Move only the detached matching closure/applicator from the sidecar onto its physically correct seat on this exact bottle. The finished output must contain no detached sidecar, no duplicate cap, no duplicate applicator, and no leftover loose component.

Preserve the exact bottle silhouette, body proportions, neck, threads, glass color and finish, closure shape, closure color, collar, sprayer, pump, roller ball, dip tube, and all hardware shown in the evidence. Do not invent, substitute, delete, recolor, or redesign any physical component. This is an assembly and native-resolution studio remediation of the approved evidence, not a new product design.`;

function canonicalAssemblyGeometryLock(row: CylinderReferenceRemediationRow): string {
  const bodyHeightMm = row.canonicalGeometry.bodyHeightMm;
  if (bodyHeightMm == null || bodyHeightMm <= 0) {
    throw new Error(`${row.graceSku} requires positive canonical body height for assembled geometry lock.`);
  }
  const assembledHeightMm = row.canonicalGeometry.assembledHeightMm;
  const widthAxisMm = row.canonicalGeometry.widthAxisMm;
  const closureContributionMm = assembledHeightMm - bodyHeightMm;
  const assembledRatio = Number((assembledHeightMm / widthAxisMm).toFixed(3));
  return `CANONICAL ASSEMBLED GEOMETRY LOCK:
- Body height: ${bodyHeightMm} mm.
- Assembled height: ${assembledHeightMm} mm.
- Maximum body diameter: ${widthAxisMm} mm.
- Visible closure contribution above the body: ${closureContributionMm} mm. This is not the closure object's full detached height: seat and overlap it over the neck exactly as the real assembled product requires.
- Assembled height-to-diameter ratio: ${assembledRatio}:1. Preserve this silhouette ratio; do not make the bottle or closure taller, shorter, wider, or narrower.
- The canonical measurements control the assembled output. Source padding, crop, detached-component spacing, and the detached cap's standalone bounding box do not control geometry.`;
}

export function buildCylinderRemediationEvalPrompt(
  basePrompt: string,
  row: CylinderReferenceRemediationRow,
): string {
  const workflowHeader = `WORKFLOW LIFECYCLE: ${CYLINDER_REMEDIATION_EVAL_WORKFLOW_VERSION}. Output is review-pending local evidence only; it is not approved, promoted, published, or Shopify-ready.`;
  const geometryLock = canonicalAssemblyGeometryLock(row);
  if (row.remediationMode === "regenerate-native-resolution") {
    return `${workflowHeader}\n\n${geometryLock}\n\n${basePrompt}`;
  }
  const preserveCount = basePrompt.split(PRESERVE).length - 1;
  if (preserveCount !== 1) {
    throw new Error(`${row.graceSku} prompt must contain exactly one canonical PRESERVE block; found ${preserveCount}.`);
  }
  let prompt = basePrompt.replace(PRESERVE, ASSEMBLY_REMEDIATION_IDENTITY_LOCK);
  prompt = prompt.replace(
    DETACHED_SIDECAR_FRAMING_LINE,
    "- This remediation output is assembled cap-on: render no detached sidecar and keep the assembled bottle centered on the shared baseline.",
  );
  return `${workflowHeader}\n\n${geometryLock}\n\n${prompt}`;
}
