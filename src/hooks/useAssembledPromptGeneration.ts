/**
 * Runs an assembled 4-layer prompt (SKU + preset + global + constraints)
 * through the existing `generate-madison-image` edge function, so the SKU
 * workflow shares the same generation + storage pipeline as Dark Room.
 *
 * Payload shape mirrors the DarkRoom caller at src/pages/DarkRoom.tsx:499
 * so we inherit its known-working defaults (`aiProvider`, `resolution`,
 * `sessionId`, `productContext`) instead of relying on the edge function's
 * optional-field handling.
 */

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_IMAGE_AI_PROVIDER } from "@/config/imageSettings";
import type { AssembledPrompt } from "@/lib/product-image/promptAssembler";
import { getBestBottlesReferenceUrlIssue } from "@/lib/bestBottlesReferenceValidation";
import { getRetiredTransparentBestBottlesReferenceIssue } from "@/lib/bestBottlesReferenceFilters";
import { dataUrlToBlob } from "@/lib/product-image/colorCorrect";
import {
  normalizeBestBottlesRigBaseline,
  type RigBaselineNormalizeResult,
} from "@/lib/product-image/rigPostprocess";
import {
  getBestBottlesImageAssetRoleForPreset,
  recordBestBottlesRawImage,
  recordBestBottlesRigResult,
  requiresBestBottlesPipelineReconciliation,
  type RecordBestBottlesRawImageInput,
} from "@/lib/bestBottlesImageReconciliation";
import { shouldRunBestBottlesRigPostprocess } from "@/lib/product-image/bestBottlesRigPostprocessPolicy";
import {
  getExactOutputCanvasConstraints,
  resolveExactCanvasForAspectRatio,
} from "@/lib/product-image/exactOutputCanvas";
import type { PromptRecord } from "@/lib/bestBottlesPromptCompiler";
import {
  getBestBottlesShadowPolicyTags,
  resolveBestBottlesShadowPolicy,
  type BestBottlesShadowOwner,
  type BestBottlesShadowPolicy,
} from "@/lib/bestBottlesShadowPolicy";
import {
  applyBestBottlesVisualTargetPrompt,
  BEST_BOTTLES_VISUAL_TARGET_CANVAS_HEX,
  getBestBottlesVisualTargetReference,
  getBestBottlesVisualTargetTags,
} from "@/config/bestBottlesVisualTarget";
import type { RigReviewEvidence } from "@/lib/product-image/rigReview";


export interface AssembledGenerationResult {
  imageUrl: string;
  savedImageId: string | null;
  prompt: string;
  aspectRatio: string;
  canvas: { widthPx: number; heightPx: number };
  presetId: string;
  sessionId: string;
  rigReview: RigReviewEvidence | null;
}

export interface AssembledGenerateOptions {
  /** Image provider/model id sent through to generate-madison-image. */
  aiProvider?: string;
  /** Optional geometry reference image (e.g. product.imageUrl from Convex). */
  referenceImageUrl?: string | null;
  /** Optional style-only reference for realistic glass, specularity, and shadow behavior. */
  glassSpecularityReferenceImageUrl?: string | null;
  /**
   * Extra SKU metadata for the `productContext` field in the edge function
   * — drives per-product prompt tuning and visual-DNA enrichment.
   */
  productContext?: {
    name?: string;
    websiteSku?: string | null;
    eligibleGraceSkus?: string[];
    eligibleWebsiteSkus?: string[];
    itemDescription?: string | null;
    collection?: string;
    family?: string | null;
    category?: string;
    presetId?: string | null;
    capState?: string | null;
    mode?: string | null;
    bodyMaterial?: string | null;
    color?: string | null;
    scent_family?: string;
    sku?: string;
    capacityMl?: number | null;
    heightWithoutCap?: string | null;
    heightWithCap?: string | null;
    diameter?: string | null;
    neckThreadSize?: string | null;
    measurementSource?: string | null;
    measurementSourceUrl?: string | null;
    measurementSourceNote?: string | null;
    sourcePageUrl?: string | null;
    websiteTruthStatus?: string | null;
    websiteTruthIssues?: string[];
    capColor?: string | null;
    trimColor?: string | null;
    applicator?: string | null;
    tasselColor?: string | null;
    bulbColor?: string | null;
    hoseColor?: string | null;
    collarFinish?: string | null;
    ringPresent?: boolean | null;
    accessoryCode?: string | null;
    reducerFinish?: string | null;
    sourceReference?: string | null;
    referenceWorkflow?: string | null;
    maskReference?: string | null;
    maskQcStatus?: string | null;
    identityStatus?: "ready" | "blocked";
    identityBlockers?: string[];
    identityHash?: string;
    promptVersion?: string;
    rigVersion?: string;
    shadowOwner?: BestBottlesShadowOwner;
    shadowContract?: BestBottlesShadowPolicy["contract"];
    qaStatus?: "pending" | string;
    canvas?: "2080x2288" | string;
  };
  /** JSON-driven Best Bottles prompt compiler output, used as the authoritative prompt for Studio masters. */
  precompiledPromptRecord?: PromptRecord | null;
  /** Extra tags merged into `extraLibraryTags` alongside preset/canvas tags. */
  extraLibraryTags?: string[];
  /**
   * Stable session id to correlate retries of the same master in the Library.
   * If omitted a fresh uuid is minted per call.
   */
  sessionId?: string;
  /**
   * Scene overlay — used by the Master · Scene-Flexible preset so the
   * operator can swap the background, framing aspect, and resolution
   * without editing the prompt. The edge function (Director Mode) appends
   * `BACKGROUND STYLE: <backgroundPrompt>` to the prompt and uses
   * `aspectRatio` / `resolution` directly. The strict catalog presets
   * leave these undefined to keep their canonical 10:11 / standard output.
   */
  sceneOverlay?: {
    backgroundPresetId?: string | null;
    backgroundPrompt?: string | null;
    aspectRatioOverride?: string | null;
    resolutionOverride?: "standard" | "high" | null;
  };
}

