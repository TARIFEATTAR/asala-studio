import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  decode,
  encode,
} from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

import { callGeminiImage } from "../_shared/aiProviders.ts";
import OpenAIProvider from "../_shared/openaiProvider.ts";
import { conformImageToCanvas } from "../_shared/imageAspectRatio.ts";
import {
  buildRoleSemanticReviewChecklist,
  buildMaterialPilotScaleContract,
  buildWholeRasterNormalizationPlan,
  evaluateNativeBoneCanvas,
  evaluateMaterialPilotScaleQa,
  getMaterialPilotRenderer,
  type MaterialPilotAssetRole,
  type MaterialPilotReference,
  type MaterialPilotRendererId,
  type MaterialPilotScaleContract,
  validateMaterialPilotRequest,
} from "../_shared/bestBottlesMaterialPilot.ts";
import {
  buildMaterialPilotProviderRequest,
  executeMaterialPilotRenderer,
} from "../_shared/bestBottlesMaterialPilotRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PilotRequestBody {
  runId: string;
  organizationId: string;
  jobKey: string;
  websiteSku: string;
  graceSku: string;
  family: string;
  assetRole: MaterialPilotAssetRole;
  rendererId: MaterialPilotRendererId;
  attemptOrdinal: number;
  prompt: string;
  promptHash: string;
  promptVersion: string;
  canonicalTruth: Record<string, unknown>;
  canonicalTruthHash: string;
  scaleContract: MaterialPilotScaleContract;
  references: MaterialPilotReference[];
  codeVersion?: string;
}

function canonicalNumber(
  canonical: Record<string, unknown>,
  key: string,
): number {
  const value = Number(canonical[key]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Canonical truth lacks positive ${key}.`);
  }
  return value;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: Uint8Array | string): Promise<string> {
  const source = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input;
  const bytes = Uint8Array.from(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer);
  return [...new Uint8Array(digest)].map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${
      Object.keys(record).sort().map((key) =>
        `${JSON.stringify(key)}:${stableStringify(record[key])}`
      ).join(",")
    }}`;
  }
  return JSON.stringify(value);
}

function jwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
    );
    return typeof decoded.role === "string" ? decoded.role : null;
  } catch {
    return null;
  }
}

