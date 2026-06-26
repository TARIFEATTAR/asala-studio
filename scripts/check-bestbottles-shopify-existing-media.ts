#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const BEST_BOTTLES_REPO =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const AUDIT_ROOT = join(BEST_BOTTLES_REPO, "data/audits/stage-in-sight-image-sync-2026-06-15");
const DEFAULT_ASSIGN_CSV = join(
  AUDIT_ROOT,
  "cleanup/launch_image_reconciliation_assign_existing_media.csv",
);
const DEFAULT_COORDINATOR_CSV = join(AUDIT_ROOT, "coordinator/missing_shopify_variant_images.csv");
const DEFAULT_OUT_JSON = join(AUDIT_ROOT, "cleanup/shopify_existing_media_live_check.json");
const DEFAULT_OUT_CSV = join(AUDIT_ROOT, "cleanup/shopify_existing_media_live_check.csv");
const API_VERSION = "2025-01";

interface CsvRow {
  [key: string]: string;
}

interface AssignRow extends CsvRow {
  graceSku: string;
  websiteSku: string;
  product_group_slug: string;
  family: string;
  reference_url_or_path: string;
  generated_image_path_or_shopify_cdn_url: string;
  product_media_count: string;
}

interface CoordinatorRow extends CsvRow {
  sku: string;
  website_sku: string;
  shopify_variant_id: string;
  convex_image_url: string;
  madison_evidence_url: string;
}

interface ShopifyMedia {
  id: string;
  url: string;
  alt: string;
}

interface ShopifyVariant {
  id: string;
  sku: string | null;
  title: string | null;
  image: { id: string; url: string; altText: string | null } | null;
  product: {
    id: string;
    title: string;
    handle: string;
    media: { edges: Array<{ node: { __typename: string; id: string; alt?: string; image?: { url?: string } } }> };
  } | null;
}

interface CheckRow {
  graceSku: string;
  websiteSku: string | null;
  family: string | null;
  productGroupSlug: string | null;
  shopifyVariantId: string | null;
  shopifyVariantSku: string | null;
  shopifyProductId: string | null;
  shopifyProductHandle: string | null;
  shopifyProductMediaCount: number;
  candidateUrl: string | null;
  candidateCdnHttpStatus: number | null;
  candidateCdnContentType: string | null;
  existsInShopifyProductMedia: "yes" | "no";
  alreadyAssignedToVariant: "yes" | "no";
  matchedMediaId: string | null;
  matchedMediaUrl: string | null;
  matchStrategy: string | null;
  status:
    | "exists_in_product_media"
    | "already_assigned_to_variant"
    | "cdn_exists_not_product_media"
    | "product_media_present_no_exact_candidate"
    | "product_media_present_candidate_not_attached"
    | "no_shopify_product_media"
    | "missing_shopify_variant"
    | "shopify_sku_mismatch"
    | "no_shopify_cdn_candidate"
    | "candidate_cdn_unreachable";
  notes: string;
}

function readArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function loadEnvFile(filePath: string): void {
  try {
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      if (!key || process.env[key] != null) continue;
      process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional for CI.
  }
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const header = rows.shift() ?? [];
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function isShopifyCdn(value: string | null | undefined): boolean {
  try {
    return new URL(value ?? "").hostname === "cdn.shopify.com";
  } catch {
    return false;
  }
}

function normalizeUrl(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.searchParams.delete("v");
    return url.toString();
  } catch {
    return String(value);
  }
}

function imageFileStem(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    const file = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    return file.replace(/\.(png|jpe?g|webp|gif)$/i, "");
  } catch {
    const file = String(value).split("?")[0].split("/").pop() ?? "";
    return file.replace(/\.(png|jpe?g|webp|gif)$/i, "");
  }
}

