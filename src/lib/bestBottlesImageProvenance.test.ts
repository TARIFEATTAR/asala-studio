import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getBestBottlesImageProvenance } from "./bestBottlesImageProvenance";

describe("Best Bottles image provenance", () => {
  it("classifies keeper backfill rows as non-regenerated reference imports", () => {
    const provenance = getBestBottlesImageProvenance({
      imageUrl:
        "https://example.supabase.co/storage/v1/object/public/generated-images/org/user/best-bottles/keeper-backfill/GB-CYL.png",
      sessionName: "Best Bottles keeper-backfill-2026-06-12",
      goalType: "product_photography",
      libraryTags: ["best-bottles", "keeper-backfill-2026-06-12", "Cylinder"],
      brandContextUsed: { source: "keeper-backfill" },
      finalPrompt: "Keeper backfill - live on-brand image cataloged into Madison library.",
    });

    assert.equal(provenance.kind, "keeper-backfill");
    assert.equal(provenance.isRegeneratedOutput, false);
    assert.equal(provenance.isReferenceLike, true);
  });

  it("classifies local generation imports as regenerated outputs", () => {
    const provenance = getBestBottlesImageProvenance({
      sessionName: "Best Bottles smoke-fresh-2026-06-13",
      goalType: "product_photography",
      libraryTags: ["best-bottles", "local-generation", "cap-on", "frame-pass"],
      brandContextUsed: { source: "local-generate.ts" },
      finalPrompt: "Imported from Madison local Best Bottles generation batch.",
    });

    assert.equal(provenance.kind, "generated-output");
    assert.equal(provenance.isRegeneratedOutput, true);
    assert.equal(provenance.isReferenceLike, false);
  });

  it("classifies studio master outputs as regenerated outputs", () => {
    const provenance = getBestBottlesImageProvenance({
      sessionName: "30 ml Green Apothecary Applicator Bottle",
      goalType: "product_photography",
      libraryTags: [
        "sku-preset",
        "preset:grid-card-2000x2200",
        "brand:best-bottles",
        "studio-master",
        "sku:GB-APT-GRN-30ML-GRN-T",
      ],
    });

    assert.equal(provenance.kind, "generated-output");
    assert.equal(provenance.isRegeneratedOutput, true);
  });

  it("classifies reference-import storage paths as reference-like", () => {
    const provenance = getBestBottlesImageProvenance({
      imageUrl:
        "https://example.supabase.co/storage/v1/object/public/generated-images/org/user/best-bottles/reference-imports/Diva/GB-DVA.png",
      sessionName: "Best Bottles reference import",
      goalType: "product_photography",
      libraryTags: ["best-bottles", "Diva"],
    });

    assert.equal(provenance.kind, "reference-import");
    assert.equal(provenance.isRegeneratedOutput, false);
    assert.equal(provenance.isReferenceLike, true);
  });
});
