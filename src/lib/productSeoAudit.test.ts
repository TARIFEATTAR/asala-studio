import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  auditProductSeo,
  hasAwkwardSeoLanguage,
  hasInternalSeoLanguage,
  normalizeProductSeoName,
} from "./productSeoAudit.ts";

describe("product SEO audit", () => {
  it("grades a rich public product record as ready", () => {
    const audit = auditProductSeo({
      name: "100 ml Clear Aluminum Fine Mist Bottle",
      slug: "100ml-clear-aluminum-fine-mist-bottle",
      category: "Aluminum Bottle",
      productType: "Bottle",
      seoTitle: "100 ml Clear Aluminum Fine Mist Bottle | Best Bottles",
      seoDescription:
        "Shop 100 ml clear aluminum bottles with fine mist sprayers for fragrance, beauty, and personal care packaging programs.",
      seoKeywords: ["100 ml aluminum bottle", "fine mist sprayer bottle", "beauty packaging"],
      shortDescription: "Clear 100 ml aluminum bottle with a fine mist sprayer for beauty packaging.",
      longDescription:
        "This 100 ml clear aluminum bottle pairs a lightweight metal body with a fine mist sprayer for fragrance, beauty, and personal care packaging. The record includes product family, capacity, finish, material, and image details so teams can maintain consistent product pages across channels.",
      heroImageUrl: "https://example.com/bottle.png",
      metadata: {
        seo: {
          hero_alt: "100 ml clear aluminum bottle with fine mist sprayer",
          faqs: ["What applicator fits this bottle?"],
          structured_data: { "@type": "Product" },
        },
      },
    });

    assert.equal(audit.isPublicReady, true);
    assert.equal(audit.grade, "A");
    assert.deepEqual(audit.missingFields, []);
  });

  it("flags internal workflow language and thin SEO records", () => {
    const audit = auditProductSeo({
      name: "100 ml Aluminum Bottle Bottle with Cap",
      slug: "100ml-aluminum-bottle",
      seoTitle: "100 ml Aluminum Bottle Bottle with Cap",
      seoDescription: "This Product Hub record centralizes SKU, media, image-generation, Shopify, and Convex sync data.",
      shortDescription: "Internal pipeline copy.",
    });

    assert.equal(audit.isPublicReady, false);
    assert.equal(audit.publicCopyUnsafe, true);
    assert.ok(audit.missingFields.includes("SEO keywords"));
    assert.ok(audit.warnings.includes("Public copy contains internal workflow language"));
    assert.ok(audit.warnings.includes("Public copy contains awkward repeated product nouns"));
  });

  it("normalizes repeated generated product nouns", () => {
    assert.equal(
      normalizeProductSeoName("100 ml Aluminum Bottle Bottle with Cap"),
      "100 ml Aluminum Bottle with Cap",
    );
    assert.equal(hasInternalSeoLanguage("Convex sync data"), true);
    assert.equal(hasAwkwardSeoLanguage("Bottle Bottle"), true);
  });
});
