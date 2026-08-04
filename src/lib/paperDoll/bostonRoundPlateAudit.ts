import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type BostonRoundResponsibility =
  | "dropper"
  | "metal-roller"
  | "plastic-roller"
  | "short-cap";

export interface BostonRoundBodyAppearance {
  capacityMl: number;
  color: "amber" | "clear" | "cobalt-blue";
  neckFinish: string;
  bodyHeightMm: number;
  diameterMm: number;
  catalogRowCount: number;
}

export interface BostonRoundTruthConflict {
  websiteSku: string;
  graceSku: string;
  capacityMl: number;
  color: "amber" | "clear" | "cobalt-blue";
  field: "canon_bodyHeightMm";
  observed: number;
  familyMode: number;
  disposition: "manual-review-required";
}

export interface BostonRoundPlateAudit {
  catalogRowCount: number;
  catalogRowsByCapacityMl: Record<string, number>;
  catalogRowsByNeckFinish: Record<string, number>;
  bodyAppearances: BostonRoundBodyAppearance[];
  truthConflicts: BostonRoundTruthConflict[];
  compatibilityByCapacityMl: Record<string, {
    neckFinish: string;
    responsibilities: BostonRoundResponsibility[];
  }>;
  dropperAppearanceKeys: string[];
  rollerFitmentKeys: string[];
  rollerOvercapFinishKeys: string[];
}

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const table: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      table.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    table.push(row);
  }

  const nonEmpty = table.filter((cells) => cells.some((cell) => cell.trim()));
  const headers = nonEmpty.shift() ?? [];
  return nonEmpty.map((cells) => Object.fromEntries(
    headers.map((header, index) => [header, cells[index] ?? ""]),
  ));
}

function number(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function normalizeColor(value: string): BostonRoundBodyAppearance["color"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "amber") return "amber";
  if (normalized === "clear") return "clear";
  if (normalized === "cobalt blue" || normalized === "cobalt") return "cobalt-blue";
  throw new Error(`Unsupported Boston Round color: ${value}`);
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const winner = [...counts.entries()].sort((left, right) => (
    right[1] - left[1] || left[0] - right[0]
  ))[0];
  if (!winner) throw new Error("Cannot calculate a mode from an empty set.");
  return winner[0];
}

function responsibility(row: CsvRow): BostonRoundResponsibility | null {
  const applicator = row.applicator.trim().toLowerCase();
  const evidence = `${row.websiteSku} ${row.itemName}`.toLowerCase();
  if (applicator === "dropper" || evidence.includes("dropper") || /\bdrp\b|drpr/.test(evidence)) {
    return "dropper";
  }
  if (applicator === "metal roller ball") return "metal-roller";
  if (applicator === "plastic roller ball") return "plastic-roller";
  if (row.capStyle.trim().toLowerCase() === "short" || evidence.includes("short cap")) return "short-cap";
  return null;
}

function dropperAppearance(row: CsvRow): string {
  const evidence = `${row.websiteSku} ${row.capColor} ${row.trimColor} ${row.itemName}`.toLowerCase();
  const bulb = /wht|white/.test(evidence) ? "white" : "black";
  const trim = /gltrim|shngl|shiny gold|gold trim/.test(evidence)
    ? "shiny-gold"
    : /sltrim|shnsl|shiny silver|silver trim/.test(evidence)
      ? "shiny-silver"
      : "none";
  return `${bulb}:${trim}`;
}

function rollerOvercapFinish(row: CsvRow): string {
  const evidence = `${row.websiteSku} ${row.capColor} ${row.itemName}`.toLowerCase();
  if (/matt(e)?\s*blk|matte black/.test(evidence)) return "matte-black";
  if (/matt(e)?\s*gl|matte gold/.test(evidence)) return "matte-gold";
  if (/matt(e)?\s*sl|matte silver/.test(evidence)) return "matte-silver";
  if (/shn\s*sl|shiny silver/.test(evidence)) return "shiny-silver";
  if (/shn\s*blk|sh\s*blk|shiny black|\bblack cap\b/.test(evidence)) return "shiny-black";
  if (/shn\s*gl|sh\s*gl|roll(on)?gl|shiny gold|\bgold\b/.test(evidence)) return "shiny-gold";
  throw new Error(`Cannot normalize Boston Round roller overcap finish for ${row.websiteSku}.`);
}

