import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panelSource = () => readFileSync(new URL("./ProductionRoutePanel.tsx", import.meta.url), "utf8");
const workbenchSource = () => readFileSync(new URL("./ProductionCandidateWorkbench.tsx", import.meta.url), "utf8");
const studioSource = () => readFileSync(new URL("../../pages/BestBottlesStudio.tsx", import.meta.url), "utf8");

test("active candidate bench mounts the registered production route above the existing editing workflow", () => {
  const source = workbenchSource();
  assert.match(source, /<ProductionRoutePanel/);
  assert.match(source, /route=\{cyl9ProductionRoute\}/);
  assert.match(source, /liveRelease=\{liveReleaseSnapshot\}/);
  assert.ok(source.indexOf("<ProductionRoutePanel") < source.indexOf("Production candidate bench"));
});

test("production route panel contains the nine-stage route, source/build drawer, and consolidated matrix", () => {
  const source = panelSource();
  assert.match(source, /Production Route/);
  assert.match(source, /Source &(?:amp;)? Build/);
  assert.match(source, /Visual evidence · review proxies/);
  assert.match(source, /containment receipt remain evidence authority/);
  assert.match(source, /Consolidated Production Matrix/);
  assert.match(source, /route\.stages\.map/);
  assert.match(source, /<SheetContent/);
  assert.match(source, /buildProductionRouteMatrixRow/);
});

test("route stages are keyboard buttons with visible status text and no filename-based approval inference", () => {
  const source = panelSource();
  assert.match(source, /type="button"/);
  assert.match(source, /aria-label=\{`Open evidence for/);
  assert.match(source, /stage\.status/);
  assert.doesNotMatch(source, /filename.*approved/i);
});

test("Product Studio relabels Compose as Production while preserving the compose route key", () => {
  const source = studioSource();
  assert.match(source, /id: "compose",\s*label: "Production"/);
  assert.doesNotMatch(source, /id: "compose",\s*label: "Compose"/);
  assert.match(source, /activeTab === "compose"/);
});
