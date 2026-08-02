import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type PipelineSkuJob = {
  id: string;
  organization_id: string;
  grace_sku: string;
  website_sku: string;
  family: string;
  generated_image_id: string | null;
  generated_image_url: string | null;
  approved_image_id: string | null;
  approved_image_url: string | null;
  status: string;
  shopify_pushed_at: string | null;
  convex_synced_at: string | null;
};

type GeneratedImage = {
  id: string;
  organization_id: string;
  image_url: string;
  library_tags: string[] | null;
};

type WebsiteTruthRow = {
  graceSku?: string;
  websiteSku?: string;
  family?: string;
  status?: string;
  issues?: string[];
  measurementSource?: string;
  liveSourceUrl?: string | null;
};

type Candidate = {
  job: PipelineSkuJob;
  imageId: string;
  imageUrl: string | null;
  decision: "unreviewed" | "approved-keep";
};

type BackfillDecisions = {
  rejectedImages?: Array<{
    imageId: string;
    graceSku?: string;
    reason: string;
  }>;
};

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

async function fetchJobs(client: SupabaseClient, organizationId: string): Promise<PipelineSkuJob[]> {
  const jobs: PipelineSkuJob[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("best_bottles_pipeline_sku_jobs")
      .select(
        "id,organization_id,grace_sku,website_sku,family,generated_image_id,generated_image_url,approved_image_id,approved_image_url,status,shopify_pushed_at,convex_synced_at",
      )
      .eq("organization_id", organizationId)
      .or("generated_image_id.not.is.null,approved_image_id.not.is.null")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as PipelineSkuJob[];
    jobs.push(...page);
    if (page.length < pageSize) break;
  }
  return jobs;
}

function buildCandidates(jobs: PipelineSkuJob[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const job of jobs) {
    if (job.generated_image_id) {
      candidates.push({
        job,
        imageId: job.generated_image_id,
        imageUrl: job.generated_image_url,
        decision: job.approved_image_id === job.generated_image_id ? "approved-keep" : "unreviewed",
      });
    }
    if (job.approved_image_id && job.approved_image_id !== job.generated_image_id) {
      candidates.push({
        job,
        imageId: job.approved_image_id,
        imageUrl: job.approved_image_url,
        decision: "approved-keep",
      });
    }
  }
  return candidates;
}

async function loadWebsiteTruth(): Promise<Map<string, WebsiteTruthRow>> {
  const path = resolve(process.cwd(), "public/data/best-bottles-website-truth-status.json");
  const parsed = JSON.parse(await readFile(path, "utf8")) as { rows?: WebsiteTruthRow[] } | WebsiteTruthRow[];
  const rows = Array.isArray(parsed) ? parsed : parsed.rows ?? [];
  return new Map(rows.flatMap((row) => row.graceSku ? [[row.graceSku.toUpperCase(), row]] : []));
}

async function loadBackfillDecisions(): Promise<BackfillDecisions> {
  const path = resolve(process.cwd(), "public/data/best-bottles-reconciliation-backfill-decisions.json");
  return JSON.parse(await readFile(path, "utf8")) as BackfillDecisions;
}

