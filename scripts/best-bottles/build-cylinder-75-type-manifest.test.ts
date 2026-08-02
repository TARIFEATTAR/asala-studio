import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildCylinderPhysicalTypes,
  physicalTypeKey,
} from "../../src/lib/bestBottlesCylinderPhysicalTypes";
import {
  buildCylinder75TypeManifest,
  collectPsdSourceBytes,
  resolveCoverageTarget,
  type Cylinder75TypeManifestInput,
} from "./build-cylinder-75-type-manifest";

const catalogBytes = readFileSync("public/data/best-bottles-catalog-lite.json");
const readinessBytes = readFileSync("public/data/best-bottles-generation-readiness.json");
const catalog = JSON.parse(catalogBytes.toString("utf8")) as { products: Array<Record<string, unknown>> };
const readiness = JSON.parse(readinessBytes.toString("utf8")) as { rows: Array<Record<string, unknown>> };
const authoritativePsdRoot = "/authoritative/psds";

function exactPsdInput(products = catalog.products): Cylinder75TypeManifestInput {
  const targets = buildCylinderPhysicalTypes(products);
  const supplemental = catalog.products.find((row) => row.websiteSku === "Alu500");
  assert.ok(supplemental);
  const targetRows = [...targets, supplemental];
  const psdCoverageRows = [...new Map(targetRows.map((row) => [
    String(row.websiteSku).toLowerCase(),
    {
      websiteSku: String(row.websiteSku),
      graceSku: String(row.graceSku),
      allMatchedPsdPaths: `${String(row.websiteSku)}.psd`,
    },
  ])).values()];
  const psdSourceBytesByPath = Object.fromEntries(
    targetRows.map((row) => [
      path.join(authoritativePsdRoot, `${String(row.websiteSku)}.psd`),
      Buffer.from(`authoritative:${String(row.websiteSku)}`),
    ]),
  );
  const readinessRows = targetRows.map((target) =>
    readiness.rows.find((row) =>
      String(row.websiteSku).toLowerCase() === String(target.websiteSku).toLowerCase() &&
      String(row.graceSku).toLowerCase() === String(target.graceSku).toLowerCase()
    ) ?? readiness.rows.find((row) =>
      String(row.websiteSku).toLowerCase() === String(target.websiteSku).toLowerCase()
    ) ?? readiness.rows.find((row) =>
      String(row.graceSku).toLowerCase() === String(target.graceSku).toLowerCase()
    )
  ).filter((row): row is Record<string, unknown> => Boolean(row));
  return {
    catalogProducts: products,
    readinessRows,
    psdCoverageRows,
    authoritativePsdRoot,
    psdSourceBytesByPath,
    sourceFiles: {
      catalog: { path: "public/data/best-bottles-catalog-lite.json", bytes: catalogBytes },
      readiness: { path: "public/data/best-bottles-generation-readiness.json", bytes: readinessBytes },
      psdCoverage: { path: "website-sku-psd-coverage.csv", bytes: Buffer.from("fixture coverage") },
    },
  };
}

