import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const organizationId = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const outputPath = "docs/BEST_BOTTLES_RECONCILIATION_REVIEW_REPORT.md";

type Job = {
  id: string;
  grace_sku: string;
  website_sku: string;
  status: string;
  generated_image_id: string | null;
  generated_image_url: string | null;
  approved_image_id: string | null;
  approved_image_url: string | null;
};

type Candidate = {
  job: Job;
  imageId: string;
  imageUrl: string | null;
  approvalState: "approved-keep" | "unreviewed";
};

type BackfillDecisions = {
  rejectedImages?: Array<{
    imageId: string;
    reason: string;
  }>;
};

function cell(value: string | null | undefined): string {
  return (value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function candidateRow(candidate: Candidate, reason: string, decision = candidate.approvalState): string {
  return `| \`${cell(candidate.imageId)}\` | ${cell(candidate.imageUrl)} | \`${cell(candidate.job.id)}\` | \`${cell(candidate.job.grace_sku)}\` | \`${cell(candidate.job.website_sku)}\` | ${cell(candidate.job.status)} | ${decision} | ${reason} |`;
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase read credentials are unavailable.");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const jobs: Job[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("best_bottles_pipeline_sku_jobs")
      .select("id,grace_sku,website_sku,status,generated_image_id,generated_image_url,approved_image_id,approved_image_url")
      .eq("organization_id", organizationId)
      .or("generated_image_id.not.is.null,approved_image_id.not.is.null")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Job[];
    jobs.push(...page);
    if (page.length < pageSize) break;
  }

  const candidates: Candidate[] = [];
  for (const job of jobs) {
    if (job.generated_image_id) {
      candidates.push({
        job,
        imageId: job.generated_image_id,
        imageUrl: job.generated_image_url,
        approvalState: job.approved_image_id === job.generated_image_id ? "approved-keep" : "unreviewed",
      });
    }
    if (job.approved_image_id && job.approved_image_id !== job.generated_image_id) {
      candidates.push({
        job,
        imageId: job.approved_image_id,
        imageUrl: job.approved_image_url,
        approvalState: "approved-keep",
      });
    }
  }

  const candidatesByImage = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const group = candidatesByImage.get(candidate.imageId) ?? [];
    group.push(candidate);
    candidatesByImage.set(candidate.imageId, group);
  }

  const decisions = JSON.parse(
    await readFile("public/data/best-bottles-reconciliation-backfill-decisions.json", "utf8"),
  ) as BackfillDecisions;
  const rejectedReasons = new Map(
    (decisions.rejectedImages ?? []).map((decision) => [decision.imageId, decision.reason]),
  );
  const sharedGroups = Array.from(candidatesByImage.entries())
    .filter(([, group]) => group.length > 1)
    .sort(([a], [b]) => a.localeCompare(b));
  const rejected = candidates
    .filter((candidate) => rejectedReasons.has(candidate.imageId))
    .sort((a, b) => a.job.grace_sku.localeCompare(b.job.grace_sku));
  const unreviewed = candidates
    .filter((candidate) => candidate.approvalState === "unreviewed" && !rejectedReasons.has(candidate.imageId))
    .sort((a, b) => a.job.grace_sku.localeCompare(b.job.grace_sku) || a.imageId.localeCompare(b.imageId));

  const lines: string[] = [
    "# Best Bottles Reconciliation Backfill Review Report",
    "",
    `**Generated:** ${new Date().toISOString()}  `,
    `**Organization:** \`${organizationId}\`  `,
    "**Mode:** Read-only; no production writes performed",
    "",
    "## Summary",
    "",
    `- Shared images requiring eligibility confirmation: **${sharedGroups.length}**`,
    `- Explicitly rejected assignments excluded from backfill: **${rejected.length}**`,
    `- Remaining unreviewed assignments: **${unreviewed.length}**`,
    "- Every historical image remains flagged for measured-geometry review.",
    "- Every proposed assignment remains pending Shopify and Convex read-back verification.",
    "",
    "## Shared images",
    "",
    "Each image below is linked to more than one exact SKU job. Confirm that reusing the same image across every listed Grace/website SKU is intentional.",
    "",
  ];

  sharedGroups.forEach(([imageId, group], index) => {
    lines.push(`### ${index + 1}. Image \`${imageId}\``, "");
    lines.push(`**Image URL:** ${group.find((item) => item.imageUrl)?.imageUrl ?? "—"}`, "");
    lines.push("| Job ID | Grace SKU | Website SKU | Job status | Approval state | Review reason |", "|---|---|---|---|---|---|");
    for (const candidate of group.sort((a, b) => a.job.grace_sku.localeCompare(b.job.grace_sku))) {
      lines.push(`| \`${cell(candidate.job.id)}\` | \`${cell(candidate.job.grace_sku)}\` | \`${cell(candidate.job.website_sku)}\` | ${cell(candidate.job.status)} | ${candidate.approvalState} | Shared image: confirm intentional cross-SKU reuse and explicit eligibility for this SKU. |`);
    }
    lines.push("");
  });

  lines.push(
    "## Rejected assignments",
    "",
    "These images were explicitly rejected and are excluded from the production backfill candidate set.",
    "",
    "| Image ID | Image URL | Job ID | Grace SKU | Website SKU | Job status | Decision | Reason |",
    "|---|---|---|---|---|---|---|---|",
  );
  for (const candidate of rejected) {
    lines.push(candidateRow(candidate, cell(rejectedReasons.get(candidate.imageId)), "rejected"));
  }

  lines.push(
    "",
    "## Remaining unreviewed assignments",
    "",
    "These generated images are not the exact image recorded as approved for their SKU job. They remain excluded from approval until a human confirms their historical role.",
    "",
    "| Image ID | Image URL | Job ID | Grace SKU | Website SKU | Job status | Approval state | Review reason |",
    "|---|---|---|---|---|---|---|---|",
  );
  for (const candidate of unreviewed) {
    lines.push(candidateRow(candidate, "No exact historical approval for this image; confirm whether this superseded candidate should be preserved as unreviewed history or excluded."));
  }

  lines.push(
    "",
    "## Decision gate",
    "",
    "Do not run the production backfill with `--execute` until the four shared-image groups and seven remaining unreviewed assignments have been accepted or excluded. The seven rejected paint-on images are already excluded from the candidate set. Executing the backfill will not invent geometry or destination verification; those states remain pending after insertion.",
    "",
  );

  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({
    outputPath,
    sharedImages: sharedGroups.length,
    rejectedAssignments: rejected.length,
    unreviewedAssignments: unreviewed.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