function catalogTruthSnapshot(
  job: PipelineSkuJob,
  truth: WebsiteTruthRow | undefined,
  eligibleGraceSkus: string[],
  eligibleWebsiteSkus: string[],
) {
  return {
    graceSku: job.grace_sku,
    websiteSku: job.website_sku,
    eligibleGraceSkus,
    eligibleWebsiteSkus,
    family: job.family,
    identityStatus: truth?.status === "ready" || truth?.status === "alias_exception" ? "ready" : "historical-unverified",
    identityBlockers: truth?.issues ?? ["Historical image has not passed the new product-truth gate."],
    websiteTruthStatus: truth?.status ?? "missing",
    websiteTruthIssues: truth?.issues ?? [],
    measurementSource: truth?.measurementSource ?? "historical-unrecorded",
    sourceReference: truth?.liveSourceUrl ?? null,
    historicalBackfill: true,
  };
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("Usage: npm run bestbottles:images:backfill-reconciliation -- --organization-id UUID [--execute]");
    console.log("Dry-run by default. --execute inserts missing image evidence and exact SKU assignments only.");
    return;
  }

  const organizationId = required(argValue("--organization-id") ?? undefined, "--organization-id");
  const execute = process.argv.includes("--execute");
  const client = createClient(
    required(process.env.VITE_SUPABASE_URL, "VITE_SUPABASE_URL"),
    required(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const jobs = await fetchJobs(client, organizationId);
  const allCandidates = buildCandidates(jobs);
  const decisions = await loadBackfillDecisions();
  const rejectedImageIds = new Set((decisions.rejectedImages ?? []).map((decision) => decision.imageId));
  const rejectedCandidates = allCandidates.filter((candidate) => rejectedImageIds.has(candidate.imageId));
  const candidates = allCandidates.filter((candidate) => !rejectedImageIds.has(candidate.imageId));
  const eligibilityByImageId = new Map<
    string,
    { graceSkus: Set<string>; websiteSkus: Set<string>; assignmentCount: number }
  >();
  for (const candidate of candidates) {
    const eligibility = eligibilityByImageId.get(candidate.imageId) ?? {
      graceSkus: new Set<string>(),
      websiteSkus: new Set<string>(),
      assignmentCount: 0,
    };
    eligibility.graceSkus.add(candidate.job.grace_sku);
    eligibility.websiteSkus.add(candidate.job.website_sku);
    eligibility.assignmentCount += 1;
    eligibilityByImageId.set(candidate.imageId, eligibility);
  }
  const imageIds = Array.from(new Set(candidates.map((candidate) => candidate.imageId)));
  const { data: imagesData, error: imagesError } = imageIds.length === 0
    ? { data: [] as GeneratedImage[], error: null }
    : await client
        .from("generated_images")
        .select("id,organization_id,image_url,library_tags")
        .eq("organization_id", organizationId)
        .in("id", imageIds);
  if (imagesError) throw new Error(imagesError.message);
  const imageById = new Map(((imagesData ?? []) as GeneratedImage[]).map((image) => [image.id, image]));

  const { data: existingEvidence, error: evidenceError } = imageIds.length === 0
    ? { data: [] as Array<{ image_id: string }>, error: null }
    : await client
        .from("best_bottles_image_reconciliations")
        .select("image_id")
        .eq("organization_id", organizationId)
        .in("image_id", imageIds);
  if (evidenceError) throw new Error(evidenceError.message);
  const evidenceIds = new Set((existingEvidence ?? []).map((row) => row.image_id));

  const { data: existingAssignments, error: assignmentsError } = imageIds.length === 0
    ? { data: [] as Array<{ sku_job_id: string; image_id: string }>, error: null }
    : await client
        .from("best_bottles_pipeline_sku_images")
        .select("sku_job_id,image_id")
        .eq("organization_id", organizationId)
        .in("image_id", imageIds);
  if (assignmentsError) throw new Error(assignmentsError.message);
  const assignmentKeys = new Set(
    (existingAssignments ?? []).map((row) => `${row.sku_job_id}:${row.image_id}`),
  );
  const truthBySku = await loadWebsiteTruth();

  const missingImages = imageIds.filter((imageId) => !imageById.has(imageId));
  const evidenceInserts = [];
  const assignmentInserts = [];
  for (const candidate of candidates) {
    const image = imageById.get(candidate.imageId);
    if (!image) continue;
    if (!evidenceIds.has(candidate.imageId)) {
      const truth = truthBySku.get(candidate.job.grace_sku.toUpperCase());
      const eligibility = eligibilityByImageId.get(candidate.imageId);
      const catalogTruth = catalogTruthSnapshot(
        candidate.job,
        truth,
        Array.from(eligibility?.graceSkus ?? [candidate.job.grace_sku]).sort(),
        Array.from(eligibility?.websiteSkus ?? [candidate.job.website_sku]).sort(),
      );
      evidenceInserts.push({
        image_id: candidate.imageId,
        organization_id: organizationId,
        grace_sku: candidate.job.grace_sku,
        website_sku: candidate.job.website_sku,
        family: candidate.job.family,
        source_reference_url: truth?.liveSourceUrl ?? null,
        catalog_truth: catalogTruth,
        asset_role: "pdp-primary",
        requires_pipeline_reconciliation: true,
        raw_image_url: image.image_url || candidate.imageUrl,
        final_image_url: image.image_url || candidate.imageUrl,
        lifecycle_state: candidate.decision === "approved-keep" ? "approved" : "review-pending",
        last_error: "Historical image backfilled without measured pixel geometry; rerig or review is required.",
      });
      evidenceIds.add(candidate.imageId);
    }
    const key = `${candidate.job.id}:${candidate.imageId}`;
    if (!assignmentKeys.has(key)) {
      assignmentInserts.push({
        organization_id: organizationId,
        sku_job_id: candidate.job.id,
        image_id: candidate.imageId,
        decision: candidate.decision,
        link_source: "exact-sku-tag-backfill",
        expected_image_url: candidate.imageUrl || image.image_url,
        shopify_verification_state: "pending",
        convex_verification_state: "pending",
        review_note: "Historical exact job/image linkage; destination state requires read-back verification.",
      });
      assignmentKeys.add(key);
    }
  }

  const summary = {
    execute,
    organizationId,
    jobsWithImages: jobs.length,
    allCandidateAssignments: allCandidates.length,
    excludedRejectedAssignments: rejectedCandidates.length,
    excludedRejectedImageIds: Array.from(new Set(rejectedCandidates.map((candidate) => candidate.imageId))).sort(),
    candidateAssignments: candidates.length,
    imageRowsFound: imageById.size,
    sharedImageRows: Array.from(eligibilityByImageId.values()).filter(
      (eligibility) => eligibility.assignmentCount > 1,
    ).length,
    approvedKeepAssignments: candidates.filter((candidate) => candidate.decision === "approved-keep").length,
    unreviewedAssignments: candidates.filter((candidate) => candidate.decision === "unreviewed").length,
    missingGeneratedImageRows: missingImages,
    missingEvidenceRows: evidenceInserts.length,
    missingAssignmentRows: assignmentInserts.length,
    manualGeometryReviewImages: evidenceInserts.length,
    assignmentsRequiringDestinationVerification: assignmentInserts.length,
  };

  if (!execute) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (evidenceInserts.length > 0) {
    const { error } = await client.from("best_bottles_image_reconciliations").insert(evidenceInserts);
    if (error) throw new Error(error.message);
  }
  if (assignmentInserts.length > 0) {
    const { error } = await client.from("best_bottles_pipeline_sku_images").insert(assignmentInserts);
    if (error) throw new Error(error.message);
  }

  console.log(JSON.stringify({ ...summary, inserted: true }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
