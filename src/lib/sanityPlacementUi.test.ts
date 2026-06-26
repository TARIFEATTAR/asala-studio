import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSanityPlacementMetadata,
  getDefaultSanityPlacementDestination,
  getSanityPlacementDestination,
  SANITY_PLACEMENT_DESTINATIONS,
  validateSanityPlacementForm,
} from "./sanityPlacementUi";

describe("Sanity placement UI rules", () => {
  it("exposes the media destinations supported by the placement edge function", () => {
    assert.deepEqual(
      SANITY_PLACEMENT_DESTINATIONS.map((destination) => destination.key),
      [
        "homepage_hero",
        "blog_post",
        "product_family_hero",
        "product_main_image",
        "paper_doll_component",
      ],
    );
    assert.equal(
      getSanityPlacementDestination("product_family_hero")?.label,
      "Product family hero",
    );
  });

  it("defaults family-tagged Best Bottles media to product family hero", () => {
    assert.equal(
      getDefaultSanityPlacementDestination({
        familySlug: "sleek-5ml-clear-13-415-rollon",
      }),
      "product_family_hero",
    );
  });

  it("requires document ID and alt text for all placements", () => {
    const result = validateSanityPlacementForm({
      destinationKey: "homepage_hero",
      documentId: "",
      altText: "",
      isBestBottlesOrg: true,
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /Sanity document ID/);
    assert.match(result.errors.join(" "), /Alt text/);
  });

  it("requires family and role metadata where placement fields need them", () => {
    const family = validateSanityPlacementForm({
      destinationKey: "product_family_hero",
      documentId: "productFamily.sleek",
      altText: "Sleek family hero",
      familySlug: "",
      isBestBottlesOrg: true,
    });
    const component = validateSanityPlacementForm({
      destinationKey: "paper_doll_component",
      documentId: "paperDoll.sleek.top",
      altText: "Sleek cap component",
      familySlug: "sleek-5ml-clear-13-415-rollon",
      role: "",
      isBestBottlesOrg: true,
    });

    assert.equal(family.ok, false);
    assert.match(family.errors.join(" "), /Family slug/);
    assert.equal(component.ok, false);
    assert.match(component.errors.join(" "), /Component role/);
  });

  it("requires Best Bottles SKU truth for product main image placement", () => {
    const result = validateSanityPlacementForm({
      destinationKey: "product_main_image",
      documentId: "product.gb09",
      altText: "9 ml vial PDP image",
      websiteSku: "GB09BlackCapApp",
      graceSku: "",
      isBestBottlesOrg: true,
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /Grace SKU/);
  });

  it("builds trimmed Sanity placement metadata", () => {
    assert.deepEqual(
      buildSanityPlacementMetadata({
        destinationKey: "paper_doll_component",
        documentId: " paperDoll.sleek.top ",
        altText: " Sleek cap ",
        caption: " Component media ",
        familySlug: " sleek-5ml-clear-13-415-rollon ",
        role: " top ",
        websiteSku: " ",
        graceSku: " GB-SLK-CLR-5ML-TOP ",
      }),
      {
        documentId: "paperDoll.sleek.top",
        altText: "Sleek cap",
        caption: "Component media",
        familySlug: "sleek-5ml-clear-13-415-rollon",
        role: "top",
        graceSku: "GB-SLK-CLR-5ML-TOP",
      },
    );
  });
});