describe("Cylinder 75-type identity and measurement manifest", () => {
  it("emits 75 unique coverage rows, source checksums, and the measured curve version", () => {
    const input = exactPsdInput();
    const manifest = buildCylinder75TypeManifest(input);

    assert.equal(manifest.coverageRows.length, 75);
    assert.equal(new Set(manifest.coverageRows.map((row) => row.physicalTypeKey)).size, 75);
    assert.equal(manifest.curveVersion, "cylinder-measured-display-v1");
    assert.equal(
      manifest.sources.catalog.sha256,
      createHash("sha256").update(catalogBytes).digest("hex"),
    );
    assert.equal(manifest.primarySourceChecksum, manifest.sources.catalog.sha256);
    assert.ok(manifest.eligibleRows.every((row) => /^[a-f0-9]{64}$/.test(row.primarySourceChecksum ?? "")));
    assert.equal(manifest.eligibleRows.length + manifest.blockers.length, 75);
    assert.ok(manifest.eligibleRows.length > 0);
  });

  it("keeps independent fail-closed statuses for missing measurements", () => {
    const products = structuredClone(catalog.products);
    const representative = buildCylinderPhysicalTypes(products)[0];
    const source = products.find((row) => row === representative) ?? products.find(
      (row) => row.websiteSku === representative.websiteSku && row.graceSku === representative.graceSku,
    );
    assert.ok(source);
    source.heightWithCap = null;
    const manifest = buildCylinder75TypeManifest(exactPsdInput(products));
    const row = manifest.coverageRows.find((candidate) => candidate.websiteSku === source.websiteSku);

    assert.ok(row);
    assert.equal(row.identityStatus, "confirmed");
    assert.equal(row.measurementStatus, "missing");
    assert.equal(row.referenceStatus, "exact-psd");
    assert.equal(row.topologyStatus, "confirmed");
    assert.ok(manifest.blockers.some((blocker) =>
      blocker.websiteSku === source.websiteSku && blocker.reasons.includes("missing_height_with_cap_mm")
    ));
  });

  it("distinguishes malformed, non-positive, approximate, and multi-value measurements from missing", () => {
    const invalidValues: unknown[] = ["-44", "about 44", "44 x 50", 0, -44];
    for (const invalidValue of invalidValues) {
      const products = structuredClone(catalog.products);
      const target = buildCylinderPhysicalTypes(products).find((row) => row.heightWithCap != null);
      assert.ok(target);
      for (const product of products) {
        if (physicalTypeKey(product) === target.physicalTypeKey) product.heightWithCap = invalidValue;
      }
      const manifest = buildCylinder75TypeManifest(exactPsdInput(products));
      const row = manifest.coverageRows.find((candidate) => candidate.physicalTypeKey === target.physicalTypeKey);
      assert.equal(row?.measurementStatus, "invalid", String(invalidValue));
      assert.ok(row?.reasons.includes("invalid_height_with_cap_mm"), String(invalidValue));
    }

    const products = structuredClone(catalog.products);
    const target = buildCylinderPhysicalTypes(products).find((row) => row.heightWithCap != null);
    assert.ok(target);
    for (const product of products) {
      if (physicalTypeKey(product) === target.physicalTypeKey) product.heightWithCap = "";
    }
    const manifest = buildCylinder75TypeManifest(exactPsdInput(products));
    const row = manifest.coverageRows.find((candidate) => candidate.physicalTypeKey === target.physicalTypeKey);
    assert.equal(row?.measurementStatus, "missing");
    assert.ok(row?.reasons.includes("missing_height_with_cap_mm"));
  });

  it("accepts only anchored positive catalog measurement formats", () => {
    const validValues: unknown[] = [55, "55", "55 ±1 mm", "127.8", "8 ± 0.1 mm"];
    for (const validValue of validValues) {
      const products = structuredClone(catalog.products);
      const target = buildCylinderPhysicalTypes(products).find((row) =>
        Number(String(row.heightWithCap).match(/\d+(?:\.\d+)?/)?.[0]) >
          Number(String(row.heightWithoutCap).match(/\d+(?:\.\d+)?/)?.[0])
      );
      assert.ok(target);
      const bodyHeight = Number(String(target.heightWithoutCap).match(/\d+(?:\.\d+)?/)?.[0]);
      if (Number(String(validValue).match(/\d+(?:\.\d+)?/)?.[0]) <= bodyHeight) continue;
      for (const product of products) {
        if (physicalTypeKey(product) === target.physicalTypeKey) product.heightWithCap = validValue;
      }
      const manifest = buildCylinder75TypeManifest(exactPsdInput(products));
      const row = manifest.coverageRows.find((candidate) => candidate.physicalTypeKey === target.physicalTypeKey);
      assert.equal(row?.measurementStatus, "confirmed", String(validValue));
    }
  });

  it("rejects fuzzy and sibling PSD references instead of substituting them", () => {
    const input = exactPsdInput();
    const target = buildCylinderPhysicalTypes(catalog.products)[0];
    const coverage = input.psdCoverageRows.find((row) => row.websiteSku === target.websiteSku);
    assert.ok(coverage);
    coverage.allMatchedPsdPaths = `${String(target.websiteSku)}-copy.psd|SiblingSku.psd`;
    input.psdSourceBytesByPath = {
      ...input.psdSourceBytesByPath,
      [path.join(authoritativePsdRoot, `${String(target.websiteSku)}-copy.psd`)]: Buffer.from("fuzzy"),
      [path.join(authoritativePsdRoot, "SiblingSku.psd")]: Buffer.from("sibling"),
    };
    const manifest = buildCylinder75TypeManifest(input);
    const row = manifest.coverageRows.find((candidate) => candidate.websiteSku === target.websiteSku);

    assert.ok(row);
    assert.equal(row.referenceStatus, "rejected-non-exact");
    assert.ok(manifest.blockers.some((blocker) =>
      blocker.websiteSku === target.websiteSku && blocker.reasons.includes("no_exact_reference")
    ));
  });

  it("keeps a declared exact PSD with missing bytes blocked instead of using the catalog image", () => {
    const input = exactPsdInput();
    const target = buildCylinderPhysicalTypes(catalog.products).find((row) => {
      const filename = String(row.imageUrl ?? "").split(/[?#]/, 1)[0].split("/").pop() ?? "";
      return filename.replace(/\.[^.]+$/, "").toLowerCase() === String(row.websiteSku).toLowerCase();
    });
    assert.ok(target);
    const missingPath = path.join(authoritativePsdRoot, `${String(target.websiteSku)}.psd`);
    input.psdSourceBytesByPath = Object.fromEntries(
      Object.entries(input.psdSourceBytesByPath).filter(([sourcePath]) => sourcePath !== missingPath),
    );
    const manifest = buildCylinder75TypeManifest(input);
    const row = manifest.coverageRows.find((candidate) => candidate.physicalTypeKey === target.physicalTypeKey);

    assert.equal(row?.referenceStatus, "missing-source");
    assert.equal(row?.reference, null);
    assert.ok(row?.reasons.includes("exact_psd_source_missing"));
  });

  it("retains exact PSD and exact-SKU catalog provenance", () => {
    const input = exactPsdInput();
    const targets = buildCylinderPhysicalTypes(catalog.products);
    const psdTarget = targets[0];
    const catalogTarget = targets.find((row) => {
      const basename = String(row.imageUrl ?? "").split(/[?#]/, 1)[0].split("/").pop() ?? "";
      return row.websiteSku !== psdTarget.websiteSku &&
        basename.replace(/\.[^.]+$/, "").toLowerCase() === String(row.websiteSku).toLowerCase();
    });
    assert.ok(catalogTarget);
    input.psdCoverageRows = input.psdCoverageRows.filter((row) => row.websiteSku !== catalogTarget.websiteSku);
    const manifest = buildCylinder75TypeManifest(input);
    const psdRow = manifest.coverageRows.find((row) => row.websiteSku === psdTarget.websiteSku);
    const catalogRow = manifest.coverageRows.find((row) => row.websiteSku === catalogTarget.websiteSku);

    assert.equal(psdRow?.referenceStatus, "exact-psd");
    assert.match(psdRow?.reference?.sha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(catalogRow?.referenceStatus, "exact-catalog");
    assert.equal(catalogRow?.reference?.source, "catalog-image-url");
  });

  it("uses website SKU before Grace SKU when joining readiness", () => {
    const input = exactPsdInput();
    const target = buildCylinderPhysicalTypes(catalog.products)[0];
    input.readinessRows = [
      { ...target, websiteSku: "not-the-target", graceSku: target.graceSku },
      { ...target, websiteSku: target.websiteSku, graceSku: "not-the-grace-sku" },
      ...input.readinessRows.filter((row) =>
        row.websiteSku !== target.websiteSku && row.graceSku !== target.graceSku
      ),
    ];
    const manifest = buildCylinder75TypeManifest(input);
    const row = manifest.coverageRows.find((candidate) => candidate.websiteSku === target.websiteSku);

    assert.equal(row?.identityMatch, "websiteSku");
  });

  it("fails closed on conflicting duplicate readiness keys independent of source order", () => {
    const input = exactPsdInput();
    const targets = buildCylinderPhysicalTypes(catalog.products);
    const target = targets.find((candidate) =>
      targets.filter((row) => String(row.websiteSku).toLowerCase() === String(candidate.websiteSku).toLowerCase()).length === 1
    );
    assert.ok(target);
    const base = input.readinessRows.find((row) => row.websiteSku === target.websiteSku);
    assert.ok(base);
    const conflicting = { ...base, applicator: "Conflicting Applicator" };
    const remaining = input.readinessRows.filter((row) =>
      row.websiteSku !== target.websiteSku && row.graceSku !== target.graceSku
    );
    const outcomes = [[base, conflicting], [conflicting, base]].map((duplicates) => {
      const manifest = buildCylinder75TypeManifest({ ...input, readinessRows: [...duplicates, ...remaining] });
      return manifest.coverageRows.find((row) => row.physicalTypeKey === target.physicalTypeKey);
    });

    assert.deepEqual(outcomes.map((row) => row?.identityStatus), ["ambiguous", "ambiguous"]);
    assert.deepEqual(outcomes.map((row) => row?.reasons), [
      ["ambiguous_readiness_website_sku"],
      ["ambiguous_readiness_website_sku"],
    ]);
  });

  it("merges equivalent duplicate evidence but blocks conflicting coverage independent of order", () => {
    const input = exactPsdInput();
    const target = buildCylinderPhysicalTypes(catalog.products).find((row) =>
      input.psdCoverageRows.filter((coverage) => coverage.websiteSku === row.websiteSku).length === 1
    );
    assert.ok(target);
    const readinessRow = input.readinessRows.find((row) => row.websiteSku === target.websiteSku);
    assert.ok(readinessRow);
    const equivalentManifest = buildCylinder75TypeManifest({
      ...input,
      readinessRows: [{ ...readinessRow }, { ...readinessRow }, ...input.readinessRows.filter((row) => row !== readinessRow)],
    });
    assert.equal(
      equivalentManifest.coverageRows.find((row) => row.physicalTypeKey === target.physicalTypeKey)?.identityStatus,
      "confirmed",
    );

    const coverage = input.psdCoverageRows.find((row) => row.websiteSku === target.websiteSku);
    assert.ok(coverage);
    const conflict = { ...coverage, allMatchedPsdPaths: `1. ${String(target.websiteSku)}.psd` };
    const remaining = input.psdCoverageRows.filter((row) => row !== coverage);
    const outcomes = [[coverage, conflict], [conflict, coverage]].map((duplicates) => {
      const manifest = buildCylinder75TypeManifest({ ...input, psdCoverageRows: [...duplicates, ...remaining] });
      return manifest.coverageRows.find((row) => row.physicalTypeKey === target.physicalTypeKey);
    });
    assert.deepEqual(outcomes.map((row) => row?.referenceStatus), ["ambiguous", "ambiguous"]);
    assert.deepEqual(outcomes.map((row) => row?.reasons), [
      ["ambiguous_psd_coverage_website_sku"],
      ["ambiguous_psd_coverage_website_sku"],
    ]);
  });

  it("resolves CLI coverage targets by website before Grace SKU", () => {
    const websiteTarget = { websiteSku: "WebsiteMatch", graceSku: "OTHER" };
    const graceTarget = { websiteSku: "OtherWebsite", graceSku: "GraceMatch" };
    assert.equal(
      resolveCoverageTarget(
        { websiteSku: "WebsiteMatch", graceSku: "GraceMatch" },
        [graceTarget, websiteTarget],
      ),
      websiteTarget,
    );
  });

  it("rejects traversal before filesystem evidence callbacks are touched", () => {
    let existsCalls = 0;
    let readCalls = 0;
    const target = { websiteSku: "GBSKU", graceSku: "GRACE" };
    const result = collectPsdSourceBytes({
      coverageRows: [{ websiteSku: "GBSKU", allMatchedPsdPaths: "../../GBSKU.psd" }],
      targetRows: [target],
      authoritativePsdRoot,
      fileExists: () => { existsCalls += 1; return true; },
      readBytes: () => { readCalls += 1; return Buffer.from("must not read"); },
    });

    assert.deepEqual(result, {});
    assert.equal(existsCalls, 0);
    assert.equal(readCalls, 0);
  });

  it("designates the 227 ml plastic endpoint and supplemental Alu500 outside coverage", () => {
    const manifest = buildCylinder75TypeManifest(exactPsdInput());
    const plasticEndpoint = manifest.coverageRows.find((row) => row.websiteSku === "PbClear8ozFlpWh");

    assert.equal(plasticEndpoint?.capacityMl, 227);
    assert.equal(plasticEndpoint?.material, "plastic");
    assert.equal(manifest.supplementalMasterEndpoint.websiteSku, "Alu500");
    assert.equal(manifest.supplementalMasterEndpoint.capacityMl, 500);
    assert.equal(manifest.supplementalMasterEndpoint.material, "aluminum");
    assert.ok(!manifest.coverageRows.some((row) => row.websiteSku === "Alu500"));
  });

  it("sorts every plate by display scale, capacity, then website SKU", () => {
    const manifest = buildCylinder75TypeManifest(exactPsdInput());
    for (const plateId of Object.keys(manifest.plates)) {
      const rows = manifest.plates[plateId as keyof typeof manifest.plates];
      const sorted = [...rows].sort((left, right) =>
        (left.displayScale?.assembledTargetPct ?? Number.POSITIVE_INFINITY) -
          (right.displayScale?.assembledTargetPct ?? Number.POSITIVE_INFINITY) ||
        left.capacityMl - right.capacityMl ||
        left.websiteSku.localeCompare(right.websiteSku)
      );
      assert.deepEqual(rows.map((row) => row.websiteSku), sorted.map((row) => row.websiteSku));
    }
  });
});
