import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const CREATE_RELATION = /\bCREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-zA-Z0-9_]+)/gi;

export async function findDuplicateCreatedRelations(
  migrationsDirectory: string,
  relationPrefix = "",
): Promise<string[]> {
  const files = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  const owners = new Map<string, string>();
  const duplicates = new Set<string>();

  for (const filename of files) {
    const source = await readFile(join(migrationsDirectory, filename), "utf8");
    for (const match of source.matchAll(CREATE_RELATION)) {
      const relation = match[1].toLowerCase();
      if (relationPrefix && !relation.startsWith(relationPrefix)) continue;
      if (owners.has(relation)) duplicates.add(relation);
      else owners.set(relation, filename);
    }
  }

  return [...duplicates].sort();
}
