export interface BestBottlesDottedCapIdentity {
  graceSku?: string | null;
  websiteSku?: string | null;
  applicator?: string | null;
  neckThreadSize?: string | null;
  capColor?: string | null;
}

const DOTTED_SKU_PATTERN = /(?:BKDT|BLDOT|BDOT|PKDT|PNKDOT|SLDT|SLDOT|DOT)/i;
const ROLL_ON_PATTERN = /(?:roll[ -]?on|roller ball|\brol\b|\bmrl\b)/i;

function resolveFinish(input: BestBottlesDottedCapIdentity): "BLK" | "PNK" | "SLV" | null {
  const evidence = [input.capColor, input.graceSku, input.websiteSku].filter(Boolean).join(" ").toUpperCase();
  if (/(?:PINK|PNK|PKDT)/.test(evidence)) return "PNK";
  if (/(?:SILVER|SLV|SLDT|SLDOT)/.test(evidence)) return "SLV";
  if (/(?:BLACK|BLK|BKDT|BLDOT|BDOT)/.test(evidence)) return "BLK";
  return null;
}

export function resolveBestBottlesDottedCapComponentSku(
  input: BestBottlesDottedCapIdentity,
): string | null {
  const skuEvidence = `${input.graceSku ?? ""} ${input.websiteSku ?? ""}`;
  if (!DOTTED_SKU_PATTERN.test(skuEvidence)) return null;
  if (!ROLL_ON_PATTERN.test(`${input.applicator ?? ""} ${skuEvidence}`)) return null;

  const thread = (input.neckThreadSize ?? "").replace(/[^0-9]/g, "");
  if (thread !== "13415" && thread !== "17415") return null;
  const finish = resolveFinish(input);
  return finish ? `CMP-ROC-${finish}-${thread}-DOT` : null;
}
