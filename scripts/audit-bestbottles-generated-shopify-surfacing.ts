#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DEFAULT_ORG_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const DEFAULT_API_VERSION = "2025-01";
const DEFAULT_BEST_BOTTLES_REPO =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";

type JsonRecord = Record<string, unknown>;

type GeneratedImageRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  image_url: string | null;
  reference_image_url: string | null;
  session_name: string | null;
  goal_type: string | null;
  aspect_ratio: string | null;
  final_prompt: string | null;
  description: string | null;
  library_category: string | null;
  library_tags: string[] | null;
  brand_style_tags: string[] | null;
  brand_context_used: unknown;
  selected_template: string | null;
  is_archived: boolean | null;
};

type PipelineSkuJobRow = {
  id: string;
  created_at: string;
  updated_at: string;
  product_group_slug: string;
  product_group_display_name: string | null;
  family: string;
  category: string | null;
  capacity_ml: number | null;
  applicator: string | null;
  canonical_color: string | null;
  grace_sku: string;
  website_sku: string;
  shopify_sku: string | null;
  status: string;
  generated_image_id: string | null;
  generated_image_url: string | null;
  approved_image_id: string | null;
  approved_image_url: string | null;
  approved_at: string | null;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  shopify_media_id: string | null;
  shopify_image_url: string | null;
  shopify_pushed_at: string | null;
  convex_synced_at: string | null;
  last_error: string | null;
};

type ConvexProductRow = {
  websiteSku?: string | null;
  graceSku?: string | null;
  family?: string | null;
  productGroupId?: string | null;
  imageUrl?: string | null;
  imageUrlCapOff?: string | null;
};

type ShopifyVariantRow = {
  id: string;
  sku: string | null;
  image: { id: string; url: string; altText: string | null } | null;
  product: { id: string; title: string; handle: string } | null;
};

type AuditRow = {
  imageId: string;
  imageCreatedAt: string;
  imageUrl: string;
  imageKind: string;
  frameQaStatus: string;
  sourceBatch: string;
  generatedMode: string;
  detectedGraceSku: string;
  detectedWebsiteSku: string;
  matchedBy: string;
  graceSku: string;
  websiteSku: string;
  shopifySku: string;
  productGroupSlug: string;
  productGroupDisplayName: string;
  family: string;
  category: string;
  capacityMl: string | number;
  applicator: string;
  canonicalColor: string;
  pipelineStatus: string;
  pipelineApprovedImageUrl: string;
  pipelineShopifyImageUrl: string;
  pipelineShopifyMediaId: string;
  pipelineConvexSyncedAt: string;
  shopifyVariantImageUrl: string;
  shopifyVariantId: string;
  convexImageUrl: string;
  convexImageHost: string;
  sourceUsedByPipeline: "yes" | "no";
  statusBucket: string;
  recommendedAction: string;
  libraryTags: string;
};

type CliArgs = {
  orgId: string;
  outDir: string;
  since: string | null;
  includeArchived: boolean;
  skipShopify: boolean;
};

function loadEnvFile(filePath: string): void {
  try {
    const text = readFileSync(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const eqIdx = line.indexOf("=");
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Optional.
  }
}

function argValue(name: string, fallback = ""): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : fallback;
}

