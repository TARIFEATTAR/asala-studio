import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parsePaperDollComponentGeometryReview,
  type PaperDollComponentGeometryReview,
  type PaperDollComponentGeometryReviewGroup,
} from "../../src/lib/paperDoll/componentGeometryReviewContract";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const queuePath = path.join(workspaceRoot, "docs/paper-doll-rig/component-authority-queue.json");
const outputPath = path.join(workspaceRoot, "docs/paper-doll-rig/component-geometry-review-groups.json");
const csvPath = path.join(workspaceRoot, "docs/paper-doll-rig/component-geometry-review-groups.csv");
const reportPath = path.join(workspaceRoot, "docs/paper-doll-rig/COMPONENT-GEOMETRY-REVIEW-GROUPS.md");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function unique(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()))].sort();
}

function descriptorParts(item: any): [string, string, string, string] {
  return [
    item.slotProposals.slice().sort().join("+") || "unknown-slot",
    item.neckFinishEvidence.slice().sort().join("+") || "unknown-neck",
    item.applicatorEvidence.slice().sort().join("+") || "none",
    item.capStyleEvidence.slice().sort().join("+") || "none",
  ];
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join(" | ") : value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvFor(groups: PaperDollComponentGeometryReviewGroup[]): string {
  const headers: Array<keyof PaperDollComponentGeometryReviewGroup> = [
    "reviewGroupKey", "descriptorSignature", "slotProposals", "neckFinishEvidence", "applicatorEvidence",
    "capStyleEvidence", "sourceIdentities", "appearanceEvidence", "sourceReferenceUrls", "sourceIdentityCount",
    "sourceReferenceObservedCount", "localVariantCount", "localGeometryFamilyIds", "localAuthorityMaskSha256",
    "status", "priority", "geometryClaim", "nextGate", "issues",
  ];
  return `${headers.join(",")}\n${groups.map((group) => headers.map((header) => csvCell(group[header])).join(",")).join("\n")}\n`;
}

export async function buildComponentGeometryReviewGroups(): Promise<PaperDollComponentGeometryReview> {
  const queueText = await readFile(queuePath, "utf8");
  const queue = JSON.parse(queueText) as any;
  const grouped = new Map<string, any[]>();
  for (const item of queue.items) {
    const signature = descriptorParts(item).join(" :: ");
    grouped.set(signature, [...(grouped.get(signature) ?? []), item]);
  }

  const groups: PaperDollComponentGeometryReviewGroup[] = [...grouped.entries()].map(([signature, items]) => {
    const [slot, neck, applicator, capStyle] = signature.split(" :: ");
    const localVariants = items.flatMap((item) => item.localPlateVariants);
    const localGeometryFamilyIds = unique(localVariants.map((variant) => variant.geometryFamilyId));
    const localAuthorityMaskSha256 = unique(localVariants.map((variant) => variant.authorityMaskSha256));
    const allHaveLocal = items.every((item) => item.localPlateVariants.length === 1);
    const verifiedSharedAuthority = items.length > 1
      && allHaveLocal
      && localGeometryFamilyIds.length === 1
      && localAuthorityMaskSha256.length === 1;
    const localRequiresReconciliation = localVariants.length > 0 && !verifiedSharedAuthority;
    const allReferencesObserved = items.every((item) => item.sourceReferenceStatus === "reference-url-observed");
    const status = verifiedSharedAuthority
      ? "verified-local-shared-authority" as const
      : localRequiresReconciliation
        ? "local-authorities-require-reconciliation" as const
        : allReferencesObserved
          ? "source-ready-physical-review" as const
          : "source-incomplete" as const;
    const priority = status === "verified-local-shared-authority"
      ? "P0-VERIFY" as const
      : status === "source-ready-physical-review"
        ? "P1-PRODUCE" as const
        : "P0-TRUTH" as const;
    const nextGate = status === "verified-local-shared-authority"
      ? "Preserve the exact shared authority mask; complete named material, family-fit, placement, and release approval."
      : status === "local-authorities-require-reconciliation"
        ? "Compare local source silhouettes and physical dimensions. Do not merge the appearances until one exact authority is proven."
        : status === "source-ready-physical-review"
          ? "Review source silhouettes and obtain/confirm physical dimensions; split or register one authority before material production."
          : "Obtain missing component imagery and physical dimensions before authority creation or geometry grouping.";
    return {
      reviewGroupKey: `geometry-review__${slug(slot)}__${slug(neck)}__${sha256(signature).slice(0, 10)}`,
      descriptorSignature: signature,
      slotProposals: unique(items.flatMap((item) => item.slotProposals)),
      neckFinishEvidence: unique(items.flatMap((item) => item.neckFinishEvidence)),
      applicatorEvidence: unique(items.flatMap((item) => item.applicatorEvidence)),
      capStyleEvidence: unique(items.flatMap((item) => item.capStyleEvidence)),
      sourceIdentities: unique(items.map((item) => item.sourceIdentity)),
      appearanceEvidence: unique(items.flatMap((item) => [...item.finishEvidence, ...item.trimEvidence])),
      sourceReferenceUrls: unique(items.flatMap((item) => item.referenceUrls)),
      sourceIdentityCount: items.length,
      sourceReferenceObservedCount: items.filter((item) => item.sourceReferenceStatus === "reference-url-observed").length,
      localVariantCount: localVariants.length,
      localGeometryFamilyIds,
      localAuthorityMaskSha256,
      status,
      priority,
      geometryClaim: verifiedSharedAuthority ? "verified-local-exact-alpha" as const : "unverified-descriptor-cluster" as const,
      nextGate,
      issues: unique([
        ...items.flatMap((item) => item.issues),
        ...(status === "local-authorities-require-reconciliation" ? ["local-appearance-authorities-do-not-yet-prove-one-shared-mask"] : []),
        ...(status === "source-incomplete" ? ["one-or-more-source-identities-lack-component-image-reference"] : []),
      ]),
    };
  }).sort((left, right) => left.priority.localeCompare(right.priority)
    || left.status.localeCompare(right.status)
    || left.descriptorSignature.localeCompare(right.descriptorSignature));

  const review = {
    schemaVersion: 1,
    generatedFrom: {
      componentAuthorityQueuePath: path.relative(workspaceRoot, queuePath),
      componentAuthorityQueueSha256: sha256(queueText),
    },
    summary: {
      sourceIdentityCount: groups.reduce((total, group) => total + group.sourceIdentityCount, 0),
      descriptorReviewGroupCount: groups.length,
      verifiedSharedAuthorityGroupCount: groups.filter((group) => group.status === "verified-local-shared-authority").length,
      verifiedSharedAuthorityIdentityCount: groups.filter((group) => group.status === "verified-local-shared-authority").reduce((total, group) => total + group.sourceIdentityCount, 0),
      localReconciliationGroupCount: groups.filter((group) => group.status === "local-authorities-require-reconciliation").length,
      sourceReadyPhysicalReviewGroupCount: groups.filter((group) => group.status === "source-ready-physical-review").length,
      sourceIncompleteGroupCount: groups.filter((group) => group.status === "source-incomplete").length,
    },
    groups,
    claimPolicy: { descriptorClusterIsGeometryLock: false, exactSharedAuthorityRequiredForVerifiedClaim: true, compatibilityInferred: false },
    mutationPolicy: { assetsGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
  return parsePaperDollComponentGeometryReview(review);
}

function reportFor(review: PaperDollComponentGeometryReview): string {
  return `# Best Bottles component geometry review groups

**Purpose:** reduce 148 component appearance identities into conservative physical-review lanes without claiming unverified shared geometry.

## Result

- ${review.summary.sourceIdentityCount} source-backed component appearances.
- ${review.summary.descriptorReviewGroupCount} descriptor review groups based only on exact slot, neck-finish, applicator, and cap-style evidence.
- ${review.summary.verifiedSharedAuthorityGroupCount} group / ${review.summary.verifiedSharedAuthorityIdentityCount} appearances already prove one exact shared local authority mask.
- ${review.summary.localReconciliationGroupCount} local groups have appearance authorities that do not yet prove one shared mask.
- ${review.summary.sourceReadyPhysicalReviewGroupCount} groups have component reference imagery for every identity and can enter physical review.
- ${review.summary.sourceIncompleteGroupCount} groups require missing reference imagery or dimensions before authority work.

## Non-negotiable interpretation

A descriptor review group is **not** a geometry lock and is **not** guaranteed to equal one Blender model. Only an exact shared authority mask or verified physical dimensions can promote a group to shared geometry. Compatibility remains unverified.

## Next gate

1. Preserve the verified 17-415 roll-on cap authority.
2. Reconcile the 17-415 pump and sprayer appearance authorities before claiming shared geometry.
3. Review the 28 source-ready groups against physical measurements and source silhouettes.
4. Obtain evidence for the 11 source-incomplete groups.
5. Split groups whenever physical evidence differs; never force a group to meet a target count.
`;
}

async function main() {
  const review = await buildComponentGeometryReviewGroups();
  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
    writeFile(csvPath, csvFor(review.groups), "utf8"),
    writeFile(reportPath, reportFor(review), "utf8"),
  ]);
  console.log(JSON.stringify({ outputPath, csvPath, reportPath, summary: review.summary, claimPolicy: review.claimPolicy, mutationPolicy: review.mutationPolicy }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
