#!/usr/bin/env tsx
/**
 * Paper-Doll Rig — component / body-plate intake CLI (build task 1).
 * Spec: docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md
 *
 * Takes an exported asset (alpha cutout for closures, Bone plate for bodies),
 * runs the intake QA gates, SHA-pins it, joins it to canon geometry, and
 * records it in the repo registry as `pending-review`. A separate --approve
 * pass freezes it. Read-only toward Supabase and the asset itself — this lane
 * PREPS the library; it never generates or publishes.
 *
 * Usage:
 *   # Closure component (alpha-preserving cutout):
 *   npm run paperdoll:intake -- --file <png> --role closure \
 *     --thread 13-415 --applicator "Fine Mist Sprayer" --colorway "Matte Gold" \
 *     [--source psd-layer-export] [--source-psd "<path>"] [--scenes 4,5] \
 *     [--by jordan] [--notes "…"] [--dry-run] [--force]
 *
 *   # Body plate (born on Bone, cap-off):
 *   npm run paperdoll:intake -- --file <png> --role body-plate \
 *     --family Cylinder --capacity 9 --color Clear \
 *     [--height-mm 70 --width-mm 20]   # only when canon is ambiguous
 *
 *   # Approve (freezes the SHA):
 *   npm run paperdoll:intake -- --approve <entry-id> --by jordan
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

import {
  approveRegistryEntry,
  PAPER_DOLL_REGISTRY_VERSION,
  parseCanonGeometryRows,
  registryIdForEntry,
  resolveCanonGeometry,
  runBodyPlateQa,
  runClosureQa,
  threadSizeExistsInCanon,
  upsertRegistryEntry,
  type BodyPlateKey,
  type ClosureKey,
  type IntakeSourceKind,
  type PaperDollRole,
  type RegistryEntry,
  type RegistryFile,
  type RgbaImage,
} from "../../src/lib/paperDoll/componentRegistry";
import { neckDiameterMmFromThread } from "../../src/lib/paperDoll/plateBirthPrompt";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: resolve(REPO_ROOT, ".env") });
const REGISTRY_DIR = resolve(REPO_ROOT, "docs/paper-doll-rig");

/** Canonical byte vault — same bucket + SHA-in-filename convention as the
 * visual-target plates (reference-images/best-bottles/visual-targets/...). */
const STORAGE_BUCKET = "reference-images";
const STORAGE_PREFIX: Record<PaperDollRole, string> = {
  closure: "best-bottles/paper-doll/components",
  "body-plate": "best-bottles/paper-doll/body-plates",
};

/** Registry paths are repo-relative so registries stay machine-portable. */
function portablePath(absPath: string): string {
  const rel = relative(REPO_ROOT, absPath);
  return rel.startsWith("..") ? absPath : rel;
}

async function uploadToVault(
  role: PaperDollRole,
  id: string,
  sha256: string,
  bytes: Buffer,
): Promise<string> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("--upload needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  const client = createClient(url, key);
  const objectKey = `${STORAGE_PREFIX[role]}/${id}__${sha256.slice(0, 12)}.png`;
  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(objectKey, bytes, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`vault upload failed: ${error.message}`);
  return `${url}/storage/v1/object/public/${STORAGE_BUCKET}/${objectKey}`;
}
const CANON_CSV = resolve(REPO_ROOT, "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv");

const REGISTRY_PATHS: Record<PaperDollRole, string> = {
  closure: resolve(REGISTRY_DIR, "component-registry.json"),
  "body-plate": resolve(REGISTRY_DIR, "body-plate-registry.json"),
};

// ─── args ────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const out = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out.set(key, true);
    else {
      out.set(key, next);
      i++;
    }
  }
  return out;
}

