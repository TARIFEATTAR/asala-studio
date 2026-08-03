import {
  createPaperDollActionContext,
  databaseError,
  jsonResponse,
  requireArray,
  requireRecord,
  requireString,
  runPaperDollAction,
} from "../_shared/paperDollEdge.ts";
import {
  PaperDollActionError,
  validateNamedAction,
} from "../_shared/paperDollLifecycle.ts";

interface PlateInput {
  bodyVariantKey?: unknown;
  bodyComponentVersionId?: unknown;
  adjustment?: unknown;
}

function positiveNumber(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new PaperDollActionError(
      422,
      "invalid_request",
      `${field} must be positive.`,
      [
        { field, message: `${field} must be positive.` },
      ],
    );
  }
  return number;
}

Deno.serve((request) =>
  runPaperDollAction(request, async () => {
    const body = requireRecord(await request.json());
    const organizationId = requireString(body.organizationId, "organizationId");
    const candidateId = requireString(body.candidateId, "candidateId");
    const familyKey = requireString(body.familyKey, "familyKey");
    const geometryFamilyId = requireString(
      body.geometryFamilyId,
      "geometryFamilyId",
    );
    const expectedContentSha256 = requireString(
      body.expectedContentSha256,
      "expectedContentSha256",
    );
    const expectedAuthorityMaskSha256 = requireString(
      body.expectedAuthorityMaskSha256,
      "expectedAuthorityMaskSha256",
    );
    const approvedByName = requireString(body.approvedByName, "approvedByName");
    const approvalNote = requireString(body.approvalNote, "approvalNote");
    const placementBounds = requireRecord(
      body.placementBounds,
      "placementBounds",
    );
    const plates = requireArray<PlateInput>(body.plates, "plates");
    if (plates.length !== 5) {
      throw new PaperDollActionError(
        422,
        "five_plates_required",
        "Exactly five explicit body plates are required.",
        [
          {
            field: "plates",
            message: "Provide the five locked CYL-9ML body plate versions.",
          },
        ],
      );
    }
    const context = await createPaperDollActionContext(request, organizationId);
    validateNamedAction({
      userId: context.user.id,
      organizationMember: true,
      approvedByName,
      approvalNote,
    });

    const { data: candidate, error: candidateError } = await context.service
      .from("paper_doll_component_candidates")
      .select(
        "id, lifecycle_state, normalized_sha256, authority_mask_sha256, component_id",
      )
      .eq("id", candidateId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (candidateError || !candidate) {
      databaseError(candidateError, "Candidate is unavailable.");
    }
    if (candidate.lifecycle_state !== "family-fit-approved") {
      databaseError(
        null,
        "Candidate must be family-fit-approved before placement lock.",
      );
    }
    if (
      candidate.normalized_sha256 !== expectedContentSha256 ||
      candidate.authority_mask_sha256 !== expectedAuthorityMaskSha256
    ) {
      databaseError(
        null,
        "Candidate or authority-mask identity changed before placement lock.",
      );
    }

    const versionIds = plates.map((plate, index) =>
      requireString(
        plate.bodyComponentVersionId,
        `plates.${index}.bodyComponentVersionId`,
      )
    );
    if (new Set(versionIds).size !== 5) {
      throw new PaperDollActionError(
        422,
        "five_distinct_plates_required",
        "Five distinct body versions are required.",
        [
          {
            field: "plates",
            message: "Duplicate body component versions are not allowed.",
          },
        ],
      );
    }
    const { data: bodyVersions, error: bodyError } = await context.service
      .from("paper_doll_component_versions")
      .select("id, approval_status, width_px, height_px")
      .eq("organization_id", organizationId)
      .in("id", versionIds);
    if (
      bodyError || !bodyVersions || bodyVersions.length !== 5 ||
      bodyVersions.some((row) => row.approval_status !== "approved")
    ) {
      databaseError(
        bodyError,
        "All five body versions must exist and be approved.",
      );
    }

    const { data: latest, error: latestError } = await context.service
      .from("paper_doll_placement_versions")
      .select("version_number")
      .eq("organization_id", organizationId)
      .eq("family_key", familyKey)
      .eq("geometry_family_id", geometryFamilyId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) {
      databaseError(latestError, "Placement version allocation failed.");
    }

    const now = new Date().toISOString();
    const { data: placement, error: placementError } = await context.service
      .from("paper_doll_placement_versions")
      .insert({
        organization_id: organizationId,
        family_key: familyKey,
        geometry_family_id: geometryFamilyId,
        version_number: Number(latest?.version_number ?? 0) + 1,
        width_px: positiveNumber(body.widthPx, "widthPx"),
        center_x_px: Number(body.centerXPx),
        seat_y_px: Number(body.seatYPx),
        placement_bounds: placementBounds,
        authority_mask_sha256: expectedAuthorityMaskSha256,
        placement_status: "locked",
        locked_by_user_id: context.user.id,
        locked_by_display_name: approvedByName,
        lock_note: approvalNote,
        locked_at: now,
      })
      .select("id, version_number")
      .single();
    if (placementError || !placement) {
      databaseError(
        placementError,
        "Placement lock conflicted with another version.",
      );
    }

    const rows = plates.map((plate, index) => {
      const adjustment = requireRecord(
        plate.adjustment,
        `plates.${index}.adjustment`,
      );
      positiveNumber(adjustment.scale, `plates.${index}.adjustment.scale`);
      return {
        organization_id: organizationId,
        placement_version_id: placement.id,
        body_variant_key: requireString(
          plate.bodyVariantKey,
          `plates.${index}.bodyVariantKey`,
        ),
        body_component_version_id: versionIds[index],
        adjustment,
      };
    });
    const { error: platesError } = await context.service
      .from("paper_doll_placement_plates")
      .insert(rows);
    if (platesError) {
      databaseError(
        platesError,
        "Five explicit placement plate rows could not be recorded.",
      );
    }

    const { data: updated, error: candidateUpdateError } = await context.service
      .from("paper_doll_component_candidates")
      .update({ lifecycle_state: "placement-locked" })
      .eq("id", candidateId)
      .eq("organization_id", organizationId)
      .eq("lifecycle_state", "family-fit-approved")
      .select("id")
      .maybeSingle();
    if (candidateUpdateError || !updated) {
      databaseError(
        candidateUpdateError,
        "Candidate changed before placement lock completed.",
      );
    }

    const { data: event, error: eventError } = await context.service
      .from("paper_doll_approval_events")
      .insert({
        organization_id: organizationId,
        candidate_id: candidateId,
        action: "placement-locked",
        approver_user_id: context.user.id,
        approver_display_name: approvedByName,
        approval_note: approvalNote,
        evidence: {
          placementVersionId: placement.id,
          contentSha256: expectedContentSha256,
          authorityMaskSha256: expectedAuthorityMaskSha256,
          bodyComponentVersionIds: versionIds,
        },
      })
      .select("id")
      .single();
    if (eventError || !event) {
      databaseError(
        eventError,
        "Placement approval event could not be appended.",
      );
    }

    return jsonResponse(200, {
      candidateId,
      placementVersionId: placement.id,
      placementVersion: placement.version_number,
      approvalEventId: event.id,
      lifecycleState: "placement-locked",
    });
  })
);
