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

import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_IMAGE_AI_PROVIDER } from "@/config/imageSettings";
import type { AssembledPrompt } from "@/lib/product-image/promptAssembler";
import {
  colorCorrectToTarget,
  conformToCanvas,
  dataUrlToBlob,
} from "@/lib/product-image/colorCorrect";
import { runMasterRenderQc } from "@/lib/product-image/qc";
import type { QcResult } from "@/lib/product-image/types";
import { addLibraryTag } from "@/lib/imageLibraryTags";

/** Fallback plate when the preset doesn't specify a solid background. */
const PAPER_DOLL_TARGET_CREAM = "#EEE6D4";

export interface AssembledGenerationResult {
  imageUrl: string;
  savedImageId: string | null;
  prompt: string;
  aspectRatio: string;
  canvas: { widthPx: number; heightPx: number };
  presetId: string;
  sessionId: string;
  /** Seed the edge function generated with — reuse it to reproduce this render. */
  seed: number | null;
  /** QC gate outcome: true/false when the gate ran, null when it didn't apply. */
  qcPassed: boolean | null;
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
    collection?: string;
    category?: string;
    scent_family?: string;
    sku?: string;
    capacityMl?: number | null;
    heightWithoutCap?: string | null;
    heightWithCap?: string | null;
    diameter?: string | null;
    capColor?: string | null;
    trimColor?: string | null;
    applicator?: string | null;
  };
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
  /**
   * Explicit seed for reproducible generation (e.g. re-running the exact
   * recipe of a previous render — read it from the result's `seed`, the
   * Library `seed:` tag, or generated_images.generation_seed).
   *
   * When omitted, Best Bottles studio-master runs derive a STABLE seed from
   * the generation identity (SKU + preset + scene tags), so a catalog run
   * over the same inputs is reproducible by default; repeat attempts for the
   * same identity within this hook instance step the seed deterministically
   * (attempt 1, 2, …) so "generate again" still explores. Non-pipeline runs
   * keep the server's random-seed-per-call behavior.
   */
  seed?: number;
  /**
   * Total generation attempts the QC gate may spend (initial + retries with
   * a stepped seed) before returning the last render tagged qc:failed.
   * Default 2. Set 1 to disable retries (the gate still tags results).
   */
  qcMaxAttempts?: number;
}

/**
 * FNV-1a 32-bit hash → non-negative INT32 (Gemini seed range). Stable across
 * sessions/devices so the same SKU + preset + scene always maps to the same
 * base seed.
 */
function stableSeedFromIdentity(identity: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < identity.length; i++) {
    hash ^= identity.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) & 0x7fffffff;
}

function getExactCanvasForAspectRatio(aspectRatio: string): { widthPx: number; heightPx: number } | null {
  const normalized = aspectRatio.trim().toLowerCase().replace(/\s+/g, "");
  return normalized === "10:11" || normalized === "2080:2288" || normalized === "2080x2288"
    ? { widthPx: 2080, heightPx: 2288 }
    : null;
}

