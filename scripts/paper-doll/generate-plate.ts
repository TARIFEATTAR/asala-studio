#!/usr/bin/env tsx
/**
 * Paper-Doll Rig — plate-birth / color-transfer generation runner.
 * Spec: docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md
 * ("When gpt-image-2 runs" — moments 1 and the color derivations)
 *
 * One gpt-image-2 /images/edits call: Image 1 (product/geometry authority) +
 * optional Image 2 (optical authority), a versioned prompt file, exact
 * canvas size, ledger-tracked (lane: paper-doll-plate-birth). SPENDS MONEY.
 *
 * Usage:
 *   npm run paperdoll:generate-plate -- \
 *     --image1 <path|https-url> [--image2 <path|https-url>] \
 *     --prompt-file docs/paper-doll-rig/prompts/pass2-clear.txt \
 *     --out outputs/paper-doll-plates/clear-9ml-17415-v1.png \
 *     [--size 2080x2288] [--quality high] [--lane paper-doll-plate-birth]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

import {
  beginGenerationAttempt,
  completeGenerationAttempt,
} from "../../supabase/functions/_shared/generationAttemptLedger";
import { parseCanonGeometryRows, resolveCanonGeometry } from "../../src/lib/paperDoll/componentRegistry";
import { buildPlateBirthPrompt } from "../../src/lib/paperDoll/plateBirthPrompt";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: resolve(REPO_ROOT, ".env") });

function parseArgs(argv: string[]) {
  const get = (key: string, fallback: string | null = null) => {
    const i = argv.indexOf(`--${key}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    image1: get("image1"),
    image2: get("image2"),
    promptFile: get("prompt-file"),
    out: get("out"),
    size: get("size", "2080x2288")!,
    quality: get("quality", "high")!,
    lane: get("lane", "paper-doll-plate-birth")!,
  };
}

async function loadBytes(ref: string): Promise<{ bytes: Buffer; sha256: string; mime: string }> {
  let bytes: Buffer;
  if (/^https?:\/\//.test(ref)) {
    const res = await fetch(ref);
    if (!res.ok) throw new Error(`fetch ${ref} → ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
  } else {
    const abs = resolve(ref);
    if (!existsSync(abs)) throw new Error(`file not found: ${abs}`);
    bytes = readFileSync(abs);
  }
  const mime = bytes[0] === 0x89 ? "image/png" : "image/jpeg";
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), mime };
}

/**
 * Canon-driven prompt: --family/--capacity/--color/--thread [--pass 1|2].
 * Geometry (body H/W) resolves from the canon CSV; neck diameter derives from
 * the GPI thread designation. Explicit --height-mm/--width-mm override.
 */
function buildCanonPrompt(argv: string[]): string {
  const get = (k: string) => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };
  const family = get("family"), capacity = get("capacity"), color = get("color"), thread = get("thread");
  if (!family || !capacity || !color || !thread) {
    console.error("Provide --prompt-file, or canon params: --family --capacity --color --thread [--pass 1|2] [--height-mm --width-mm]");
    process.exit(1);
  }
  const rows = parseCanonGeometryRows(
    readFileSync(resolve(REPO_ROOT, "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv"), "utf8"),
  );
  const hMm = get("height-mm"), wMm = get("width-mm");
  const geometry = hMm && wMm
    ? { bodyHeightMm: Number(hMm), widthAxisMm: Number(wMm) }
    : resolveCanonGeometry(rows, family, Number(capacity), color);
  const prompt = buildPlateBirthPrompt(
    {
      family,
      capacityMl: Number(capacity),
      color,
      bodyHeightMm: geometry.bodyHeightMm,
      bodyWidthMm: geometry.widthAxisMm,
      neckThreadSize: thread,
    },
    { pass: (Number(get("pass") ?? "2") === 1 ? 1 : 2) },
  );
  console.log(`   prompt: canon-driven (${family} ${capacity}ml ${color}, ${geometry.bodyHeightMm}×${geometry.widthAxisMm}mm, neck ${thread})`);
  return prompt;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.image1 || !args.out) {
    console.error("Required: --image1, --out, and either --prompt-file or canon params");
    process.exit(1);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const prompt = args.promptFile
    ? readFileSync(resolve(args.promptFile), "utf8").trim()
    : buildCanonPrompt(process.argv.slice(2));
  const image1 = await loadBytes(args.image1);
  const image2 = args.image2 ? await loadBytes(args.image2) : null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ledger = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;
  const tracker = ledger
    ? await beginGenerationAttempt(ledger, {
        lane: args.lane,
        provider: "openai",
        model: "gpt-image-2",
        endpoint: "edits",
        requestSize: args.size,
        requestResolution: args.quality,
        prompt,
        referenceFingerprintSources: [image1.sha256, ...(image2 ? [image2.sha256] : [])],
        codeCommit: process.env.MADISON_GIT_COMMIT ?? null,
        requestParams: { promptFile: args.promptFile },
      })
    : null;

  console.log(`\n── Plate generation (${args.lane})`);
  console.log(`   image1: ${image1.sha256.slice(0, 12)}…  image2: ${image2 ? image2.sha256.slice(0, 12) + "…" : "(none)"}`);
  console.log(`   💸 calling gpt-image-2 /images/edits ${args.size} quality=${args.quality}…`);

  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("prompt", prompt);
  form.append("n", "1");
  form.append("size", args.size);
  form.append("quality", args.quality);
  form.append("output_format", "png");
  form.append("image[]", new Blob([image1.bytes], { type: image1.mime }), "image-1.png");
  if (image2) form.append("image[]", new Blob([image2.bytes], { type: image2.mime }), "image-2.png");

  const started = Date.now();
  let outputBytes: Buffer;
  try {
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 400)}`);
    const data = await res.json() as { data?: Array<{ b64_json?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error("no image in response");
    outputBytes = Buffer.from(b64, "base64");
    if (ledger && tracker) await completeGenerationAttempt(ledger, tracker, { status: "succeeded" });
  } catch (error) {
    if (ledger && tracker) {
      await completeGenerationAttempt(ledger, tracker, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }

  const outAbs = resolve(args.out);
  mkdirSync(dirname(outAbs), { recursive: true });
  writeFileSync(outAbs, outputBytes);
  console.log(`   ✅ ${Math.round((Date.now() - started) / 1000)}s → ${outAbs}`);
  console.log(`   sha256: ${createHash("sha256").update(outputBytes).digest("hex")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
