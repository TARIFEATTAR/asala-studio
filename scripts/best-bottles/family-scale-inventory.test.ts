import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyFamilyRenderingPlan,
  parseMeasurementMm,
  summarizeMeasurements,
} from "./family-scale-inventory";

test("parses tolerance measurement strings", () => {
  assert.equal(parseMeasurementMm("83 ±1 mm"), 83);
  assert.equal(parseMeasurementMm("20 ±0.5 mm"), 20);
  assert.equal(parseMeasurementMm("118mm"), 118);
  assert.equal(parseMeasurementMm(null), null);
});

test("summarizes observed height ranges", () => {
  const summary = summarizeMeasurements([
    { heightWithCap: "83 ±1 mm", heightWithoutCap: "70 ±1 mm", diameter: "20 ±0.5 mm" },
    { heightWithCap: "118 ±2 mm", heightWithoutCap: "106 ±2 mm", diameter: "18 ±0.5 mm" },
  ]);

  assert.deepEqual(summary.heightWithCapMm, { min: 83, max: 118 });
  assert.deepEqual(summary.heightWithoutCapMm, { min: 70, max: 106 });
  assert.deepEqual(summary.diameterMm, { min: 18, max: 20 });
});

test("marks explicit scale profiles as mapped", () => {
  assert.deepEqual(classifyFamilyRenderingPlan("Cylinder", "Cylinder"), {
    renderingLane: "bottle_catalog",
    bottleScaleStatus: "mapped",
    enhancementStatus: "needs_review",
    reason: "Covered by current Madison family profile resolver.",
  });
});

test("marks high-priority but unimplemented families as needs review", () => {
  assert.deepEqual(classifyFamilyRenderingPlan("Circle", "Circle"), {
    renderingLane: "bottle_catalog",
    bottleScaleStatus: "needs_review",
    enhancementStatus: "needs_review",
    reason: "Known Best Bottles family with enough product coverage to map next.",
  });
});

test("routes component-only families to component enhancement instead of blocking generation", () => {
  assert.deepEqual(classifyFamilyRenderingPlan("Dropper", "Dropper"), {
    renderingLane: "component_enhancement",
    bottleScaleStatus: "not_bottle",
    enhancementStatus: "needs_review",
    reason: "Component family; exclude from bottle scale, but keep eligible for material and geometry enhancement.",
  });
});

test("keeps broad decorative mappings in review when they mix small and large products", () => {
  assert.deepEqual(classifyFamilyRenderingPlan("Sleek", "Sleek"), {
    renderingLane: "bottle_catalog",
    bottleScaleStatus: "needs_review",
    enhancementStatus: "needs_review",
    reason: "Broad decorative family mixes small and large capacities; needs capacity-aware sub-bands before bulk generation.",
  });
});

test("keeps Tall Cylinder in review because current resolver and inventory band disagree", () => {
  assert.deepEqual(classifyFamilyRenderingPlan("Tall Cylinder", "Tall Cylinder Collection"), {
    renderingLane: "bottle_catalog",
    bottleScaleStatus: "needs_review",
    enhancementStatus: "needs_review",
    reason: "Single-row tall-cylinder family conflicts with current measured-height resolver behavior; requires explicit resolver test.",
  });
});

test("routes packaging families to packaging enhancement", () => {
  assert.deepEqual(classifyFamilyRenderingPlan("Gift Box", "Gift Box"), {
    renderingLane: "packaging_enhancement",
    bottleScaleStatus: "not_bottle",
    enhancementStatus: "needs_review",
    reason: "Packaging family; exclude from bottle scale, but keep eligible for packaging enhancement.",
  });
});

test("keeps unknown families truly blocked", () => {
  assert.deepEqual(classifyFamilyRenderingPlan("Unknown", null), {
    renderingLane: "blocked_unknown",
    bottleScaleStatus: "blocked",
    enhancementStatus: "blocked",
    reason: "Missing or unknown family; requires product-truth review before generation.",
  });
});
