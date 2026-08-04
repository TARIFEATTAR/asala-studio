import {
  applyBestBottlesFamilyScaleCorrection,
  BEST_BOTTLES_CATALOG_SCALE_VERSION,
  resolveBestBottlesGlobalScalePct,
} from "./bestBottlesCatalogScale";

export const CYLINDER_APPLICATOR_CURVE_SOURCE = {
  path: "tmp/best-bottles-reference-production/cylinder-applicator-curves-v1/cylinder-applicator-curves-manifest.json",
  sha256: "c2dbb366cb32fb09573df8627845065ae0a6c51e59efcedb41f23930439a954e",
  reviewVersion: "2026-07-13-user-applicator-curves-v3",
} as const;

type CylinderPresentationStatus = "ready" | "blocked";

export type CylinderPaperDollPresentationPosition = {
  displayKey: string;
  label: string;
  lane: "spray" | "roll-on" | "reducer";
  capacityMl: number;
  bodyHeightMm: number;
  assembledHeightMm: number;
  status: CylinderPresentationStatus;
  familyCorrectionPct: number;
  blocker: string | null;
};

export const CYLINDER_PAPER_DOLL_PRESENTATION_POSITIONS = [
  { displayKey: "spray|3", label: "3 mL spray", lane: "spray", capacityMl: 3, bodyHeightMm: 37, assembledHeightMm: 54, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "spray|4", label: "4 mL spray", lane: "spray", capacityMl: 4, bodyHeightMm: 49, assembledHeightMm: 67, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "spray|5", label: "5 mL spray", lane: "spray", capacityMl: 5, bodyHeightMm: 53, assembledHeightMm: 72, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "spray|9|regular", label: "9 mL regular spray", lane: "spray", capacityMl: 9, bodyHeightMm: 70, assembledHeightMm: 96, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "spray|9|tall", label: "9 mL tall 13-415 spray", lane: "spray", capacityMl: 9, bodyHeightMm: 106, assembledHeightMm: 111, status: "ready", familyCorrectionPct: 2, blocker: null },
  { displayKey: "spray|25", label: "25 mL spray", lane: "spray", capacityMl: 25, bodyHeightMm: 83, assembledHeightMm: 108, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "spray|50", label: "50 mL spray", lane: "spray", capacityMl: 50, bodyHeightMm: 117, assembledHeightMm: 142, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "spray|100", label: "100 mL spray", lane: "spray", capacityMl: 100, bodyHeightMm: 154, assembledHeightMm: 195, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "roll-on|5", label: "5 mL regular roll-on", lane: "roll-on", capacityMl: 5, bodyHeightMm: 53, assembledHeightMm: 65, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "roll-on|9|classic-20", label: "9 mL classic 20 mm roll-on", lane: "roll-on", capacityMl: 9, bodyHeightMm: 70, assembledHeightMm: 83, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "roll-on|9|classic-21", label: "9 mL classic 21 mm roll-on", lane: "roll-on", capacityMl: 9, bodyHeightMm: 70, assembledHeightMm: 75, status: "blocked", familyCorrectionPct: 0, blocker: "No exact supplied or approved reference exists for the distinct 70 × 21 mm shell." },
  { displayKey: "roll-on|9|regular", label: "9 mL regular roll-on", lane: "roll-on", capacityMl: 9, bodyHeightMm: 74, assembledHeightMm: 87, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "roll-on|9|tall", label: "9 mL tall roll-on", lane: "roll-on", capacityMl: 9, bodyHeightMm: 106, assembledHeightMm: 118, status: "ready", familyCorrectionPct: 2, blocker: null },
  { displayKey: "roll-on|28", label: "28 mL big roll-on", lane: "roll-on", capacityMl: 28, bodyHeightMm: 81, assembledHeightMm: 100, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "roll-on|50", label: "50 mL big roll-on", lane: "roll-on", capacityMl: 50, bodyHeightMm: 98, assembledHeightMm: 116, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "reducer|25", label: "25 mL reducer", lane: "reducer", capacityMl: 25, bodyHeightMm: 83, assembledHeightMm: 97, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "reducer|50", label: "50 mL reducer", lane: "reducer", capacityMl: 50, bodyHeightMm: 117, assembledHeightMm: 131, status: "ready", familyCorrectionPct: 0, blocker: null },
  { displayKey: "reducer|100", label: "100 mL reducer", lane: "reducer", capacityMl: 100, bodyHeightMm: 154, assembledHeightMm: 184, status: "ready", familyCorrectionPct: 0, blocker: null },
] as const satisfies readonly CylinderPaperDollPresentationPosition[];

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function resolveCylinderPaperDollPresentation(displayKey: string) {
  const position = CYLINDER_PAPER_DOLL_PRESENTATION_POSITIONS.find(
    (candidate) => candidate.displayKey === displayKey,
  );
  if (!position) {
    throw new Error(`Unknown Cylinder paper-doll display position: ${displayKey}`);
  }
  if (position.status === "blocked") {
    throw new Error(`Cylinder paper-doll display position ${displayKey} is blocked: ${position.blocker}`);
  }
  const globalTarget = resolveBestBottlesGlobalScalePct(position.capacityMl);
  const targetAssembledHeightPct = round(applyBestBottlesFamilyScaleCorrection(
    globalTarget,
    position.familyCorrectionPct,
  ));
  return {
    ...position,
    scaleContractVersion: BEST_BOTTLES_CATALOG_SCALE_VERSION,
    targetSource: "reviewed-cylinder-applicator-display-position",
    targetAssembledHeightPct,
    transformScope: "complete-paper-doll-assembly" as const,
    sourceManifest: CYLINDER_APPLICATOR_CURVE_SOURCE,
  };
}
