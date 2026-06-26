import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bestBottlesProductTruthRule,
  buildImageField,
  buildPatchSet,
  buildSelectorParams,
  needsProfileSpecificDestination,
  normalizeDestinationKey,
  selectDestinationConfig,
  validatePlacementRequest,
} from "./sanityPlacement";

describe("sanity placement rules", () => {
  it("normalizes only known placement destinations", () => {
    assert.equal(normalizeDestinationKey("homepage-hero"), "homepage_hero");
    assert.equal(
      normalizeDestinationKey(" product family hero "),
      "product_family_hero",
    );
    assert.equal(normalizeDestinationKey("variant_pdp"), null);
  });

  it("prefers org/profile destination rows before global or generic fallbacks", () => {
    const selected = selectDestinationConfig(
      [
        {
          organization_id: null,
          destination_key: "homepage_hero",
          schema_profile: "generic",
          target_field_path: "heroImage",
        },
        {
          organization_id: null,
          destination_key: "homepage_hero",
          schema_profile: "best_bottles",
          target_field_path: "homeHero",
        },
        {
          organization_id: "org_1",
          destination_key: "homepage_hero",
          schema_profile: "best_bottles",
          target_field_path: "homepage.hero.image",
        },
      ],
      "homepage_hero",
      "best_bottles",
      "org_1",
    );

    assert.equal(selected?.target_field_path, "homepage.hero.image");
  });

  it("blocks non-generic schema profiles from using generic destination rows", () => {
    assert.equal(
      needsProfileSpecificDestination(
        {
          organization_id: null,
          destination_key: "homepage_hero",
          schema_profile: "generic",
        },
        "best_bottles",
      ),
      true,
    );
    assert.equal(
      needsProfileSpecificDestination(
        {
          organization_id: "org_1",
          destination_key: "homepage_hero",
          schema_profile: "best_bottles",
        },
        "best_bottles",
      ),
      false,
    );
  });

  it("defines Best Bottles product-truth metadata gates for product placements", () => {
    assert.deepEqual(bestBottlesProductTruthRule("product_main_image"), {
      requiredKeys: ["websiteSku", "graceSku"],
      skuScoped: true,
      familyScoped: false,
    });
    assert.deepEqual(bestBottlesProductTruthRule("product_family_hero"), {
      requiredKeys: ["familySlug"],
      skuScoped: false,
      familyScoped: true,
    });
    assert.equal(bestBottlesProductTruthRule("blog_post"), null);
  });

  it("requires image URL and destination metadata before publish", () => {
    const result = validatePlacementRequest(
      { imageUrl: "notaurl", metadata: { slug: "home" } },
      {
        destination_key: "homepage_hero",
        requires_image: true,
        required_metadata: ["documentId", "altText"],
      },
    );

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /imageUrl must be an http/);
    assert.match(result.errors.join(" "), /documentId/);
    assert.match(result.errors.join(" "), /altText/);
  });

  it("builds selector params from metadata and destination defaults", () => {
    const params = buildSelectorParams(
      {
        destination_key: "product_family_hero",
        sanity_document_type: "productFamily",
        selector_params: { familySlug: "slug", fixedType: "productFamily" },
      },
      {
        slug: "empire-50ml-clear",
        documentId: "family.empire-50ml-clear",
      },
    );

    assert.deepEqual(params, {
      documentType: "productFamily",
      documentId: "family.empire-50ml-clear",
      slug: "empire-50ml-clear",
      familySlug: "empire-50ml-clear",
      fixedType: "productFamily",
    });
  });

  it("builds a single Sanity image field patch", () => {
    const image = buildImageField("image-abc-1000x1300-png", {
      altText: "Bottle family hero",
      caption: "Approved Madison render",
    });

    assert.deepEqual(image, {
      _type: "image",
      asset: { _type: "reference", _ref: "image-abc-1000x1300-png" },
      alt: "Bottle family hero",
      caption: "Approved Madison render",
    });
    assert.deepEqual(buildPatchSet("heroImage", image), { heroImage: image });
  });
});
