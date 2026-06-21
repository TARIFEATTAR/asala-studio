import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildReferenceIntakeUpdatePayload,
  buildRowsFromCliInputs,
  buildReferenceIntakePlan,
  defaultReferenceLocalRoots,
  deriveReferenceCoverageStatus,
  isMissingReferenceMetadataColumn,
  selectReferenceIntakeApplyRows,
  sourceForPath,
  sourceReferenceRowsWithFirecrawl,
  summarizeReferenceIntake,
  type ReferenceIntakeSkuRow,
} from "./bestBottlesReferenceIntake.ts";

function sku(overrides: Partial<ReferenceIntakeSkuRow>): ReferenceIntakeSkuRow {
  return {
    graceSku: "GB-BSR-CLR-30ML-BLK-S",
    websiteSku: "GBBstn1ozBlkCapSht",
    shopifySku: null,
    family: "Boston Round",
    productGroupSlug: "boston-round-30-clear-screw-cap",
    productGroupDisplayName: "Boston Round 30 ml",
    status: "needs-reference",
    hasReference: false,
    bestReferenceCandidatePath: null,
    coverageStatus: "missing_local_reference_image",
    liveReferenceUrl: null,
    ...overrides,
  };
}

describe("Best Bottles clean-lane cutover (coverage derivation + classification)", () => {
  it("classifies the clean reference lane as canonical-render and everything else as local-legacy", () => {
    assert.equal(
      sourceForPath(
        "/x/pipeline/best-bottles-reference-images-clean/01-transparent-png-candidates/_dryrun-2026-06-21/GB-CYL-CLR-50ML-RDC-WHT.png",
      ),
      "canonical-render",
    );
    assert.equal(
      sourceForPath("/x/pipeline/madison-hero-sync/renders/GB-CYL-CLR-50ML-RDC-WHT.png"),
      "local-legacy",
    );
    assert.equal(
      sourceForPath("/x/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/foo.png"),
      "local-legacy",
    );
  });

  it("flips coverage to covered_canonical only on a clean canonical match, else preserves state", () => {
    assert.equal(deriveReferenceCoverageStatus("canonical-render", "covered_needs_canonical_copy"), "covered_canonical");
    assert.equal(deriveReferenceCoverageStatus("canonical-render", "missing_local_reference_image"), "covered_canonical");
    // a legacy/opaque match keeps "needs canonical copy"; never auto-promoted
    assert.equal(deriveReferenceCoverageStatus("local-legacy", "covered_needs_canonical_copy"), "covered_needs_canonical_copy");
    // website-only / no match preserve the incoming state (no demotion either)
    assert.equal(deriveReferenceCoverageStatus("bestbottles-live", "missing_local_reference_image"), "missing_local_reference_image");
    assert.equal(deriveReferenceCoverageStatus("none", "covered_needs_canonical_copy"), "covered_needs_canonical_copy");
    assert.equal(deriveReferenceCoverageStatus(null, null), null);
  });
});

