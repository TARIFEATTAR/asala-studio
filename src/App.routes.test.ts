import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const currentDir = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(resolve(currentDir, "App.tsx"), "utf8");

test("Best Bottles Studio deep-link route is registered in both app route tables", () => {
  const studioRouteMatches = appSource.match(
    /path="\/best-bottles\/studio\/:groupSlug"/g,
  );

  assert.equal(studioRouteMatches?.length, 2);
});
