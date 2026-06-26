import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  buildPromptForSku,
  generateJsonl,
  normalizePromptSkuRow,
  type ClosureModule,
  type FamilyModule,
  type FrameModule,
  type JsonRecord,
  type MaterialModule,
  type ModuleConfig,
  type NegativeRulesConfig,
  type PromptSku,
  type PromptSystem,
} from "../src/lib/bestBottlesPromptCompiler";

export {
  buildPromptForSku,
  generateJsonl,
  normalizePromptSkuRow,
  type PromptRecord,
  type PromptSku,
  type PromptSystem,
} from "../src/lib/bestBottlesPromptCompiler";

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      i += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function readCsvInput(filePath: string): PromptSku[] {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: JsonRecord = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return normalizePromptSkuRow(row);
  });
}

export function readSkuInput(filePath: string): PromptSku[] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv") return readCsvInput(filePath);
  const payload = readJson<unknown>(filePath);
  if (!Array.isArray(payload)) {
    throw new Error(`SKU input must be a JSON array or CSV: ${filePath}`);
  }
  return payload.map((row) => normalizePromptSkuRow(row as JsonRecord));
}

export function loadPromptSystem(root = process.cwd()): PromptSystem {
  const families = readJson<ModuleConfig<FamilyModule>>(path.join(root, "config/product_families.json"));
  const materials = readJson<ModuleConfig<MaterialModule>>(path.join(root, "config/material_modules.json"));
  const frames = readJson<ModuleConfig<FrameModule>>(path.join(root, "config/frame_classes.json"));
  const closures = readJson<ModuleConfig<ClosureModule>>(path.join(root, "config/closure_modules.json"));
  const negativeRules = readJson<NegativeRulesConfig>(path.join(root, "config/negative_rules.json"));
  const masterTemplate = fs.readFileSync(path.join(root, "prompts/master_pdp_prompt.md"), "utf8");

  return {
    masterTemplate,
    families: families.modules,
    materials: materials.modules,
    frames: frames.modules,
    closures: closures.modules,
    negativeRules: negativeRules.rules,
  };
}

function parseArgs(argv: string[]): { input: string; out?: string; root: string } {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      args.set(arg.slice(2), argv[i + 1] ?? "");
      i += 1;
    }
  }
  const input = args.get("input");
  if (!input) {
    throw new Error("Usage: tsx scripts/generate-prompts.ts --input examples/sample_skus.json --out tmp/prompts.jsonl");
  }
  return {
    input,
    out: args.get("out") || undefined,
    root: args.get("root") || process.cwd(),
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.isAbsolute(args.input) ? args.input : path.join(args.root, args.input);
  const system = loadPromptSystem(args.root);
  const skus = readSkuInput(inputPath);
  const jsonl = generateJsonl(skus, system);

  if (args.out) {
    const outPath = path.isAbsolute(args.out) ? args.out : path.join(args.root, args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${jsonl}\n`);
    console.log(`Wrote ${skus.length} prompt records to ${outPath}`);
  } else {
    process.stdout.write(`${jsonl}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
