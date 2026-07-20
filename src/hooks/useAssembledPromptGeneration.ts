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
import type { CylinderCanonicalGeometryContract } from "@/lib/bestBottlesCylinderRoleAuthority";
import { dataUrlToBlob } from "@/lib/product-image/colorCorrect";
import {
  measureReferencePrimaryAspectRatio,
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
  resolveBestBottlesReconciliationPromptVersion,
  resolveBestBottlesShadowPolicy,
  type BestBottlesShadowOwner,
  type BestBottlesShadowPolicy,
} from "@/lib/bestBottlesShadowPolicy";
import { resolveBestBottlesShadowTopology } from "@/lib/bestBottlesShadowTopology";
import {
  applyBestBottlesVisualTargetPrompt,
  BEST_BOTTLES_VISUAL_TARGET_CANVAS_HEX,
  getBestBottlesVisualTargetReference,
  getBestBottlesVisualTargetTags,
  type BestBottlesVisualComponentTopology,
} from "@/config/bestBottlesVisualTarget";
import type { RigReviewEvidence } from "@/lib/product-image/rigReview";
import { resolveBestBottlesStyleReferenceUrl } from "@/lib/bestBottlesStyleReferenceRouting";


export interface AssembledGenerationResult {
  imageUrl: string;
  savedImageId: string | null;
  prompt: string;
  aspectRatio: string;
  canvas: { widthPx: number; heightPx: number };
  presetId: string;
  sessionId: string;
  rigReview: RigReviewEvidence | null;
  /**
   * The provider/model the server ACTUALLY executed (edge `usedProvider`),
   * which can differ from the dropdown selection — Best Bottles masters
   * force GPT Image 2 unless the comparison override is sent (2026-07-20:
   * Gemini selections silently ran GPT). Surfaced as a rig-review badge so
   * the operator always sees the truth.
   */
  usedProvider: string | null;
  /** Wall-clock generation time (invoke start → response), for the rig-review timer. */
  durationMs: number | null;
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
    componentTopology?: BestBottlesVisualComponentTopology;
    capOffReferenceId?: string | null;
    topologyReferenceId?: string | null;
    referenceRoleId?: string | null;
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
    canonicalGeometryContract?: CylinderCanonicalGeometryContract | null;
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
      // Body-color evidence: catalog color field + grace SKU body segment.
      // Without these, every colored-glass bottle fell back to the clear
      // exemplar (style-surface:clear on the 2026-07-20 amber renders).
      {
        color: options.productContext?.color ?? null,
        graceSku: options.productContext?.sku ?? null,
      },
    );
    const rawGlassRef = resolveBestBottlesStyleReferenceUrl({
      explicitStyleReferenceUrl: options.glassSpecularityReferenceImageUrl,
      fallbackCylinderStyleReferenceUrl: visualTargetReference.imageUrl,
      isBestBottlesStudioMasterRequest,
      family: options.productContext?.family,
    });
    const rawMaskRef = options.productContext?.maskReference?.trim() || "";
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
    const shadowPolicy = resolveBestBottlesShadowPolicy({
      graceSku: options.productContext?.sku,
      websiteSku: options.productContext?.websiteSku,
      family: options.productContext?.family,
      bottleCollection: options.productContext?.collection,
    });
    const shadowTopology = resolveBestBottlesShadowTopology(
      {
        family: options.productContext?.family,
        capState: options.productContext?.capState,
        mode: options.productContext?.mode,
        applicator: options.productContext?.applicator,
        accessoryCode: options.productContext?.accessoryCode,
        itemName: options.productContext?.name,
        itemDescription: options.productContext?.itemDescription,
      },
      {
        sku: options.productContext?.sku,
        detached_components:
          options.productContext?.capState === "detached" ||
          options.productContext?.mode === "cap-off"
            ? ["cap"]
            : [],
        applicator_type: options.productContext?.applicator,
      },
    );
    // Shadow ownership is resolved from reviewed family context. Caller-supplied
    // prompt/shadow metadata cannot override the canonical policy.
    const resolvedShadowPolicy: BestBottlesShadowPolicy = shadowPolicy;
    const shadowPolicyTags = isBestBottlesStudioMasterRequest
      ? getBestBottlesShadowPolicyTags(resolvedShadowPolicy)
      : [];
    const callerLibraryTags = isBestBottlesStudioMasterRequest
      ? (options.extraLibraryTags ?? []).filter(
          (tag) => !/^(?:prompt-version|prompt|shadow-owner|shadow-contract|shadow-smoke-sku|shadow-rollout):/i.test(tag),
        )
      : options.extraLibraryTags ?? [];
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
    // Detached-sidecar lanes: canon mm can't describe the pictured cap-off
    // bottle (body + attached fitment), so measure the byte-locked reference's
    // actual bottle ratio and tell the model the exact number the aspect QA
    // gate will grade it against. Same measurement feeds the rig gate below.
    const detachedAspectReferenceUrl =
      options.productContext?.sourceReference || rawRef || null;
    const referenceAspectRatio =
      isBestBottlesStudioMaster &&
      options.productContext?.capState === "detached" &&
      detachedAspectReferenceUrl
        ? await measureReferencePrimaryAspectRatio(detachedAspectReferenceUrl)
        : null;
    const appendMeasuredProportionLock = (prompt: string): string =>
      referenceAspectRatio != null
        ? `${prompt.trim()}\nMEASURED REFERENCE PROPORTION LOCK: the primary bottle in the attached Product Reference measures exactly ${referenceAspectRatio.toFixed(2)}:1 height-to-width. Render the bottle at exactly this height-to-width relationship — do not elongate, slim, or stretch it; QA rejects any render whose bottle deviates from this ratio.`
        : prompt;
    // Scene/marketing presets: the operator's background direction must BEAT
    // the reference-locked prompt's studio laws ("flat Bone background only",
    // no-props bans), which otherwise steamroll the server's one-line
    // BACKGROUND STYLE note (observed 2026-07-20: Natural Stone chip run
    // returned a bone-studio replica). Identity stays locked; only the
    // environment is released. PDP presets never get this block.
    const presetAssetRole = getBestBottlesImageAssetRoleForPreset(assembled.preset.id);
    const sceneEnvironmentPrompt =
      presetAssetRole === "scene" || presetAssetRole === "marketing"
        ? options.sceneOverlay?.backgroundPrompt?.trim() || null
        : null;
    const appendSceneEnvironmentOverride = (prompt: string): string =>
      sceneEnvironmentPrompt
        ? `${prompt.trim()}\nSCENE ENVIRONMENT OVERRIDE (ENVIRONMENT AUTHORITY — this block supersedes every earlier background, surface, prop, and environment rule in this prompt, including the flat-Bone-background law and all no-prop / no-texture / single-background bans): stage the SAME locked bottle in this environment: ${sceneEnvironmentPrompt}. Product identity remains fully locked — geometry, silhouette, proportions, colors, cap state, component count, and material identity must not change. Only the backdrop, surface, props, lighting mood, and shadow behavior follow this scene direction.`
        : prompt;
    const requestPrompt = isBestBottlesStudioMaster
      ? appendSceneEnvironmentOverride(
          appendMeasuredProportionLock(
            applyBestBottlesVisualTargetPrompt(
              uncalibratedRequestPrompt,
              options.productContext?.bodyMaterial,
              options.productContext?.componentTopology,
            ),
          ),
        )
      : uncalibratedRequestPrompt;
    const calibratedPromptRecord =
      isBestBottlesStudioMaster && options.precompiledPromptRecord
        ? {
            ...options.precompiledPromptRecord,
            prompt_version: sceneEnvironmentPrompt
              ? `${resolvedShadowPolicy.promptVersion}+scene-overlay`
              : resolvedShadowPolicy.promptVersion,
            shadow_owner: resolvedShadowPolicy.owner,
            final_prompt: appendSceneEnvironmentOverride(
              appendMeasuredProportionLock(
                applyBestBottlesVisualTargetPrompt(
                  options.precompiledPromptRecord.final_prompt,
                  options.productContext?.bodyMaterial,
                  options.productContext?.componentTopology,
                ),
              ),
            ),
            qa_checklist: Array.from(
              new Set([
                ...options.precompiledPromptRecord.qa_checklist.filter(
                  (tag) => !/^(?:prompt-version|prompt|shadow-owner|shadow-contract|shadow-smoke-sku|shadow-rollout):/i.test(tag),
                ),
                ...visualTargetTags,
                ...shadowPolicyTags,
              ]),
            ),
          }
        : options.precompiledPromptRecord;

    try {
      const generationStartedAtMs = Date.now();
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
            // Provider policy (Jordan 2026-07-20): pdp-primary/pdp-secondary
            // presets ALWAYS render on GPT Image 2 — the server force stands
            // and the override hatch is not sent (Gemini comparison runs broke
            // the rig contract: -29% aspect on the tall roll-on, 17% under-fill
            // on the swirl sprayer). marketing/scene presets are the Nano
            // Banana lane: a non-OpenAI dropdown selection there sends the
            // hatch so the requested model actually executes.
            allowBestBottlesProviderOverride:
              ["marketing", "scene"].includes(
                getBestBottlesImageAssetRoleForPreset(assembled.preset.id),
              ) &&
              Boolean(options.aiProvider && options.aiProvider !== "openai-image-2"),
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
                  ...(isBestBottlesStudioMasterRequest
                    ? {
                        promptVersion: resolvedShadowPolicy.promptVersion,
                        shadowOwner: resolvedShadowPolicy.owner,
                        shadowContract: resolvedShadowPolicy.contract,
                      }
                    : {}),
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
              promptVersion: resolveBestBottlesReconciliationPromptVersion(
                {
                  graceSku: options.productContext?.sku,
                  websiteSku: options.productContext?.websiteSku,
                  family: options.productContext?.family,
                  bottleCollection: options.productContext?.collection,
                },
                isBestBottlesStudioMasterRequest,
                options.productContext?.promptVersion,
              ),
              rigVersion: options.productContext?.rigVersion,
              providerModel: options.aiProvider ?? DEFAULT_IMAGE_AI_PROVIDER,
              shadowOwner: resolvedShadowPolicy.owner,
              shadowQa: null,
              shadowTopology,
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
          // The aspect gate's truth for detached lanes is the reference ratio
          // measured above — the same number injected into the prompt lock.
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
            shadowTopology,
            maskReferenceUrl: null,
            requireMaskControl: false,
            expectedPrimaryAspectRatio: referenceAspectRatio,
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
          // Shadow QA is advisory, never blocking (Jordan standing policy
          // 2026-07-18, reaffirmed 2026-07-19): measurements are recorded in
          // shadowQa for display; only framing/geometry issues gate.
          const reviewQaIssues = [...rigged.qaIssues];
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
                shadowOwner: rigged.shadowOwner,
                shadowQa: rigged.shadowQa,
                qaIssues: reviewQaIssues,
                framingDecision: rigged.framingDecision,
                lifecycleState: "qa-passed",
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
                shadowOwner: riggedSnapshot?.shadowOwner ?? resolvedShadowPolicy.owner,
                shadowQa: riggedSnapshot?.shadowQa ?? null,
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
            shadowOwner: resolvedShadowPolicy.owner,
            shadowQa: null,
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
        usedProvider:
          typeof data.usedProvider === "string" && data.usedProvider.trim()
            ? data.usedProvider
            : null,
        durationMs: Date.now() - generationStartedAtMs,
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
          // Model-owned shadows carry no machine QA (analyzer removed, Jordan
          // 2026-07-19) — human visual confirmation is the only shadow review.
          qaIssues: riggedSnapshot?.qaIssues ?? [],
          objectBounds: riggedSnapshot?.objectBounds ?? null,
          preTransformObjectBounds: riggedSnapshot?.preTransformObjectBounds ?? null,
          shiftXPx: riggedSnapshot?.shiftXPx ?? null,
          shiftYPx: riggedSnapshot?.shiftYPx ?? null,
          scaleFactor: riggedSnapshot?.scale ?? null,
          maskControlled: riggedSnapshot?.maskControlled ?? false,
          shadowOwner: riggedSnapshot?.shadowOwner ?? resolvedShadowPolicy.owner,
          shadowQa: riggedSnapshot?.shadowQa ?? null,
          shadowTopology,
          promptVersion: resolvedShadowPolicy.promptVersion,
          sourceReferenceHash: null,
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