function sortBodyAppearances(left: BostonRoundBodyAppearance, right: BostonRoundBodyAppearance): number {
  const colorOrder = ["amber", "clear", "cobalt-blue"];
  return left.capacityMl - right.capacityMl || colorOrder.indexOf(left.color) - colorOrder.indexOf(right.color);
}

export function buildBostonRoundPlateAuditFromCsv(csv: string): BostonRoundPlateAudit {
  const rows = parseCsv(csv).filter((row) => row.family.trim() === "Boston Round");
  const catalogRowsByCapacityMl: Record<string, number> = {};
  const catalogRowsByNeckFinish: Record<string, number> = {};
  const bodyGroups = new Map<string, CsvRow[]>();
  const responsibilitiesByCapacity = new Map<number, Set<BostonRoundResponsibility>>();
  const dropperAppearances = new Set<string>();
  const rollerFitments = new Set<string>();
  const rollerOvercaps = new Set<string>();

  for (const row of rows) {
    const capacityMl = number(row.capacityMl);
    if (capacityMl === null) throw new Error(`Boston Round row ${row.websiteSku} has no numeric capacity.`);
    const color = normalizeColor(row.color);
    increment(catalogRowsByCapacityMl, String(capacityMl));
    increment(catalogRowsByNeckFinish, row.neckThreadSize.trim());
    const bodyKey = `${capacityMl}:${color}`;
    bodyGroups.set(bodyKey, [...(bodyGroups.get(bodyKey) ?? []), row]);

    const normalizedResponsibility = responsibility(row);
    if (normalizedResponsibility) {
      const set = responsibilitiesByCapacity.get(capacityMl) ?? new Set<BostonRoundResponsibility>();
      set.add(normalizedResponsibility);
      responsibilitiesByCapacity.set(capacityMl, set);
      if (normalizedResponsibility === "dropper") dropperAppearances.add(dropperAppearance(row));
      if (normalizedResponsibility === "metal-roller" || normalizedResponsibility === "plastic-roller") {
        rollerFitments.add(normalizedResponsibility === "metal-roller" ? "metal" : "plastic");
        rollerOvercaps.add(rollerOvercapFinish(row));
      }
    }
  }

  const truthConflicts: BostonRoundTruthConflict[] = [];
  const bodyAppearances = [...bodyGroups.values()].map((group): BostonRoundBodyAppearance => {
    const capacityMl = number(group[0].capacityMl)!;
    const color = normalizeColor(group[0].color);
    const heights = group.map((row) => number(row.canon_bodyHeightMm)).filter((value): value is number => value !== null);
    const diameters = group.map((row) => number(row.canon_widthAxisMm)).filter((value): value is number => value !== null);
    const bodyHeightMm = mode(heights);
    const diameterMm = mode(diameters);
    for (const row of group) {
      const observed = number(row.canon_bodyHeightMm);
      if (observed !== null && observed !== bodyHeightMm) {
        truthConflicts.push({
          websiteSku: row.websiteSku,
          graceSku: row.graceSku,
          capacityMl,
          color,
          field: "canon_bodyHeightMm",
          observed,
          familyMode: bodyHeightMm,
          disposition: "manual-review-required",
        });
      }
    }
    return {
      capacityMl,
      color,
      neckFinish: group[0].neckThreadSize.trim(),
      bodyHeightMm,
      diameterMm,
      catalogRowCount: group.length,
    };
  }).sort(sortBodyAppearances);

  const compatibilityByCapacityMl = Object.fromEntries(
    [...responsibilitiesByCapacity.entries()]
      .sort(([left], [right]) => left - right)
      .map(([capacityMl, responsibilities]) => [String(capacityMl), {
        neckFinish: bodyAppearances.find((appearance) => appearance.capacityMl === capacityMl)!.neckFinish,
        responsibilities: [...responsibilities].sort(),
      }]),
  );

  return {
    catalogRowCount: rows.length,
    catalogRowsByCapacityMl,
    catalogRowsByNeckFinish,
    bodyAppearances,
    truthConflicts,
    compatibilityByCapacityMl,
    dropperAppearanceKeys: [...dropperAppearances].sort(),
    rollerFitmentKeys: [...rollerFitments].sort(),
    rollerOvercapFinishKeys: [...rollerOvercaps].sort(),
  };
}

