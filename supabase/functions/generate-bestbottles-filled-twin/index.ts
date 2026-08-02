import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  decode as decodeBase64,
  encode as encodeBase64,
} from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

import OpenAIProvider from "../_shared/openaiProvider.ts";
import {
  buildFilledHoverTwinLibraryTags,
  buildFilledHoverTwinProviderInput,
  FILLED_HOVER_TWIN_PARENT_APPROVAL_TAG,
  validateFilledHoverTwinEdgeRequest,
} from "../_shared/bestBottlesFilledHoverTwinContract.ts";
import {
  evaluateFilledHoverTwinQa,
  type FilledHoverTwinPixelPlane,
} from "../_shared/bestBottlesFilledHoverTwinQa.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_INPUT_BYTES = 12 * 1024 * 1024;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeContentType(value: string | null): string {
  return value?.split(";")[0].trim().toLowerCase() || "application/octet-stream";
}

async function fetchImageBytes(url: string, label: string): Promise<{
  bytes: Uint8Array;
  mimeType: string;
}> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} download failed (${response.status}).`);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_INPUT_BYTES) throw new Error(`${label} exceeds the 12 MB limit.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_INPUT_BYTES) {
    throw new Error(`${label} is empty or exceeds the 12 MB limit.`);
  }
  return {
    bytes,
    mimeType: normalizeContentType(response.headers.get("content-type")),
  };
}

function imagePlane(image: Image): FilledHoverTwinPixelPlane {
  return {
    width: image.width,
    height: image.height,
    rgba: image.bitmap,
  };
}

function hasExactTag(tags: string[], value: string): boolean {
  return tags.some((tag) => tag === value);
}

