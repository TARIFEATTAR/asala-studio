import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getBestBottlesCylinderProductTruthReferenceIssue,
  isRetiredTransparentBestBottlesReferenceCandidate,
  isRetiredTransparentBestBottlesReferenceUrl,
} from "./bestBottlesReferenceFilters";
import { resolveDarkroomProductReferenceImage } from "./darkroomProductReference";

describe("isRetiredTransparentBestBottlesReferenceUrl", () => {
  it("blocks retired Cylinder clean reference paths", () => {
    assert.equal(
      isRetiredTransparentBestBottlesReferenceUrl(
        "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/reference-images/best-bottles/clean-references/cylinder/GB-SPR-CLR-3ML-BLK.png",
      ),
      true,
    );
  });

  it("blocks paper-doll and mask-control paths", () => {
    assert.equal(
      isRetiredTransparentBestBottlesReferenceUrl(
        "https://example.com/generated-images/org/user/best-bottles/mask-control/Cylinder/GB-SPR-CLR-3ML-BLK.png",
      ),
      true,
    );
    assert.equal(
      isRetiredTransparentBestBottlesReferenceUrl(
        "https://example.com/generated-images/org/user/paper-doll/master_rigged.png",
      ),
      true,
    );
  });

  it("ignores an empty optional mask-reference placeholder", () => {
    assert.equal(
      isRetiredTransparentBestBottlesReferenceCandidate([
        {
          url: "https://example.com/generated-images/org/reference.png",
          role: "product-reference",
        },
        {
          url: "",
          role: "mask-reference",
        },
      ]),
      false,
    );
  });

  it("allows flattened reference imports", () => {
    assert.equal(
      isRetiredTransparentBestBottlesReferenceUrl(
        "https://example.com/generated-images/org/user/best-bottles/reference-imports/Cylinder/GB-SPR-CLR-3ML-BLK.png",
      ),
      false,
    );
  });

  it("blocks retired transparent/background-removed local paths before upload", () => {
    assert.equal(
      isRetiredTransparentBestBottlesReferenceCandidate([
        "/Users/jordanrichter/Projects/Best Bottles Reference Images Clean/Cylinder/background-removed/GB-SPR-CLR-3ML-BLK.png",
        "GB-SPR-CLR-3ML-BLK.png",
      ]),
      true,
    );
  });

  it("blocks retired transparent/background-removed filenames even when URL looks allowed", () => {
    assert.equal(
      isRetiredTransparentBestBottlesReferenceCandidate([
        "https://example.com/generated-images/org/user/best-bottles/reference-imports/Cylinder/GB-SPR-CLR-3ML-BLK.png",
        "GB-SPR-CLR-3ML-BLK__background-removed.png",
      ]),
      true,
    );
  });

  it("blocks retired transparent/background-removed metadata even when URL looks allowed", () => {
    assert.equal(
      isRetiredTransparentBestBottlesReferenceCandidate([
        {
          url: "https://example.com/generated-images/org/user/best-bottles/reference-imports/Cylinder/GB-SPR-CLR-3ML-BLK.png",
          name: "GB-SPR-CLR-3ML-BLK.png",
          libraryTags: [
            "role:product-reference",
            "mask-ref:transparent-png",
          ],
          storagePath:
            "org/user/best-bottles/reference-imports/background-removed/Cylinder/GB-SPR-CLR-3ML-BLK.png",
        },
      ]),
      true,
    );
  });

  it("allows flattened source-background product truth metadata", () => {
    assert.equal(
      isRetiredTransparentBestBottlesReferenceCandidate([
        {
          url: "https://example.com/generated-images/org/user/best-bottles/reference-imports/Cylinder/GB-SPR-CLR-3ML-BLK.png",
          name: "GB-SPR-CLR-3ML-BLK-source-background.png",
          libraryTags: [
            "role:product-reference",
            "source:reference-import",
            "truth-ref:flattened-png",
            "reference-lineage:flattened-single-source",
          ],
          sessionName: "Cylinder flattened product truth",
        },
      ]),
      false,
    );
  });

  it("allows valid flattened Cylinder persisted references to auto-associate by SKU", () => {
    assert.equal(
      getBestBottlesCylinderProductTruthReferenceIssue([
        {
          url: "https://example.com/generated-images/org/user/best-bottles/reference-imports/Cylinder/GB-CYL-CLR-9ML-SPR-MSLV-01.png",
          name: "GB-CYL-CLR-9ML-SPR-MSLV-01.png",
          libraryTags: [
            "role:product-reference",
            "source:reference-import",
            "truth-ref:flattened-png",
          ],
        },
      ]),
      null,
    );
  });

  it("blocks retired Cylinder persisted references from auto-association by SKU", () => {
    const issue = getBestBottlesCylinderProductTruthReferenceIssue([
        {
          url: "https://example.com/generated-images/org/user/best-bottles/reference-imports/background-removed/Cylinder/GB-CYL-CLR-9ML-SPR-MSLV-01.png",
          name: "GB-CYL-CLR-9ML-SPR-MSLV-01.png",
          libraryTags: ["role:product-reference", "mask-ref:transparent-png"],
        },
      ]) ?? "";
    assert.match(issue, /retired.*lineage/i);
    assert.match(issue, /does not prove.*pixels.*transparent/i);
  });
});

describe("resolveDarkroomProductReferenceImage", () => {
  it("does not use a retired transparent Product Hub hero image as the product truth reference", async () => {
    const result = await resolveDarkroomProductReferenceImage(
      {
        name: "3 ml Clear Cylinder Fine Mist Spray Bottle",
        hero_image_url:
          "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/reference-images/best-bottles/clean-references/cylinder/GB-SPR-CLR-3ML-BLK.png",
        metadata: {},
      } as Parameters<typeof resolveDarkroomProductReferenceImage>[0],
      null,
    );

    assert.equal(result, null);
  });

  it("allows a flattened Product Hub hero image when product truth mentions a transparent cap", async () => {
    const url =
      "https://example.com/generated-images/org/user/best-bottles/reference-imports/Cylinder/GB-CYL-CLR-9ML-SPR-MSLV-01.png";
    const result = await resolveDarkroomProductReferenceImage(
      {
        name: "9 ml Swirl Cylinder Fine Mist Spray Bottle",
        hero_image_url: url,
        short_description: "Swirl cylinder bottle with a transparent cap beside the bottle.",
        metadata: {
          best_bottles: {
            graceSku: "GB-CYL-CLR-9ML-SPR-MSLV-01",
            family: "Cylinder",
            capColor: "Transparent",
            referenceLineage: "flattened-single-source",
          },
        },
      } as Parameters<typeof resolveDarkroomProductReferenceImage>[0],
      null,
    );

    assert.equal(result?.url, url);
    assert.equal(result?.source, "product-hub");
  });
});
