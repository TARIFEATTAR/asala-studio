// Build the gap-worklist manifest the Best Bottles workbench reads at runtime.
//
// Cowork drops per-family CSVs named `<family-slug>-gap-worklist-<YYYY-MM-DD>.csv`
// into public/data/audits/. A static SPA can't list a directory at runtime, so
// this Madison-owned indexer globs that directory and writes
// public/data/audits/gap-worklists.json — every CSV discovered, with the family,
// date, row count, and (when present) the legend README. The app picks the
// newest dated CSV per family from this manifest.
//
//   npm run bestbottles:gap-worklist:index

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { parseCsv } from "../src/lib/bestBottlesGapWorklist";

const AUDITS_DIR = path.resolve(process.cwd(), "public/data/audits");
const PUBLIC_PREFIX = "/data/audits";
const OUT_FILE = path.join(AUDITS_DIR, "gap-worklists.json");

// `<family-slug>-gap-worklist-<YYYY-MM-DD>.csv`
const FILENAME_RE = /^(?<slug>.+)-gap-worklist-(?<date>\d{4}-\d{2}-\d{2})\.csv$/;

interface ManifestEntry {
  family: string;
  familySlug: string;
  date: string;
  file: string;
  readme?: string;
  rowCount?: number;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function findReadme(slug: string, allFiles: string[]): string | undefined {
  const candidates = [`${slug}-gap-worklist-README.md`, `${slug}-gap-worklist-readme.md`];
  for (const candidate of candidates) {
    if (allFiles.includes(candidate)) return `${PUBLIC_PREFIX}/${candidate}`;
  }
  return undefined;
}

function main(): void {
  if (!fs.existsSync(AUDITS_DIR)) {
    fs.mkdirSync(AUDITS_DIR, { recursive: true });
  }
  const allFiles = fs.readdirSync(AUDITS_DIR);
  const entries: ManifestEntry[] = [];

  for (const filename of allFiles) {
    const match = FILENAME_RE.exec(filename);
    if (!match?.groups) continue;
    const slug = match.groups.slug;
    const date = match.groups.date;

    let rowCount: number | undefined;
    try {
      const text = fs.readFileSync(path.join(AUDITS_DIR, filename), "utf8");
      rowCount = parseCsv(text).records.length;
    } catch {
      rowCount = undefined;
    }

    entries.push({
      family: titleCaseSlug(slug),
      familySlug: slug,
      date,
      file: `${PUBLIC_PREFIX}/${filename}`,
      readme: findReadme(slug, allFiles),
      rowCount,
    });
  }

  // Deterministic ordering: family, then date (newest last).
  entries.sort((a, b) => a.family.localeCompare(b.family) || a.date.localeCompare(b.date));

  // Use the newest file's date as the manifest stamp (avoids a nondeterministic
  // clock so reruns are reproducible); fall back to a fixed sentinel if empty.
  const generatedAt = entries.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), "");

  const manifest = {
    generatedAt: generatedAt || "1970-01-01",
    entries,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + "\n");

  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} with ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`);
  for (const entry of entries) {
    console.log(`  • ${entry.family} ${entry.date} — ${entry.rowCount ?? "?"} rows — ${entry.file}`);
  }
}

main();
