import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getBestBottlesImageAssetRoleForPreset,
  requiresBestBottlesPipelineReconciliation,
} from "./bestBottlesImageReconciliationRules";
import {
  approveBestBottlesReconciledImage,
  buildBestBottlesRigReconciliationPayload,
} from "./bestBottlesImageReconciliation";
import { approveBestBottlesGeneratedMaster } from "./bestBottlesMasterApproval";
import type { BestBottlesCatalogTruthSnapshot } from "./bestBottlesImageReconciliationRules";
import type { ShadowQaReport } from "./product-image/shadowQa";

const currentDir = dirname(fileURLToPath(import.meta.url));
const studioSource = readFileSync(resolve(currentDir, "../pages/BestBottlesStudio.tsx"), "utf8");
const foundationMigrationSource = readFileSync(
  resolve(
    currentDir,
    "../../supabase/migrations/20260710090000_best_bottles_image_reconciliation.sql",
  ),
  "utf8",
);
const modelShadowMigrationSource = readFileSync(
  resolve(
    currentDir,
    "../../supabase/migrations/20260712001000_best_bottles_model_shadow_evidence.sql",
  ),
  "utf8",
);
const reconciliationSqlTestSource = readFileSync(
  resolve(currentDir, "../../supabase/tests/best_bottles_image_reconciliation.sql"),
  "utf8",
);

function shadowQa(status: "pass" | "review"): ShadowQaReport {
  return {
    status,
    failures: [],
    warnings: [],
    measurements: {
      contactGapPx: 0,
      contactCoreDensity: 0.36,
      rightExtensionPx: 18,
      rightExtensionRatio: 0.28,
      leftExtensionPx: 2,
      verticalDepthPx: 8,
      componentCount: 1,
      shadowPixelCount: 120,
    },
    target: {
      maxContactGapPx: 2,
      rightExtensionRatio: { min: 0.2, max: 0.3 },
      contract: "contact-back-right-v1",
    },
  };
}

describe("Best Bottles image reconciliation asset roles", () => {
  it("requires reconciliation for canonical PDP presets", () => {
    const role = getBestBottlesImageAssetRoleForPreset("grid-card-2000x2200");
    assert.equal(role, "pdp-primary");
    assert.equal(requiresBestBottlesPipelineReconciliation(role), true);
  });

  it("keeps exploded and angle outputs as tracked secondary Library assets", () => {
    assert.equal(
      getBestBottlesImageAssetRoleForPreset("grid-card-exploded-2000x2200"),
      "pdp-secondary",
    );
    assert.equal(
      getBestBottlesImageAssetRoleForPreset("master-angle-2080x2288"),
      "pdp-secondary",
    );
    assert.equal(requiresBestBottlesPipelineReconciliation("pdp-secondary"), false);
  });

  it("keeps scene and marketing outputs out of the PDP exception queue", () => {
    assert.equal(
      getBestBottlesImageAssetRoleForPreset("master-scene-flexible-2000x2200"),
      "scene",
    );
    assert.equal(
      getBestBottlesImageAssetRoleForPreset("master-marketing-2080x2288"),
      "marketing",
    );
    assert.equal(requiresBestBottlesPipelineReconciliation("scene"), false);
    assert.equal(requiresBestBottlesPipelineReconciliation("marketing"), false);
  });
});

