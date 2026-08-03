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

function sameNumericRecord(left: unknown, right: unknown, keys: string[]): boolean {
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return keys.every((key) => Number(a[key]) === Number(b[key]));
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

    const { data: latest, error: latestError } = await context.service
      .from("paper_doll_placement_versions")
      .select("id, version_number, width_px, center_x_px, seat_y_px, placement_bounds, authority_mask_sha256")
      .eq("organization_id", organizationId)
      .eq("family_key", familyKey)
      .eq("geometry_family_id", geometryFamilyId)
      .eq("placement_status", "locked")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) {
      databaseError(latestError, "Placement version allocation failed.");
    }

    let placement: { id: string; version_number: number } | null = null;
    let placementReused = false;
    if (latest &&
      Number(latest.width_px) === requestedWidth &&
      Number(latest.center_x_px) === requestedCenterX &&
      Number(latest.seat_y_px) === requestedSeatY &&
      latest.authority_mask_sha256 === expectedAuthorityMaskSha256 &&
      sameNumericRecord(latest.placement_bounds, placementBounds, ["left", "top", "width", "height"])) {
      const { data: existingPlates, error: existingPlatesError } = await context.service
        .from("paper_doll_placement_plates")
        .select("body_variant_key, body_component_version_id, adjustment")
        .eq("organization_id", organizationId)
        .eq("placement_version_id", latest.id);
      if (existingPlatesError) databaseError(existingPlatesError, "Shared placement plates are unavailable.");
      const expectedByVariant = new Map(rows.map((row) => [row.body_variant_key, row]));
      const platesMatch = existingPlates?.length === 5 && existingPlates.every((existing) => {
        const expected = expectedByVariant.get(existing.body_variant_key);
        if (!expected) return false;
        return expected.body_component_version_id === existing.body_component_version_id &&
          sameNumericRecord(existing.adjustment, expected.adjustment, ["deltaX", "deltaY", "scale"]);
      });
      if (platesMatch) {
        placement = { id: latest.id, version_number: Number(latest.version_number) };
        placementReused = true;
      }
    }

    if (!placement) {
      const now = new Date().toISOString();
      const { data: inserted, error: placementError } = await context.service
        .from("paper_doll_placement_versions")
        .insert({
          organization_id: organizationId,
          family_key: familyKey,
          geometry_family_id: geometryFamilyId,
          version_number: Number(latest?.version_number ?? 0) + 1,
          width_px: requestedWidth,
          center_x_px: requestedCenterX,
          seat_y_px: requestedSeatY,
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
      if (placementError || !inserted) databaseError(placementError, "Placement lock conflicted with another version.");
      placement = inserted;
      const { error: platesError } = await context.service
        .from("paper_doll_placement_plates")
        .insert(rows.map((row) => ({ ...row, placement_version_id: placement!.id })));
      if (platesError) databaseError(platesError, "Five explicit placement plate rows could not be recorded.");
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
          placementReused,
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
      placementReused,
      idempotent: false,
    });
  })
);
