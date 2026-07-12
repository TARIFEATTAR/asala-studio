import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { buildCylinderPhysicalTypes } from "./bestBottlesCylinderPhysicalTypes";

const require = createRequire(import.meta.url);

describe("Cylinder physical types", () => {
  it("collapses cosmetic variants without collapsing physical topology", () => {
    const rows = buildCylinderPhysicalTypes([
      { graceSku: "A", websiteSku: "A1", family: "Cylinder", capacityMl: 9, category: "Glass Bottle", neckThreadSize: "17-415", applicator: "Metal Roller Ball", capStyle: "Tall", color: "Clear" },
      { graceSku: "B", websiteSku: "B1", family: "Cylinder", capacityMl: 9, category: "Glass Bottle", neckThreadSize: "17-415", applicator: "Metal Roller Ball", capStyle: "Tall", color: "Amber" },
      { graceSku: "C", websiteSku: "C1", family: "Cylinder", capacityMl: 9, category: "Glass Bottle", neckThreadSize: "17-415", applicator: "Plastic Roller Ball", capStyle: "Tall", color: "Clear" },
    ]);
    assert.equal(rows.length, 2);
  });

  it("assigns every physical type to one detailed plate", () => {
    const rows = buildCylinderPhysicalTypes(require("../../public/data/best-bottles-catalog-lite.json").products);
    assert.equal(rows.length, 75);
    assert.deepEqual(
      Object.fromEntries([...new Set(rows.map((row) => row.plateId))].map((plateId) => [plateId, rows.filter((row) => row.plateId === plateId).length])),
      { "01": 10, "02": 12, "03": 11, "04": 11, "05": 7, "06": 9, "07": 7, "08": 8 },
    );
  });
});