function str(args: Map<string, string | boolean>, key: string): string | null {
  const v = args.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function requireString(args: Map<string, string | boolean>, key: string): string {
  const value = args.get(key);
  if (typeof value !== "string" || !value.trim()) {
    console.error(`Missing required --${key}`);
    process.exit(1);
  }
  return value.trim();
}

// ─── registry I/O ────────────────────────────────────────────────────

function loadRegistry(path: string): RegistryFile {
  if (!existsSync(path)) {
    return { version: PAPER_DOLL_REGISTRY_VERSION, updatedAt: new Date().toISOString(), entries: [] };
  }
  return JSON.parse(readFileSync(path, "utf8")) as RegistryFile;
}

function saveRegistry(path: string, file: RegistryFile): void {
  mkdirSync(REGISTRY_DIR, { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...file, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

// ─── main ────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Approve mode.
  const approveId = args.get("approve");
  if (typeof approveId === "string") {
    const reviewer = requireString(args, "by");
    for (const role of ["closure", "body-plate"] as PaperDollRole[]) {
      const path = REGISTRY_PATHS[role];
      const registry = loadRegistry(path);
      if (registry.entries.some((e) => e.id === approveId)) {
        registry.entries = approveRegistryEntry(registry.entries, approveId, reviewer, new Date().toISOString());
        saveRegistry(path, registry);
        console.log(`✅ Approved + SHA-frozen: ${approveId} (reviewed by ${reviewer})`);
        return;
      }
    }
    console.error(`No registry entry '${approveId}' found in either registry.`);
    process.exit(1);
  }

  const filePath = resolve(requireString(args, "file"));
  const role = requireString(args, "role") as PaperDollRole;
  if (role !== "closure" && role !== "body-plate") {
    console.error(`--role must be 'closure' or 'body-plate', got '${role}'`);
    process.exit(1);
  }
  const dryRun = args.get("dry-run") === true;
  const force = args.get("force") === true;
  const source = (typeof args.get("source") === "string" ? args.get("source") : "psd-layer-export") as IntakeSourceKind;

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  // Decode + fingerprint.
  const bytes = readFileSync(filePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const meta = await sharp(filePath).metadata();
  const hasAlpha = Boolean(meta.hasAlpha);
  const raw = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const image: RgbaImage = {
    data: raw.data,
    width: raw.info.width,
    height: raw.info.height,
    hasAlpha,
  };

  // Canon join.
  const canonRows = parseCanonGeometryRows(readFileSync(CANON_CSV, "utf8"));

  let closureKey: ClosureKey | undefined;
  let bodyPlateKey: BodyPlateKey | undefined;

  if (role === "closure") {
    const heightMmArg = args.get("height-mm");
    closureKey = {
      neckThreadSize: requireString(args, "thread"),
      applicator: requireString(args, "applicator"),
      colorway: requireString(args, "colorway"),
      heightMm: typeof heightMmArg === "string" && Number(heightMmArg) > 0 ? Number(heightMmArg) : undefined,
    };
    if (!threadSizeExistsInCanon(canonRows, closureKey.neckThreadSize)) {
      console.error(`Thread size '${closureKey.neckThreadSize}' does not exist in the canon CSV — check the key.`);
      process.exit(1);
    }
  } else {
    const family = requireString(args, "family");
    const capacityMl = Number(requireString(args, "capacity"));
    const color = requireString(args, "color");
    const explicitH = args.get("height-mm");
    const explicitW = args.get("width-mm");
    const geometry = typeof explicitH === "string" && typeof explicitW === "string"
      ? { bodyHeightMm: Number(explicitH), widthAxisMm: Number(explicitW) }
      : resolveCanonGeometry(canonRows, family, capacityMl, color);
    bodyPlateKey = { family, capacityMl, color, ...geometry };
  }

  // QA. A recorded geometry exception downgrades canon-conflict issues to
  // warnings (auditable, never silent) — used when the PHOTOGRAPHY contradicts
  // the canon numbers and the measurement lane has not yet reconciled them.
  const geometryException = str(args, "geometry-exception");
  const qa = role === "closure"
    ? runClosureQa(image, { heightMm: closureKey?.heightMm })
    : runBodyPlateQa(image, {
        expectedAspect: bodyPlateKey ? bodyPlateKey.bodyHeightMm / bodyPlateKey.widthAxisMm : undefined,
        expectedNeckToBodyRatio: (() => {
          const thread = str(args, "thread");
          const neckMm = thread ? neckDiameterMmFromThread(thread) : null;
          return neckMm && bodyPlateKey ? neckMm / bodyPlateKey.widthAxisMm : undefined;
        })(),
      });

  if (geometryException) {
    const geometryIssues = qa.issues.filter((i) => i.startsWith("aspect_off_canon") || i.startsWith("neck_off_canon"));
    if (geometryIssues.length > 0) {
      qa.issues = qa.issues.filter((i) => !geometryIssues.includes(i));
      qa.warnings = [
        ...(qa.warnings ?? []),
        ...geometryIssues.map((i) => `EXCEPTION[${geometryException}]: ${i}`),
      ];
      qa.passed = qa.issues.length === 0;
    }
  }

  const entryId = registryIdForEntry(role, closureKey, bodyPlateKey);
  let storageUrl: string | null = null;
  if (args.get("upload") === true && !dryRun) {
    storageUrl = await uploadToVault(role, entryId, sha256, bytes);
  }

  const entry: RegistryEntry = {
    id: entryId,
    role,
    closureKey,
    bodyPlateKey,
    asset: {
      path: portablePath(filePath),
      storageUrl,
      sha256,
      widthPx: image.width,
      heightPx: image.height,
      hasAlpha,
    },
    provenance: {
      source,
      sourcePsd: typeof args.get("source-psd") === "string" ? String(args.get("source-psd")) : null,
      sourcePsdScenes: typeof args.get("scenes") === "string" ? String(args.get("scenes")) : null,
      sourceSha256: null,
      intakeDate: new Date().toISOString(),
      intakeBy: typeof args.get("by") === "string" ? String(args.get("by")) : null,
    },
    qa,
    status: "pending-review",
    notes: typeof args.get("notes") === "string" ? String(args.get("notes")) : null,
  };

  // Report.
  console.log(`\n── Paper-Doll intake ${dryRun ? "(DRY RUN)" : ""}`);
  console.log(`   id:        ${entry.id}`);
  console.log(`   file:      ${filePath}`);
  console.log(`   sha256:    ${sha256}`);
  console.log(`   pixels:    ${image.width}×${image.height}  alpha=${hasAlpha}`);
  if (bodyPlateKey) {
    console.log(`   canon:     ${bodyPlateKey.bodyHeightMm}×${bodyPlateKey.widthAxisMm} mm (${bodyPlateKey.family} ${bodyPlateKey.capacityMl}ml ${bodyPlateKey.color})`);
  }
  if (qa.alphaCoverageRatio != null) console.log(`   alpha cov: ${(qa.alphaCoverageRatio * 100).toFixed(1)}%`);
  if (qa.edgeHaloDelta != null) console.log(`   halo Δ:    ${qa.edgeHaloDelta.toFixed(1)} vs Bone`);
  if (qa.backgroundBoneDelta != null) console.log(`   bg Δ:      ${qa.backgroundBoneDelta.toFixed(1)} vs Bone`);
  if (qa.keySide) console.log(`   key side:  ${qa.keySide}`);
  console.log(`   verdict:   ${qa.passed ? "✅ PASS — eligible for review/approval" : "❌ FAIL"}`);
  for (const issue of qa.issues) console.log(`     · ${issue}`);
  for (const warning of qa.warnings ?? []) console.log(`     ⚠ ${warning}`);

  if (dryRun) {
    console.log("\n(dry run — registry not written)");
    return;
  }

  const path = REGISTRY_PATHS[role];
  const registry = loadRegistry(path);
  const { entries, action } = upsertRegistryEntry(registry.entries, entry, { force });
  registry.entries = entries;
  saveRegistry(path, registry);
  console.log(`\n📒 Registry ${action}: ${path.replace(`${REPO_ROOT}/`, "")}`);
  console.log(`   status: pending-review — approve with:`);
  console.log(`   npm run paperdoll:intake -- --approve ${entry.id} --by <reviewer>`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
