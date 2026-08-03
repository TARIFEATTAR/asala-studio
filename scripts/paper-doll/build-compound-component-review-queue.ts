import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_GROUPS_PATH = "docs/paper-doll-rig/component-geometry-review-groups.json";
const DEFAULT_DECISIONS_PATH = "docs/paper-doll-rig/component-physical-review-decisions.json";
const DEFAULT_JSON_OUTPUT = "docs/paper-doll-rig/compound-component-review-queue.json";
const DEFAULT_MARKDOWN_OUTPUT = "docs/paper-doll-rig/COMPOUND-COMPONENT-REVIEW-QUEUE.md";

type LaneType =
  | "pump"
  | "sprayer"
  | "dropper"
  | "bulb-sprayer"
  | "bulb-sprayer+sprayer"
  | "compound-applicator";

interface GeometryReviewGroup {
  reviewGroupKey: string;
  descriptorSignature: string;
  slotProposals: string[];
  neckFinishEvidence: string[];
  sourceIdentities: string[];
  sourceIdentityCount: number;
  status: string;
  priority: string;
}

interface GeometryReviewGroupsDocument {
  groups: GeometryReviewGroup[];
}

interface PhysicalReviewDecision {
  sourceReviewGroupKey: string;
  status: string;
  evidencePaths?: string[];
  nextGate?: string;
}

interface PhysicalReviewDecisionsDocument {
  decisions: PhysicalReviewDecision[];
}

export interface CompoundComponentReviewQueueItem {
  reviewGroupKey: string;
  laneType: LaneType;
  descriptorSignature: string;
  neckFinishEvidence: string[];
  sourceIdentities: string[];
  sourceIdentityCount: number;
  sourceStatus: string;
  auditStatus: string;
  evidencePaths: string[];
  suspectedResponsibilities: string[];
  reviewQuestions: string[];
  geometryClaim: "none";
  productionPlateDelta: null;
  nextGate: string;
}

export interface CompoundComponentReviewQueue {
  schemaVersion: 1;
  summary: {
    catalogReviewLaneCount: number;
    sourceIdentityCount: number;
    laneTypeCounts: Record<LaneType, number>;
    sourceReadyLaneCount: number;
    sourceIncompleteLaneCount: number;
    reviewedDecisionLaneCount: number;
    finalReusablePlateDelta: null;
  };
  items: CompoundComponentReviewQueueItem[];
  supplementalLocalChecks: Array<{
    checkId: string;
    scope: string;
    decision: string;
    geometryClaim: "none";
  }>;
  countingPolicy: string;
  mutationPolicy: {
    candidatesGenerated: false;
    remoteWritesPerformed: false;
    currentReleaseChanged: false;
    sanityChanged: false;
  };
}

const COMPOUND_SLOTS = new Set(["pump", "sprayer", "dropper", "bulb-sprayer"]);

function classifyLane(group: GeometryReviewGroup): LaneType | null {
  if (/\bApplicator\b/i.test(group.descriptorSignature)) return "compound-applicator";
  const relevant = group.slotProposals.filter((slot) => COMPOUND_SLOTS.has(slot)).sort();
  const key = relevant.join("+");
  return [
    "pump",
    "sprayer",
    "dropper",
    "bulb-sprayer",
    "bulb-sprayer+sprayer",
  ].includes(key) ? key as LaneType : null;
}

function suspectedResponsibilities(laneType: LaneType): string[] {
  switch (laneType) {
    case "pump":
    case "sprayer":
      return ["exterior-dispenser", "possible-secondary-overcap", "internal-delivery-tube"];
    case "dropper":
      return ["bulb-and-collar-exterior", "inserted-pipette", "possible-secondary-overcap"];
    case "bulb-sprayer":
    case "bulb-sprayer+sprayer":
      return ["mounting-collar", "bulb", "hose-or-tube", "possible-tassel-or-decorative-accessory"];
    case "compound-applicator":
      return ["exterior-cap-shell", "visible-applicator", "inserted-body-contextual-stem"];
  }
}

function reviewQuestions(laneType: LaneType): string[] {
  const base = [
    "Which visible parts are independently selectable catalog components?",
    "Which source layers are fragments of one physical responsibility and must be recomposed?",
    "Which inserted parts change length, visibility, refraction, or occlusion by target bottle?",
    "What physical mount axis, seat, and target-body depth control production placement?",
  ];
  if (laneType === "bulb-sprayer" || laneType === "bulb-sprayer+sprayer") {
    base.push("Are bulb, hose, tassel, and collar sold or replaced independently?");
  }
  return base;
}

