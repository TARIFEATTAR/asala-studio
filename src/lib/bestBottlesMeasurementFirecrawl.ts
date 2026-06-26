export interface BestBottlesMeasurementFirecrawlRow {
  graceSku: string;
  websiteSku?: string | null;
  shopifySku?: string | null;
  family?: string | null;
  productGroupSlug?: string | null;
  productGroupDisplayName?: string | null;
  capacityMl?: string | number | null;
  color?: string | null;
  applicator?: string | null;
  status?: string | null;
  issues?: string[] | null;
  heightWithoutCap?: string | null;
  diameter?: string | null;
  productUrl?: string | null;
  measurementOverrideUrl?: string | null;
}

export interface FirecrawlMeasurementScrapePayload {
  markdown?: string | null;
  html?: string | null;
  metadata?: Record<string, unknown> | null;
  links?: unknown;
  [key: string]: unknown;
}

export interface BestBottlesMeasurementOverride {
  graceSku: string;
  heightWithoutCap?: string | null;
  diameter?: string | null;
  source: string;
  sourceUrl?: string | null;
  note: string;
}

export interface BestBottlesMeasurementOverridesPayload {
  notes?: string;
  overrides?: BestBottlesMeasurementOverride[];
}

export interface BestBottlesFirecrawlMeasurementCandidate {
  graceSku: string;
  websiteSku: string | null;
  family: string | null;
  productGroupSlug: string | null;
  heightWithoutCap: string;
  diameter: string;
  diameterSourceLabel: string;
  source: "Firecrawl BestBottles product page";
  sourceUrl: string;
  note: string;
}

export type FirecrawlMeasurementScrapePage = (
  url: string,
  row: BestBottlesMeasurementFirecrawlRow,
) => Promise<FirecrawlMeasurementScrapePayload | null>;

export interface FirecrawlMeasurementSourceSummary {
  targeted: number;
  attempted: number;
  sourced: number;
  skippedNoApiKey: boolean;
  errors: Array<{ graceSku: string; url: string; message: string }>;
}

export interface FirecrawlMeasurementRowsResult {
  candidates: BestBottlesFirecrawlMeasurementCandidate[];
  summary: FirecrawlMeasurementSourceSummary;
}

export interface FirecrawlMeasurementSourceOptions {
  enabled?: boolean;
  limit?: number | null;
  skuKeys?: Iterable<string | null | undefined>;
  apiKey?: string | null;
  timeoutMs?: number;
  scrapePage?: FirecrawlMeasurementScrapePage;
  fetcher?: typeof fetch;
}

const BEST_BOTTLES_ORIGIN = "https://www.bestbottles.com";
const FIRECRAWL_SCRAPE_ENDPOINT = "https://api.firecrawl.dev/v1/scrape";

