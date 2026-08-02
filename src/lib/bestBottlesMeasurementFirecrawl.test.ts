import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendBestBottlesMeasurementOverrides,
  buildFirecrawlMeasurementSourceUrls,
  pickFirecrawlMeasurementCandidate,
  sourceMeasurementRowsWithFirecrawl,
  type BestBottlesMeasurementFirecrawlRow,
} from "./bestBottlesMeasurementFirecrawl.ts";

function row(
  overrides: Partial<BestBottlesMeasurementFirecrawlRow> = {},
): BestBottlesMeasurementFirecrawlRow {
  return {
    graceSku: "GB-BEL-CLR-10ML-SPR-SBLK",
    websiteSku: "GBBell10SpryBlkSh",
    shopifySku: "GB-BEL-CLR-10ML-SPR-SBLK",
    family: "Bell",
    productGroupSlug: "bell-10ml-clear-13-415-finemist",
    productGroupDisplayName: "10 ml Clear Bell Fine Mist Spray Bottle",
    capacityMl: "10",
    color: "Clear",
    applicator: "Fine Mist Sprayer",
    status: "needs-measurement",
    issues: ["missing_measurement"],
    productUrl: "https://www.bestbottles.com/product/bell-design-10-ml-glass-bottle-shiny-black-spray",
    ...overrides,
  };
}

