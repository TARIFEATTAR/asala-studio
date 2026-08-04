import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CYLINDER_PAPER_DOLL_PRESENTATION_POSITIONS } from "../../src/config/bestBottlesCylinderPresentation";

type Stage =
  | "candidate-ready-for-named-approval"
  | "authority-build-ready"
  | "truth-decision-required"
  | "exact-reference-required";

type EvidencePosition = {
  displayKey: string;
  stage: Stage;
  bodyAuthorityKey: string;
  requiredResponsibilities: string[];
  evidencePaths: string[];
  nextGate: string;
};

type EvidenceFile = {
  schemaVersion: 1;
  asOfDate: string;
  scope: string;
  positions: EvidencePosition[];
  componentPrograms: Array<{
    programId: string;
    stage: Stage;
    scope: string;
    nextGate: string;
  }>;
};

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const evidencePath = path.join(workspaceRoot, "docs/paper-doll-rig/cylinder-family-completion-evidence.json");

function valueAfter(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function count(positions: EvidencePosition[], stage: Stage): number {
  return positions.filter((position) => position.stage === stage).length;
}

function markdown(board: any): string {
  const table = board.positions.map((position: any) => (
    `| \`${position.displayKey}\` | ${position.label} | ${position.stage} | \`${position.bodyAuthorityKey}\` | ${position.nextGate} |`
  )).join("\n");
  const programs = board.componentPrograms.map((program: any) => (
    `| \`${program.programId}\` | ${program.stage} | ${program.scope} | ${program.nextGate} |`
  )).join("\n");
  return `# Cylinder family completion board

**As of:** ${board.asOfDate}

**State:** generated execution view; no approval, release, Supabase, or Sanity mutation

## Honest delivery state

- 18 reviewed presentation positions are preserved.
- ${board.summary.candidateReadyForNamedApprovalCount} CYL-9ML positions have a complete local candidate inventory ready for named approval.
- ${board.summary.authorityBuildReadyCount} positions have sufficient evidence to build or review authorities.
- ${board.summary.truthDecisionRequiredCount} positions require a catalog-truth decision.
- ${board.summary.exactReferenceRequiredCount} position requires an exact reference.
- 0 positions are represented here as production released.

This board is derived from the existing Cylinder presentation contract and SHA/evidence records. It does not replace the 318-line master shot list.

## Presentation positions

| Display key | Position | Stage | Body authority key | Next gate |
|---|---|---|---|---|
${table}

## Component programs

| Program | Stage | Scope | Next gate |
|---|---|---|---|
${programs}

## Production sequence

1. Approve and release the existing 70 × 20 mm CYL-9ML candidate pack without changing the five locked bodies.
2. Build measured Blender/source-calibrated body authority masks for the ${board.summary.authorityBuildReadyCount} authority-ready positions, grouped by shared body geometry; keep the disputed 74 × 21 mm body review-only while the five locked 70 × 20 mm plates remain the active 9 mL 17-415 authority.
3. Use GPT Image only for material fidelity, reflections, and restrained shadow; exact-alpha clamp every result to the named authority.
4. Fit reusable components by physical cohort and render every dip tube or inserted interaction in body context.
5. Resolve the 25/30 mL identity conflict and find exact references for both classic 9 mL shells.
6. Generate identical-framing contact sheets, record named approvals, and cut append-only releases. Sanity draft sync remains separate from public publication.
`;
}

export async function buildCylinderFamilyCompletionBoard() {
  const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as EvidenceFile;
  const expectedKeys = CYLINDER_PAPER_DOLL_PRESENTATION_POSITIONS.map((position) => position.displayKey);
  const evidenceKeys = evidence.positions.map((position) => position.displayKey);
  if (new Set(evidenceKeys).size !== evidenceKeys.length) {
    throw new Error("Cylinder completion evidence contains duplicate display keys.");
  }
  const missing = expectedKeys.filter((displayKey) => !evidenceKeys.includes(displayKey));
  const unknown = evidenceKeys.filter((displayKey) => !expectedKeys.includes(displayKey));
  if (missing.length || unknown.length) {
    throw new Error(`Cylinder completion evidence does not match the presentation contract. Missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"}.`);
  }
  const evidenceByKey = new Map(evidence.positions.map((position) => [position.displayKey, position]));
  const positions = CYLINDER_PAPER_DOLL_PRESENTATION_POSITIONS.map((presentation) => {
    const row = evidenceByKey.get(presentation.displayKey)!;
    if (presentation.status === "blocked" && row.stage !== "exact-reference-required") {
      throw new Error(`${presentation.displayKey} is blocked by the presentation contract and must require an exact reference.`);
    }
    if (!row.bodyAuthorityKey || !row.requiredResponsibilities.length || !row.nextGate) {
      throw new Error(`${presentation.displayKey} is missing an executable body, responsibility, or gate record.`);
    }
    return { ...presentation, ...row };
  });
  return {
    schemaVersion: 1,
    asOfDate: evidence.asOfDate,
    scope: evidence.scope,
    summary: {
      positionCount: positions.length,
      candidateReadyForNamedApprovalCount: count(positions, "candidate-ready-for-named-approval"),
      authorityBuildReadyCount: count(positions, "authority-build-ready"),
      truthDecisionRequiredCount: count(positions, "truth-decision-required"),
      exactReferenceRequiredCount: count(positions, "exact-reference-required"),
      productionReleasedCount: 0,
    },
    positions,
    componentPrograms: evidence.componentPrograms,
    mutationPolicy: {
      approvalsWritten: false,
      placementWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
      publicPublicationChanged: false,
    },
  };
}

async function main() {
  const requested = valueAfter("out");
  const outputDirectory = requested
    ? path.resolve(requested)
    : path.join(workspaceRoot, "docs/paper-doll-rig");
  await mkdir(outputDirectory, { recursive: true });
  const board = await buildCylinderFamilyCompletionBoard();
  const jsonPath = path.join(outputDirectory, "cylinder-family-completion-board.json");
  const markdownPath = path.join(outputDirectory, "CYLINDER-FAMILY-COMPLETION-BOARD.md");
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(board, null, 2)}\n`),
    writeFile(markdownPath, markdown(board)),
  ]);
  console.log(JSON.stringify({ jsonPath, markdownPath, summary: board.summary }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