function isReviewedMaskStorageUrl(
  maskUrl: string,
  supabaseUrl: string,
  userId: string,
): boolean {
  const actual = new URL(maskUrl);
  const expected = new URL(supabaseUrl);
  const prefix = `/storage/v1/object/public/reference-images/${userId}/filled-hover-masks/`;
  return actual.origin === expected.origin &&
    actual.pathname.startsWith(prefix) &&
    actual.pathname.toLowerCase().endsWith(".png");
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "POST required" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Supabase service configuration missing" });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json(400, { error: "Malformed JSON request" });
  }
  const validation = validateFilledHoverTwinEdgeRequest(input);
  if (!validation.ok) {
    return json(400, { error: "Invalid filled-hover-twin request", issues: validation.issues });
  }
  const body = validation.request;

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "Authentication required" });
  const user = authData.user;

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", body.organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) {
    return json(403, { error: "Organization membership required" });
  }

  if (!isReviewedMaskStorageUrl(body.mask.imageUrl, supabaseUrl, user.id)) {
    return json(400, {
      error: "Reviewed mask must be an authenticated PNG in the user's filled-hover-masks intake path.",
    });
  }

  const { data: parent, error: parentError } = await supabase
    .from("generated_images")
    .select(
      "id, organization_id, user_id, session_id, session_name, image_url, aspect_ratio, chain_depth, library_tags, is_archived",
    )
    .eq("id", body.parentImageId)
    .eq("organization_id", body.organizationId)
    .maybeSingle();
  if (parentError || !parent || parent.is_archived) {
    return json(404, { error: "Approved marketing parent not found" });
  }

  const parentTags = Array.isArray(parent.library_tags)
    ? parent.library_tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const parentIsMarketing = hasExactTag(parentTags, "brand:best-bottles") &&
    (hasExactTag(parentTags, "scene-flexible") || hasExactTag(parentTags, "marketing"));
  const identityMatches = hasExactTag(parentTags, `sku:${body.graceSku}`) &&
    hasExactTag(parentTags, `websiteSku:${body.websiteSku}`);
  const parentApproved = hasExactTag(parentTags, FILLED_HOVER_TWIN_PARENT_APPROVAL_TAG);
  if (!parentIsMarketing || !identityMatches || !parentApproved) {
    return json(400, {
      error: "Parent must be an explicitly approved Best Bottles marketing scene with exact pilot identity tags.",
    });
  }

  const { count: priorAttemptCount, error: priorAttemptError } = await supabase
    .from("generated_images")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", body.organizationId)
    .eq("parent_image_id", body.parentImageId)
    .contains("library_tags", ["filled-twin"]);
  if (priorAttemptError) {
    return json(500, { error: "Could not verify the filled-twin attempt budget." });
  }
  if ((priorAttemptCount ?? 0) >= 2) {
    return json(409, {
      error: "The two-attempt filled-twin pilot budget is exhausted for this parent.",
      publishEligible: false,
    });
  }

  try {
    const [parentInput, maskInput] = await Promise.all([
      fetchImageBytes(parent.image_url, "Parent image"),
      fetchImageBytes(body.mask.imageUrl, "Reviewed cavity mask"),
    ]);
    if (!parentInput.mimeType.startsWith("image/")) {
      throw new Error("Parent reference is not an image.");
    }
    if (maskInput.mimeType !== "image/png") {
      throw new Error("Reviewed cavity mask must resolve as image/png.");
    }

    const [parentImage, maskImage] = await Promise.all([
      Image.decode(parentInput.bytes) as Promise<Image>,
      Image.decode(maskInput.bytes) as Promise<Image>,
    ]);
    if (parentImage.width !== maskImage.width || parentImage.height !== maskImage.height) {
      return json(400, { error: "Reviewed cavity mask dimensions must exactly match the parent." });
    }

    const providerInput = buildFilledHoverTwinProviderInput(body, {
      parentBase64: encodeBase64(Uint8Array.from(parentInput.bytes).buffer),
      parentMimeType: parentInput.mimeType,
      maskBase64: encodeBase64(Uint8Array.from(maskInput.bytes).buffer),
    });
    const providerResult = await OpenAIProvider.generateImage(providerInput);
    const childBytes = decodeBase64(providerResult.imageBase64);
    const childImage = await Image.decode(childBytes) as Image;
    const pairQa = evaluateFilledHoverTwinQa({
      parent: imagePlane(parentImage),
      child: imagePlane(childImage),
      mask: imagePlane(maskImage),
      targetFillPercent: body.liquid.fillPercent,
      fillTolerancePercent: 3,
      outsideMaskCodecTolerance: 3,
    });

    const childId = crypto.randomUUID();
    const storagePath =
      `${body.organizationId}/marketing-hover-twins/${body.parentImageId}/${childId}.png`;
    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(storagePath, childBytes, { contentType: "image/png", upsert: false });
    if (uploadError) throw uploadError;
    const imageUrl = supabase.storage.from("generated-images")
      .getPublicUrl(storagePath).data.publicUrl;
    const libraryTags = buildFilledHoverTwinLibraryTags(body, pairQa.status);

    const { data: child, error: insertError } = await supabase
      .from("generated_images")
      .insert({
        id: childId,
        organization_id: body.organizationId,
        user_id: user.id,
        session_id: parent.session_id,
        session_name: `Filled hover twin · ${body.graceSku}`,
        goal_type: "marketing_hover_filled",
        library_category: "content",
        aspect_ratio: parent.aspect_ratio || `${childImage.width}:${childImage.height}`,
        output_format: "png",
        final_prompt: providerInput.prompt,
        image_url: imageUrl,
        generation_provider: providerResult.model,
        media_type: "image",
        description: pairQa.status === "pass"
          ? "Filled hover twin awaiting human review"
          : "Rejected filled hover twin retained for review",
        saved_to_library: true,
        parent_image_id: body.parentImageId,
        chain_depth: Number(parent.chain_depth ?? 0) + 1,
        is_chain_origin: false,
        refinement_instruction: providerInput.prompt,
        library_tags: libraryTags,
        reference_images: [{
          url: parent.image_url,
          label: "Approved Empty Marketing Parent",
          description: "Submitted exactly once as the exterior and scene truth.",
        }, {
          url: body.mask.imageUrl,
          label: "Reviewed Interior Edit Mask",
          description: `Reviewed by ${body.mask.reviewedBy}; transparent cavity pixels are editable.`,
        }],
        brand_context_used: {
          filledHoverTwin: {
            version: "best-bottles-filled-hover-twin-v1",
            marketingOnly: true,
            publishEligible: false,
            humanApprovalStatus: "pending",
            parentImageId: body.parentImageId,
            graceSku: body.graceSku,
            websiteSku: body.websiteSku,
            liquid: body.liquid,
            mask: body.mask,
            pairQa,
          },
        },
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    return json(200, {
      childImageId: child.id,
      imageUrl,
      parentImageId: body.parentImageId,
      pairQa,
      reviewStatus: pairQa.status === "pass" ? "review-pending" : "rejected",
      publishEligible: false,
    });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : String(error),
      publishEligible: false,
    });
  }
});