function parseArgs(): CliArgs {
  const date = new Date().toISOString().slice(0, 10);
  return {
    orgId: argValue("--org-id", process.env.MADISON_BEST_BOTTLES_ORG_ID || DEFAULT_ORG_ID),
    outDir: resolve(argValue("--out-dir", `tmp/best-bottles-generated-shopify-surfacing-${date}`)),
    since: argValue("--since", "") || null,
    includeArchived: process.argv.includes("--include-archived"),
    skipShopify: process.argv.includes("--skip-shopify"),
  };
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function array(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function cleanUrl(value: unknown): string {
  return text(value);
}

function normalizeKey(value: unknown): string {
  return text(value).toUpperCase();
}

function host(value: unknown): string {
  try {
    return new URL(text(value)).hostname;
  } catch {
    return "";
  }
}

function normalizeUrl(value: unknown): string {
  const input = text(value);
  if (!input) return "";
  try {
    const url = new URL(input);
    url.searchParams.delete("v");
    return url.toString();
  } catch {
    return input;
  }
}

function csvEscape(value: unknown): string {
  const output = String(value ?? "");
  if (!/[",\n\r]/.test(output)) return output;
  return `"${output.replace(/"/g, '""')}"`;
}

function tagsFor(image: GeneratedImageRow): string[] {
  return [...array(image.library_tags), ...array(image.brand_style_tags)];
}

function lowerTags(image: GeneratedImageRow): string[] {
  return tagsFor(image).map((tag) => tag.toLowerCase());
}

function imageFileStem(value: unknown): string {
  const input = text(value).split("?")[0];
  try {
    const parsed = new URL(input);
    return decodeURIComponent(parsed.pathname.split("/").pop() ?? "").replace(/\.(png|jpe?g|webp|gif)$/i, "");
  } catch {
    return decodeURIComponent(input.split("/").pop() ?? "").replace(/\.(png|jpe?g|webp|gif)$/i, "");
  }
}

function isBestBottlesImage(image: GeneratedImageRow): boolean {
  const tags = lowerTags(image);
  const ctx = record(image.brand_context_used);
  const haystack = [
    image.image_url,
    image.reference_image_url,
    image.session_name,
    image.description,
    image.final_prompt,
    text(ctx.source),
    text(ctx.batchSlug),
  ].join(" ");
  return (
    tags.includes("best-bottles") ||
    tags.includes("brand:best-bottles") ||
    /best[-_\s]?bottles/i.test(haystack)
  );
}

function classifyImageKind(image: GeneratedImageRow): string {
  const tags = lowerTags(image);
  const ctx = record(image.brand_context_used);
  const source = text(ctx.source).toLowerCase();
  const imageUrl = text(image.image_url).toLowerCase();
  const prompt = text(image.final_prompt).toLowerCase();

  if (tags.includes("local-generation") || imageUrl.includes("/local-generation/") || source.includes("local-generate")) {
    return "local_generation";
  }
  if (tags.includes("studio-master") || source === "best-bottles-pipeline") {
    return "studio_master";
  }
  if (tags.some((tag) => tag.includes("reference")) || image.goal_type === "style_reference") {
    return "reference_or_source_asset";
  }
  if (/imported from madison local best bottles generation batch/i.test(prompt)) {
    return "local_generation";
  }
  if (tags.includes("brand:best-bottles") || tags.includes("best-bottles")) {
    return "best_bottles_library_asset";
  }
  return "other";
}

function isGeneratedOutput(kind: string): boolean {
  return kind === "local_generation" || kind === "studio_master";
}

function frameQaStatus(image: GeneratedImageRow): string {
  const tags = lowerTags(image);
  const ctx = record(image.brand_context_used);
  if (text(ctx.frameQaStatus)) return text(ctx.frameQaStatus).toLowerCase();
  const tag = tags.find((candidate) => candidate.startsWith("frame-"));
  return tag ? tag.replace(/^frame-/, "") : "";
}

function sourceBatch(image: GeneratedImageRow): string {
  const ctx = record(image.brand_context_used);
  const tags = lowerTags(image);
  return (
    text(ctx.batchSlug) ||
    tags.find((tag) => /batch|openai|reference-backed|colored-local/.test(tag)) ||
    text(image.session_name)
  );
}

function generatedMode(image: GeneratedImageRow): string {
  const ctx = record(image.brand_context_used);
  const tags = lowerTags(image);
  return text(ctx.mode) || tags.find((tag) => tag === "cap-on" || tag === "cap-off") || "cap-on";
}

function detectTaggedValue(image: GeneratedImageRow, names: string[]): string {
  for (const tag of tagsFor(image)) {
    for (const name of names) {
      const match = tag.match(new RegExp(`^${name}:(.+)$`, "i"));
      if (match?.[1]?.trim()) return match[1].trim();
    }
  }
  return "";
}

function detectGraceSku(image: GeneratedImageRow): string {
  const ctx = record(image.brand_context_used);
  const explicit =
    text(ctx.graceSku) ||
    text(ctx.grace_sku) ||
    detectTaggedValue(image, ["graceSku", "grace-sku"]);
  if (explicit) return explicit.toUpperCase();

  const haystack = [
    image.description,
    image.session_name,
    image.final_prompt,
    image.image_url,
    image.reference_image_url,
    imageFileStem(image.image_url),
  ].join("\n");
  const lineMatch = haystack.match(/Grace SKU:\s*([A-Za-z0-9._-]+)/i);
  if (lineMatch?.[1]) return lineMatch[1].toUpperCase();
  const skuMatch = haystack.match(/\b(?:GB|LB)-[A-Z0-9][A-Z0-9-]*\b/i);
  return skuMatch?.[0]?.toUpperCase() ?? "";
}

function detectWebsiteSku(image: GeneratedImageRow): string {
  const ctx = record(image.brand_context_used);
  const explicit =
    text(ctx.websiteSku) ||
    text(ctx.website_sku) ||
    detectTaggedValue(image, ["websiteSku", "website-sku"]);
  if (explicit) return explicit;

  const haystack = [
    image.description,
    image.session_name,
    image.final_prompt,
    image.image_url,
    image.reference_image_url,
  ].join("\n");
  const lineMatch = haystack.match(/Website SKU:\s*([A-Za-z0-9._-]+)/i);
  return lineMatch?.[1] ?? "";
}

function indexBySku<T>(rows: T[], getKeys: (row: T) => Array<string | null | undefined>): Map<string, T> {
  const out = new Map<string, T>();
  for (const row of rows) {
    for (const key of getKeys(row)) {
      const normalized = normalizeKey(key);
      if (normalized && !out.has(normalized)) out.set(normalized, row);
    }
  }
  return out;
}

async function fetchAllSupabase<T>(params: {
  table: string;
  select: string;
  orgId: string;
  includeArchived?: boolean;
  since?: string | null;
}): Promise<T[]> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase URL/key. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = client
      .from(params.table)
      .select(params.select)
      .eq("organization_id", params.orgId)
      .range(from, from + pageSize - 1);
    if (params.since) query = query.gte("created_at", params.since);
    if (!params.includeArchived && params.table === "generated_images") {
      query = query.or("is_archived.is.null,is_archived.eq.false");
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw new Error(`${params.table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function convexRequest<T>(path: string, args: JsonRecord, action = false): Promise<T> {
  const convexUrl = (process.env.NEXT_PUBLIC_CONVEX_URL || process.env.BESTBOTTLES_CONVEX_URL || "").replace(/\/+$/, "");
  if (!convexUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL or BESTBOTTLES_CONVEX_URL.");
  const res = await fetch(`${convexUrl}/api/${action ? "action" : "query"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const body = await res.json();
  if (!res.ok || body?.status === "error") {
    throw new Error(`Convex ${path} failed: ${body?.errorMessage || body?.error || res.statusText}`);
  }
  return body.value as T;
}

async function fetchConvexProducts(): Promise<ConvexProductRow[]> {
  const out: ConvexProductRow[] = [];
  let cursor: string | null = null;
  while (true) {
    const result = await convexRequest<{
      page: ConvexProductRow[];
      isDone: boolean;
      continueCursor: string;
    }>("products:getCatalogProductIndexPage", { cursor, limit: 200 });
    out.push(...result.page);
    if (result.isDone) return out;
    cursor = result.continueCursor;
  }
}

async function shopifyGraphQL(query: string, variables: JsonRecord): Promise<JsonRecord> {
  const domain = text(process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN)
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token) throw new Error("Missing Shopify domain/token.");
  const res = await fetch(`https://${domain}/admin/api/${DEFAULT_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (!res.ok || body.errors?.length) {
    throw new Error(`Shopify GraphQL failed: ${body.errors?.map((error: JsonRecord) => error.message).join("; ") || res.statusText}`);
  }
  return body.data;
}

async function fetchShopifyVariants(skipShopify: boolean): Promise<ShopifyVariantRow[]> {
  if (skipShopify) return [];
  if (!process.env.SHOPIFY_ADMIN_TOKEN || !process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN) return [];
  const variants: ShopifyVariantRow[] = [];
  let cursor: string | null = null;
  const query = `
    query ProductVariants($first: Int!, $after: String) {
      productVariants(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            sku
            image { id url altText }
            product { id title handle }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;
  while (true) {
    const data = await shopifyGraphQL(query, { first: 250, after: cursor });
    const payload = data.productVariants as {
      edges: Array<{ node: ShopifyVariantRow }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
    variants.push(...payload.edges.map((edge) => edge.node));
    if (!payload.pageInfo.hasNextPage) return variants;
    cursor = payload.pageInfo.endCursor;
  }
}

function matchJob(params: {
  image: GeneratedImageRow;
  jobsByGrace: Map<string, PipelineSkuJobRow>;
  jobsByWebsite: Map<string, PipelineSkuJobRow>;
}): { job: PipelineSkuJobRow | null; detectedGraceSku: string; detectedWebsiteSku: string; matchedBy: string } {
  const detectedGraceSku = detectGraceSku(params.image);
  const detectedWebsiteSku = detectWebsiteSku(params.image);
  if (detectedGraceSku && params.jobsByGrace.has(normalizeKey(detectedGraceSku))) {
    return {
      job: params.jobsByGrace.get(normalizeKey(detectedGraceSku)) ?? null,
      detectedGraceSku,
      detectedWebsiteSku,
      matchedBy: "grace_sku",
    };
  }
  if (detectedWebsiteSku && params.jobsByWebsite.has(normalizeKey(detectedWebsiteSku))) {
    return {
      job: params.jobsByWebsite.get(normalizeKey(detectedWebsiteSku)) ?? null,
      detectedGraceSku,
      detectedWebsiteSku,
      matchedBy: "website_sku",
    };
  }

  const stem = normalizeKey(imageFileStem(params.image.image_url));
  if (stem && params.jobsByGrace.has(stem)) {
    return {
      job: params.jobsByGrace.get(stem) ?? null,
      detectedGraceSku: stem,
      detectedWebsiteSku,
      matchedBy: "image_filename_grace_sku",
    };
  }
  if (stem && params.jobsByWebsite.has(stem)) {
    return {
      job: params.jobsByWebsite.get(stem) ?? null,
      detectedGraceSku,
      detectedWebsiteSku: stem,
      matchedBy: "image_filename_website_sku",
    };
  }
  return { job: null, detectedGraceSku, detectedWebsiteSku, matchedBy: "" };
}

function sourceUsedByJob(image: GeneratedImageRow, job: PipelineSkuJobRow | null): boolean {
  if (!job) return false;
  const urls = [
    job.generated_image_url,
    job.approved_image_url,
  ].map(normalizeUrl);
  return (
    image.id === job.generated_image_id ||
    image.id === job.approved_image_id ||
    urls.includes(normalizeUrl(image.image_url))
  );
}

function statusFor(params: {
  kind: string;
  frame: string;
  job: PipelineSkuJobRow | null;
  sourceUsed: boolean;
  shopifyVariantImageUrl: string;
  convexImageUrl: string;
}): { bucket: string; action: string } {
  const shopifyReady = host(params.shopifyVariantImageUrl) === "cdn.shopify.com";
  const convexReady = host(params.convexImageUrl) === "cdn.shopify.com";
  const terminalJob = Boolean(
    params.job?.shopify_image_url ||
      params.job?.shopify_media_id ||
      params.job?.convex_synced_at ||
      params.job?.status === "shopify-pushed" ||
      params.job?.status === "synced",
  );

  if (!isGeneratedOutput(params.kind)) {
    return {
      bucket: "not_generated_output",
      action: "Keep out of Shopify publish queue; this is reference/source/library evidence, not a generated product image.",
    };
  }
  if (!params.job) {
    return {
      bucket: "unmatched_generated_image",
      action: "Resolve SKU or product group before any Shopify push.",
    };
  }
  if (params.sourceUsed && shopifyReady && convexReady) {
    return {
      bucket: "surfaced_this_generated_image",
      action: "No action. This generated source is already the pipeline source for a Shopify/Convex surfaced image.",
    };
  }
  if (params.sourceUsed && shopifyReady && !convexReady) {
    return {
      bucket: "pushed_to_shopify_not_surfaced_in_convex",
      action: "Run Convex backfill/reconcile for this SKU so staging can see the Shopify image.",
    };
  }
  if (params.sourceUsed && !shopifyReady && params.job.status === "approved") {
    return {
      bucket: "approved_not_pushed",
      action: "Push through push-shopify-product-images, attach to variant, then sync Convex.",
    };
  }
  if (!params.sourceUsed && terminalJob) {
    return {
      bucket: "sku_already_has_other_surface_image",
      action: "Do not overwrite automatically. Compare visually before deciding whether this newer generated image should replace the surfaced SKU image.",
    };
  }
  if (params.frame === "pass") {
    return {
      bucket: "ready_for_visual_review",
      action: "Visual QA; if this is the keeper/on-brand image, promote it to approved and push to Shopify/Convex.",
    };
  }
  return {
    bucket: "needs_visual_qa",
    action: "Review manually before pushing; this generated image is not frame-pass or lacks enough QA metadata.",
  };
}

function toCsv(rows: AuditRow[]): string {
  const headers: Array<keyof AuditRow> = [
    "imageId",
    "imageCreatedAt",
    "imageUrl",
    "imageKind",
    "frameQaStatus",
    "sourceBatch",
    "generatedMode",
    "detectedGraceSku",
    "detectedWebsiteSku",
    "matchedBy",
    "graceSku",
    "websiteSku",
    "shopifySku",
    "productGroupSlug",
    "productGroupDisplayName",
    "family",
    "category",
    "capacityMl",
    "applicator",
    "canonicalColor",
    "pipelineStatus",
    "pipelineApprovedImageUrl",
    "pipelineShopifyImageUrl",
    "pipelineShopifyMediaId",
    "pipelineConvexSyncedAt",
    "shopifyVariantImageUrl",
    "shopifyVariantId",
    "convexImageUrl",
    "convexImageHost",
    "sourceUsedByPipeline",
    "statusBucket",
    "recommendedAction",
    "libraryTags",
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function countBy<T>(rows: T[], keyFn: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = keyFn(row) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function markdownTable(counts: Record<string, number>, label: string): string {
  const rows = Object.entries(counts).map(([key, count]) => `| ${key} | ${count} |`);
  return [`| ${label} | Rows |`, "| --- | ---: |", ...rows].join("\n");
}

async function main() {
  loadEnvFile(resolve(".env.local"));
  loadEnvFile(resolve(".env"));
  const bestBottlesRepo = process.env.BEST_BOTTLES_WEBSITE_REPO || DEFAULT_BEST_BOTTLES_REPO;
  loadEnvFile(resolve(bestBottlesRepo, ".env.local"));
  loadEnvFile(resolve(bestBottlesRepo, ".env"));
  const options = parseArgs();
  mkdirSync(options.outDir, { recursive: true });

  const [imagesRaw, jobs, convexProducts, shopifyVariants] = await Promise.all([
    fetchAllSupabase<GeneratedImageRow>({
      table: "generated_images",
      select:
        "id,created_at,updated_at,image_url,reference_image_url,session_name,goal_type,aspect_ratio,final_prompt,description,library_category,library_tags,brand_style_tags,brand_context_used,selected_template,is_archived",
      orgId: options.orgId,
      includeArchived: options.includeArchived,
      since: options.since,
    }),
    fetchAllSupabase<PipelineSkuJobRow>({
      table: "best_bottles_pipeline_sku_jobs",
      select:
        "id,created_at,updated_at,product_group_slug,product_group_display_name,family,category,capacity_ml,applicator,canonical_color,grace_sku,website_sku,shopify_sku,status,generated_image_id,generated_image_url,approved_image_id,approved_image_url,approved_at,shopify_product_id,shopify_variant_id,shopify_media_id,shopify_image_url,shopify_pushed_at,convex_synced_at,last_error",
      orgId: options.orgId,
    }),
    fetchConvexProducts(),
    fetchShopifyVariants(options.skipShopify),
  ]);

  const images = imagesRaw.filter(isBestBottlesImage);
  const jobsByGrace = indexBySku(jobs, (job) => [job.grace_sku]);
  const jobsByWebsite = indexBySku(jobs, (job) => [job.website_sku, job.shopify_sku]);
  const convexByGrace = indexBySku(convexProducts, (product) => [product.graceSku]);
  const convexByWebsite = indexBySku(convexProducts, (product) => [product.websiteSku]);
  const shopifyBySku = indexBySku(shopifyVariants, (variant) => [variant.sku]);

  const rows: AuditRow[] = images.map((image) => {
    const kind = classifyImageKind(image);
    const frameRaw = frameQaStatus(image);
    const frame = frameRaw === "frame-pass" ? "pass" : frameRaw.replace(/^frame-/, "");
    const match = matchJob({ image, jobsByGrace, jobsByWebsite });
    const job = match.job;
    const convexProduct = job
      ? convexByGrace.get(normalizeKey(job.grace_sku)) ?? convexByWebsite.get(normalizeKey(job.website_sku))
      : null;
    const mode = generatedMode(image);
    const convexImageUrl = mode === "cap-off"
      ? cleanUrl(convexProduct?.imageUrlCapOff || convexProduct?.imageUrl)
      : cleanUrl(convexProduct?.imageUrl || convexProduct?.imageUrlCapOff);
    const shopifyVariant = job
      ? shopifyBySku.get(normalizeKey(job.grace_sku)) ??
        shopifyBySku.get(normalizeKey(job.shopify_sku)) ??
        shopifyBySku.get(normalizeKey(job.website_sku))
      : null;
    const sourceUsed = sourceUsedByJob(image, job);
    const status = statusFor({
      kind,
      frame,
      job,
      sourceUsed,
      shopifyVariantImageUrl: shopifyVariant?.image?.url ?? job?.shopify_image_url ?? "",
      convexImageUrl,
    });

    return {
      imageId: image.id,
      imageCreatedAt: image.created_at,
      imageUrl: cleanUrl(image.image_url),
      imageKind: kind,
      frameQaStatus: frame,
      sourceBatch: sourceBatch(image),
      generatedMode: mode,
      detectedGraceSku: match.detectedGraceSku,
      detectedWebsiteSku: match.detectedWebsiteSku,
      matchedBy: match.matchedBy,
      graceSku: job?.grace_sku ?? "",
      websiteSku: job?.website_sku ?? "",
      shopifySku: job?.shopify_sku ?? "",
      productGroupSlug: job?.product_group_slug ?? "",
      productGroupDisplayName: job?.product_group_display_name ?? "",
      family: job?.family ?? "",
      category: job?.category ?? "",
      capacityMl: job?.capacity_ml ?? "",
      applicator: job?.applicator ?? "",
      canonicalColor: job?.canonical_color ?? "",
      pipelineStatus: job?.status ?? "",
      pipelineApprovedImageUrl: job?.approved_image_url ?? "",
      pipelineShopifyImageUrl: job?.shopify_image_url ?? "",
      pipelineShopifyMediaId: job?.shopify_media_id ?? "",
      pipelineConvexSyncedAt: job?.convex_synced_at ?? "",
      shopifyVariantImageUrl: shopifyVariant?.image?.url ?? "",
      shopifyVariantId: shopifyVariant?.id ?? "",
      convexImageUrl,
      convexImageHost: host(convexImageUrl),
      sourceUsedByPipeline: sourceUsed ? "yes" : "no",
      statusBucket: status.bucket,
      recommendedAction: status.action,
      libraryTags: tagsFor(image).join("|"),
    };
  });

  rows.sort((a, b) =>
    a.statusBucket.localeCompare(b.statusBucket) ||
    a.family.localeCompare(b.family) ||
    a.productGroupSlug.localeCompare(b.productGroupSlug) ||
    a.graceSku.localeCompare(b.graceSku) ||
    b.imageCreatedAt.localeCompare(a.imageCreatedAt),
  );

  const generatedRows = rows.filter((row) => isGeneratedOutput(row.imageKind));
  const pushCandidates = rows.filter((row) =>
    ["approved_not_pushed", "ready_for_visual_review"].includes(row.statusBucket),
  );
  const surfaced = rows.filter((row) => row.statusBucket === "surfaced_this_generated_image");
  const unmatched = rows.filter((row) => row.statusBucket === "unmatched_generated_image");
  const replacementReview = rows.filter((row) => row.statusBucket === "sku_already_has_other_surface_image");

  const summary = {
    generatedAt: new Date().toISOString(),
    orgId: options.orgId,
    since: options.since,
    inputs: {
      generatedImagesRead: imagesRaw.length,
      bestBottlesLibraryImages: images.length,
      pipelineSkuJobs: jobs.length,
      convexProducts: convexProducts.length,
      shopifyVariantsRead: shopifyVariants.length,
      shopifyVerification: shopifyVariants.length > 0 ? "enabled" : "not_available_or_skipped",
    },
    counts: {
      generatedOutputs: generatedRows.length,
      surfacedThisGeneratedImage: surfaced.length,
      pushCandidates: pushCandidates.length,
      replacementReview: replacementReview.length,
      unmatchedGeneratedImages: unmatched.length,
    },
    byStatusBucket: countBy(rows, (row) => row.statusBucket),
    byImageKind: countBy(rows, (row) => row.imageKind),
    pushCandidatesByFamily: countBy(pushCandidates, (row) => row.family),
    pushCandidatesByPipelineStatus: countBy(pushCandidates, (row) => row.pipelineStatus),
    replacementReviewByFamily: countBy(replacementReview, (row) => row.family),
  };

  writeFileSync(join(options.outDir, "generated_image_surfacing.json"), JSON.stringify({ summary, rows }, null, 2));
  writeFileSync(join(options.outDir, "generated_image_surfacing_rows.csv"), toCsv(rows));
  writeFileSync(join(options.outDir, "push_candidates.csv"), toCsv(pushCandidates));
  writeFileSync(join(options.outDir, "surfaced_this_generated_image.csv"), toCsv(surfaced));
  writeFileSync(join(options.outDir, "sku_already_has_other_surface_image.csv"), toCsv(replacementReview));
  writeFileSync(join(options.outDir, "unmatched_generated_images.csv"), toCsv(unmatched));

  const report = `# Best Bottles Generated Image Shopify/Stage Surfacing Audit

Generated: ${summary.generatedAt}

## Summary

- Best Bottles Library images audited: ${summary.inputs.bestBottlesLibraryImages}
- Generated outputs identified: ${summary.counts.generatedOutputs}
- Generated outputs already surfaced through Shopify + Convex: ${summary.counts.surfacedThisGeneratedImage}
- Push/review candidates: ${summary.counts.pushCandidates}
- Generated images whose SKU already has another surfaced image: ${summary.counts.replacementReview}
- Unmatched generated images: ${summary.counts.unmatchedGeneratedImages}
- Shopify variant verification: ${summary.inputs.shopifyVerification}

## Status Buckets

${markdownTable(summary.byStatusBucket, "Status")}

## Image Kinds

${markdownTable(summary.byImageKind, "Kind")}

## Push Candidates By Family

${markdownTable(summary.pushCandidatesByFamily, "Family")}

## Files

- \`generated_image_surfacing.json\`
- \`generated_image_surfacing_rows.csv\`
- \`push_candidates.csv\`
- \`surfaced_this_generated_image.csv\`
- \`sku_already_has_other_surface_image.csv\`
- \`unmatched_generated_images.csv\`

## Guardrail

\`push_candidates.csv\` is not an auto-push list. Rows in \`ready_for_visual_review\` passed generation/framing metadata checks, but still need human visual approval before Shopify mutation. Rows in \`approved_not_pushed\` are the only rows safe to push without another creative decision.
`;
  writeFileSync(join(options.outDir, "generated_image_surfacing_summary.md"), report);

  console.log(JSON.stringify({ outDir: options.outDir, summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