function canonicalImageKey(value: string | null | undefined): string {
  return imageFileStem(value)
    .toLowerCase()
    .replace(/[_-][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "");
}

function splitUrlField(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function exactSkuInFilename(value: string | null | undefined, sku: string): boolean {
  const filename = imageFileStem(value).toUpperCase();
  const target = sku.toUpperCase();
  return filename === target || filename.startsWith(`${target}__`) || filename.startsWith(`${target}_`);
}

function candidateUrls(assign: AssignRow, coordinator?: CoordinatorRow): string[] {
  const strongEvidence = [
    assign.generated_image_path_or_shopify_cdn_url,
    coordinator?.convex_image_url,
    coordinator?.madison_evidence_url,
  ].flatMap(splitUrlField);
  const exactSkuSamples = splitUrlField(assign.reference_url_or_path).filter((value) =>
    exactSkuInFilename(value, assign.graceSku),
  );
  return Array.from(
    new Set(
      [...strongEvidence, ...exactSkuSamples].filter((value): value is string =>
        Boolean(value && isShopifyCdn(value)),
      ),
    ),
  );
}

function matchProductMedia(productMedia: ShopifyMedia[], targetUrl: string): {
  media: ShopifyMedia | null;
  strategy: string | null;
} {
  const direct = productMedia.filter((media) => normalizeUrl(media.url) === normalizeUrl(targetUrl));
  if (direct.length === 1) return { media: direct[0], strategy: "exact_url" };

  const targetKey = canonicalImageKey(targetUrl);
  if (!targetKey) return { media: null, strategy: null };

  const canonical = productMedia.filter((media) => canonicalImageKey(media.url) === targetKey);
  if (canonical.length === 1) return { media: canonical[0], strategy: "canonical_filename" };
  return { media: null, strategy: canonical.length > 1 ? "ambiguous_canonical_filename" : null };
}

async function candidateHttpEvidence(url: string | null): Promise<{
  status: number | null;
  contentType: string | null;
}> {
  if (!url) return { status: null, contentType: null };
  try {
    let response = await fetch(url, { method: "HEAD" });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
      response = await fetch(url, { method: "GET", headers: { Range: "bytes=0-2048" } });
    }
    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
    };
  } catch {
    return { status: null, contentType: null };
  }
}

