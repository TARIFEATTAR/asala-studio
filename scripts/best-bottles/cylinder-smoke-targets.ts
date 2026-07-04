const ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";

export type CylinderSmokeCapState = "assembled" | "detached";
export type CylinderSmokeMode = "cap-on" | "cap-off";

export interface CylinderSmokeTarget {
  caseId: string;
  capacity: string;
  sku: string;
  reference: string;
  mode?: CylinderSmokeMode;
  capState?: CylinderSmokeCapState;
}

export const ALL_CYLINDER_SMOKE_TARGETS: readonly CylinderSmokeTarget[] = [
  {
    caseId: "3ml",
    capacity: "3ml",
    sku: "GB-SPR-CLR-3ML-BLK",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-3ml-clear-12mm-finemist/GB-SPR-CLR-3ML-BLK__GBSpry3mlClBlk__pdp-main__v001.png`,
  },
  {
    caseId: "4ml",
    capacity: "4ml",
    sku: "GB-SPR-CLR-4ML-BLK",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-4ml-clear-12mm-finemist/GB-SPR-CLR-4ML-BLK__GBSpry4mlClBlk__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "5ml-cap-off",
    capacity: "5ml",
    sku: "GB-CYL-CLR-5ML-SPR-SBLK",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-5ml-clear-13-415-finemist/GB-CYL-CLR-5ML-SPR-SBLK__GBCyl5SpryBlkSh__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "9ml-regular",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-11",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-11__GBCyl9RollBlkDot__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "9ml-slim",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-SPR-SBLK",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-13-415-finemist/GB-CYL-CLR-9ML-SPR-SBLK__GBTallCyl9SpryBlkSh__pdp-main__v001.png`,
  },
  {
    caseId: "28ml",
    capacity: "28ml",
    sku: "GB-CYL-CLR-28ML-MRL-01",
    reference:
      `${ROOT}/pipeline/madison-hero-sync/renders/cylinder-reframed-2026-06-13/GB-CYL-CLR-28ML-MRL-01.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "100ml",
    capacity: "100ml",
    sku: "GB-CYL-CLR-100ML-ASP-BLK",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-100ml-clear-18-415-antiquespray/GB-CYL-CLR-100ML-ASP-BLK__GBCyl100AnSpBlk__pdp-main__v001.png`,
  },
] as const;

export const NINE_ML_ROLL_ON_CAP_OFF_SMOKE_TARGETS: readonly CylinderSmokeTarget[] = [
  {
    caseId: "9ml-rollon-capoff-metal-black-dot",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-02",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-02__GBCyl9MtlRollBlkDot__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "9ml-rollon-capoff-metal-matte-copper",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-03",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-03__GBCyl9MtlRollMattCu__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "9ml-rollon-capoff-metal-matte-gold",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-04",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-04__GBCyl9MtlRollMattGl__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  // GB-CYL-CLR-9ML-T-05's Convex row says capColor="Clear" but the product has a
  // pink dot cap; the cap-color override registry (src/lib/bestBottlesCapColorOverrides.ts)
  // corrects it code-side, so it is identity-clean and back in the ready set.
  // Remove the override entry once Cowork fixes the Convex metadata.
  {
    caseId: "9ml-rollon-capoff-metal-pink-dot",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-05",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-05__GBCyl9MtlRollPnkDot__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "9ml-rollon-capoff-metal-matte-silver",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-MRL-MSLV-01",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-MRL-MSLV-01__GBCyl9MtlRollMattSl__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "9ml-rollon-capoff-metal-shiny-black",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-06",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-06__GBCyl9MtlRollShBlk__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "9ml-rollon-capoff-metal-shiny-gold",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-07",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-07__GBCyl9MtlRollShnGl__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "9ml-rollon-capoff-metal-shiny-silver",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-08",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-08__GBCyl9MtlRollShnSl__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "9ml-rollon-capoff-metal-silver-dot",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-09",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-09__GBCyl9MtlRollSlDot__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
  {
    caseId: "9ml-rollon-capoff-metal-white",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-10",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-10__GBCyl9MtlRollWht__pdp-main__v001.png`,
    mode: "cap-off",
    capState: "detached",
  },
] as const;

export const NINE_ML_FINE_MIST_SMOKE_TARGETS: readonly CylinderSmokeTarget[] = [
  {
    caseId: "9ml-finemist-black",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-21",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-finemist/GB-CYL-CLR-9ML-T-21__GBCyl9SpryBlk__pdp-main__v001.png`,
  },
  {
    caseId: "9ml-finemist-matte-silver",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-23",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-finemist/GB-CYL-CLR-9ML-T-23__GBCyl9SpryMattSl__pdp-main__v001.png`,
  },
  {
    caseId: "9ml-finemist-gold",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-22",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-finemist/GB-CYL-CLR-9ML-T-22__GBCyl9SpryGl__pdp-main__v001.png`,
  },
  {
    caseId: "9ml-finemist-shiny-silver",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-25",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-finemist/GB-CYL-CLR-9ML-T-25__GBCyl9SpryShSl__pdp-main__v001.png`,
  },
  {
    caseId: "9ml-finemist-red",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-24",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-finemist/GB-CYL-CLR-9ML-T-24__GBCyl9SpryRd__pdp-main__v001.png`,
  },
  {
    caseId: "9ml-finemist-turquoise",
    capacity: "9ml",
    sku: "GB-CYL-CLR-9ML-T-26",
    reference:
      `${ROOT}/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-clear-17-415-finemist/GB-CYL-CLR-9ML-T-26__GBCyl9SpryTur__pdp-main__v001.png`,
  },
] as const;

export function selectCylinderSmokeTargets(requestedCsv?: string): readonly CylinderSmokeTarget[] {
  const requested = new Set(
    (requestedCsv ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (requested.size === 0) return ALL_CYLINDER_SMOKE_TARGETS;
  if (requested.has("9ml-rollons-capoff")) return NINE_ML_ROLL_ON_CAP_OFF_SMOKE_TARGETS;
  if (requested.has("9ml-finemist")) return NINE_ML_FINE_MIST_SMOKE_TARGETS;

  return [
    ...ALL_CYLINDER_SMOKE_TARGETS,
    ...NINE_ML_ROLL_ON_CAP_OFF_SMOKE_TARGETS,
    ...NINE_ML_FINE_MIST_SMOKE_TARGETS,
  ].filter((target) => requested.has(target.caseId) || requested.has(target.sku));
}