function sampleBoneBorder(image: Image): Array<[number, number, number]> {
  const x = [
    8,
    Math.round(image.width * .25),
    Math.round(image.width * .5),
    Math.round(image.width * .75),
    image.width - 9,
  ];
  const y = [
    8,
    Math.round(image.height * .12),
    Math.round(image.height * .3),
    image.height - 9,
  ];
  const samples: Array<[number, number, number]> = [];
  for (const px of x) {
    for (const py of y) {
      if (
        px !== 8 && px !== image.width - 9 && py !== 8 &&
        py !== image.height - 9
      ) continue;
      const rgba = image.getRGBAAt(px, py);
      samples.push([rgba[0], rgba[1], rgba[2]]);
    }
  }
  return samples;
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") return json(405, { error: "POST required" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Supabase service configuration missing" });
  }
  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const supabase = createClient(supabaseUrl, serviceKey);
  let body: PilotRequestBody;
  let attemptId: string | null = null;
  const startedAt = Date.now();

  try {
    // JWT signature/authenticity is enforced by the Supabase gateway before
    // this function executes. The extra header prevents accidental use of a
    // service token through the interactive client path.
    const trustedServiceAutomation = jwtRole(token) === "service_role" &&
      request.headers.get("x-material-pilot-automation") === "service";
    const { data: authData, error: authError } = trustedServiceAutomation
      ? { data: { user: null }, error: null }
      : await supabase.auth.getUser(token);
    if (!trustedServiceAutomation && (authError || !authData.user)) {
      return json(401, { error: "Authentication required" });
    }
    body = await request.json();
    if (
      !body || typeof body.runId !== "string" ||
      typeof body.organizationId !== "string" ||
      typeof body.family !== "string" ||
      typeof body.websiteSku !== "string" ||
      typeof body.graceSku !== "string" ||
      typeof body.prompt !== "string" ||
      !body.scaleContract ||
      !Array.isArray(body.references)
    ) {
      return json(400, { error: "Malformed material pilot request" });
    }

    if (!trustedServiceAutomation) {
      const { data: membership } = await supabase.from("organization_members")
        .select("organization_id").eq("organization_id", body.organizationId)
        .eq("user_id", authData.user!.id).maybeSingle();
      if (!membership) {
        return json(403, { error: "Organization membership required" });
      }
    }

    const validation = validateMaterialPilotRequest(body);
    if (!validation.ok) {
      return json(400, {
        error: "Invalid pilot request",
        issues: validation.issues,
      });
    }
    if (await sha256Hex(body.prompt) !== body.promptHash.toLowerCase()) {
      return json(400, { error: "Prompt hash mismatch" });
    }
    if (
      await sha256Hex(stableStringify(body.canonicalTruth)) !==
        body.canonicalTruthHash.toLowerCase()
    ) {
      return json(400, { error: "Canonical truth hash mismatch" });
    }
    const resolvedScaleContract = buildMaterialPilotScaleContract({
      capacityMl: canonicalNumber(body.canonicalTruth, "capacityMl"),
      canonBodyHeightMm: canonicalNumber(
        body.canonicalTruth,
        "canon_bodyHeightMm",
      ),
      canonBodyWidthMm: canonicalNumber(
        body.canonicalTruth,
        "canon_widthAxisMm",
      ),
      canonAssembledHeightMm: canonicalNumber(
        body.canonicalTruth,
        "canon_heightWithCapMm",
      ),
    });
    if (
      stableStringify(resolvedScaleContract) !==
        stableStringify(body.scaleContract)
    ) {
      return json(400, { error: "Comparative scale contract mismatch" });
    }
    const scaleQa = evaluateMaterialPilotScaleQa(
      resolvedScaleContract,
      null,
    );

    const { data: run, error: runError } = await supabase.from(
      "best_bottles_material_pilot_runs",
    )
      .select(
        "id, organization_id, renderer_ids, price_card, price_card_version",
      )
      .eq("id", body.runId).eq("organization_id", body.organizationId).single();
    if (runError || !run) return json(404, { error: "Pilot run not found" });
    if (!run.renderer_ids.includes(body.rendererId)) {
      return json(400, { error: "Renderer is not part of this run" });
    }

    const referencePayloads = [];
    for (const reference of body.references) {
      const response = await fetch(reference.url);
      if (!response.ok) {
        throw new Error(`Reference download failed (${response.status})`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (await sha256Hex(bytes) !== reference.sha256.toLowerCase()) {
        throw new Error(`Reference hash mismatch for ${reference.role}`);
      }
      referencePayloads.push({
        role: reference.role,
        data: encode(bytes.buffer),
        mimeType: response.headers.get("content-type")?.split(";")[0] ||
          "image/png",
        sha256: reference.sha256,
      });
    }

    const providerRequest = buildMaterialPilotProviderRequest({
      rendererId: body.rendererId,
      prompt: body.prompt,
      references: referencePayloads,
    });
    const renderer = getMaterialPilotRenderer(body.rendererId)!;
    const estimatedCost = Number(
      run.price_card?.[body.rendererId]?.estimated_cost_usd ?? 0,
    );
    const attemptInsert = {
      run_id: body.runId,
      organization_id: body.organizationId,
      job_key: body.jobKey,
      website_sku: body.websiteSku,
      grace_sku: body.graceSku,
      family: body.family,
      asset_role: body.assetRole,
      renderer_id: body.rendererId,
      gateway_provider: renderer.provider,
      underlying_provider: renderer.provider,
      model_identifier: renderer.model,
      endpoint_identifier: providerRequest.endpoint,
      attempt_ordinal: body.attemptOrdinal,
      status: "queued",
      reference_manifest: body.references,
      prompt_text: body.prompt,
      prompt_hash: body.promptHash,
      prompt_version: body.promptVersion,
      canonical_truth: body.canonicalTruth,
      canonical_truth_hash: body.canonicalTruthHash,
      framing_qa: scaleQa,
      request_parameters: providerRequest.parameters,
      requested_width_px: 2080,
      requested_height_px: 2288,
      estimated_cost_usd: estimatedCost,
      price_card_version: run.price_card_version,
      code_version: body.codeVersion,
      function_version: "material-pilot-v1",
      publish_eligible: false,
      background_mutated: false,
    };
    const { data: inserted, error: insertError } = await supabase.from(
      "best_bottles_material_pilot_attempts",
    ).insert(attemptInsert).select("id").single();
    if (insertError) throw insertError;
    attemptId = inserted.id;
    await supabase.rpc("best_bottles_material_pilot_mark_attempt_launched", {
      target_run_id: body.runId,
    });
    await supabase.from("best_bottles_material_pilot_attempts").update({
      status: "running",
      provider_started_at: new Date().toISOString(),
    }).eq("id", attemptId);

    const providerResult = await executeMaterialPilotRenderer(providerRequest, {
      openai: async (input) => {
        const result = await OpenAIProvider.generateImage({
          prompt: input.prompt,
          model: "gpt-image-2",
          size: "2080x2288",
          quality: "high",
          background: "opaque",
          outputFormat: "png",
          n: 1,
          referenceImages: input.references.map(({ data, mimeType }) => ({
            data,
            mimeType,
          })),
        });
        return {
          imageBase64: result.imageBase64,
          mimeType: result.mimeType,
          model: result.model,
          endpoint: result.endpoint,
        };
      },
      google: async (input) => {
        const result = await callGeminiImage({
          prompt: input.prompt,
          model: "models/gemini-3.1-flash-image-preview",
          aspectRatio: "1:1",
          imageSize: "2K",
          referenceImages: input.references.map(({ data, mimeType }) => ({
            data,
            mimeType,
          })),
        });
        return {
          imageBase64: result.data,
          mimeType: result.mimeType,
          model: input.model,
          endpoint: input.endpoint,
        };
      },
    });

    const rawBytes = decode(providerResult.imageBase64);
    const rawImage = await Image.decode(rawBytes) as Image;
    const normalization = buildWholeRasterNormalizationPlan(
      body.rendererId,
      rawImage.width,
      rawImage.height,
    );
    const conformed = await conformImageToCanvas(
      providerResult.imageBase64,
      2080,
      2288,
    );
    const finalBytes = decode(conformed.base64);
    const finalImage = await Image.decode(finalBytes) as Image;
    const nativeBoneQa = evaluateNativeBoneCanvas(sampleBoneBorder(finalImage));
    const semanticQa = buildRoleSemanticReviewChecklist(body.assetRole);
    const failureReasons = [...nativeBoneQa.failureReasons];
    const storageRoot =
      `${body.organizationId}/material-pilot/${body.runId}/${attemptId}`;
    const rawPath = `${storageRoot}/raw.png`;
    const finalPath = `${storageRoot}/final.png`;
    for (
      const [path, bytes] of [[rawPath, rawBytes], [
        finalPath,
        finalBytes,
      ]] as const
    ) {
      const { error } = await supabase.storage.from("generated-images").upload(
        path,
        bytes,
        { contentType: "image/png", upsert: false },
      );
      if (error) throw error;
    }
    const rawUrl =
      supabase.storage.from("generated-images").getPublicUrl(rawPath).data
        .publicUrl;
    const finalUrl =
      supabase.storage.from("generated-images").getPublicUrl(finalPath).data
        .publicUrl;
    const completedAt = new Date().toISOString();
    await supabase.from("best_bottles_material_pilot_attempts").update({
      status: "completed",
      provider_completed_at: completedAt,
      qa_completed_at: completedAt,
      returned_width_px: rawImage.width,
      returned_height_px: rawImage.height,
      returned_mime_type: providerResult.mimeType,
      raw_image_url: rawUrl,
      raw_image_hash: await sha256Hex(rawBytes),
      final_image_url: finalUrl,
      final_image_hash: await sha256Hex(finalBytes),
      transform_recipe: normalization,
      native_bone_qa: nativeBoneQa,
      semantic_qa: semanticQa,
      framing_qa: scaleQa,
      automated_decision: nativeBoneQa.pass ? null : "reject",
      failure_reasons: failureReasons,
      duration_ms: Date.now() - startedAt,
      provider_response_metadata: providerResult.responseMetadata ?? {},
      provider_request_id: providerResult.providerRequestId ?? null,
      publish_eligible: false,
      background_mutated: false,
    }).eq("id", attemptId);
    await supabase.rpc("best_bottles_material_pilot_mark_attempt_completed", {
      target_run_id: body.runId,
    });
    return json(200, {
      attemptId,
      finalImageUrl: finalUrl,
      nativeBoneQa,
      publishEligible: false,
    });
  } catch (error) {
    if (attemptId) {
      await supabase.from("best_bottles_material_pilot_attempts").update({
        status: "failed",
        failure_stage: "execution",
        failure_code: "pilot_execution_failed",
        failure_reasons: ["provider_or_evidence_error"],
        error_message: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startedAt,
        publish_eligible: false,
        background_mutated: false,
      }).eq("id", attemptId);
    }
    return json(500, {
      error: error instanceof Error ? error.message : String(error),
      attemptId,
    });
  }
});
