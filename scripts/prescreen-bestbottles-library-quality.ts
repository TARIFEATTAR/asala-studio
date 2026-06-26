import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

type ExportRow = {
  id: string;
  image_url: string | null;
  library_tags?: unknown;
  description?: string | null;
  final_prompt?: string | null;
  reference_image_url?: string | null;
  reference_images?: unknown;
  brand_context_used?: unknown;
  generation_provider?: string | null;
  image_generator?: string | null;
};

type BackgroundClass = "bone" | "white" | "transparent" | "other";
type Tier = "likely-keep" | "review" | "likely-reject";
type Lineage = "legacy" | "keeper";

type OutputRow = {
  id: string;
  graceSku: string;
  family: string;
  lineage: Lineage;
  url: string;
  bg_class: BackgroundClass;
  tier: Tier;
  identity_ok: boolean;
  defects: string[];
  reason: string;
  confidence: number;
};

type PreparedRow = {
  row: ExportRow;
  graceSku: string;
  websiteSku: string;
  family: string;
  lineage: Lineage;
  bgClass: BackgroundClass;
  deterministicDefects: string[];
  imageDataUrl: string;
};

const INPUT_PATH = resolve("public/data/bb-generated-images-export.json");
const OUTPUT_PATH = resolve("public/data/bb-quality-prescreen.json");
const OPENAI_MODEL = process.env.OPENAI_QUALITY_MODEL || "gpt-4.1-mini";
const BATCH_SIZE = Number.parseInt(process.env.BB_QUALITY_BATCH_SIZE || "4", 10);
const MAX_RETRIES = Number.parseInt(process.env.BB_QUALITY_MAX_RETRIES || "4", 10);
const LIMIT = Number.parseInt(process.env.BB_QUALITY_LIMIT || "0", 10);
const CONCURRENCY = Number.parseInt(process.env.BB_QUALITY_CONCURRENCY || "1", 10);

const DASHED_GRACE_SKU_RE = /\b(?:GB|LB|AB|CJ|PB)-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/i;
const WEBSITE_SKU_RE = /\b(?:GB|LB|AB|CJ|PB)[A-Za-z0-9]{4,}\b/;

const FAMILY_BY_CODE: Record<string, string> = {
  ALM: "Aluminum Bottle",
  APO: "Apothecary",
  ATM: "Atomizer",
  BEL: "Bell",
  BST: "Boston Round",
  CAP: "Cap/Closure",
  CIR: "Circle",
  CYL: "Cylinder",
  DEC: "Decorative",
  DIA: "Diamond",
  DVA: "Diva",
  DRP: "Dropper",
  ELG: "Elegant",
  EMP: "Empire",
  FLR: "Flair",
  GRC: "Grace",
  PCK: "Packaging Supply",
  PIL: "Pillar",
  RCT: "Rectangle",
  ROL: "Roll-On Cap",
  RND: "Round",
  ROY: "Royal",
  SLK: "Sleek",
  SLM: "Slim",
  SPR: "Sprayer",
  SQR: "Square",
  TCL: "Tall Cylinder",
  TDR: "Teardrop",
  TLP: "Tulip",
  TUL: "Tulip",
  VIL: "Vial",
};

const KNOWN_FAMILIES = new Set(
  Object.values(FAMILY_BY_CODE).concat([
    "Atomizer",
    "Circle",
    "Cylinder",
    "Diva",
    "Empire",
    "Grace",
    "Sleek",
    "Tulip",
  ]),
);

function asTags(value: unknown): string[] {
  return Array.isArray(value) ? value.map((tag) => String(tag)).filter(Boolean) : [];
}