function normalizeKey(value: string | number | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function toBestBottlesAbsoluteUrl(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    const url = new URL(text, BEST_BOTTLES_ORIGIN);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.hostname !== "bestbottles.com" && !url.hostname.endsWith(".bestbottles.com")) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function buildFirecrawlMeasurementSourceUrls(row: BestBottlesMeasurementFirecrawlRow): string[] {
  const urls = new Set<string>();
  for (const directUrl of [row.productUrl, row.measurementOverrideUrl]) {
    const absolute = toBestBottlesAbsoluteUrl(directUrl);
    if (absolute) urls.add(absolute);
  }

  for (const query of [row.websiteSku, row.graceSku, row.shopifySku]) {
    const trimmed = query?.trim();
    if (!trimmed) continue;
    urls.add(`${BEST_BOTTLES_ORIGIN}/search?q=${encodeURIComponent(trimmed)}`);
  }
  return Array.from(urls);
}

function collectStringLeaves(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringLeaves(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStringLeaves(item, out);
  }
  return out;
}

function hasSkuEvidence(row: BestBottlesMeasurementFirecrawlRow, text: string): boolean {
  const normalizedText = normalizeKey(text);
  return [row.websiteSku, row.graceSku, row.shopifySku]
    .map(normalizeKey)
    .filter(Boolean)
    .some((key) => normalizedText.includes(key));
}

function rowNeedsMeasurement(row: BestBottlesMeasurementFirecrawlRow): boolean {
  const issues = row.issues ?? [];
  return row.status === "needs-measurement" || issues.includes("missing_measurement");
}

function rowMatchesSkuKeys(row: BestBottlesMeasurementFirecrawlRow, skuKeys: Set<string>): boolean {
  if (skuKeys.size === 0) return true;
  return [row.websiteSku, row.graceSku, row.shopifySku]
    .map(normalizeKey)
    .filter(Boolean)
    .some((key) => skuKeys.has(key));
}

function firstMeasurementValue(
  text: string,
  labelPatterns: Array<{ label: string; pattern: RegExp }>,
): { value: string; label: string } | null {
  for (const { label, pattern } of labelPatterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    return { value: match[1], label };
  }
  return null;
}

function extractMeasurements(text: string): {
  heightWithoutCap: string | null;
  diameter: string | null;
  diameterSourceLabel: string | null;
} {
  const normalizedText = text.replace(/\s+/g, " ");
  const valuePattern = String.raw`([0-9]+(?:\.[0-9]+)?)\s*(?:mm|millimeters?)?`;
  const separator = String.raw`\s*(?::|-|=)?\s*`;
  const height = firstMeasurementValue(normalizedText, [
    {
      label: "Height Without Cap",
      pattern: new RegExp(String.raw`\bHeight\s+Without\s+Cap\b${separator}${valuePattern}`, "i"),
    },
    {
      label: "Body Height",
      pattern: new RegExp(String.raw`\bBody\s+Height\b${separator}${valuePattern}`, "i"),
    },
    {
      label: "Item Height",
      pattern: new RegExp(String.raw`\bItem\s+Height\b${separator}${valuePattern}`, "i"),
    },
    {
      label: "Height",
      pattern: new RegExp(String.raw`\bHeight\b(?!\s+With\s+Cap)${separator}${valuePattern}`, "i"),
    },
  ]);
  const diameter = firstMeasurementValue(normalizedText, [
    {
      label: "Item Diameter",
      pattern: new RegExp(String.raw`\bItem\s+Diameter\b${separator}${valuePattern}`, "i"),
    },
    {
      label: "Body Diameter",
      pattern: new RegExp(String.raw`\bBody\s+Diameter\b${separator}${valuePattern}`, "i"),
    },
    {
      label: "Diameter",
      pattern: new RegExp(String.raw`\bDiameter\b${separator}${valuePattern}`, "i"),
    },
    {
      label: "Item Width",
      pattern: new RegExp(String.raw`\bItem\s+Width\b${separator}${valuePattern}`, "i"),
    },
    {
      label: "Face Width",
      pattern: new RegExp(String.raw`\bFace\s+Width\b${separator}${valuePattern}`, "i"),
    },
    {
      label: "Width",
      pattern: new RegExp(String.raw`\bWidth\b${separator}${valuePattern}`, "i"),
    },
  ]);

  return {
    heightWithoutCap: height?.value ?? null,
    diameter: diameter?.value ?? null,
    diameterSourceLabel: diameter?.label ?? null,
  };
}

export function pickFirecrawlMeasurementCandidate(
  row: BestBottlesMeasurementFirecrawlRow,
  payload: FirecrawlMeasurementScrapePayload,
  sourceUrl: string,
): BestBottlesFirecrawlMeasurementCandidate | null {
  const text = collectStringLeaves(payload).join("\n");
  if (!hasSkuEvidence(row, text)) return null;

  const measurements = extractMeasurements(text);
  if (!measurements.heightWithoutCap || !measurements.diameter || !measurements.diameterSourceLabel) {
    return null;
  }

  return {
    graceSku: row.graceSku,
    websiteSku: row.websiteSku ?? null,
    family: row.family ?? null,
    productGroupSlug: row.productGroupSlug ?? null,
    heightWithoutCap: measurements.heightWithoutCap,
    diameter: measurements.diameter,
    diameterSourceLabel: measurements.diameterSourceLabel,
    source: "Firecrawl BestBottles product page",
    sourceUrl,
    note: [
      "Firecrawl scrape found SKU evidence",
      row.productGroupSlug ? `for ${row.productGroupSlug}` : null,
      `plus ${measurements.heightWithoutCap} mm body height and ${measurements.diameterSourceLabel} ${measurements.diameter} mm.`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function appendBestBottlesMeasurementOverrides(
  payload: BestBottlesMeasurementOverridesPayload,
  candidates: BestBottlesFirecrawlMeasurementCandidate[],
): BestBottlesMeasurementOverridesPayload {
  const overrides = [...(payload.overrides ?? [])];
  const indexBySku = new Map(
    overrides.map((override, index) => [normalizeKey(override.graceSku), index]),
  );

  for (const candidate of candidates) {
    const override: BestBottlesMeasurementOverride = {
      graceSku: candidate.graceSku,
      heightWithoutCap: candidate.heightWithoutCap,
      diameter: candidate.diameter,
      source: candidate.source,
      sourceUrl: candidate.sourceUrl,
      note: candidate.note,
    };
    const existingIndex = indexBySku.get(normalizeKey(candidate.graceSku));
    if (existingIndex == null) {
      indexBySku.set(normalizeKey(candidate.graceSku), overrides.length);
      overrides.push(override);
    } else {
      overrides[existingIndex] = override;
    }
  }

  return {
    ...payload,
    overrides,
  };
}

function unwrapFirecrawlPayload(payload: unknown): FirecrawlMeasurementScrapePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const objectPayload = payload as Record<string, unknown>;
  if (objectPayload.data && typeof objectPayload.data === "object") {
    return objectPayload.data as FirecrawlMeasurementScrapePayload;
  }
  return objectPayload as FirecrawlMeasurementScrapePayload;
}

async function scrapeBestBottlesMeasurementPageWithFirecrawl(params: {
  url: string;
  apiKey: string;
  timeoutMs: number;
  fetcher: typeof fetch;
}): Promise<FirecrawlMeasurementScrapePayload | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const response = await params.fetcher(FIRECRAWL_SCRAPE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: params.url,
        formats: ["markdown", "html"],
        onlyMainContent: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Firecrawl HTTP ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
    }
    return unwrapFirecrawlPayload(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

export async function sourceMeasurementRowsWithFirecrawl(
  rows: BestBottlesMeasurementFirecrawlRow[],
  options: FirecrawlMeasurementSourceOptions = {},
): Promise<FirecrawlMeasurementRowsResult> {
  const summary: FirecrawlMeasurementSourceSummary = {
    targeted: 0,
    attempted: 0,
    sourced: 0,
    skippedNoApiKey: false,
    errors: [],
  };
  const candidates: BestBottlesFirecrawlMeasurementCandidate[] = [];
  if (options.enabled === false) return { candidates, summary };

  const skuKeys = new Set(Array.from(options.skuKeys ?? []).map(normalizeKey).filter(Boolean));
  const targets = rows.filter((row) => rowNeedsMeasurement(row) && rowMatchesSkuKeys(row, skuKeys));
  summary.targeted = targets.length;
  if (targets.length === 0) return { candidates, summary };

  const limit = Math.max(0, options.limit ?? targets.length);
  const selectedTargets = targets.slice(0, limit);
  if (selectedTargets.length === 0) return { candidates, summary };

  const apiKey = options.apiKey ?? process.env.FIRECRAWL_API_KEY ?? process.env.FIRECRAWL_KEY ?? null;
  const scrapePage =
    options.scrapePage ??
    (apiKey
      ? ((url: string) =>
          scrapeBestBottlesMeasurementPageWithFirecrawl({
            url,
            apiKey,
            timeoutMs: Math.max(1000, options.timeoutMs ?? 15000),
            fetcher: options.fetcher ?? fetch,
          }))
      : null);

  if (!scrapePage) {
    summary.skippedNoApiKey = true;
    return { candidates, summary };
  }

  for (const row of selectedTargets) {
    for (const url of buildFirecrawlMeasurementSourceUrls(row)) {
      summary.attempted += 1;
      try {
        const payload = await scrapePage(url, row);
        const candidate = payload ? pickFirecrawlMeasurementCandidate(row, payload, url) : null;
        if (!candidate) continue;
        candidates.push(candidate);
        summary.sourced += 1;
        break;
      } catch (error) {
        summary.errors.push({
          graceSku: row.graceSku,
          url,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { candidates, summary };
}
