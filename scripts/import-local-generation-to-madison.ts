#!/usr/bin/env tsx
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type GenerationReportRow = {
  graceSku: string;
  websiteSku: string;
  mode: string;
  cycleId: string;
  pipelineLaneId: string;
  presetId: string;
  status: string;
  outputPath: string;
  genTimeSec: string;
  promptLength: string;
  shapeDescriptorPresent: string;
  frameQaStatus: string;
  frameCenterDeltaPx: string;
  frameBaselineDeltaPx: string;
  frameHeightDeltaPct: string;
  frameQaNotes: string;
  error: string;
};

type ImportOptions = {
  reportPath: string;
  batchSlug: string;
  organizationId: string;
  userId: string;
  bucket: string;
  execute: boolean;
  upsert: boolean;
  limit: number;
  supabaseUrl?: string;
  supabaseKey?: string;
};

type BuildStoragePathParams = {
  batchSlug: string;
  row: Pick<GenerationReportRow, "graceSku" | "mode" | "outputPath">;
};

type BuildInsertParams = {
  row: GenerationReportRow;
  imageUrl: string;
  userId: string;
  organizationId: string;
  referenceImageUrl?: string | null;
  batchSlug: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "local-generation";
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  values.push(current);
  return values;
}

export function parseGenerationReport(reportPath: string): GenerationReportRow[] {
  const text = readFileSync(reportPath, "utf8").trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row as GenerationReportRow;
  });
}

export function selectImportableRows(rows: GenerationReportRow[]): GenerationReportRow[] {
  return rows.filter((row) => {
    const status = clean(row.status).toLowerCase();
    return (status === "ok" || status === "qa-warning") && Boolean(row.outputPath) && existsSync(row.outputPath);
  });
}

export function buildStoragePath({ batchSlug, row }: BuildStoragePathParams): string {
  const sku = clean(row.graceSku) || basename(row.outputPath, ".png");
  const mode = slugify(row.mode || "cap-on");
  return [
    "best-bottles",
    "local-generation",
    slugify(batchSlug),
    mode,
    `${sku}.png`,
  ].join("/");
}

export function buildGeneratedImageInsert({
  row,
  imageUrl,
  userId,
  organizationId,
  referenceImageUrl,
  batchSlug,
}: BuildInsertParams) {
  const frameStatus = clean(row.frameQaStatus).toLowerCase() || "unknown";
  const status = clean(row.status).toLowerCase();
  const tags = [
    "best-bottles",
    "local-generation",
    clean(row.mode) || "cap-on",
    slugify(batchSlug),
    `frame-${frameStatus}`,
  ];
  if (status === "qa-warning") tags.push("qa-warning");

  return {
    user_id: userId,
    organization_id: organizationId,
    image_url: imageUrl,
    reference_image_url: referenceImageUrl || null,
    reference_images: referenceImageUrl
      ? {
          primary: referenceImageUrl,
          source: "madison-local-generation-reference",
        }
      : null,
    final_prompt: [
      "Imported from Madison local Best Bottles generation batch.",
      `Grace SKU: ${row.graceSku}`,
      `Website SKU: ${row.websiteSku}`,
      `Mode: ${row.mode}`,
      `Batch: ${batchSlug}`,
      `Cycle: ${row.cycleId}`,
      `Pipeline lane: ${row.pipelineLaneId}`,
    ].join("\n"),
    goal_type: "product_photography",
    aspect_ratio: "2080:2288",
    output_format: "png",
    saved_to_library: true,
    is_hero_image: true,
    is_archived: false,
    is_chain_origin: true,
    chain_depth: 0,
    // Madison currently constrains generated_images.library_category to "content".
    // Best Bottles/batch identity is carried in library_tags + brand_context_used.
    library_category: "content",
    selected_template: "grid-card-2080x2288",
    session_name: `Best Bottles ${batchSlug}`,
    description: `${row.graceSku} ${row.mode} local generation import`,
    brand_style_tags: tags,
    library_tags: tags,
    brand_context_used: {
      source: "local-generate.ts",
      batchSlug,
      graceSku: row.graceSku,
      websiteSku: row.websiteSku,
      mode: row.mode,
      cycleId: row.cycleId,
      pipelineLaneId: row.pipelineLaneId,
      presetId: row.presetId,
      status: row.status,
      outputPath: row.outputPath,
      genTimeSec: numericOrNull(row.genTimeSec),
      promptLength: numericOrNull(row.promptLength),
      shapeDescriptorPresent: row.shapeDescriptorPresent === "true",
      frameQaStatus: row.frameQaStatus,
      frameCenterDeltaPx: numericOrNull(row.frameCenterDeltaPx),
      frameBaselineDeltaPx: numericOrNull(row.frameBaselineDeltaPx),
      frameHeightDeltaPct: numericOrNull(row.frameHeightDeltaPct),
      frameQaNotes: row.frameQaNotes,
    },
  };
}