describe("Best Bottles reference intake planner", () => {
  it("includes flattened Best Bottles repo references in the default local roots", () => {
    assert(
      defaultReferenceLocalRoots().some((root) =>
        root.endsWith("pipeline/aios-shopify-pdp-images/00-input/reference-flattened"),
      ),
      "default local roots should include reference-flattened product/component references",
    );
  });

  it("matches missing-reference SKUs to local legacy files by Grace SKU before website SKU", () => {
    const root = mkdtempSync(join(tmpdir(), "bb-ref-intake-"));
    mkdirSync(join(root, "legacy-products", "images"), { recursive: true });
    mkdirSync(join(root, "boston-round", "madison-upload-website-sku-png"), { recursive: true });
    const weakerWebsiteMatch = join(
      root,
      "legacy-products",
      "images",
      "SOME-OTHER-GRACE__GBBstn1ozBlkCapSht__legacy-reference__v001.gif",
    );
    const strongerGraceMatch = join(
      root,
      "boston-round",
      "madison-upload-website-sku-png",
      "GBBstn1ozBlkCapSht__GB-BSR-CLR-30ML-BLK-S__legacy-reference__v001.png",
    );
    writeFileSync(weakerWebsiteMatch, "gif");
    writeFileSync(strongerGraceMatch, "png");

    const plan = buildReferenceIntakePlan({
      rows: [sku({})],
      localRoots: [root],
    });

    assert.equal(plan.rows.length, 1);
    assert.equal(plan.rows[0].referenceSource, "local-legacy");
    assert.equal(plan.rows[0].matchKind, "grace-sku");
    assert.equal(plan.rows[0].referenceSourcePath, strongerGraceMatch);
    assert.equal(plan.rows[0].referenceIssue, null);
  });

  it("flags GIF local matches for conversion/import instead of treating them as generation-ready", () => {
    const root = mkdtempSync(join(tmpdir(), "bb-ref-intake-"));
    mkdirSync(join(root, "legacy-products", "images"), { recursive: true });
    const gif = join(
      root,
      "legacy-products",
      "images",
      "GB-BSR-CLR-30ML-BLK-S__GBBstn1ozBlkCapSht__legacy-reference__v001.gif",
    );
    writeFileSync(gif, "gif");

    const plan = buildReferenceIntakePlan({
      rows: [sku({})],
      localRoots: [root],
    });

    assert.equal(plan.rows[0].referenceSource, "local-legacy");
    assert.equal(plan.rows[0].referenceSourcePath, gif);
    assert.match(plan.rows[0].referenceIssue ?? "", /unsupported/i);
    assert.equal(plan.rows[0].nextAction, "import-local-reference");
  });

  it("flips a clean-lane canonical match to covered_canonical and keeps it pending import", () => {
    const root = mkdtempSync(join(tmpdir(), "bb-ref-intake-"));
    const renderPath = join(
      root,
      "pipeline",
      "best-bottles-reference-images-clean",
      "01-transparent-png-candidates",
      "_dryrun-2026-06-21",
      "apothecary",
      "apothecary-30ml-glass-stopper",
      "cap-on",
      "GB-APT-GRN-30ML-GRN-T.png",
    );
    mkdirSync(join(renderPath, ".."), { recursive: true });
    writeFileSync(renderPath, "png");

    const plan = buildReferenceIntakePlan({
      rows: [
        sku({
          graceSku: "GB-APT-GRN-30ML-GRN-T",
          websiteSku: "GB1ozApthGreen",
          family: "Apothecary",
          productGroupSlug: "apothecary-30ml-green-Ground-glassapplicator",
          productGroupDisplayName: "30 ml Green Apothecary Applicator Bottle",
          status: "ready-to-generate",
          hasReference: true,
          bestReferenceCandidatePath:
            "pipeline/best-bottles-reference-images-clean/01-transparent-png-candidates/_dryrun-2026-06-21/apothecary/apothecary-30ml-glass-stopper/cap-on/GB-APT-GRN-30ML-GRN-T.png",
          coverageStatus: "covered_needs_canonical_copy",
        }),
      ],
      localRoots: [root],
    });

    assert.equal(plan.rows.length, 1);
    assert.equal(plan.rows[0].referenceSource, "canonical-render");
    assert.equal(plan.rows[0].referenceSourcePath, renderPath);
    // The cutover: a matched clean canonical reference promotes coverage.
    assert.equal(plan.rows[0].coverageStatus, "covered_canonical");
    assert.equal(plan.rows[0].nextAction, "import-local-reference");
  });

  it("excludes _quarantine / _qa-checker / _manifests scratch dirs from the reference scan", () => {
    const root = mkdtempSync(join(tmpdir(), "bb-ref-intake-"));
    const quarantined = join(
      root,
      "pipeline",
      "best-bottles-reference-images-clean",
      "01-transparent-png-candidates",
      "_quarantine",
      "GB-APT-GRN-30ML-GRN-T.png",
    );
    mkdirSync(join(quarantined, ".."), { recursive: true });
    writeFileSync(quarantined, "png");

    const plan = buildReferenceIntakePlan({
      rows: [
        sku({
          graceSku: "GB-APT-GRN-30ML-GRN-T",
          family: "Apothecary",
          status: "ready-to-generate",
          coverageStatus: "covered_needs_canonical_copy",
        }),
      ],
      localRoots: [root],
    });

    // The quarantined (rejected) cutout must NOT bind or promote coverage.
    assert.equal(plan.rows[0].referenceSource, "none");
    assert.equal(plan.rows[0].coverageStatus, "covered_needs_canonical_copy");
  });

  it("uses live bestbottles.com URLs as source candidates when local files are absent", () => {
    const plan = buildReferenceIntakePlan({
      rows: [
        sku({
          liveReferenceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBBstn1ozBlkCapSht.gif",
        }),
      ],
      localRoots: [],
    });

    assert.equal(plan.rows[0].referenceSource, "bestbottles-live");
    assert.equal(
      plan.rows[0].referenceSourceUrl,
      "https://www.bestbottles.com/images/store/enlarged_pics/GBBstn1ozBlkCapSht.gif",
    );
    assert.equal(plan.rows[0].nextAction, "source-website-reference");
  });

  it("summarizes local, live, unresolved, and duplicate candidates", () => {
    const root = mkdtempSync(join(tmpdir(), "bb-ref-intake-"));
    writeFileSync(join(root, "GB-ONE__OneWeb__legacy-reference__v001.png"), "png");
    writeFileSync(join(root, "GB-ONE__OneWeb__legacy-reference__v002.png"), "png");

    const plan = buildReferenceIntakePlan({
      rows: [
        sku({ graceSku: "GB-ONE", websiteSku: "OneWeb" }),
        sku({ graceSku: "GB-TWO", websiteSku: "TwoWeb", liveReferenceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/TwoWeb.gif" }),
        sku({ graceSku: "GB-THREE", websiteSku: "ThreeWeb" }),
      ],
      localRoots: [root],
    });
    const summary = summarizeReferenceIntake(plan.rows);

    assert.equal(summary.totalRows, 3);
    assert.equal(summary.localMatches, 1);
    assert.equal(summary.liveSiteCandidates, 1);
    assert.equal(summary.unresolved, 1);
    assert.equal(summary.duplicateCandidates, 1);
  });
});

describe("Best Bottles reference intake apply selection", () => {
  it("targets selected local and website fallback SKUs together", () => {
    const root = mkdtempSync(join(tmpdir(), "bb-ref-intake-"));
    writeFileSync(join(root, "GB-LOCAL__LocalWeb__legacy-reference__v001.png"), "png");
    const plan = buildReferenceIntakePlan({
      rows: [
        sku({ graceSku: "GB-LOCAL", websiteSku: "LocalWeb" }),
        sku({
          graceSku: "GB-WEBSITE",
          websiteSku: "WebsiteWeb",
          liveReferenceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/WebsiteWeb.gif",
        }),
        sku({ graceSku: "GB-OTHER", websiteSku: "OtherWeb" }),
      ],
      localRoots: [root],
    });

    const rows = selectReferenceIntakeApplyRows(plan.rows, {
      skus: ["GB-LOCAL", "WebsiteWeb"],
      limit: 100,
    });

    assert.deepEqual(rows.map((row) => row.graceSku), ["GB-LOCAL", "GB-WEBSITE"]);
    assert.equal(rows[0].nextAction, "import-local-reference");
    assert.equal(rows[1].nextAction, "source-website-reference");
  });

  it("builds a mixed smoke sample with local and website fallback rows", () => {
    const root = mkdtempSync(join(tmpdir(), "bb-ref-intake-"));
    writeFileSync(join(root, "GB-LOCAL-ONE__LocalOne__legacy-reference__v001.png"), "png");
    writeFileSync(join(root, "GB-LOCAL-TWO__LocalTwo__legacy-reference__v001.png"), "png");
    const plan = buildReferenceIntakePlan({
      rows: [
        sku({ graceSku: "GB-LOCAL-ONE", websiteSku: "LocalOne" }),
        sku({ graceSku: "GB-LOCAL-TWO", websiteSku: "LocalTwo" }),
        sku({
          graceSku: "GB-WEBSITE-ONE",
          websiteSku: "WebsiteOne",
          liveReferenceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/WebsiteOne.gif",
        }),
        sku({
          graceSku: "GB-WEBSITE-TWO",
          websiteSku: "WebsiteTwo",
          liveReferenceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/WebsiteTwo.gif",
        }),
      ],
      localRoots: [root],
    });

    const rows = selectReferenceIntakeApplyRows(plan.rows, {
      sampleLocal: 1,
      sampleWebsite: 1,
      limit: 100,
    });

    assert.deepEqual(rows.map((row) => row.graceSku), ["GB-LOCAL-ONE", "GB-WEBSITE-ONE"]);
  });
});

describe("Best Bottles website fallback sourcing", () => {
  it("uses catalog bestbottles.com image URLs when no local reference is available", () => {
    const root = mkdtempSync(join(tmpdir(), "bb-ref-intake-cli-"));
    const readinessPath = join(root, "readiness.json");
    const pipelinePath = join(root, "pipeline.json");
    const catalogPath = join(root, "catalog.json");

    writeFileSync(
      readinessPath,
      JSON.stringify({
        rows: [
          {
            status: "needs-reference",
            graceSku: "AB-ALU-CLR-100ML-SPR-BLK",
            websiteSku: "Alu100mlSprayBlack",
            productGroupSlug: "aluminum-bottle-100ml-mixed-20-410",
            productGroupDisplayName: "100 ml Aluminum Bottle",
            family: "Aluminum Bottle",
            hasReference: false,
            bestReferenceCandidatePath: "",
            coverageStatus: "missing_local_reference_image",
          },
        ],
      }),
    );
    writeFileSync(
      pipelinePath,
      JSON.stringify({
        products: [
          {
            graceSku: "AB-ALU-CLR-100ML-SPR-BLK",
            websiteSku: "Alu100mlSprayBlack",
            shopifySku: "AB-ALU-CLR-100ML-SPR-BLK",
          },
        ],
      }),
    );
    writeFileSync(
      catalogPath,
      JSON.stringify({
        products: [
          {
            graceSku: "AB-ALU-CLR-100ML-SPR-BLK",
            websiteSku: "Alu100mlSprayBlack",
            imageUrl: "https://www.bestbottles.com/images/store/enlarged_pics/Alu100mlSprayBlack.gif",
          },
        ],
      }),
    );

    const rows = buildRowsFromCliInputs({
      readinessPath,
      pipelinePath,
      liveAuditPath: null,
      catalogPath,
    });
    const plan = buildReferenceIntakePlan({ rows, localRoots: [] });

    assert.equal(
      plan.rows[0].referenceSourceUrl,
      "https://www.bestbottles.com/images/store/enlarged_pics/Alu100mlSprayBlack.gif",
    );
    assert.equal(plan.rows[0].nextAction, "source-website-reference");
  });
});

describe("Best Bottles Firecrawl reference fallback", () => {
  it("promotes unresolved source-match rows when Firecrawl finds SKU-backed bestbottles.com image evidence", async () => {
    const result = await sourceReferenceRowsWithFirecrawl(
      [
        sku({
          graceSku: "GB-SOURCE-MATCH",
          websiteSku: "SourceMatchWeb",
          productUrl: "https://www.bestbottles.com/product/source-match-web",
        }),
      ],
      {
        scrapePage: async () => ({
          markdown:
            "Product page for SourceMatchWeb\n\n![SourceMatchWeb](https://www.bestbottles.com/images/store/enlarged_pics/SourceMatchWeb.gif)",
        }),
      },
    );

    const plan = buildReferenceIntakePlan({ rows: result.rows, localRoots: [] });

    assert.equal(result.summary.sourced, 1);
    assert.equal(
      plan.rows[0].referenceSourceUrl,
      "https://www.bestbottles.com/images/store/enlarged_pics/SourceMatchWeb.gif",
    );
    assert.equal(plan.rows[0].nextAction, "source-website-reference");
  });

  it("keeps Firecrawl image candidates unresolved when the scrape has no SKU evidence", async () => {
    const result = await sourceReferenceRowsWithFirecrawl(
      [
        sku({
          graceSku: "GB-SOURCE-MATCH",
          websiteSku: "SourceMatchWeb",
          productUrl: "https://www.bestbottles.com/product/source-match-web",
        }),
      ],
      {
        scrapePage: async () => ({
          markdown:
            "A visually similar bottle\n\n![Bottle](https://www.bestbottles.com/images/store/enlarged_pics/SomeOtherBottle.gif)",
        }),
      },
    );

    const plan = buildReferenceIntakePlan({ rows: result.rows, localRoots: [] });

    assert.equal(result.summary.sourced, 0);
    assert.equal(plan.rows[0].referenceSource, "none");
    assert.equal(plan.rows[0].nextAction, "needs-source-match");
  });

  it("can restrict Firecrawl fallback to explicit unresolved SKU keys", async () => {
    const result = await sourceReferenceRowsWithFirecrawl(
      [
        sku({
          graceSku: "GB-TARGET",
          websiteSku: "TargetWeb",
          productUrl: "https://www.bestbottles.com/product/target-web",
        }),
        sku({
          graceSku: "GB-SKIP",
          websiteSku: "SkipWeb",
          productUrl: "https://www.bestbottles.com/product/skip-web",
        }),
      ],
      {
        skuKeys: ["GB-TARGET"],
        scrapePage: async (_url, row) => ({
          markdown: `${row.websiteSku}\nhttps://www.bestbottles.com/images/store/enlarged_pics/${row.websiteSku}.gif`,
        }),
      },
    );

    assert.equal(result.summary.targeted, 1);
    assert.equal(result.summary.sourced, 1);
    assert.equal(result.rows[0].liveReferenceUrl, "https://www.bestbottles.com/images/store/enlarged_pics/TargetWeb.gif");
    assert.equal(result.rows[1].liveReferenceUrl, null);
  });
});

describe("Best Bottles reference intake database update payload", () => {
  it("recognizes PostgREST schema cache errors for missing reference metadata columns", () => {
    assert.equal(
      isMissingReferenceMetadataColumn({
        code: "PGRST204",
        message: "Could not find the 'reference_imported_at' column of 'best_bottles_pipeline_sku_jobs' in the schema cache",
      }),
      true,
    );
  });

  it("can omit reference metadata columns for live databases that have not migrated yet", () => {
    const row = {
      ...sku({
        graceSku: "AB-ALU-CLR-100ML-SPR-BLK",
        websiteSku: "Alu100mlSprayBlack",
        liveReferenceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/Alu100mlSprayBlack.gif",
      }),
      referenceSource: "bestbottles-live" as const,
      referenceSourcePath: null,
      referenceSourceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/Alu100mlSprayBlack.gif",
      referenceIssue: null,
      referenceImportedAt: null,
      matchKind: "none" as const,
      duplicateCandidateCount: 0,
      nextAction: "source-website-reference" as const,
    };

    const migrated = buildReferenceIntakeUpdatePayload({
      row,
      publicUrl: "https://storage.example/reference.png",
      existingStatus: "needs-reference",
      importedAt: "2026-06-15T12:00:00.000Z",
      includeMetadataColumns: true,
    });
    const legacy = buildReferenceIntakeUpdatePayload({
      row,
      publicUrl: "https://storage.example/reference.png",
      existingStatus: "needs-reference",
      importedAt: "2026-06-15T12:00:00.000Z",
      includeMetadataColumns: false,
    });

    assert.equal(migrated.reference_source, "bestbottles-live");
    assert.equal(migrated.reference_source_url, row.referenceSourceUrl);
    assert.equal(legacy.reference_source, undefined);
    assert.equal(legacy.reference_source_url, undefined);
    assert.equal(legacy.best_reference_candidate_path, "https://storage.example/reference.png");
    assert.equal(legacy.status, "ready-to-generate");
  });
});
