/**
 * DIRECT-OPENAI PROMPT SMOKE — renders the EXACT live catalog prompt without the
 * Supabase edge function, for prompt QA when the edge gateway's 150s idle limit
 * makes live smoke runs flaky (gpt-image-2 high-quality edits can exceed it).
 *
 * Prompt path is IDENTICAL to production: buildBestBottlesPromptPreflight →
 * record.final_prompt (vendored canon + family framing profile). Only the
 * transport differs (direct POST /v1/images/edits vs generate-madison-image).
 *
 * Usage:
 *   BB_SMOKE_SKUS="9ml-rollons-capoff" BB_SMOKE_OUT=/tmp/bb-renders \
 *     npx tsx scripts/best-bottles/direct-openai-prompt-smoke.ts
 *
 * Idempotent: SKUs whose output PNG already exists in BB_SMOKE_OUT are skipped,
 * so a killed run can simply be re-invoked to finish the remainder.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

import { IMAGE_PRESETS } from "../../src/config/imagePresets";
import { inferBestBottlesBodyMaterial } from "../../src/lib/bestBottlesBodyMaterial";
import { buildBestBottlesPromptPreflight } from "../../src/lib/bestBottlesPromptPreflight";
import { loadPromptSystem } from "../generate-prompts";
import { selectCylinderSmokeTargets } from "./cylinder-smoke-targets";

type ProductRow = Record<string, unknown>;

const ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const convexSnapshotPath = `${ROOT}/data/audits/2026-06-27-framing-profiles/convex_snapshot.json`;

const OPENAI_API_BASE = "https://api.openai.com/v1";
const OPENAI_MODEL = "gpt-image-2";
const CONCURRENCY = Number(process.env.BB_SMOKE_CONCURRENCY ?? "3");
const MAX_ATTEMPTS = Number(process.env.BB_SMOKE_ATTEMPTS ?? "2");

const outDir = process.env.BB_SMOKE_OUT?.trim();
if (!outDir) throw new Error("Set BB_SMOKE_OUT to an output directory.");
mkdirSync(outDir, { recursive: true });

const preset = IMAGE_PRESETS["grid-card-2000x2200"];
if (!preset) throw new Error("Missing grid-card-2000x2200 preset.");

const targets = selectCylinderSmokeTargets(process.env.BB_SMOKE_SKUS);
if (targets.length === 0) {
  throw new Error(`No smoke-test targets matched BB_SMOKE_SKUS=${process.env.BB_SMOKE_SKUS ?? ""}`);
}

function loadEnvKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  for (const file of [".env", ".env.local"]) {
    try {
      for (const line of readFileSync(file, "utf8").split(/\n/)) {
        const match = line.match(/^OPENAI_API_KEY\s*=\s*(.+?)\s*$/);
        if (match) return match[1].replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Optional env files.
    }
  }
  throw new Error("OPENAI_API_KEY not found in env or .env/.env.local.");
}

function getText(row: ProductRow, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : value == null ? null : String(value);
}

function getNumber(row: ProductRow, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function productFromSnapshot(row: ProductRow) {
  return {
    graceSku: getText(row, "graceSku"),
    websiteSku: getText(row, "websiteSku"),
    itemName: getText(row, "itemName"),
    itemDescription: getText(row, "itemDescription"),
    bottleCollection: getText(row, "bottleCollection"),
    family: getText(row, "family"),
    category: getText(row, "category"),
    color: getText(row, "color"),
    capacityMl: getNumber(row, "capacityMl"),
    applicator: getText(row, "applicator"),
    capColor: getText(row, "capColor"),
    trimColor: getText(row, "trimColor"),
    capStyle: getText(row, "capStyle"),
    heightWithoutCap: getText(row, "heightWithoutCap"),
    heightWithCap: getText(row, "heightWithCap"),
    diameter: getText(row, "diameter"),
  };
}

function promptHeader(prompt: string): string | null {
  return (
    prompt
      .split("\n")
      .find((line) => /FRAMING PROFILE \(CANVAS COMPOSITION AUTHORITY\):/.test(line)) ?? null
  );
}

const apiKey = loadEnvKey();
const snapshot = JSON.parse(readFileSync(convexSnapshotPath, "utf8")) as {
  products: ProductRow[];
};
const system = loadPromptSystem(process.cwd());

interface SmokeResult {
  caseId: string;
  sku: string;
  status: "rendered" | "skipped-existing" | "failed";
  outputPath?: string;
  elapsedMs?: number;
  attempts?: number;
  promptHeader?: string | null;
  preflightStatus?: string;
  warnings?: string[];
  error?: string;
}

async function renderTarget(target: (typeof targets)[number]): Promise<SmokeResult> {
  const outputPath = `${outDir}/${target.sku}.png`;
  if (existsSync(outputPath)) {
    return { caseId: target.caseId, sku: target.sku, status: "skipped-existing", outputPath };
  }

  const row = snapshot.products.find((product) => getText(product, "graceSku") === target.sku);
  if (!row) throw new Error(`Missing Convex product for ${target.sku}`);
  const product = productFromSnapshot(row);
  const bodyMaterial = inferBestBottlesBodyMaterial(product);

  const preflight = buildBestBottlesPromptPreflight({
    product,
    referenceImagePath: target.reference,
    bodyMaterial,
    canvas: preset.canvas,
    system,
  });
  if (preflight.status === "error" || !preflight.record) {
    throw new Error(`${target.sku} preflight blocked: ${preflight.issue ?? "missing record"}`);
  }
  const finalPrompt = preflight.record.final_prompt;
  writeFileSync(`${outDir}/${target.sku}.prompt.txt`, finalPrompt);

  const referenceBuffer = readFileSync(target.reference);
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    try {
      const form = new FormData();
      form.append("model", OPENAI_MODEL);
      form.append("prompt", finalPrompt);
      form.append("size", "2080x2288");
      form.append("quality", "high");
      form.append("background", "opaque");
      form.append(
        "image[]",
        new Blob([referenceBuffer], { type: "image/png" }),
        basename(target.reference),
      );

      const res = await fetch(`${OPENAI_API_BASE}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`;
        continue;
      }
      const payload = (await res.json()) as { data?: Array<{ b64_json?: string }> };
      const b64 = payload.data?.[0]?.b64_json;
      if (!b64) {
        lastError = "Response had no b64_json image data.";
        continue;
      }
      writeFileSync(outputPath, Buffer.from(b64, "base64"));
      return {
        caseId: target.caseId,
        sku: target.sku,
        status: "rendered",
        outputPath,
        elapsedMs: Date.now() - startedAt,
        attempts: attempt,
        promptHeader: promptHeader(finalPrompt),
        preflightStatus: preflight.status,
        warnings: preflight.warnings,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    caseId: target.caseId,
    sku: target.sku,
    status: "failed",
    attempts: MAX_ATTEMPTS,
    error: lastError,
  };
}

async function run(): Promise<void> {
  const queue = [...targets];
  const results: SmokeResult[] = [];

  async function worker(): Promise<void> {
    for (;;) {
      const target = queue.shift();
      if (!target) return;
      const label = `${target.caseId} (${target.sku})`;
      console.error(`→ ${label} starting`);
      try {
        const result = await renderTarget(target);
        results.push(result);
        console.error(
          `✓ ${label} ${result.status}${result.elapsedMs ? ` in ${Math.round(result.elapsedMs / 1000)}s` : ""}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ caseId: target.caseId, sku: target.sku, status: "failed", error: message });
        console.error(`✗ ${label} failed: ${message}`);
      }
      writeFileSync(`${outDir}/results.json`, JSON.stringify({ results }, null, 2));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  writeFileSync(`${outDir}/results.json`, JSON.stringify({ results }, null, 2));
  console.log(JSON.stringify({ results }, null, 2));
}

await run();