function numericOrNull(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv: string[]): ImportOptions {
  const get = (name: string, fallback = "") => {
    const idx = argv.indexOf(name);
    return idx >= 0 ? argv[idx + 1] ?? fallback : fallback;
  };
  const reportPath = get("--report", "");
  const batchSlug = get("--batch-slug", reportPath ? basename(dirname(reportPath)) : "local-generation");
  const limitRaw = get("--limit", "0");
  return {
    reportPath,
    batchSlug,
    organizationId: get("--organization-id", process.env.MADISON_BEST_BOTTLES_ORG_ID || "4ab1ac72-cd7e-4faf-9152-5aa5f2862411"),
    userId: get("--user-id", process.env.MADISON_IMPORT_USER_ID || ""),
    bucket: get("--bucket", process.env.MADISON_GENERATED_IMAGES_BUCKET || "generated-images"),
    execute: argv.includes("--execute"),
    upsert: argv.includes("--upsert"),
    limit: Number(limitRaw) > 0 ? Number(limitRaw) : Infinity,
    supabaseUrl: get("--supabase-url", process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""),
    supabaseKey: get("--supabase-key", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""),
  };
}

async function uploadAndInsert(params: {
  client: SupabaseClient;
  bucket: string;
  row: GenerationReportRow;
  storagePath: string;
  insertPayload: ReturnType<typeof buildGeneratedImageInsert>;
  upsert: boolean;
}) {
  const bytes = readFileSync(params.row.outputPath);
  const upload = await params.client.storage
    .from(params.bucket)
    .upload(params.storagePath, bytes, {
      contentType: "image/png",
      upsert: params.upsert,
    });
  if (upload.error) throw new Error(`Upload failed for ${params.row.graceSku}: ${upload.error.message}`);

  const insert = await params.client.from("generated_images").insert(params.insertPayload).select("id").single();
  if (insert.error) throw new Error(`generated_images insert failed for ${params.row.graceSku}: ${insert.error.message}`);
  return insert.data;
}

export async function runImport(options: ImportOptions) {
  const rows = selectImportableRows(parseGenerationReport(options.reportPath)).slice(0, options.limit);
  if (!options.userId) {
    throw new Error("Missing user id. Pass --user-id or set MADISON_IMPORT_USER_ID.");
  }
  if (!options.organizationId) {
    throw new Error("Missing organization id. Pass --organization-id.");
  }

  const planned = rows.map((row) => {
    const storagePath = buildStoragePath({ batchSlug: options.batchSlug, row });
    const imageUrl = options.supabaseUrl
      ? `${options.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${options.bucket}/${storagePath}`
      : `storage://${options.bucket}/${storagePath}`;
    const referenceImageUrl = row.outputPath ? pathToFileURL(row.outputPath).href : null;
    return {
      row,
      storagePath,
      imageUrl,
      insertPayload: buildGeneratedImageInsert({
        row,
        imageUrl,
        userId: options.userId,
        organizationId: options.organizationId,
        referenceImageUrl,
        batchSlug: options.batchSlug,
      }),
    };
  });

  if (!options.execute) {
    return { mode: "dry-run" as const, planned };
  }
  if (!options.supabaseUrl || !options.supabaseKey) {
    throw new Error("Missing Supabase URL/key. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --supabase-url/--supabase-key.");
  }

  const client = createClient(options.supabaseUrl, options.supabaseKey);
  const inserted = [];
  for (const item of planned) {
    const data = await uploadAndInsert({
      client,
      bucket: options.bucket,
      row: item.row,
      storagePath: item.storagePath,
      insertPayload: item.insertPayload,
      upsert: options.upsert,
    });
    inserted.push({ graceSku: item.row.graceSku, storagePath: item.storagePath, id: data?.id });
  }
  return { mode: "execute" as const, planned, inserted };
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));
  const options = parseArgs(process.argv.slice(2));
  if (!options.reportPath) {
    throw new Error("Usage: npx tsx scripts/import-local-generation-to-madison.ts --report <_generation-report.csv> --user-id <uuid> [--execute]");
  }
  const result = await runImport(options);
  console.log(JSON.stringify({
    mode: result.mode,
    count: result.planned.length,
    bucket: options.bucket,
    batchSlug: options.batchSlug,
    first: result.planned.slice(0, 3).map((item) => ({
      graceSku: item.row.graceSku,
      storagePath: item.storagePath,
      imageUrl: item.imageUrl,
    })),
    inserted: "inserted" in result ? result.inserted : undefined,
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
