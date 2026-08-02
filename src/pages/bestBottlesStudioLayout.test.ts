import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Best Bottles Studio overrides the fixed Dark Room shell so the full Compose workspace scrolls", async () => {
  const [pageSource, darkroomCss] = await Promise.all([
    readFile(new URL("./BestBottlesStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../styles/darkroom.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /dark-room-container best-bottles-studio-container/);
  assert.match(
    darkroomCss,
    /\.dark-room-container\.best-bottles-studio-container\s*\{[^}]*height:\s*auto;[^}]*overflow-y:\s*auto;/s,
  );
});

test("Best Bottles Studio route exists during initial auth hydration and after sidebar activation", async () => {
  const appSource = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  const routeMatches = appSource.match(/path="\/best-bottles\/studio\/:groupSlug"/g) ?? [];

  assert.equal(routeMatches.length, 2);
});