describe("Best Bottles generated master approval", () => {
  it("guards terminal SKU jobs before the link RPC mutates assignments or state", () => {
    const linkFunction = foundationMigrationSource.match(
      /CREATE OR REPLACE FUNCTION public\.link_best_bottles_generated_image[\s\S]*?\$\$;/,
    )?.[0];

    assert.ok(linkFunction);
    assert.match(linkFunction, /FOR UPDATE/);
    assert.match(linkFunction, /status\s+IN\s+\('approved', 'shopify-pushed', 'synced'\)/);
    assert.match(linkFunction, /approved_image_id\s+IS NOT NULL/);
    assert.ok(linkFunction.indexOf("FOR UPDATE") < linkFunction.indexOf("INSERT INTO"));
    assert.match(reconciliationSqlTestSource, /terminal-link-preserves-approved-job/);
  });

  it("makes the model-shadow is_reconciled predicate null-safe", () => {
    const isReconciledExpression = modelShadowMigrationSource.match(
      /\(\s*r\.requires_pipeline_reconciliation[\s\S]*?\) AS is_reconciled/,
    )?.[0];

    assert.ok(isReconciledExpression);
    assert.match(
      isReconciledExpression,
      /AND COALESCE\(\s*r\.shadow_owner = 'rig'[\s\S]*?r\.shadow_qa->'target'->>'contract'[\s\S]*?,\s*FALSE\s*\)/,
    );
    assert.match(reconciliationSqlTestSource, /model-shadow-null-is-reconciled-false/);
  });

  it("keeps model-shadow status pending until status and contract both pass", () => {
    const reconciliationStatusCase = modelShadowMigrationSource.match(
      /CASE[\s\S]*?END AS reconciliation_status/,
    )?.[0];

    assert.ok(reconciliationStatusCase);
    assert.match(
      reconciliationStatusCase,
      /r\.shadow_qa->>'status'\s*=\s*'pass'/,
    );
    assert.match(
      reconciliationStatusCase,
      /r\.shadow_qa->'target'->>'contract'\s*=\s*'contact-back-right-v1'/,
    );
    assert.match(reconciliationSqlTestSource, /model-shadow-pass-invalid-contract/);
    assert.match(reconciliationSqlTestSource, /model-shadow-pass-missing-contract/);
  });

  it("types explicit Grace and website SKU eligibility in catalog truth", () => {
    const eligibility: Pick<
      BestBottlesCatalogTruthSnapshot,
      "eligibleGraceSkus" | "eligibleWebsiteSkus"
    > = {
      eligibleGraceSkus: ["SKU-A", "SKU-B"],
      eligibleWebsiteSkus: ["WEB-A", "WEB-B"],
    };

    assert.deepEqual(eligibility.eligibleGraceSkus, ["SKU-A", "SKU-B"]);
    assert.deepEqual(eligibility.eligibleWebsiteSkus, ["WEB-A", "WEB-B"]);
  });

  it("keeps the Studio approval callback behind the single approval helper", () => {
    assert.match(studioSource, /await approveBestBottlesGeneratedMaster\(/);
    assert.doesNotMatch(
      studioSource,
      /import\s*\{[^}]*approveBestBottlesReconciledImage[^}]*\}\s*from\s*["']@\/lib\/bestBottlesImageReconciliation["']/s,
    );
    assert.doesNotMatch(studioSource, /markBestBottlesImageApprovedKeep/);
  });

  it("links the generated image before invoking the strict approval gate", async () => {
    const calls: string[] = [];
    const input = {
      organizationId: "org-1",
      pipelineSkuJobId: "job-1",
      imageId: "image-1",
    };

    await approveBestBottlesGeneratedMaster(input, {
      link: async (received) => {
        assert.deepEqual(received, input);
        calls.push("link");
      },
      approve: async (received) => {
        assert.deepEqual(received, input);
        calls.push("approve");
      },
    });

    assert.deepEqual(calls, ["link", "approve"]);
  });

  it("does not invoke approval when the fail-closed link rejects", async () => {
    const calls: string[] = [];

    await assert.rejects(
      approveBestBottlesGeneratedMaster(
        {
          organizationId: "org-1",
          pipelineSkuJobId: "terminal-job-1",
          imageId: "image-2",
        },
        {
          link: async () => {
            calls.push("link");
            throw new Error("Terminal SKU job cannot be relinked");
          },
          approve: async () => {
            calls.push("approve");
          },
        },
      ),
      /Terminal SKU job cannot be relinked/,
    );

    assert.deepEqual(calls, ["link"]);
  });

  it("invokes the strict approval RPC with the linked image identifiers", async () => {
    const input = {
      organizationId: "org-1",
      pipelineSkuJobId: "job-1",
      imageId: "image-1",
    };
    const rpcCalls: Array<{ name: string; args: Record<string, string> }> = [];

    await approveBestBottlesReconciledImage(input, {
      rpc: async (name, args) => {
        rpcCalls.push({ name, args });
        return { error: null };
      },
    });

    assert.deepEqual(rpcCalls, [
      {
        name: "approve_best_bottles_reconciled_image",
        args: {
          p_organization_id: "org-1",
          p_pipeline_sku_job_id: "job-1",
          p_image_id: "image-1",
        },
      },
    ]);
  });

  it("persists model-owned shadow evidence in the rig reconciliation payload", () => {
    const payload = buildBestBottlesRigReconciliationPayload({
      imageId: "image-1",
      organizationId: "org-1",
      rawImageUrl: "https://example.invalid/raw.png",
      shadowOwner: "model",
      shadowQa: shadowQa("pass"),
      lifecycleState: "qa-passed",
    });

    assert.equal(payload.shadow_owner, "model");
    assert.deepEqual(payload.shadow_qa, shadowQa("pass"));
  });
});