export function buildCompoundComponentReviewQueue(
  groupsValue: GeometryReviewGroupsDocument,
  decisionsValue: PhysicalReviewDecisionsDocument,
): CompoundComponentReviewQueue {
  const decisionByGroup = new Map(
    (decisionsValue.decisions ?? []).map((decision) => [decision.sourceReviewGroupKey, decision]),
  );
  const items = groupsValue.groups.flatMap((group): CompoundComponentReviewQueueItem[] => {
    const laneType = classifyLane(group);
    if (!laneType) return [];
    const decision = decisionByGroup.get(group.reviewGroupKey);
    const auditStatus = decision?.status
      ?? (group.status === "source-incomplete"
        ? "source-evidence-required-before-decomposition"
        : "decomposition-audit-required");
    return [{
      reviewGroupKey: group.reviewGroupKey,
      laneType,
      descriptorSignature: group.descriptorSignature,
      neckFinishEvidence: group.neckFinishEvidence,
      sourceIdentities: group.sourceIdentities,
      sourceIdentityCount: group.sourceIdentityCount,
      sourceStatus: group.status,
      auditStatus,
      evidencePaths: decision?.evidencePaths ?? [],
      suspectedResponsibilities: suspectedResponsibilities(laneType),
      reviewQuestions: reviewQuestions(laneType),
      geometryClaim: "none",
      productionPlateDelta: null,
      nextGate: decision?.nextGate
        ?? "Inspect layered and assembled sources, record a responsibility map, then create a component-kit recipe only if more than one physical responsibility is proven.",
    }];
  });
  const laneTypeCounts = {
    pump: 0,
    sprayer: 0,
    dropper: 0,
    "bulb-sprayer": 0,
    "bulb-sprayer+sprayer": 0,
    "compound-applicator": 0,
  } satisfies Record<LaneType, number>;
  for (const item of items) laneTypeCounts[item.laneType] += 1;
  return {
    schemaVersion: 1,
    summary: {
      catalogReviewLaneCount: items.length,
      sourceIdentityCount: items.reduce((sum, item) => sum + item.sourceIdentityCount, 0),
      laneTypeCounts,
      sourceReadyLaneCount: items.filter((item) => item.sourceStatus === "source-ready-physical-review").length,
      sourceIncompleteLaneCount: items.filter((item) => item.sourceStatus === "source-incomplete").length,
      reviewedDecisionLaneCount: items.filter((item) => decisionByGroup.has(item.reviewGroupKey)).length,
      finalReusablePlateDelta: null,
    },
    items,
    supplementalLocalChecks: [
      {
        checkId: "local-check__17-415-roller-fitments",
        scope: "plastic and metal roller housings plus balls; roll-on overcaps remain separate",
        decision: "Treat each housing-and-ball assembly as one exterior fitment responsibility unless catalog selection proves otherwise. Preserve the shared physical mount and keep the roll-on overcap independent.",
        geometryClaim: "none",
      },
    ],
    countingPolicy: "The source-backed master shot-list count is a baseline. Do not increase or decrease the reusable production-plate count until a reviewed responsibility map proves the final split.",
    mutationPolicy: {
      candidatesGenerated: false,
      remoteWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
}

function markdown(queue: CompoundComponentReviewQueue): string {
  const rows = queue.items.map((item) => (
    `| ${item.laneType} | ${item.descriptorSignature} | ${item.sourceIdentityCount} | ${item.sourceStatus} | ${item.auditStatus} |`
  )).join("\n");
  return `# Compound component review queue

This is a conservative audit queue, not an automatic plate-count expansion.
Every pump, sprayer, dropper, bulb/tassel system, and compound applicator lane
must be reviewed by physical responsibility before production plates are counted.

## Summary

- Catalog lanes requiring the gate: ${queue.summary.catalogReviewLaneCount}
- Source identities represented: ${queue.summary.sourceIdentityCount}
- Source-ready physical-review lanes: ${queue.summary.sourceReadyLaneCount}
- Source-incomplete lanes: ${queue.summary.sourceIncompleteLaneCount}
- Lanes with an explicit physical-review decision: ${queue.summary.reviewedDecisionLaneCount}
- Final reusable-plate delta: unresolved until responsibility review

| Lane type | Descriptor evidence | Identities | Source status | Audit status |
|---|---|---:|---|---|
${rows}

## Counting rule

${queue.countingPolicy}

The local 17-415 plastic and metal roller fitments are also covered by the
responsibility gate. Their housing and ball remain one exterior fitment when
they are not independently selectable; the roll-on overcap remains a separate
plate.

No item in this queue claims geometry lock, production eligibility, Current
Release mutation, or Sanity mutation.
`;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function main(): Promise<void> {
  const groupsPath = path.resolve(DEFAULT_GROUPS_PATH);
  const decisionsPath = path.resolve(DEFAULT_DECISIONS_PATH);
  const [groupsBuffer, decisionsBuffer] = await Promise.all([
    readFile(groupsPath),
    readFile(decisionsPath),
  ]);
  const queue = buildCompoundComponentReviewQueue(
    JSON.parse(groupsBuffer.toString("utf8")),
    JSON.parse(decisionsBuffer.toString("utf8")),
  );
  const output = {
    ...queue,
    generatedFrom: {
      componentGeometryReviewGroupsPath: DEFAULT_GROUPS_PATH,
      componentGeometryReviewGroupsSha256: sha256(groupsBuffer),
      componentPhysicalReviewDecisionsPath: DEFAULT_DECISIONS_PATH,
      componentPhysicalReviewDecisionsSha256: sha256(decisionsBuffer),
    },
  };
  await Promise.all([
    writeFile(path.resolve(DEFAULT_JSON_OUTPUT), `${JSON.stringify(output, null, 2)}\n`),
    writeFile(path.resolve(DEFAULT_MARKDOWN_OUTPUT), markdown(queue)),
  ]);
  process.stdout.write(`${JSON.stringify(queue.summary, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
