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

function finiteNumber(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new PaperDollActionError(422, "invalid_request", `${field} must be finite.`, [
      { field, message: `${field} must be finite.` },
    ]);
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
    const { data: existingEvent, error: existingEventError } = await context.service
      .from("paper_doll_approval_events")
      .select("id, approver_user_id, approver_display_name, approval_note, evidence")
      .eq("organization_id", organizationId)
      .eq("candidate_id", candidateId)
      .eq("action", "placement-locked")
      .maybeSingle();
    if (existingEventError) databaseError(existingEventError, "Placement approval evidence is unavailable.");
    if (existingEvent) {
      const evidence = requireRecord(existingEvent.evidence, "existing placement evidence");
      const same = existingEvent.approver_user_id === context.user.id &&
        existingEvent.approver_display_name === approvedByName &&
        existingEvent.approval_note === approvalNote &&
        evidence.contentSha256 === expectedContentSha256 &&
        evidence.authorityMaskSha256 === expectedAuthorityMaskSha256;
      if (!same) databaseError(null, "This placement lock already has different immutable evidence.");
      return jsonResponse(200, {
        candidateId,
        placementVersionId: requireString(evidence.placementVersionId, "existing placement evidence.placementVersionId"),
        approvalEventId: existingEvent.id,
        lifecycleState: "placement-locked",
        idempotent: true,
      });
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

    const requestedWidth = positiveNumber(body.widthPx, "widthPx");
    const requestedCenterX = finiteNumber(body.centerXPx, "centerXPx");
    const requestedSeatY = finiteNumber(body.seatYPx, "seatYPx");
    const rows = plates.map((plate, index) => {
      const adjustment = requireRecord(
        plate.adjustment,
        `plates.${index}.adjustment`,
      );
      positiveNumber(adjustment.scale, `plates.${index}.adjustment.scale`);
      finiteNumber(adjustment.deltaX, `plates.${index}.adjustment.deltaX`);
      finiteNumber(adjustment.deltaY, `plates.${index}.adjustment.deltaY`);
      return {
        organization_id: organizationId,
        placement_version_id: "",
        body_variant_key: requireString(
          plate.bodyVariantKey,
          `plates.${index}.bodyVariantKey`,
        ),
        body_component_version_id: versionIds[index],
        adjustment,
      };
    });
    if (new Set(rows.map((row) => row.body_variant_key)).size !== 5) {
      throw new PaperDollActionError(422, "five_distinct_body_variants_required", "Five distinct body variants are required.", [
        { field: "plates", message: "Duplicate body variant keys are not allowed." },
      ]);
    }

    const { data: result, error: actionError } = await context.service.rpc(
      "paper_doll_lock_factory_placement_atomic",
      {
        p_organization_id: organizationId,
        p_candidate_id: candidateId,
        p_family_key: familyKey,
        p_geometry_family_id: geometryFamilyId,
        p_expected_content_sha256: expectedContentSha256,
        p_expected_authority_mask_sha256: expectedAuthorityMaskSha256,
        p_width_px: requestedWidth,
        p_center_x_px: requestedCenterX,
        p_seat_y_px: requestedSeatY,
        p_placement_bounds: placementBounds,
        p_plates: rows.map((row) => ({
          body_variant_key: row.body_variant_key,
          body_component_version_id: row.body_component_version_id,
          adjustment: row.adjustment,
        })),
        p_actor_user_id: context.user.id,
        p_actor_display_name: approvedByName,
        p_action_note: approvalNote,
      },
    );
    if (actionError || !result) {
      databaseError(actionError, "Atomic factory placement lock could not be completed.");
    }

    return jsonResponse(200, result);
  })
);
