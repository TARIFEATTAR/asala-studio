import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parsePaperDollComponentAuthorityQueue,
  type PaperDollComponentAuthorityQueue,
} from "../../src/lib/paperDoll/componentAuthorityIntakeContract";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const backlogPath = path.join(workspaceRoot, "docs/paper-doll-rig/catalog-wide-plate-backlog.json");
const outputPath = path.join(workspaceRoot, "docs/paper-doll-rig/component-authority-queue.json");
const reportPath = path.join(workspaceRoot, "docs/paper-doll-rig/COMPONENT-AUTHORITY-QUEUE.md");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function validUrls(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => {
    if (typeof value !== "string" || value.length === 0) return false;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }))].sort();
}

export async function buildComponentAuthorityQueue(): Promise<PaperDollComponentAuthorityQueue> {
  const backlogText = await readFile(backlogPath, "utf8");
  const backlog = JSON.parse(backlogText) as any;
  const items = backlog.componentSourceIdentities.map((source: any) => {
    const referenceUrls = validUrls([
      ...source.imageUrls,
      ...source.siteMeasuredRenderUrls,
      ...source.siteDepthviewRenderUrls,
    ]);
    const hasLocalAuthority = source.localPlateVariants.length > 0
      && source.localPlateVariants.every((variant: any) => variant.authorityStatus === "approved" && variant.authorityId && variant.authorityMaskSha256);
    const requiresManualReview = source.issues.length > 0 || source.slotProposal.length !== 1;
    const authorityStatus = requiresManualReview
      ? "manual-review-required"
      : hasLocalAuthority
        ? "local-pilot-authority-exists"
        : "missing";
    const primarySlot = source.slotProposal[0] ?? "unresolved";
    return {
      authorityQueueKey: `component__${slug(primarySlot)}__${slug(source.neckThreadSizes.join("-or-") || "unknown-neck")}__${slug(source.sourceIdentity)}__${sha256(source.sourceIdentity).slice(0, 8)}`,
      sourceIdentity: source.sourceIdentity,
      websiteSkus: source.websiteSkus,
      graceSkus: source.graceSkus,
      slotProposals: source.slotProposal,
      familyLabels: source.family,
      neckFinishEvidence: source.neckThreadSizes,
      applicatorEvidence: source.applicators,
      capStyleEvidence: source.capStyles,
      finishEvidence: source.capColors,
      trimEvidence: source.trimColors,
      materialEvidence: source.materials,
      assemblyEvidence: source.assemblyTypes,
      itemNameEvidence: source.itemNames,
      referenceUrls,
      productUrls: validUrls(source.productUrls),
      localPlateVariants: source.localPlateVariants,
      sourceReferenceStatus: referenceUrls.length > 0 ? "reference-url-observed" : "reference-url-missing",
      authorityStatus,
      geometryGroupingStatus: hasLocalAuthority && !requiresManualReview ? "verified-local-pilot" : "unresolved",
      compatibilityStatus: "unverified",
      issues: source.issues,
      mutationPolicy: { candidatesGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
    };
  }).sort((left: any, right: any) => left.sourceIdentity.localeCompare(right.sourceIdentity));

  const queue = {
    schemaVersion: 1,
    sourceBacklogPath: path.relative(workspaceRoot, backlogPath),
    sourceBacklogSha256: sha256(backlogText),
    summary: {
      sourceIdentityCount: items.length,
      exactWebsiteSkuCount: items.filter((item: any) => item.websiteSkus.length === 1).length,
      localPilotAuthorityIdentityCount: items.filter((item: any) => item.authorityStatus === "local-pilot-authority-exists").length,
      sourceReferenceObservedCount: items.filter((item: any) => item.sourceReferenceStatus === "reference-url-observed").length,
      manualReviewIdentityCount: items.filter((item: any) => item.authorityStatus === "manual-review-required").length,
    },
    items,
    missingSourceResponsibilities: backlog.summary.sourceMissingRequiredSlots.map((slot: string) => ({
      slot,
      reason: "Catalog assemblies require this responsibility, but the canonical component-source inventory contains no independent source row.",
      nextAction: "Obtain a verified physical component identity and source reference before creating geometry authority or compatibility links.",
    })),
    mutationPolicy: { candidatesGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
  return parsePaperDollComponentAuthorityQueue(queue);
}

function renderReport(queue: PaperDollComponentAuthorityQueue): string {
  const slotCounts = new Map<string, number>();
  for (const item of queue.items) for (const slot of item.slotProposals) slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
  return `# Best Bottles component authority queue

**Purpose:** physical component-source intake for the complete paper-doll catalog. It inventories authority work; it does not infer bottle fit, generate pixels, approve candidates, or mutate releases.

## Exact source inventory

- ${queue.summary.sourceIdentityCount} explicit component-source identities.
- ${queue.summary.exactWebsiteSkuCount} have one exact component website SKU.
- ${queue.summary.localPilotAuthorityIdentityCount} resolve to an approved local CYL-9ML authority lineage.
- ${queue.summary.sourceReferenceObservedCount} expose at least one image or measured-render URL.
- ${queue.summary.manualReviewIdentityCount} require source/slot identity review before authority work.

Source identities by proposed slot: ${[...slotCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([slot, count]) => `${slot} ${count}`).join(", ")}.

## Missing independent component sources

${queue.missingSourceResponsibilities.map((item) => `- **${item.slot}:** ${item.reason} ${item.nextAction}`).join("\n")}

## Production rule

One source identity is not automatically one geometry family. Finish variants may share tooling, but shared geometry must be established from measured/approved authority evidence. Every bottle compatibility relationship remains unverified until physical fit data proves it.
`;
}

async function main() {
  const queue = await buildComponentAuthorityQueue();
  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(queue, null, 2)}\n`, "utf8"),
    writeFile(reportPath, renderReport(queue), "utf8"),
  ]);
  console.log(JSON.stringify({ outputPath, reportPath, summary: queue.summary, missingSourceResponsibilities: queue.missingSourceResponsibilities, mutationPolicy: queue.mutationPolicy }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
