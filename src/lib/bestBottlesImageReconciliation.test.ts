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
import type { ShadowQaReport } from "./product-image/shadowQa";

const currentDir = dirname(fileURLToPath(import.meta.url));
const studioSource = readFileSync(resolve(currentDir, "../pages/BestBottlesStudio.tsx"), "utf8");

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
