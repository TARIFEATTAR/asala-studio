import {
  createPaperDollActionContext,
  databaseError,
  jsonResponse,
  requireRecord,
  requireString,
  runPaperDollAction,
} from "../_shared/paperDollEdge.ts";
import {
  type PaperDollLifecycleState,
  validateApprovalRequest,
} from "../_shared/paperDollLifecycle.ts";

Deno.serve((request) =>
  runPaperDollAction(request, async () => {
    const body = requireRecord(await request.json());
    const organizationId = requireString(body.organizationId, "organizationId");
    const candidateId = requireString(body.candidateId, "candidateId");
    const action = requireString(body.action, "action");
    if (action !== "pixels-approved" && action !== "family-fit-approved") {
      return jsonResponse(422, {
        code: "invalid_action",
        message: "Action must be pixels-approved or family-fit-approved.",
        issues: [{ field: "action", message: "Unsupported approval action." }],
      });
    }
    const approvedByName = requireString(body.approvedByName, "approvedByName");
    const approvalNote = requireString(body.approvalNote, "approvalNote");
    const expectedLifecycleState = requireString(
      body.expectedLifecycleState,
      "expectedLifecycleState",
    ) as PaperDollLifecycleState;
    const expectedContentSha256 = requireString(
      body.expectedContentSha256,
      "expectedContentSha256",
    );
    const context = await createPaperDollActionContext(request, organizationId);

    const { data: candidate, error: candidateError } = await context.service
      .from("paper_doll_component_candidates")
      .select("id, lifecycle_state, normalized_sha256, layer_sha256, component_id, qa")
      .eq("id", candidateId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (candidateError) {
      databaseError(candidateError, "Candidate lookup failed.");
    }
    if (!candidate) databaseError(null, "Candidate is unavailable or stale.");

    const componentVersion = action === "pixels-approved"
      ? await (async () => {
        const { data, error } = await context.service
          .from("paper_doll_component_versions")
          .select("id, approval_status")
          .eq("organization_id", organizationId)
          .eq("component_id", candidate.component_id)
          .eq("image_sha256", candidate.layer_sha256);
        if (error || !data || data.length !== 1) {
          databaseError(error, "Pixel approval requires one exact candidate component version.");
        }
        if (!new Set(["candidate", "approved"]).has(data[0].approval_status)) {
          databaseError(null, "The exact component version is not eligible for pixel approval.");
        }
        return data[0] as { id: string; approval_status: string };
      })()
      : null;

    const ensureComponentVersionApproved = async () => {
      if (!componentVersion || componentVersion.approval_status === "approved") return;
      const { data, error } = await context.service
        .from("paper_doll_component_versions")
        .update({ approval_status: "approved" })
        .eq("id", componentVersion.id)
        .eq("organization_id", organizationId)
        .eq("approval_status", "candidate")
        .select("id")
        .maybeSingle();
      if (error || !data) databaseError(error, "Exact component version could not be promoted with pixel approval.");
    };

    const { data: existing } = await context.service
      .from("paper_doll_approval_events")
      .select(
        "id, approver_user_id, approver_display_name, approval_note, evidence",
      )
      .eq("organization_id", organizationId)
      .eq("candidate_id", candidateId)
      .eq("action", action)
      .maybeSingle();
    if (existing) {
      const same = existing.approver_user_id === context.user.id &&
        existing.approver_display_name === approvedByName &&
        existing.approval_note === approvalNote;
      if (!same) {
        databaseError(
          null,
          "This approval action already has different immutable evidence.",
        );
      }
      await ensureComponentVersionApproved();
      return jsonResponse(200, {
        candidateId,
        lifecycleState: action,
        approvalEventId: existing.id,
        idempotent: true,
      });
    }

    const qa = requireRecord(candidate.qa, "qa") as {
      geometryLocked?: unknown;
      minIoU?: unknown;
      mismatchedPixels?: unknown;
    };
    validateApprovalRequest({
      action,
      userId: context.user.id,
      organizationMember: true,
      approvedByName,
      approvalNote,
      expectedLifecycleState,
      actualLifecycleState: candidate
        .lifecycle_state as PaperDollLifecycleState,
      expectedContentSha256,
      actualContentSha256: String(candidate.normalized_sha256),
      qa: {
        geometryLocked: qa.geometryLocked === true,
        minIoU: Number(qa.minIoU),
        mismatchedPixels: Number(qa.mismatchedPixels),
      },
    });

    const { data: updated, error: updateError } = await context.service
      .from("paper_doll_component_candidates")
      .update({ lifecycle_state: action })
      .eq("id", candidateId)
      .eq("organization_id", organizationId)
      .eq("lifecycle_state", expectedLifecycleState)
      .eq("normalized_sha256", expectedContentSha256)
      .select("id, lifecycle_state")
      .maybeSingle();
    if (updateError || !updated) {
      databaseError(
        updateError,
        "Candidate changed before approval could be recorded.",
      );
    }

    const evidence = {
      expectedLifecycleState,
      contentSha256: expectedContentSha256,
      qa,
    };
    const { data: event, error: eventError } = await context.service
      .from("paper_doll_approval_events")
      .insert({
        organization_id: organizationId,
        candidate_id: candidateId,
        action,
        approver_user_id: context.user.id,
        approver_display_name: approvedByName,
        approval_note: approvalNote,
        evidence,
      })
      .select("id")
      .single();
    if (eventError || !event) {
      databaseError(eventError, "Approval event could not be appended.");
    }
    await ensureComponentVersionApproved();

    return jsonResponse(200, {
      candidateId,
      lifecycleState: action,
      approvalEventId: event.id,
      idempotent: false,
      componentVersionId: componentVersion?.id ?? null,
    });
  })
);