function getBodyMaterialLabel(productContext: AssembledGenerateOptions["productContext"]): string {
  const haystack = [
    productContext?.bodyMaterial,
    productContext?.family,
    productContext?.collection,
    productContext?.category,
    productContext?.name,
    productContext?.sku,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (haystack.includes("aluminum") || haystack.includes("aluminium") || haystack.includes("ab-alu")) {
    return "opaque brushed/satin aluminum metal";
  }
  if (
    haystack.includes("atomizer") ||
    haystack.includes("metal atomizer") ||
    /(?:^|\s)gb-[a-z0-9-]+-(?:5ml|10ml)-atm-/i.test(haystack)
  ) {
    return "opaque colored/anodized metal atomizer casing";
  }
  return "the exact referenced bottle body material";
}

function isCylinderBestBottlesContext(
  productContext: AssembledGenerateOptions["productContext"],
): boolean {
  const family = productContext?.family?.trim().toLowerCase();
  return family === "cylinder" || family === "tall cylinder";
}

export function useAssembledPromptGeneration() {
  const { user } = useAuth();
  const { currentOrganizationId } = useOnboarding();
  const { toast } = useToast();

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssembledGenerationResult | null>(null);

  const generate = async (
    assembled: AssembledPrompt,
    options: AssembledGenerateOptions = {},
  ): Promise<AssembledGenerationResult | null> => {
    if (!user) {
      const message = "Sign in required to generate images.";
      setError(message);
      toast({ title: "Not signed in", description: message, variant: "destructive" });
      return null;
    }
    if (!currentOrganizationId) {
      const message = "No organization selected — finish onboarding first.";
      setError(message);
      toast({ title: "No organization", description: message, variant: "destructive" });
      return null;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    const sessionId = options.sessionId ?? uuidv4();

    // Best Bottles Convex stores `imageUrl` as .gif (legacy bestbottles.com
    // thumbnails). The reference-locked PDP flow needs a fetchable product
    // reference. GPT image edits accepts PNG, JPG, and WebP inputs, so only
    // skip formats the provider path cannot reliably pass through.
    //
    // Reference shape: the edge function's `categorizeReferences` keys off
    // `ref.url` and `ref.label`. Sending a bare URL string silently fails
    // downstream (`processReferenceImage(undefined)`), so the model never
    // actually sees the reference. Always pass objects.
    const rawRef = options.referenceImageUrl?.trim() || "";
    const isBestBottlesStudioMasterRequest =
      Boolean(options.extraLibraryTags?.includes("brand:best-bottles")) &&
      Boolean(options.extraLibraryTags?.includes("studio-master"));
    const visualTargetReference = getBestBottlesVisualTargetReference(
      options.productContext?.bodyMaterial,
    );
    const rawGlassRef =
      options.glassSpecularityReferenceImageUrl?.trim() ||
      (isBestBottlesStudioMasterRequest ? visualTargetReference.imageUrl : "");
    const rawMaskRef = options.productContext?.maskReference?.trim() || "";
    const isCylinderBestBottlesMasterRequest =
      isBestBottlesStudioMasterRequest &&
      isCylinderBestBottlesContext(options.productContext);
    const productReferenceIssue = getBestBottlesReferenceUrlIssue(rawRef);
    const retiredReferenceIssue =
      isBestBottlesStudioMasterRequest
        ? getRetiredTransparentBestBottlesReferenceIssue([
            {
              url: rawRef,
              sourceReference: options.productContext?.sourceReference,
              referenceWorkflow: options.productContext?.referenceWorkflow,
              role: "product-reference",
            },
            {
              url: rawGlassRef,
              role: "style-reference",
            },
            {
              url: rawMaskRef,
              role: "mask-reference",
            },
          ])
        : null;
    if (retiredReferenceIssue) {
      const message = retiredReferenceIssue;
      setError(message);
      setIsGenerating(false);
      toast({
        title: "Flattened product truth required",
        description: message,
        variant: "destructive",
      });
      return null;
    }
    if (isBestBottlesStudioMasterRequest && productReferenceIssue) {
      const message = `Reference is not usable: ${productReferenceIssue}`;
      setError(message);
      setIsGenerating(false);
      toast({
        title: "Usable reference required",
        description: message,
        variant: "destructive",
      });
      return null;
    }
    if (isBestBottlesStudioMasterRequest && rawMaskRef) {
      const message =
        "Best Bottles generation does not accept mask/control references. Use one approved opaque flattened-white product reference and, only when approved, one opaque style-only reference.";
      setError(message);
      setIsGenerating(false);
      toast({
        title: "Mask/control reference prohibited",
        description: message,
        variant: "destructive",
      });
      return null;
    }
    const refIsSupported =
      rawRef.length > 0 && productReferenceIssue === null;
    const glassRefIsSupported =
      rawGlassRef.length > 0 && !/\.(gif|heic|bmp)(\?|$)/i.test(rawGlassRef);
    const referenceImagesList: Array<{ url: string; label: string; description: string }> = [];
    const bodyMaterialLabel = getBodyMaterialLabel(options.productContext);
    const isMetalBody = bodyMaterialLabel.includes("aluminum") || bodyMaterialLabel.includes("metal atomizer");
    const styleReferenceLabel = isMetalBody
      ? "Metal Lighting-Only Style Reference"
      : "Glass Specularity Style Reference";
    if (refIsSupported) {
      referenceImagesList.push({
        url: rawRef,
        label: "Product Reference",
        description:
          [
            "Canonical bottle reference (PSD-rendered PNG).",
            `Use this image as an exact product-identity lock: preserve the bottle geometry, camera angle, scale relationships, body material/substrate (${bodyMaterialLabel}), cap texture, fitment, applicator, body color, hose/bulb/tassel color, collar/ring details, reducer finish, trim metal, and all surface details.`,
            "Do not redesign, restyle, recolor, rotate, or reinterpret the product components.",
            "Do allow luxury catalog staging, lighting, background replacement, shadow, and refined PDP canvas placement as instructed by the server prompt.",
          ].join(" "),
      });
    }
    if (glassRefIsSupported) {
      referenceImagesList.push({
        url: rawGlassRef,
        label: styleReferenceLabel,
        description:
          [
            "Secondary style-only reference.",
            isMetalBody
              ? `Use only for lighting direction, reflection-card rhythm, opaque metal edge glints, contact shadow, ambient occlusion, and premium studio polish. Do not use this image to change the product material: the body must remain ${bodyMaterialLabel}.`
              : "Use only for realistic glass transparency, refraction, edge glints, specular highlight rhythm, contact shadow, ambient occlusion, and premium studio polish.",
            "Do not copy or infer this reference's product silhouette, cap, label, colors, geometry, camera angle, composition, background, props, brand, or scene.",
            "Image 1 Product Reference remains the only product identity and placement source.",
          ].join(" "),
      });
    }
    const referenceImages = referenceImagesList.length > 0 ? referenceImagesList : undefined;
    const hasProductReference = refIsSupported;

    // Keep this hook compatible with the general Dark Room generator, but
    // Best Bottles masters are now recognized server-side by their tags and
    // routed to the short reference-locked retouch prompt instead of this
    // assembled art-direction prompt.
    const proModeControls = hasProductReference
      ? { productAccuracy: "strict" as const }
      : undefined;

    const baseTags = [
      "sku-preset",
      `preset:${assembled.preset.id}`,
      `canvas:${assembled.canvas.widthPx}x${assembled.canvas.heightPx}`,
    ];
    const visualTargetTags = isBestBottlesStudioMasterRequest
      ? getBestBottlesVisualTargetTags(options.productContext?.bodyMaterial)
      : [];
    const shadowPolicy = resolveBestBottlesShadowPolicy(options.productContext?.sku);
    // Shadow ownership is an exact SKU policy. Caller-supplied context fields
    // remain metadata only and may not opt a non-smoke SKU into the model/V6.1
    // contract (or force the smoke SKU back to rig/V6.0).
    const resolvedShadowPolicy: BestBottlesShadowPolicy = shadowPolicy;
    const shadowPolicyTags = isBestBottlesStudioMasterRequest
      ? getBestBottlesShadowPolicyTags(resolvedShadowPolicy)
      : [];
    const callerLibraryTags = (options.extraLibraryTags ?? []).filter(
      (tag) => !/^(?:prompt-version|shadow-owner|shadow-contract|shadow-smoke-sku):/i.test(tag),
    );
    const extraLibraryTags = options.extraLibraryTags
      ? Array.from(new Set([
          ...baseTags,
          ...callerLibraryTags,
          ...visualTargetTags,
          ...shadowPolicyTags,
        ]))
      : Array.from(new Set([...baseTags, ...visualTargetTags, ...shadowPolicyTags]));
    const isBestBottlesStudioMaster =
      hasProductReference &&
      extraLibraryTags.includes("brand:best-bottles") &&
      extraLibraryTags.includes("studio-master");
    const precompiledPrompt = options.precompiledPromptRecord?.final_prompt?.trim() || null;
    const uncalibratedRequestPrompt = isBestBottlesStudioMaster
      ? precompiledPrompt ?? [
          "REFERENCE-LOCKED BEST BOTTLES LUXURY PRODUCT PHOTOGRAPHY V5.1.",
          "Use the uploaded product reference as the source of truth.",
          "Server will build the full locked prompt from productContext, measurements, and reference metadata.",
        ].join("\n")
      : assembled.prompt;
    const requestPrompt = isBestBottlesStudioMaster
      ? applyBestBottlesVisualTargetPrompt(
          uncalibratedRequestPrompt,
          options.productContext?.bodyMaterial,
        )
      : uncalibratedRequestPrompt;
    const calibratedPromptRecord =
      isBestBottlesStudioMaster && options.precompiledPromptRecord
        ? {
            ...options.precompiledPromptRecord,
            final_prompt: applyBestBottlesVisualTargetPrompt(
              options.precompiledPromptRecord.final_prompt,
              options.productContext?.bodyMaterial,
            ),
            qa_checklist: Array.from(
              new Set([
                ...options.precompiledPromptRecord.qa_checklist,
                ...visualTargetTags,
              ]),
            ),
          }
        : options.precompiledPromptRecord;

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "generate-madison-image",
        {
          body: {
            prompt: requestPrompt,
            userId: user.id,
            organizationId: currentOrganizationId,
            sessionId,
            goalType: "product_photography",
            // Scene-Flexible preset can override aspect ratio per generation
            // so a 16:9 hero or 1:1 marketplace tile still uses the same
            // SKU lock-in. Default falls through to the preset's canonical
            // ratio (10:11 for Grid Card, 4:5 for Sanity Hero, etc.).
            aspectRatio:
              options.sceneOverlay?.aspectRatioOverride ?? assembled.preset.aspectRatio,
            outputFormat: "png",
            referenceImages,
            proModeControls,
            aiProvider: options.aiProvider ?? DEFAULT_IMAGE_AI_PROVIDER,
            // Resolution override is locked to standard|high. "high" gives
            // visibly better cap-texture / refraction / neck-thread detail
            // per the OpenAI gpt-image-2 guide, BUT on the larger 2080×2288
            // canvas it pushes past the Supabase gateway timeout (504 GW
            // Timeout, observed 2026-04-26). Default reverted to "standard"
            // so single-generate stays responsive; operator can opt into
            // "high" per-generation via the Scene-Flexible preset's
            // resolution dropdown when fidelity matters more than latency.
            // Future fix: lengthen the edge function / gateway timeout, or
            // stream the response so high-resolution returns aren't
            // gated by wall-clock budget.
            resolution: options.sceneOverlay?.resolutionOverride ?? "standard",
            imageConstraints: options.sceneOverlay?.aspectRatioOverride
              ? undefined
              : getExactOutputCanvasConstraints(assembled.preset.canvas),
            // Background overlay flows through the same fields Dark Room
            // uses; the edge function's Director Mode appends them as a
            // BACKGROUND STYLE block ahead of the bottle's product spec.
            backgroundPresetId: options.sceneOverlay?.backgroundPresetId ?? undefined,
            backgroundPrompt: options.sceneOverlay?.backgroundPrompt ?? undefined,
            extraLibraryTags,
            productContext: options.productContext
              ? {
                  ...options.productContext,
                  shadowOwner: resolvedShadowPolicy.owner,
                  shadowContract: resolvedShadowPolicy.contract,
                }
              : options.productContext,
            precompiledPromptRecord: calibratedPromptRecord ?? undefined,
          },
        },
      );

      if (invokeError) {
        // Full diagnostic logging so the browser console always has the raw
        // shape, regardless of what the toast can display. If the toast still
        // shows "[object Object]" after a refresh, dev server hasn't picked
        // up this build.
        console.error("[useAssembledPromptGeneration] invoke error", {
          error: invokeError,
          errorName: (invokeError as { name?: unknown }).name,
          errorMessage: (invokeError as { message?: unknown }).message,
          errorContext: (invokeError as { context?: unknown }).context,
          status:
            (invokeError as { context?: { status?: unknown } }).context?.status,
        });

        let message = "Image generation failed.";
        const rawMessage = (invokeError as { message?: unknown }).message;
        if (typeof rawMessage === "string" && rawMessage.trim()) {
          message = rawMessage;
        } else if (rawMessage != null) {
          try {
            message = JSON.stringify(rawMessage);
          } catch {
            message = String(rawMessage);
          }
        }

        // Try JSON body first, then text body fallback for non-JSON responses
        // (HTML error pages, plain text, etc.). Log everything we find.
        const ctx = (invokeError as {
          context?: {
            json?: () => Promise<unknown>;
            text?: () => Promise<string>;
            clone?: () => { json?: () => Promise<unknown>; text?: () => Promise<string> };
            status?: number;
          };
        }).context;
        if (ctx) {
          try {
            const clone = typeof ctx.clone === "function" ? ctx.clone() : null;
            if (typeof ctx.json === "function") {
              try {
                const body = await ctx.json();
                console.error("[useAssembledPromptGeneration] body (json)", body);
                if (body && typeof body === "object") {
                  const bodyError = (body as { error?: unknown }).error;
                  if (typeof bodyError === "string" && bodyError.trim()) {
                    message = bodyError;
                  } else if (bodyError != null) {
                    try {
                      message = JSON.stringify(bodyError);
                    } catch {
                      message = String(bodyError);
                    }
                  }
                }
              } catch (jsonErr) {
                // Not JSON — try the cloned body as text.
                if (clone && typeof clone.text === "function") {
                  try {
                    const text = await clone.text();
                    console.error("[useAssembledPromptGeneration] body (text)", text);
                    if (text && text.trim()) {
                      message = text.slice(0, 500);
                    }
                  } catch {
                    console.error(
                      "[useAssembledPromptGeneration] body unreadable as text after JSON fail",
                      jsonErr,
                    );
                  }
                }
              }
            }
          } catch (ctxErr) {
            console.error("[useAssembledPromptGeneration] context read failed", ctxErr);
          }
        }

        setError(message);
        toast({ title: "Generation failed", description: message, variant: "destructive" });
        return null;
      }

      // Under the heartbeat-streaming response (requests that outlive the edge
      // gateway's idle window), failures arrive as HTTP 200 with an `error`
      // field in the body instead of a non-2xx status. Surface the real
      // server-side message rather than a generic "no image URL".
      const streamedError = (data as { error?: unknown } | null)?.error;
      if (typeof streamedError === "string" && streamedError.trim()) {
        console.error("[useAssembledPromptGeneration] streamed body error", data);
        setError(streamedError);
        toast({ title: "Generation failed", description: streamedError, variant: "destructive" });
        return null;
      }

      if (!data?.imageUrl) {
        const message = "Edge function returned no image URL.";
        setError(message);
        toast({ title: "No image returned", description: message, variant: "destructive" });
        return null;
      }

      const resolvedAspectRatio =
        options.sceneOverlay?.aspectRatioOverride ?? assembled.preset.aspectRatio;
      const resolvedCanvas =
        resolveExactCanvasForAspectRatio(resolvedAspectRatio) ?? assembled.canvas;

      // Snap the rendered Bone background to the exact target hex and apply
      // the client-side rig baseline pass. The Edge function stays a provider
      // coordinator because 2080x2288 image re-encoding can exhaust worker
      // limits; the browser can safely perform the final Studio acceptance
      // pass before the Library URL is patched.
      const savedImageId = data.savedImageId ?? null;
      if (isBestBottlesStudioMaster && !savedImageId) {
        throw new Error("Best Bottles generation returned no durable Image Library row.");
      }
      const rigPostprocessDecision = shouldRunBestBottlesRigPostprocess({
        libraryTags: extraLibraryTags,
        family: options.productContext?.family,
        aspectRatio: resolvedAspectRatio,
        canvas: resolvedCanvas,
        sceneOverlay: options.sceneOverlay,
      });
      const reconciliationAssetRole = getBestBottlesImageAssetRoleForPreset(
        assembled.preset.id,
      );
      const requiresPipelineReconciliation =
        requiresBestBottlesPipelineReconciliation(reconciliationAssetRole);
      const reconciliationBase: RecordBestBottlesRawImageInput | null =
        isBestBottlesStudioMaster && savedImageId && currentOrganizationId
          ? {
              imageId: savedImageId,
              organizationId: currentOrganizationId,
              graceSku: options.productContext?.sku,
              websiteSku: options.productContext?.websiteSku,
              family: options.productContext?.family,
              sourceReferenceUrl: options.productContext?.sourceReference ?? rawRef,
              prompt:
                typeof data.finalPrompt === "string" && data.finalPrompt.trim()
                  ? data.finalPrompt
                  : requestPrompt,
              promptVersion: options.productContext?.promptVersion,
              rigVersion: options.productContext?.rigVersion,
              providerModel: options.aiProvider ?? DEFAULT_IMAGE_AI_PROVIDER,
              catalogTruth: {
                name: options.productContext?.name ?? null,
                graceSku: options.productContext?.sku ?? null,
                websiteSku: options.productContext?.websiteSku ?? null,
                eligibleGraceSkus:
                  options.productContext?.eligibleGraceSkus ??
                  (options.productContext?.sku ? [options.productContext.sku] : []),
                eligibleWebsiteSkus:
                  options.productContext?.eligibleWebsiteSkus ??
                  (options.productContext?.websiteSku ? [options.productContext.websiteSku] : []),
                family: options.productContext?.family ?? null,
                category: options.productContext?.category ?? null,
                capacityMl: options.productContext?.capacityMl ?? null,
                heightWithoutCap: options.productContext?.heightWithoutCap ?? null,
                heightWithCap: options.productContext?.heightWithCap ?? null,
                diameter: options.productContext?.diameter ?? null,
                neckThreadSize: options.productContext?.neckThreadSize ?? null,
                applicator: options.productContext?.applicator ?? null,
                capState: options.productContext?.capState ?? null,
                capColor: options.productContext?.capColor ?? null,
                trimColor: options.productContext?.trimColor ?? null,
                bodyMaterial: options.productContext?.bodyMaterial ?? null,
                color: options.productContext?.color ?? null,
                identityStatus: options.productContext?.identityStatus ?? null,
                identityBlockers: options.productContext?.identityBlockers ?? [],
                identityHash: options.productContext?.identityHash ?? null,
                sourceReferenceUrl: options.productContext?.sourceReference || rawRef || null,
                sourcePageUrl: options.productContext?.sourcePageUrl ?? null,
                measurementSource: options.productContext?.measurementSource ?? null,
                measurementSourceUrl: options.productContext?.measurementSourceUrl ?? null,
                measurementSourceNote: options.productContext?.measurementSourceNote ?? null,
                websiteTruthStatus: options.productContext?.websiteTruthStatus ?? null,
                websiteTruthIssues: options.productContext?.websiteTruthIssues ?? [],
              },
              assetRole: reconciliationAssetRole,
              requiresPipelineReconciliation,
              rawImageUrl: data.imageUrl,
              canvasWidthPx: resolvedCanvas.widthPx,
              canvasHeightPx: resolvedCanvas.heightPx,
            }
          : null;
      if (reconciliationBase) {
        await recordBestBottlesRawImage(reconciliationBase);
      }
      let finalImageUrl = data.imageUrl;
      let riggedSnapshot: RigBaselineNormalizeResult | null = null;
      if (rigPostprocessDecision.run && currentOrganizationId) {
        try {
          // Geometry-only rig. Global paint-after color correction is intentionally
          // retired because it shifts the product material and washes out clear glass.
          const rigged = await normalizeBestBottlesRigBaseline(data.imageUrl, {
            family: options.productContext?.family,
            bottleCollection: options.productContext?.collection,
            graceSku: options.productContext?.sku,
            websiteSku: options.productContext?.websiteSku,
            itemName: options.productContext?.name,
            itemDescription: options.productContext?.itemDescription,
            applicator: options.productContext?.applicator,
            capacityMl: options.productContext?.capacityMl,
            heightWithCap: options.productContext?.heightWithCap,
            heightWithoutCap: options.productContext?.heightWithoutCap,
            diameter: options.productContext?.diameter,
            capState: options.productContext?.capState,
            mode: options.productContext?.mode,
            targetBackgroundHex: BEST_BOTTLES_VISUAL_TARGET_CANVAS_HEX,
            shadowOwner: resolvedShadowPolicy.owner,
            maskReferenceUrl: null,
            requireMaskControl: false,
          });
          riggedSnapshot = rigged;
          const finalMeasurements = rigged.framingQa?.measurements ?? null;
          if (
            !finalMeasurements ||
            finalMeasurements.baselineYPx === null ||
            !Number.isFinite(finalMeasurements.targetBaselineYPx)
          ) {
            throw new Error("Rig baseline was not detectable in the final rendered image.");
          }
          if (rigged.qaIssues.length > 0) {
            throw new Error(`Rig QA failed: ${rigged.qaIssues.join(" ")}`);
          }
          const shadowQaIssues =
            rigged.shadowOwner === "model" && rigged.shadowQa?.status !== "pass"
              ? [
                  `Model-owned shadow ${rigged.shadowQa?.status ?? "review"}: ${[
                    ...(rigged.shadowQa?.failures ?? []),
                    ...(rigged.shadowQa?.warnings ?? []),
                  ].join(" ") || "candidate requires review."}`,
                ]
              : [];
          const reviewQaIssues = [...rigged.qaIssues, ...shadowQaIssues];
          console.info("[useAssembledPromptGeneration] Best Bottles rig postprocess", {
            shifted: rigged.shifted,
            shiftXPx: rigged.shiftXPx,
            shiftYPx: rigged.shiftYPx,
            scale: rigged.scale,
            maskControlled: rigged.maskControlled,
            qaIssues: rigged.qaIssues,
            framingQa: rigged.framingQa,
            detectedBaselineYPx: rigged.detectedBaselineYPx,
            targetBaselineYPx: rigged.targetBaselineYPx,
            reason: rigPostprocessDecision.reason,
            family: options.productContext?.family,
            capState: options.productContext?.capState,
            mode: options.productContext?.mode,
          });
          const blob = dataUrlToBlob(rigged.dataUrl);
          const ts = Date.now();
          const rand = Math.random().toString(36).slice(2, 8);
          const path = `${currentOrganizationId}/${user.id}/paper-doll/master_rigged_${ts}_${rand}.png`;
          const { error: uploadError } = await supabase.storage
            .from("generated-images")
            .upload(path, blob, {
              cacheControl: "3600",
              upsert: false,
              contentType: "image/png",
            });
          if (uploadError) {
            throw new Error(`Rigged master upload failed: ${uploadError.message}`);
          } else {
            const { data: urlData } = supabase.storage
              .from("generated-images")
              .getPublicUrl(path);
            if (!urlData?.publicUrl) {
              throw new Error("Rigged master upload returned no public URL.");
            }
            finalImageUrl = urlData.publicUrl;
            if (savedImageId) {
              const { error: updateError } = await supabase
                .from("generated_images")
                .update({ image_url: finalImageUrl })
                .eq("id", savedImageId);
              if (updateError) {
                throw new Error(`Library row rig patch failed: ${updateError.message}`);
              }
            }
            if (reconciliationBase) {
              await recordBestBottlesRigResult({
                ...reconciliationBase,
                finalImageUrl,
                preTransformBaselineYPx: rigged.preTransformBaselineYPx,
                detectedBaselineYPx: finalMeasurements.baselineYPx,
                targetBaselineYPx: finalMeasurements.targetBaselineYPx,
                fillHeightPct: finalMeasurements.fillHeightPct,
                centerXPct: finalMeasurements.centerXPct,
                targetCenterXPct: finalMeasurements.targetCenterXPct,
                centerDeltaPct: finalMeasurements.centerDeltaPct,
                shiftXPx: rigged.shiftXPx,
                shiftYPx: rigged.shiftYPx,
                scaleFactor: rigged.scale,
                maskControlled: rigged.maskControlled,
                preTransformObjectBounds: rigged.preTransformObjectBounds,
                transformControlBounds: rigged.transformControlBounds,
                objectBounds: rigged.objectBounds,
                framingQa: rigged.framingQa,
                qaIssues: reviewQaIssues,
                framingDecision: rigged.framingDecision,
                lifecycleState:
                  rigged.shadowOwner !== "model" || rigged.shadowQa?.status === "pass"
                    ? "qa-passed"
                    : rigged.shadowQa?.status === "fail"
                      ? "qa-failed"
                      : "review-pending",
                lastError: null,
              });
            }
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : "Best Bottles rig postprocess failed.";
          console.error("[useAssembledPromptGeneration] Best Bottles rig postprocess failed", {
            error: e,
            savedImageId,
            rawImageUrl: data.imageUrl,
            family: options.productContext?.family,
          });
          if (reconciliationBase) {
            try {
              const failedMeasurements = riggedSnapshot?.framingQa?.measurements ?? null;
              await recordBestBottlesRigResult({
                ...reconciliationBase,
                finalImageUrl: null,
                preTransformBaselineYPx: riggedSnapshot?.preTransformBaselineYPx ?? null,
                detectedBaselineYPx: failedMeasurements?.baselineYPx ?? null,
                targetBaselineYPx: failedMeasurements?.targetBaselineYPx ?? null,
                fillHeightPct: failedMeasurements?.fillHeightPct ?? null,
                centerXPct: failedMeasurements?.centerXPct ?? null,
                targetCenterXPct: failedMeasurements?.targetCenterXPct ?? null,
                centerDeltaPct: failedMeasurements?.centerDeltaPct ?? null,
                shiftXPx: riggedSnapshot?.shiftXPx ?? null,
                shiftYPx: riggedSnapshot?.shiftYPx ?? null,
                scaleFactor: riggedSnapshot?.scale ?? null,
                maskControlled: riggedSnapshot?.maskControlled ?? false,
                preTransformObjectBounds: riggedSnapshot?.preTransformObjectBounds ?? null,
                transformControlBounds: riggedSnapshot?.transformControlBounds ?? null,
                objectBounds: riggedSnapshot?.objectBounds ?? null,
                framingQa: riggedSnapshot?.framingQa ?? null,
                qaIssues: riggedSnapshot?.qaIssues ?? [message],
                framingDecision: riggedSnapshot?.framingDecision ?? null,
                lifecycleState: "qa-failed",
                lastError: message,
              });
            } catch (reconciliationError) {
              console.error(
                "[useAssembledPromptGeneration] Failed to persist rig failure state",
                reconciliationError,
              );
            }
          }
          setError(message);
          toast({ title: "Rig post-process failed", description: message, variant: "destructive" });
          return null;
        }
      } else if (extraLibraryTags.includes("brand:best-bottles") && extraLibraryTags.includes("studio-master")) {
        if (reconciliationBase) {
          await recordBestBottlesRigResult({
            ...reconciliationBase,
            finalImageUrl,
            qaIssues: [`Rig bypassed: ${rigPostprocessDecision.reason}`],
            lifecycleState: "review-pending",
            lastError: null,
          });
        }
        console.info("[useAssembledPromptGeneration] Best Bottles rig postprocess not required", {
          reason: rigPostprocessDecision.reason,
          family: options.productContext?.family,
          aspectRatio: resolvedAspectRatio,
          canvas: resolvedCanvas,
          sceneOverlay: options.sceneOverlay,
        });
      }

      const generated: AssembledGenerationResult = {
        imageUrl: finalImageUrl,
        savedImageId,
        prompt: typeof data.finalPrompt === "string" && data.finalPrompt.trim()
          ? data.finalPrompt
          : assembled.prompt,
        aspectRatio: resolvedAspectRatio,
        canvas: resolvedCanvas,
        presetId: assembled.preset.id,
        sessionId,
        rigReview: {
          required: rigPostprocessDecision.run,
          applied: riggedSnapshot !== null,
          reason: rigPostprocessDecision.reason,
          framingDecision: riggedSnapshot?.framingDecision ?? null,
          framingQa: riggedSnapshot?.framingQa ?? null,
          qaIssues:
            riggedSnapshot?.shadowOwner === "model" && riggedSnapshot.shadowQa?.status !== "pass"
              ? [
                  ...(riggedSnapshot.qaIssues ?? []),
                  `Model-owned shadow ${riggedSnapshot.shadowQa?.status ?? "review"} requires review.`,
                ]
              : riggedSnapshot?.qaIssues ?? [],
          objectBounds: riggedSnapshot?.objectBounds ?? null,
          preTransformObjectBounds: riggedSnapshot?.preTransformObjectBounds ?? null,
          shiftXPx: riggedSnapshot?.shiftXPx ?? null,
          shiftYPx: riggedSnapshot?.shiftYPx ?? null,
          scaleFactor: riggedSnapshot?.scale ?? null,
          maskControlled: riggedSnapshot?.maskControlled ?? false,
        },
      };
      setResult(generated);
      toast({
        title: "Image generated",
        description: `${assembled.preset.label} · ${resolvedCanvas.widthPx} × ${resolvedCanvas.heightPx}`,
      });
      return generated;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected generation error.";
      setError(message);
      toast({ title: "Generation failed", description: message, variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { generate, isGenerating, error, result, reset };
}