export function useAssembledPromptGeneration() {
  const { user } = useAuth();
  const { currentOrganizationId } = useOnboarding();
  const { toast } = useToast();

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssembledGenerationResult | null>(null);

  // Attempt counter per generation identity (SKU + preset + scene). First
  // attempt in a session uses the stable base seed — reproducible across
  // sessions — and each retry of the same identity steps the seed by one so
  // regenerating explores instead of repeating the identical render on
  // seed-capable providers. Every seed used is recorded on the saved row.
  const attemptByIdentity = useRef(new Map<string, number>());

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
    const rawGlassRef = options.glassSpecularityReferenceImageUrl?.trim() || "";
    const refIsSupported =
      rawRef.length > 0 && !/\.(gif|heic|bmp)(\?|$)/i.test(rawRef);
    const glassRefIsSupported =
      rawGlassRef.length > 0 && !/\.(gif|heic|bmp)(\?|$)/i.test(rawGlassRef);
    const referenceImagesList: Array<{ url: string; label: string; description: string }> = [];
    if (refIsSupported) {
      referenceImagesList.push({
        url: rawRef,
        label: "Product Reference",
        description:
          [
            "Canonical bottle reference (PSD-rendered PNG).",
            "Use this image as an exact product-identity lock: preserve the bottle geometry, camera angle, scale relationships, cap texture, fitment, applicator, glass color, hose/bulb/tassel color, trim metal, and all surface details.",
            "Do not redesign, restyle, recolor, rotate, or reinterpret the product components.",
            "Do allow luxury catalog staging, lighting, background replacement, shadow, and refined PDP canvas placement as instructed by the server prompt.",
          ].join(" "),
      });
    }
    if (glassRefIsSupported) {
      referenceImagesList.push({
        url: rawGlassRef,
        label: "Glass Specularity Style Reference",
        description:
          [
            "Secondary style-only reference.",
            "Use only for realistic glass transparency, refraction, edge glints, specular highlight rhythm, contact shadow, ambient occlusion, and premium studio polish.",
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
    const extraLibraryTags = options.extraLibraryTags
      ? Array.from(new Set([...baseTags, ...options.extraLibraryTags]))
      : baseTags;
    const isBestBottlesStudioMaster =
      hasProductReference &&
      extraLibraryTags.includes("brand:best-bottles") &&
      extraLibraryTags.includes("studio-master");
    const requestPrompt = isBestBottlesStudioMaster
      ? [
          "REFERENCE-LOCKED BEST BOTTLES LUXURY PRODUCT PHOTOGRAPHY V5.1.",
          "Use the uploaded product reference as the source of truth.",
          "Server will build the full locked prompt from productContext, measurements, and reference metadata.",
        ].join("\n")
      : assembled.prompt;

    // Seed resolution. Explicit seed wins; otherwise pipeline (Best Bottles
    // studio-master) runs derive a stable per-identity seed so the 2,300-SKU
    // catalog regenerates reproducibly; everything else stays random.
    let fixedSeed: number | undefined = options.seed;
    if (fixedSeed === undefined && isBestBottlesStudioMaster) {
      const identity = [...extraLibraryTags].sort().join("|");
      const attempt = attemptByIdentity.current.get(identity) ?? 0;
      attemptByIdentity.current.set(identity, attempt + 1);
      fixedSeed = (stableSeedFromIdentity(identity) + attempt) & 0x7fffffff;
    }

    // Post-processing + QC targets, fixed for the whole call. The plate hex
    // comes from the PRESET (Bone #F5F3EF for grid heroes, parchment
    // #EEE6D4 for paper-doll components) — previously everything was
    // snapped to #EEE6D4 regardless of preset. Conform target: the preset's
    // exact canvas, or the known canvas for an aspect override; null means
    // "no exact contract" (skip conform + size check).
    const resolvedAspectRatio =
      options.sceneOverlay?.aspectRatioOverride ?? assembled.preset.aspectRatio;
    const plateHex =
      assembled.preset.backgroundHex !== "transparent"
        ? assembled.preset.backgroundHex
        : PAPER_DOLL_TARGET_CREAM;
    const conformTarget = options.sceneOverlay?.aspectRatioOverride
      ? getExactCanvasForAspectRatio(resolvedAspectRatio)
      : assembled.canvas;
    const shouldColorCorrect =
      extraLibraryTags.includes("brand:best-bottles") &&
      !options.sceneOverlay?.backgroundPresetId &&
      !options.sceneOverlay?.backgroundPrompt;
    // QC gate applies exactly where the canonical plate applies: Best
    // Bottles renders on the preset's solid background. Marketing/scene
    // overrides are exempt (compositions are off-plate by design).
    const qcEnabled = shouldColorCorrect;
    const maxAttempts = qcEnabled ? Math.max(1, options.qcMaxAttempts ?? 2) : 1;
    let lastQc: QcResult | null = null;

    try {
      for (let qcAttempt = 0; qcAttempt < maxAttempts; qcAttempt++) {
      // QC retries step the seed so the retry explores a different render
      // instead of reproducing the failed one on seed-capable providers.
      const attemptSeed =
        fixedSeed !== undefined ? (fixedSeed + qcAttempt) & 0x7fffffff : undefined;

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
            // Background overlay flows through the same fields Dark Room
            // uses; the edge function's Director Mode appends them as a
            // BACKGROUND STYLE block ahead of the bottle's product spec.
            backgroundPresetId: options.sceneOverlay?.backgroundPresetId ?? undefined,
            backgroundPrompt: options.sceneOverlay?.backgroundPrompt ?? undefined,
            extraLibraryTags,
            productContext: options.productContext,
            fixedSeed: attemptSeed,
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

      if (!data?.imageUrl) {
        const message = "Edge function returned no image URL.";
        setError(message);
        toast({ title: "No image returned", description: message, variant: "destructive" });
        return null;
      }

      // Post-process: snap the rendered plate to the preset's exact hex
      // (gpt-image-2 drifts a few percent off even when the prompt locks
      // it), then conform onto the preset's exact canvas — providers return
      // model-native sizes and the edge function skips conformance on this
      // path, so the pixel contract is enforced here. Only runs for Best
      // Bottles renders on the canonical plate (custom scene backgrounds
      // are left alone).
      const savedImageId = data.savedImageId ?? null;
      let finalImageUrl = data.imageUrl;
      let qcBlob: Blob | null = null;
      if (shouldColorCorrect && currentOrganizationId) {
        try {
          const correctedDataUrl = await colorCorrectToTarget(
            data.imageUrl,
            plateHex,
          );
          const conformedDataUrl = conformTarget
            ? await conformToCanvas(correctedDataUrl, conformTarget, plateHex)
            : correctedDataUrl;
          const blob = dataUrlToBlob(conformedDataUrl);
          qcBlob = blob;
          const ts = Date.now();
          const rand = Math.random().toString(36).slice(2, 8);
          const path = `${currentOrganizationId}/${user.id}/paper-doll/master_corrected_${ts}_${rand}.png`;
          const { error: uploadError } = await supabase.storage
            .from("generated-images")
            .upload(path, blob, {
              cacheControl: "3600",
              upsert: false,
              contentType: "image/png",
            });
          if (uploadError) {
            console.warn("[useAssembledPromptGeneration] color-corrected upload failed", uploadError);
          } else {
            const { data: urlData } = supabase.storage
              .from("generated-images")
              .getPublicUrl(path);
            if (urlData?.publicUrl) {
              finalImageUrl = urlData.publicUrl;
              if (savedImageId) {
                const { error: updateError } = await supabase
                  .from("generated_images")
                  .update({ image_url: finalImageUrl })
                  .eq("id", savedImageId);
                if (updateError) {
                  console.warn(
                    "[useAssembledPromptGeneration] generated_images.image_url patch failed",
                    updateError,
                  );
                }
              }
            }
          }
        } catch (e) {
          console.warn("[useAssembledPromptGeneration] color correction skipped", e);
        }
      }

      // QC gate: verify plate hex, exact canvas, and centering on the final
      // bytes. Hard fail → tag the row and retry with a stepped seed; the
      // last attempt is returned either way (tagged qc:failed) so the
      // operator decides, instead of silently shipping an out-of-contract
      // render into the Library.
      lastQc = null;
      if (qcEnabled && qcBlob) {
        try {
          lastQc = await runMasterRenderQc(qcBlob, {
            plateHex,
            expectedCanvas: conformTarget ?? undefined,
            checkCenter: !options.sceneOverlay,
          });
          if (savedImageId) {
            const failedIds = lastQc.checks
              .filter((c) => c.severity === "hard_fail" && !c.passed)
              .map((c) => c.id);
            const rowId = savedImageId;
            const passed = lastQc.passed;
            void (async () => {
              await addLibraryTag(rowId, passed ? "qc:passed" : "qc:failed");
              for (const id of failedIds) await addLibraryTag(rowId, `qc-fail:${id}`);
            })();
          }
          if (!lastQc.passed && qcAttempt < maxAttempts - 1) {
            console.warn(
              "[useAssembledPromptGeneration] QC hard fail — retrying with stepped seed",
              lastQc.retryReasons,
            );
            toast({
              title: `QC failed — retrying (${qcAttempt + 2}/${maxAttempts})`,
              description: lastQc.retryReasons[0] ?? "Render out of contract.",
            });
            continue;
          }
        } catch (qcError) {
          // QC needs createImageBitmap/OffscreenCanvas — if unavailable,
          // skip the gate rather than block generation.
          console.warn("[useAssembledPromptGeneration] QC gate skipped", qcError);
          lastQc = null;
        }
      }

      const resolvedCanvas =
        getExactCanvasForAspectRatio(resolvedAspectRatio) ?? assembled.canvas;
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
        seed: typeof data.seed === "number" ? data.seed : attemptSeed ?? null,
        qcPassed: lastQc ? lastQc.passed : null,
      };
      setResult(generated);
      if (lastQc && !lastQc.passed) {
        toast({
          title: "Generated — QC failed",
          description:
            lastQc.retryReasons[0] ??
            "Render is out of contract after all attempts; tagged qc:failed in the Library.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Image generated",
          description: `${assembled.preset.label} · ${resolvedCanvas.widthPx} × ${resolvedCanvas.heightPx}${lastQc?.passed ? " · QC passed" : ""}`,
        });
      }
      return generated;
      }
      // Unreachable: the loop always returns or continues, and the final
      // iteration always returns.
      return null;
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
