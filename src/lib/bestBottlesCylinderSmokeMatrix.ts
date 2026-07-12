import type {
  CylinderCloseoutLedger,
  CylinderPublicationTarget,
} from "./bestBottlesCylinderCloseout";
import type { CylinderReferenceManifest } from "./bestBottlesCylinderReferenceReadiness";
import type { BestBottlesShadowTopology } from "./bestBottlesShadowTopology";

export const CYLINDER_SMOKE_REQUIRED_COVERAGE = Object.freeze({
  sizeBand: ["3ml", "4ml", "5ml", "9ml", "25-30ml", "50ml", "100ml", "large-plastic"],
  material: ["clear", "amber", "cobalt", "frosted", "swirl", "opaque-plastic"],
  applicator: [
    "fine-mist",
    "lotion-pump",
    "metal-roller",
    "plastic-roller",
    "cap-closure",
    "reducer",
    "antique-bulb-sprayer",
    "bulb-tassel",
  ],
  topology: ["assembled", "detached-sidecar"],
} as const);

export interface CylinderSmokeMatrixEntry {
  graceSku: string;
  websiteSku: string;
  referenceHash: string;
  coverage: {
    sizeBand: string;
    material: string;
    applicator: string;
    topology: BestBottlesShadowTopology["kind"];
  };
}

export interface CylinderSmokeCoverageReport {
  entries: CylinderSmokeMatrixEntry[];
  missing: string[];
}

function capacityMl(target: CylinderPublicationTarget): number | null {
  const match = `${target.graceSku} ${target.productGroupSlug ?? ""}`.match(/(?:^|[- ])(\d+)ml(?:[- ]|$)/i);
  return match ? Number(match[1]) : null;
}

function classifySize(target: CylinderPublicationTarget): string {
  const capacity = capacityMl(target);
  if (/^PB-/i.test(target.graceSku) || (capacity ?? 0) > 100) return "large-plastic";
  if (capacity === 3) return "3ml";
  if (capacity === 4) return "4ml";
  if (capacity === 5) return "5ml";
  if (capacity === 9) return "9ml";
  if (capacity !== null && capacity >= 25 && capacity <= 30) return "25-30ml";
  if (capacity === 50) return "50ml";
  if (capacity === 100) return "100ml";
  return "other-size";
}

function classifyMaterial(target: CylinderPublicationTarget): string {
  const text = `${target.graceSku} ${target.websiteSku} ${target.productGroupSlug ?? ""}`;
  if (/^PB-|(?:^|-)WHT(?:-|$)|(?:^|-)BLK(?:-|$)|white/i.test(text)) return "opaque-plastic";
  if (/swirl/i.test(text)) return "swirl";
  if (/(?:^|-)AMB(?:-|$)|amber/i.test(text)) return "amber";
  if (/(?:^|-)(?:BLU|CBL)(?:-|$)|cobalt/i.test(text)) return "cobalt";
  if (/(?:^|-)(?:FRS|FRO)(?:-|$)|frost/i.test(text)) return "frosted";
  return "clear";
}

function classifyApplicator(target: CylinderPublicationTarget): string {
  const text = `${target.graceSku} ${target.productGroupSlug ?? ""}`;
  if (/antiquespray-tassel|(?:^|-)AST(?:-|$)/i.test(text)) return "bulb-tassel";
  if (/antiquespray|(?:^|-)ASP(?:-|$)/i.test(text)) return "antique-bulb-sprayer";
  if (/lotionpump|(?:^|-)PMP(?:-|$)/i.test(text)) return "lotion-pump";
  if (/finemist|perfumespray|(?:^|-)SPR(?:-|$)/i.test(text)) return "fine-mist";
  if (/(?:^|-)MRL(?:-|$)/i.test(text)) return "metal-roller";
  if (/rollon|(?:^|-)ROL(?:-|$)/i.test(text)) return "plastic-roller";
  if (/reducer|(?:^|-)RDC(?:-|$)/i.test(text)) return "reducer";
  return "cap-closure";
}

function classifyTopology(target: CylinderPublicationTarget): BestBottlesShadowTopology["kind"] {
  return ["metal-roller", "plastic-roller"].includes(classifyApplicator(target))
    ? "detached-sidecar"
    : "assembled";
}

function tokens(entry: CylinderSmokeMatrixEntry): string[] {
  return Object.entries(entry.coverage).map(([dimension, value]) => `${dimension}:${value}`);
}

function requiredTokens(): Set<string> {
  return new Set(
    Object.entries(CYLINDER_SMOKE_REQUIRED_COVERAGE).flatMap(([dimension, values]) =>
      values.map((value) => `${dimension}:${value}`),
    ),
  );
}

export function buildCylinderSmokeMatrixReport(
  ledger: CylinderCloseoutLedger,
  references: CylinderReferenceManifest,
): CylinderSmokeCoverageReport {
  if (references.ledgerHash !== ledger.sha256) {
    throw new Error("Smoke matrix requires a reference manifest built from the supplied ledger hash.");
  }
  const targets = new Map(ledger.publicationTargets.map((target) => [target.websiteSku, target]));
  const candidates = references.decisions
    .filter((decision) => decision.status === "eligible" && /^[a-f0-9]{64}$/i.test(decision.sha256 ?? ""))
    .map((decision): CylinderSmokeMatrixEntry | null => {
      const target = targets.get(decision.websiteSku);
      if (!target || target.graceSku !== decision.graceSku) return null;
      return {
        graceSku: target.graceSku,
        websiteSku: target.websiteSku,
        referenceHash: decision.sha256!,
        coverage: {
          sizeBand: classifySize(target),
          material: classifyMaterial(target),
          applicator: classifyApplicator(target),
          topology: classifyTopology(target),
        },
      };
    })
    .filter((entry): entry is CylinderSmokeMatrixEntry => entry !== null)
    .sort((left, right) => left.graceSku.localeCompare(right.graceSku));

  const uncovered = requiredTokens();
  const selected: CylinderSmokeMatrixEntry[] = [];
  const remaining = [...candidates];
  while (uncovered.size > 0 && remaining.length > 0) {
    remaining.sort((left, right) => {
      const leftGain = tokens(left).filter((token) => uncovered.has(token)).length;
      const rightGain = tokens(right).filter((token) => uncovered.has(token)).length;
      return rightGain - leftGain || left.graceSku.localeCompare(right.graceSku);
    });
    const next = remaining.shift()!;
    const gain = tokens(next).filter((token) => uncovered.has(token));
    if (gain.length === 0) break;
    selected.push(next);
    gain.forEach((token) => uncovered.delete(token));
  }

  return { entries: selected, missing: [...uncovered].sort() };
}

export function buildCylinderSmokeMatrix(
  ledger: CylinderCloseoutLedger,
  references: CylinderReferenceManifest,
): CylinderSmokeMatrixEntry[] {
  const report = buildCylinderSmokeMatrixReport(ledger, references);
  if (report.missing.length > 0) {
    throw new Error(`Eligible Cylinder references do not cover: ${report.missing.join(", ")}`);
  }
  return report.entries;
}
