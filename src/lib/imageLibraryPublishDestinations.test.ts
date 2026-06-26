import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDefaultImageLibraryPublishDestination,
  getImageLibraryPublishDestinations,
} from "./imageLibraryPublishDestinations";

describe("Image Library publish destinations", () => {
  it("shows only Shopify-backed Best Bottles destinations for Best Bottles orgs", () => {
    const destinations = getImageLibraryPublishDestinations(true);

    assert.deepEqual(destinations.map((destination) => destination.value), [
      "best-bottles-grid",
      "best-bottles-pdp",
    ]);
    assert.equal(
      destinations.some((destination) => destination.value === "tarife-sanity"),
      false,
    );
  });

  it("keeps the Tarife Sanity destination for non-Best Bottles orgs", () => {
    assert.deepEqual(
      getImageLibraryPublishDestinations(false).map((destination) =>
        destination.value
      ),
      ["tarife-sanity"],
    );
  });

  it("defaults Best Bottles publish to group hero when a product group is known", () => {
    assert.equal(
      getDefaultImageLibraryPublishDestination({
        isBestBottlesOrg: true,
        resolvedGroupSlug: "empire-50ml-clear",
        resolvedWebsiteSku: "GBEmp50RdcrShnGl",
      }),
      "best-bottles-grid",
    );
  });

  it("defaults Best Bottles publish to PDP media when only a variant SKU is known", () => {
    assert.equal(
      getDefaultImageLibraryPublishDestination({
        isBestBottlesOrg: true,
        resolvedGroupSlug: "",
        resolvedWebsiteSku: "GBEmp50RdcrShnGl",
      }),
      "best-bottles-pdp",
    );
  });
});
