import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import {
  buildCylinderPhysicalTypes,
  type CylinderCatalogRow,
} from "./bestBottlesCylinderPhysicalTypes";

const require = createRequire(import.meta.url);

function representativeRow(overrides: CylinderCatalogRow = {}): CylinderCatalogRow {
  return {
    graceSku: "GB-CYL-CLR-9ML-T-02",
    websiteSku: "Representative",
    family: "Cylinder",
    capacityMl: 9,
    category: "Glass Bottle",
    neckThreadSize: "17-415",
    applicator: "Metal Roller Ball",
    capStyle: "Tall",
    color: "Clear",
    heightWithCap: "75 mm",
    heightWithoutCap: "55 mm",
    diameter: "20 mm",
    measurementReconciliationStatus: "pending",
    capState: "cap-on",
    ...overrides,
  };
}

function selectRepresentative(rows: CylinderCatalogRow[]): CylinderCatalogRow {
  return buildCylinderPhysicalTypes(rows)[0];
}

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

  it("prefers a clear body over a cosmetic color variant", () => {
    const selected = selectRepresentative([
      representativeRow({ websiteSku: "AmberFirst", color: "Amber" }),
      representativeRow({ websiteSku: "ClearSecond", color: "Clear" }),
    ]);

    assert.equal(selected.websiteSku, "ClearSecond");
  });

  it("prefers reconciled measurements", () => {
    const selected = selectRepresentative([
      representativeRow({
        websiteSku: "AlphaUnreconciled",
        measurementReconciliationStatus: "unreconciled",
      }),
      representativeRow({
        websiteSku: "ZuluVerified",
        measurementReconciliationStatus: "verified",
      }),
    ]);

    assert.equal(selected.websiteSku, "ZuluVerified");
  });

  it("accepts the exact reference convention and rejects stale suffixes", () => {
    const exactSelected = selectRepresentative([
      representativeRow({ websiteSku: "AlphaPlain" }),
      representativeRow({
        websiteSku: "ZuluExact",
        sourceReference:
          "/REFERENCES/gb-cyl-clr-9ml-t-02__zuluexact__PDP-MAIN__V001.PNG",
      }),
    ]);
    const staleSelected = selectRepresentative([
      representativeRow({
        websiteSku: "ZuluStale",
        sourceReference:
          "/references/GB-CYL-CLR-9ML-T-02__ZuluStale__pdp-main__v001-stale.png",
      }),
      representativeRow({ websiteSku: "AlphaPlain" }),
    ]);

    assert.equal(exactSelected.websiteSku, "ZuluExact");
    assert.equal(staleSelected.websiteSku, "AlphaPlain");
  });

  it("ranks an explicitly confirmed simple cap state above a missing state", () => {
    const selected = selectRepresentative([
      representativeRow({ websiteSku: "MissingFirst", capState: undefined }),
      representativeRow({ websiteSku: "ConfirmedSecond", capState: "cap-on" }),
    ]);

    assert.equal(selected.websiteSku, "ConfirmedSecond");
  });

  it("selects the same representative independent of input order", () => {
    const websiteZ = representativeRow({ websiteSku: "ZuluWebsite" });
    const websiteA = representativeRow({ websiteSku: "AlphaWebsite" });

    assert.equal(selectRepresentative([websiteZ, websiteA]).websiteSku, "AlphaWebsite");
    assert.equal(selectRepresentative([websiteA, websiteZ]).websiteSku, "AlphaWebsite");
  });
});