function titleCaseToken(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function deriveGraceSku(row: ExportRow, tags: string[]): string {
  const haystack = [
    ...tags,
    row.description,
    row.final_prompt,
    row.reference_image_url,
    row.image_url,
    JSON.stringify(row.reference_images ?? ""),
  ]
    .filter(Boolean)
    .join("\n");
  const tagged = tags
    .map((tag) => tag.replace(/^(sku|graceSku|grace-sku|grace_sku):/i, ""))
    .find((tag) => DASHED_GRACE_SKU_RE.test(tag));
  const dashed = tagged?.match(DASHED_GRACE_SKU_RE)?.[0] || haystack.match(DASHED_GRACE_SKU_RE)?.[0];
  if (dashed) return dashed.toUpperCase();

  const bestAvailableSku = tags
    .map((tag) => tag.replace(/^(sku|websiteSku|graceSku|grace-sku|grace_sku):/i, ""))
    .find((tag) => WEBSITE_SKU_RE.test(tag));
  return bestAvailableSku?.match(WEBSITE_SKU_RE)?.[0] || "";
}

function deriveWebsiteSku(row: ExportRow, tags: string[]): string {
  const tagged = tags
    .map((tag) => tag.replace(/^websiteSku:/i, ""))
    .find((tag) => WEBSITE_SKU_RE.test(tag));
  const haystack = [tagged, ...tags, row.description, row.final_prompt, row.image_url].filter(Boolean).join("\n");
  return haystack.match(WEBSITE_SKU_RE)?.[0] || "";
}

function deriveFamily(row: ExportRow, tags: string[], graceSku: string): string {
  const familyTag = tags.find((tag) => tag.toLowerCase().startsWith("family:"));
  if (familyTag) return titleCaseToken(familyTag.split(":").slice(1).join(":"));

  const directTag = tags.find((tag) => KNOWN_FAMILIES.has(titleCaseToken(tag)));
  if (directTag) return titleCaseToken(directTag);

  const referenceFolder = row.image_url?.match(/\/reference-imports\/([^/]+)\//i)?.[1];
  if (referenceFolder) return titleCaseToken(decodeURIComponent(referenceFolder));

  const skuCode = graceSku.match(/^(?:GB|LB|AB|CJ|PB)-([A-Z0-9]+)-/)?.[1];
  if (skuCode && FAMILY_BY_CODE[skuCode]) return FAMILY_BY_CODE[skuCode];

  return "Unknown";
}

function deriveLineage(row: ExportRow, tags: string[]): Lineage {
  const source = typeof row.brand_context_used === "object" && row.brand_context_used
    ? String((row.brand_context_used as Record<string, unknown>).source || "")
    : "";
  return tags.some((tag) => tag.startsWith("keeper-backfill")) || source === "keeper-backfill" ? "keeper" : "legacy";
}

function distance(rgb: [number, number, number], target: [number, number, number]): number {
  return Math.sqrt(
    (rgb[0] - target[0]) ** 2 +
      (rgb[1] - target[1]) ** 2 +
      (rgb[2] - target[2]) ** 2,
  );
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function classifyBackground(buffer: Buffer): Promise<{
  bgClass: BackgroundClass;
  deterministicDefects: string[];
}> {
  const image = sharp(buffer, { failOn: "none" }).ensureAlpha();
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const resized = await image.resize(64, 64, { fit: "fill" }).raw().toBuffer();
  const point = (x: number, y: number): [number, number, number, number] => {
    const index = (y * 64 + x) * 4;
    return [resized[index] ?? 0, resized[index + 1] ?? 0, resized[index + 2] ?? 0, resized[index + 3] ?? 255];
  };
  const samplePoints = [
    point(0, 0),
    point(63, 0),
    point(0, 63),
    point(63, 63),
    point(32, 0),
    point(32, 63),
    point(0, 32),
    point(63, 32),
  ];

  const alphaValues = samplePoints.map((sample) => sample[3]);
  const transparentEdges = alphaValues.filter((alpha) => alpha < 245).length;
  const deterministicDefects: string[] = [];
  if (transparentEdges >= 2) {
    deterministicDefects.push("transparent-background");
    return { bgClass: "transparent", deterministicDefects };
  }

  const opaqueSamples = samplePoints.filter((sample) => sample[3] >= 245);
  const rgb: [number, number, number] = [
    Math.round(median(opaqueSamples.map((sample) => sample[0]))),
    Math.round(median(opaqueSamples.map((sample) => sample[1]))),
    Math.round(median(opaqueSamples.map((sample) => sample[2]))),
  ];
  const boneRubric: [number, number, number] = [0xee, 0xe6, 0xd4];
  const boneCurrentPreset: [number, number, number] = [0xf5, 0xf3, 0xef];
  const white: [number, number, number] = [255, 255, 255];
  const channelSpread = Math.max(...rgb) - Math.min(...rgb);
  const brightness = (rgb[0] + rgb[1] + rgb[2]) / 3;
  const sampleDistances = opaqueSamples.map((sample) =>
    Math.min(
      distance([sample[0], sample[1], sample[2]], boneRubric),
      distance([sample[0], sample[1], sample[2]], boneCurrentPreset),
    ),
  );
  const maxBoneDistance = Math.max(...sampleDistances);
  const medianBoneDistance = median(sampleDistances);

  let bgClass: BackgroundClass = "other";
  if (medianBoneDistance <= 36 && maxBoneDistance <= 58) {
    bgClass = "bone";
  } else if (distance(rgb, white) <= 24 || (brightness >= 248 && channelSpread <= 10)) {
    bgClass = "white";
    deterministicDefects.push("white-background");
  } else {
    deterministicDefects.push("non-bone-background");
  }

  if (width > 0 && height > 0 && (width < 900 || height < 900)) {
    deterministicDefects.push("low-resolution");
  }

  return { bgClass, deterministicDefects };
}

async function fetchImage(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

async function prepareVisionImage(buffer: Buffer): Promise<string> {
  const jpeg = await sharp(buffer, { failOn: "none" })
    .flatten({ background: "#eee6d4" })
    .resize({ width: 768, height: 896, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

function uniqueDefects(defects: unknown): string[] {
  if (!Array.isArray(defects)) return [];
  return Array.from(
    new Set(
      defects
        .map((defect) =>
          String(defect)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
        )
        .filter(Boolean),
    ),
  );
}

function normalizeTier(value: unknown): Tier {
  return value === "likely-keep" || value === "review" || value === "likely-reject" ? value : "review";
}

function clampConfidence(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numberValue)) return 0.55;
  return Math.max(0, Math.min(1, Math.round(numberValue * 100) / 100));
}

function compactReason(value: unknown, fallback: string): string {
  const reason = String(value || fallback).replace(/\s+/g, " ").trim();
  return reason.length <= 180 ? reason : `${reason.slice(0, 177).trim()}...`;
}

function buildFailureRow(row: ExportRow, error: unknown): OutputRow {
  const tags = asTags(row.library_tags);
  const graceSku = deriveGraceSku(row, tags);
  const family = deriveFamily(row, tags, graceSku);
  const message = error instanceof Error ? error.message : String(error);
  return {
    id: row.id,
    graceSku,
    family,
    lineage: deriveLineage(row, tags),
    url: row.image_url || "",
    bg_class: "other",
    tier: "likely-reject",
    identity_ok: false,
    defects: ["download-or-analysis-failed"],
    reason: compactReason(`Could not complete local image analysis: ${message}.`, "Could not complete local image analysis."),
    confidence: 0.95,
  };
}

async function prepareRow(row: ExportRow): Promise<PreparedRow> {
  if (!row.image_url) throw new Error("missing image_url");
  const tags = asTags(row.library_tags);
  const graceSku = deriveGraceSku(row, tags);
  const websiteSku = deriveWebsiteSku(row, tags);
  const family = deriveFamily(row, tags, graceSku);
  const lineage = deriveLineage(row, tags);
  const buffer = await fetchImage(row.image_url);
  const { bgClass, deterministicDefects } = await classifyBackground(buffer);
  const imageDataUrl = await prepareVisionImage(buffer);
  return { row, graceSku, websiteSku, family, lineage, bgClass, deterministicDefects, imageDataUrl };
}

async function callOpenAI(batch: PreparedRow[]): Promise<Record<string, Partial<OutputRow>>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } }
  > = [
    {
      type: "text",
      text:
        "Grade these Best Bottles image-library rows against the strict rubric. " +
        "Return JSON only. The mechanical bg_class is already computed from edge/corner pixels; do not change it. " +
        "Use likely-reject for white, transparent, or non-bone backgrounds; identity or geometry drift; props; text; watermarks; wrong cap/applicator/color; obvious artifacts; cropping; or low-resolution. " +
        "A flat uncluttered Bone background is REQUIRED and must never be listed as a defect; only gradient, texture, vignette, checkerboard, white, transparent, or non-Bone background should be defects. " +
        "Cap-on and cap-off are both valid product states; cap-off means the cap may sit beside the bottle. Do not penalize cap-off unless the row metadata explicitly contradicts it. " +
        "Use likely-keep only when the background is bone, the image is premium editorial product photography, the product appears centered/baselined, and identity appears consistent with the SKU. " +
        "Use review for small or uncertain defects; do not force a reject when the only concern is uncertain identity. identity_ok means the visible object appears consistent with the SKU/family/color/applicator/cap-state available in the row metadata. " +
        "Defects must be short kebab-case labels.",
    },
  ];

  for (const item of batch) {
    content.push({
      type: "text",
      text: JSON.stringify({
        id: item.row.id,
        graceSku: item.graceSku,
        websiteSku: item.websiteSku,
        family: item.family,
        lineage: item.lineage,
        bg_class: item.bgClass,
        deterministicDefects: item.deterministicDefects,
        description: item.row.description || "",
        finalPromptExcerpt: (item.row.final_prompt || "").slice(0, 900),
      }),
    });
    content.push({ type: "image_url", image_url: { url: item.imageDataUrl, detail: "low" } });
  }

  const body = {
    model: OPENAI_MODEL,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "best_bottles_quality_prescreen_batch",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  tier: { enum: ["likely-keep", "review", "likely-reject"] },
                  identity_ok: { type: "boolean" },
                  defects: { type: "array", items: { type: "string" } },
                  reason: { type: "string" },
                  confidence: { type: "number" },
                },
                required: ["id", "tier", "identity_ok", "defects", "reason", "confidence"],
              },
            },
          },
          required: ["results"],
        },
      },
    },
    messages: [
      {
        role: "user",
        content,
      },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${text.slice(0, 500)}`);
  const payload = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const message = payload.choices?.[0]?.message?.content;
  if (!message) throw new Error("OpenAI response did not include message content");
  const parsed = JSON.parse(message) as { results?: Array<Partial<OutputRow>> };
  const byId: Record<string, Partial<OutputRow>> = {};
  for (const result of parsed.results || []) {
    if (result.id) byId[result.id] = result;
  }
  return byId;
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;
      const delayMs = Math.min(45_000, 1_500 * 2 ** (attempt - 1));
      console.warn(`[quality-prescreen] ${label} failed on attempt ${attempt}; retrying in ${delayMs}ms`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
  }
  throw lastError;
}

function finalizeOutput(item: PreparedRow, modelResult: Partial<OutputRow> | undefined): OutputRow {
  const modelDefects = uniqueDefects(modelResult?.defects);
  const defects = Array.from(new Set([...item.deterministicDefects, ...modelDefects]));
  let tier = normalizeTier(modelResult?.tier);
  if (item.bgClass !== "bone") tier = "likely-reject";
  const identityOk = item.bgClass === "bone" && modelResult?.identity_ok !== false && !defects.some((defect) =>
    defect.includes("identity") ||
    defect.includes("wrong") ||
    defect.includes("mismatch") ||
    defect.includes("other-brand"),
  );
  if (!identityOk && tier === "likely-keep") tier = "review";
  if (defects.some((defect) => defect === "cropping" || defect.includes("cropped") || defect.includes("artifact"))) {
    tier = tier === "likely-keep" ? "review" : tier;
  }
  return {
    id: item.row.id,
    graceSku: item.graceSku,
    family: item.family,
    lineage: item.lineage,
    url: item.row.image_url || "",
    bg_class: item.bgClass,
    tier,
    identity_ok: identityOk,
    defects,
    reason: compactReason(
      modelResult?.reason,
      item.bgClass === "bone" ? "Bone-background product image requires human review." : "Background is not on-brand Bone.",
    ),
    confidence: clampConfidence(modelResult?.confidence),
  };
}

function loadOutput(): OutputRow[] {
  if (!existsSync(OUTPUT_PATH)) return [];
  const content = readFileSync(OUTPUT_PATH, "utf8").trim();
  if (!content) return [];
  const parsed = JSON.parse(content) as OutputRow[];
  if (!Array.isArray(parsed)) throw new Error(`${OUTPUT_PATH} is not a JSON array`);
  return parsed;
}

function saveOutput(rows: OutputRow[]): void {
  const tmpPath = `${OUTPUT_PATH}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(rows, null, 2)}\n`);
  renameSync(tmpPath, OUTPUT_PATH);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function processBatch(batchRows: ExportRow[]): Promise<OutputRow[]> {
  const outputRows: OutputRow[] = [];
  const preparedResults = await Promise.all(
    batchRows.map(async (row) => {
      try {
        return { prepared: await withRetry(`download/analyze ${row.id}`, () => prepareRow(row)) };
      } catch (error) {
        return { failure: buildFailureRow(row, error) };
      }
    }),
  );

  const prepared = preparedResults
    .map((result) => result.prepared)
    .filter((result): result is PreparedRow => Boolean(result));
  for (const result of preparedResults) {
    if (result.failure) outputRows.push(result.failure);
  }

  if (prepared.length === 0) return outputRows;

  try {
    const modelResults = await withRetry(
      `vision batch ${prepared.map((item) => item.row.id).join(",")}`,
      () => callOpenAI(prepared),
    );
    for (const item of prepared) outputRows.push(finalizeOutput(item, modelResults[item.row.id]));
  } catch (error) {
    console.warn(`[quality-prescreen] vision batch failed permanently; marking batch for review: ${String(error)}`);
    for (const item of prepared) {
      const defects = Array.from(new Set([...item.deterministicDefects, "vision-analysis-failed"]));
      outputRows.push({
        id: item.row.id,
        graceSku: item.graceSku,
        family: item.family,
        lineage: item.lineage,
        url: item.row.image_url || "",
        bg_class: item.bgClass,
        tier: item.bgClass === "bone" ? "review" : "likely-reject",
        identity_ok: false,
        defects,
        reason: "Vision analysis failed, so this row needs human review before use.",
        confidence: 0.9,
      });
    }
  }

  return outputRows;
}

function summarize(rows: OutputRow[]): void {
  const tierCounts: Record<string, number> = {};
  const bgCounts: Record<string, number> = {};
  const perFamily: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    tierCounts[row.tier] = (tierCounts[row.tier] || 0) + 1;
    bgCounts[row.bg_class] = (bgCounts[row.bg_class] || 0) + 1;
    perFamily[row.family] ||= {};
    perFamily[row.family][row.tier] = (perFamily[row.family][row.tier] || 0) + 1;
  }
  console.log("[quality-prescreen] tier counts", JSON.stringify(tierCounts, null, 2));
  console.log("[quality-prescreen] background split", JSON.stringify(bgCounts, null, 2));
  console.log("[quality-prescreen] tier counts per family", JSON.stringify(perFamily, null, 2));
}

async function main(): Promise<void> {
  const rows = JSON.parse(readFileSync(INPUT_PATH, "utf8")) as ExportRow[];
  if (!Array.isArray(rows)) throw new Error(`${INPUT_PATH} is not a JSON array`);
  const outputDir = dirname(OUTPUT_PATH);
  if (!existsSync(outputDir)) throw new Error(`Output directory does not exist: ${outputDir}`);

  const existing = loadOutput();
  const completed = new Set(existing.map((row) => row.id));
  const pendingAll = rows.filter((row) => row.id && !completed.has(row.id));
  const pending = LIMIT > 0 ? pendingAll.slice(0, LIMIT) : pendingAll;
  const results = existing.slice();
  console.log(
    `[quality-prescreen] input=${rows.length} existing=${existing.length} pending=${pending.length} batchSize=${BATCH_SIZE} concurrency=${CONCURRENCY} model=${OPENAI_MODEL}`,
  );

  const batches = chunk(pending, BATCH_SIZE);
  for (const batchGroup of chunk(batches, Math.max(1, CONCURRENCY))) {
    const groupResults = await Promise.all(batchGroup.map((batchRows) => processBatch(batchRows)));
    for (const outputRows of groupResults) results.push(...outputRows);
    saveOutput(results);
    console.log(`[quality-prescreen] saved ${results.length}/${rows.length}`);
  }

  const finalRows = loadOutput();
  if (LIMIT === 0 && finalRows.length !== rows.length) {
    throw new Error(`Output row count ${finalRows.length} does not match input row count ${rows.length}`);
  }
  summarize(finalRows);
  console.log(`[quality-prescreen] wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
