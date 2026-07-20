import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeBestBottlesCatalogSourceRows,
  selectBestBottlesCatalogMeasurement,
} from "./bestBottlesCatalogMeasurementMerge";

test("prefers a normalized live Convex measurement over contaminated master text", () => {
  assert.equal(
    selectBestBottlesCatalogMeasurement(
      "116 ±2 mm Item Diameter: 41 ±0",
      "116 ±2 mm",
    ),
    "116 ±2 mm",
  );
});

test("retains a clean master measurement when live evidence is missing", () => {
  assert.equal(
    selectBestBottlesCatalogMeasurement("74 ±1 mm", null),
    "74 ±1 mm",
  );
});

test("rejects contaminated values when neither source is clean", () => {
  assert.equal(
    selectBestBottlesCatalogMeasurement(
      "195 ±2 mm Item Diameter: 62 ±1",
      "Item Height without Cap: 195",
    ),
    null,
  );
});

test("includes live Convex-only catalog rows without duplicating master SKUs", () => {
  const rows = mergeBestBottlesCatalogSourceRows(
    [{ graceSku: "MASTER-1", color: "Master" }],
    [
      { graceSku: "MASTER-1", color: "Live" },
      { graceSku: "LIVE-ONLY", color: "Clear" },
    ],
  );

  assert.deepEqual(rows, [
    { graceSku: "MASTER-1", color: "Master" },
    { graceSku: "LIVE-ONLY", color: "Clear" },
  ]);
});