async function shopifyGraphQL<T>(query: string, variables: Record<string, unknown>, attempt = 0): Promise<T> {
  const shopifyDomain = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  const response = await fetch(`https://${shopifyDomain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token ?? "",
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  if (response.status === 429 && attempt < 5) {
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 1500 * (attempt + 1)));
    return shopifyGraphQL(query, variables, attempt + 1);
  }
  if (!response.ok) throw new Error(`Shopify HTTP ${response.status}: ${text.slice(0, 500)}`);
  const json = JSON.parse(text);
  if (json.errors?.length) {
    const throttled = json.errors.some((error: { extensions?: { code?: string } }) => error.extensions?.code === "THROTTLED");
    if (throttled && attempt < 5) {
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 2000 * (attempt + 1)));
      return shopifyGraphQL(query, variables, attempt + 1);
    }
    throw new Error(`Shopify GraphQL: ${json.errors.map((error: { message: string }) => error.message).join("; ")}`);
  }
  return json.data as T;
}

async function fetchVariantsById(ids: string[]): Promise<ShopifyVariant[]> {
  const query = `
    query VariantMediaNodes($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          sku
          title
          image { id url altText }
          product {
            id
            title
            handle
            media(first: 250) {
              edges {
                node {
                  __typename
                  ... on MediaImage {
                    id
                    alt
                    image { url }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const variants: ShopifyVariant[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const data = await shopifyGraphQL<{ nodes: Array<ShopifyVariant | null> }>(query, { ids: chunk });
    variants.push(...data.nodes.filter((node): node is ShopifyVariant => Boolean(node)));
  }
  return variants;
}

function toCheckCsv(rows: CheckRow[]): string {
  const headers = [
    "graceSku",
    "websiteSku",
    "family",
    "productGroupSlug",
    "shopifyVariantId",
    "shopifyVariantSku",
    "shopifyProductHandle",
    "shopifyProductMediaCount",
    "candidateUrl",
    "candidateCdnHttpStatus",
    "candidateCdnContentType",
    "existsInShopifyProductMedia",
    "alreadyAssignedToVariant",
    "matchedMediaId",
    "matchedMediaUrl",
    "matchStrategy",
    "status",
    "notes",
  ] as const;

  return [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => csvEscape(row[header]))
        .join(","),
    ),
  ].join("\n");
}

function summarize(rows: CheckRow[]): Record<string, number> {
  const counts: Record<string, number> = {
    totalRows: rows.length,
    existsInProductMedia: rows.filter((row) => row.existsInShopifyProductMedia === "yes").length,
    alreadyAssignedToVariant: rows.filter((row) => row.alreadyAssignedToVariant === "yes").length,
    cdnHttpOk: rows.filter((row) => row.candidateCdnHttpStatus != null && row.candidateCdnHttpStatus >= 200 && row.candidateCdnHttpStatus < 300).length,
  };
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

async function main(): Promise<void> {
  loadEnvFile(join(BEST_BOTTLES_REPO, ".env.local"));
  const missing = [
    !process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ? "NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN" : "",
    !process.env.SHOPIFY_ADMIN_TOKEN ? "SHOPIFY_ADMIN_TOKEN" : "",
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing required env in Best Bottles .env.local: ${missing.join(", ")}`);

  const assignCsv = resolve(readArg("--assign-csv", DEFAULT_ASSIGN_CSV));
  const coordinatorCsv = resolve(readArg("--coordinator-csv", DEFAULT_COORDINATOR_CSV));
  const outJson = resolve(readArg("--out-json", DEFAULT_OUT_JSON));
  const outCsv = resolve(readArg("--out-csv", DEFAULT_OUT_CSV));
  const limit = Number(readArg("--limit", "0")) || null;

  const assignRows = parseCsv(readFileSync(assignCsv, "utf8")) as AssignRow[];
  const coordinatorRows = parseCsv(readFileSync(coordinatorCsv, "utf8")) as CoordinatorRow[];
  const coordinatorBySku = new Map(coordinatorRows.map((row) => [row.sku.toUpperCase(), row]));
  const selectedRows = limit ? assignRows.slice(0, limit) : assignRows;
  const variantIds = Array.from(
    new Set(
      selectedRows
        .map((row) => coordinatorBySku.get(row.graceSku.toUpperCase())?.shopify_variant_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const variants = await fetchVariantsById(variantIds);
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  const checks: CheckRow[] = [];
  for (const assign of selectedRows) {
    const coordinator = coordinatorBySku.get(assign.graceSku.toUpperCase());
    const variantId = coordinator?.shopify_variant_id || null;
    const variant = variantId ? variantById.get(variantId) : null;
    const candidates = candidateUrls(assign, coordinator);
    const candidateUrl = candidates[0] ?? null;
    const http = await candidateHttpEvidence(candidateUrl);

    if (!variantId || !variant) {
      checks.push({
        graceSku: assign.graceSku,
        websiteSku: assign.websiteSku || null,
        family: assign.family || null,
        productGroupSlug: assign.product_group_slug || null,
        shopifyVariantId: variantId,
        shopifyVariantSku: variant?.sku ?? null,
        shopifyProductId: variant?.product?.id ?? null,
        shopifyProductHandle: variant?.product?.handle ?? null,
        shopifyProductMediaCount: 0,
        candidateUrl,
        candidateCdnHttpStatus: http.status,
        candidateCdnContentType: http.contentType,
        existsInShopifyProductMedia: "no",
        alreadyAssignedToVariant: "no",
        matchedMediaId: null,
        matchedMediaUrl: null,
        matchStrategy: null,
        status: "missing_shopify_variant",
        notes: "Could not resolve a Shopify variant ID from the coordinator audit by graceSku.",
      });
      continue;
    }

    const productMedia = (variant.product?.media?.edges ?? [])
      .map((edge) => edge.node)
      .filter((node) => node?.__typename === "MediaImage" && node.image?.url)
      .map((node) => ({ id: node.id, url: node.image?.url ?? "", alt: node.alt ?? "" }));
    const match = candidateUrl ? matchProductMedia(productMedia, candidateUrl) : { media: null, strategy: null };
    const variantImageMatches =
      Boolean(candidateUrl && variant.image?.url && normalizeUrl(candidateUrl) === normalizeUrl(variant.image.url)) ||
      Boolean(candidateUrl && variant.image?.url && canonicalImageKey(candidateUrl) === canonicalImageKey(variant.image.url));
    const skuMatches = variant.sku?.toUpperCase() === assign.graceSku.toUpperCase();

    let status: CheckRow["status"];
    let notes: string;
    if (!skuMatches) {
      status = "shopify_sku_mismatch";
      notes = "Shopify variant SKU does not match the launch row Grace SKU. Do not assign or sync until product truth is reviewed.";
    } else if (!candidateUrl && productMedia.length > 0) {
      status = "product_media_present_no_exact_candidate";
      notes = "Shopify product media exists, but the launch evidence does not contain an exact Grace-SKU media candidate. Visual QA must choose the correct media or generate a new image.";
    } else if (!candidateUrl) {
      status = "no_shopify_cdn_candidate";
      notes = "No Shopify CDN candidate URL was present in the launch/coordinator evidence.";
    } else if (variantImageMatches) {
      status = "already_assigned_to_variant";
      notes = "The candidate is already assigned at the Shopify variant image level.";
    } else if (match.media) {
      status = "exists_in_product_media";
      notes = "The candidate exists in this Shopify product media gallery and can be assigned after visual QA.";
    } else if (http.status != null && http.status >= 200 && http.status < 300 && productMedia.length === 0) {
      status = "cdn_exists_not_product_media";
      notes = "The Shopify CDN URL returns an image, but the Shopify product currently has no media gallery item for it.";
    } else if (http.status != null && http.status >= 200 && http.status < 300) {
      status = "product_media_present_candidate_not_attached";
      notes = "The Shopify CDN URL returns an image, but it is not attached to this product media gallery.";
    } else if (productMedia.length > 0) {
      status = "product_media_present_no_exact_candidate";
      notes = "Shopify product media exists, but the launch evidence does not contain an exact Grace-SKU media candidate. Visual QA must choose the correct media or generate a new image.";
    } else {
      status = "candidate_cdn_unreachable";
      notes = "The candidate URL did not return a reachable image response during this check.";
    }

    checks.push({
      graceSku: assign.graceSku,
      websiteSku: assign.websiteSku || null,
      family: assign.family || null,
      productGroupSlug: assign.product_group_slug || null,
      shopifyVariantId: variant.id,
      shopifyVariantSku: variant.sku,
      shopifyProductId: variant.product?.id ?? null,
      shopifyProductHandle: variant.product?.handle ?? null,
      shopifyProductMediaCount: productMedia.length,
      candidateUrl,
      candidateCdnHttpStatus: http.status,
      candidateCdnContentType: http.contentType,
      existsInShopifyProductMedia: match.media ? "yes" : "no",
      alreadyAssignedToVariant: variantImageMatches ? "yes" : "no",
      matchedMediaId: match.media?.id ?? null,
      matchedMediaUrl: match.media?.url ?? null,
      matchStrategy: match.strategy,
      status,
      notes,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    assignCsv,
    coordinatorCsv,
    shopifyDomain: process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN,
    summary: summarize(checks),
    rows: checks,
  };

  mkdirSync(dirname(outJson), { recursive: true });
  mkdirSync(dirname(outCsv), { recursive: true });
  writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(outCsv, `${toCheckCsv(checks)}\n`);
  console.log(JSON.stringify({ ...report, rows: checks.slice(0, 10), outJson, outCsv }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