describe("Best Bottles Firecrawl measurement intake", () => {
  it("extracts SKU-backed body height and diameter evidence from a BestBottles scrape", () => {
    const candidate = pickFirecrawlMeasurementCandidate(
      row(),
      {
        markdown: [
          "# Bell design 10 ml glass bottle",
          "SKU: GBBell10SpryBlkSh",
          "Body Height: 55 +/-1 mm",
          "Item Diameter: 27 +/-0.5 mm",
        ].join("\n"),
      },
      "https://www.bestbottles.com/product/bell-design-10-ml-glass-bottle-shiny-black-spray",
    );

    assert.equal(candidate?.graceSku, "GB-BEL-CLR-10ML-SPR-SBLK");
    assert.equal(candidate?.heightWithoutCap, "55");
    assert.equal(candidate?.diameter, "27");
    assert.equal(candidate?.diameterSourceLabel, "Item Diameter");
    assert.equal(candidate?.source, "Firecrawl BestBottles product page");
  });

  it("rejects measurement-looking text without SKU evidence", () => {
    const candidate = pickFirecrawlMeasurementCandidate(
      row(),
      {
        markdown: [
          "# Similar Bell product",
          "Body Height: 55 mm",
          "Item Diameter: 27 mm",
        ].join("\n"),
      },
      "https://www.bestbottles.com/product/similar-bell-product",
    );

    assert.equal(candidate, null);
  });

  it("uses item width as the generation face measurement when diameter is absent", () => {
    const candidate = pickFirecrawlMeasurementCandidate(
      row({ family: "Rectangle", websiteSku: "GBRect10Gold" }),
      {
        markdown: [
          "Website SKU GBRect10Gold",
          "Height Without Cap: 74 mm",
          "Item Width: 22 mm",
        ].join("\n"),
      },
      "https://www.bestbottles.com/product/tall-rectangular-design-10-ml-glass-bottle",
    );

    assert.equal(candidate?.heightWithoutCap, "74");
    assert.equal(candidate?.diameter, "22");
    assert.equal(candidate?.diameterSourceLabel, "Item Width");
  });

  it("prefers exact product URLs before SKU search fallback URLs", () => {
    const urls = buildFirecrawlMeasurementSourceUrls(row());

    assert.deepEqual(urls.slice(0, 3), [
      "https://www.bestbottles.com/product/bell-design-10-ml-glass-bottle-shiny-black-spray",
      "https://www.bestbottles.com/search?q=GBBell10SpryBlkSh",
      "https://www.bestbottles.com/search?q=GB-BEL-CLR-10ML-SPR-SBLK",
    ]);
  });

  it("upserts Firecrawl candidates into measurement override payloads by Grace SKU", () => {
    const payload = appendBestBottlesMeasurementOverrides(
      {
        notes: "Existing measurement notes",
        overrides: [
          {
            graceSku: "GB-OLD",
            heightWithoutCap: "10",
            diameter: "5",
            source: "Manual",
            sourceUrl: null,
            note: "Keep me.",
          },
          {
            graceSku: "GB-BEL-CLR-10ML-SPR-SBLK",
            heightWithoutCap: "50",
            diameter: null,
            source: "Old partial row",
            sourceUrl: null,
            note: "Replace me.",
          },
        ],
      },
      [
        {
          graceSku: "GB-BEL-CLR-10ML-SPR-SBLK",
          websiteSku: "GBBell10SpryBlkSh",
          family: "Bell",
          productGroupSlug: "bell-10ml-clear-13-415-finemist",
          heightWithoutCap: "55",
          diameter: "27",
          diameterSourceLabel: "Item Diameter",
          source: "Firecrawl BestBottles product page",
          sourceUrl: "https://www.bestbottles.com/product/bell-design-10-ml-glass-bottle-shiny-black-spray",
          note: "Firecrawl scrape found SKU evidence plus 55 mm body height and Item Diameter 27 mm.",
        },
      ],
    );

    assert.equal(payload.overrides.length, 2);
    assert.equal(payload.overrides[0].graceSku, "GB-OLD");
    assert.equal(payload.overrides[1].heightWithoutCap, "55");
    assert.equal(payload.overrides[1].diameter, "27");
    assert.match(payload.overrides[1].note, /Firecrawl scrape found SKU evidence/);
  });

  it("sources missing measurement rows through Firecrawl scrape pages", async () => {
    const result = await sourceMeasurementRowsWithFirecrawl([row()], {
      scrapePage: async () => ({
        markdown: [
          "SKU: GBBell10SpryBlkSh",
          "Body Height: 55 mm",
          "Item Diameter: 27 mm",
        ].join("\n"),
      }),
    });

    assert.equal(result.summary.targeted, 1);
    assert.equal(result.summary.attempted, 1);
    assert.equal(result.summary.sourced, 1);
    assert.equal(result.candidates[0].graceSku, "GB-BEL-CLR-10ML-SPR-SBLK");
  });

  it("does not scrape when no Firecrawl key or injected scraper is available", async () => {
    const originalKey = process.env.FIRECRAWL_API_KEY;
    const originalLegacyKey = process.env.FIRECRAWL_KEY;
    delete process.env.FIRECRAWL_API_KEY;
    delete process.env.FIRECRAWL_KEY;
    try {
      const result = await sourceMeasurementRowsWithFirecrawl([row()]);

      assert.equal(result.summary.targeted, 1);
      assert.equal(result.summary.attempted, 0);
      assert.equal(result.summary.sourced, 0);
      assert.equal(result.summary.skippedNoApiKey, true);
      assert.deepEqual(result.candidates, []);
    } finally {
      if (originalKey == null) delete process.env.FIRECRAWL_API_KEY;
      else process.env.FIRECRAWL_API_KEY = originalKey;
      if (originalLegacyKey == null) delete process.env.FIRECRAWL_KEY;
      else process.env.FIRECRAWL_KEY = originalLegacyKey;
    }
  });

  it("does not treat component exceptions with blank dimensions as measurement blockers", async () => {
    let scrapeCount = 0;
    const result = await sourceMeasurementRowsWithFirecrawl(
      [
        row({
          status: "component-exception",
          issues: ["component_exception"],
          heightWithoutCap: null,
          diameter: null,
        }),
      ],
      {
        scrapePage: async () => {
          scrapeCount += 1;
          return {
            markdown: "SKU: GBBell10SpryBlkSh Body Height: 55 mm Item Diameter: 27 mm",
          };
        },
      },
    );

    assert.equal(result.summary.targeted, 0);
    assert.equal(scrapeCount, 0);
  });
});