export async function writeBostonRoundPlateAuditArtifacts(options: {
  csv: string;
  outputRoot: string;
  generatedAt?: string;
}): Promise<{ jsonPath: string; markdownPath: string }> {
  const audit = buildBostonRoundPlateAuditFromCsv(options.csv);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const jsonPath = path.join(options.outputRoot, "boston-round-plate-audit.json");
  const markdownPath = path.join(options.outputRoot, "BOSTON-ROUND-PLATE-AUDIT.md");
  const conflict = audit.truthConflicts[0];
  const bodyRows = audit.bodyAppearances.map((appearance) => (
    `| ${appearance.capacityMl} mL | ${appearance.color} | ${appearance.neckFinish} | ${appearance.bodyHeightMm} mm | ${appearance.diameterMm} mm | ${appearance.catalogRowCount} |`
  ));
  const markdown = [
    "# Boston Round paper-doll plate audit",
    "",
    "**State:** catalog responsibilities normalized; Photoshop sources inventoried separately; no production eligibility, geometry lock, release, or Sanity mutation",
    "",
    `The canonical catalog contains ${audit.catalogRowCount} catalog rows. They reduce to nine body appearance lanes rather than one image per SKU.`,
    "",
    "## Body appearance lanes",
    "",
    "| Capacity | Color | Neck | Body height | Diameter | Catalog rows |",
    "|---|---|---|---:|---:|---:|",
    ...bodyRows,
    "",
    "## Physical component responsibilities",
    "",
    `- Dropper appearances: ${audit.dropperAppearanceKeys.join(", ")}`,
    `- Roller fitments: ${audit.rollerFitmentKeys.join(", ")}`,
    `- Roller overcap finishes: ${audit.rollerOvercapFinishKeys.join(", ")}`,
    "- Short black cap: catalog-evidenced on both neck finishes; physical cross-neck compatibility still requires review.",
    "",
    "The 15 mL / 18-400 family has no catalog-evidenced roller responsibility. The 30 mL and 60 mL / 20-400 families have dropper, metal-roller, plastic-roller, and short-cap responsibilities.",
    "",
    "## Truth conflict quarantine",
    "",
    conflict
      ? `- ${conflict.websiteSku} (${conflict.graceSku}) records ${conflict.observed} mm for ${conflict.field}; the 30 mL clear family mode is ${conflict.familyMode} mm. It remains manual-review-required and does not create a fourth 30 mL body geometry.`
      : "- No body-height conflicts detected.",
    "",
    "## Current safe boundary",
    "",
    "This audit defines shot-list lanes, not approved plates. Photoshop byte identity is provenance evidence only; neck compatibility, clean alpha authority, family placement, and assembly-context QA remain separate gates.",
    "",
  ].join("\n");

  await mkdir(options.outputRoot, { recursive: true });
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify({
      schemaVersion: 1,
      generatedAt,
      productionEligible: false,
      geometryLocked: false,
      currentReleaseChanged: false,
      sanityChanged: false,
      audit,
    }, null, 2)}\n`),
    writeFile(markdownPath, markdown),
  ]);
  return { jsonPath, markdownPath };
}
