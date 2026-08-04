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

    const { data: result, error: actionError } = await context.service.rpc(
      "paper_doll_approve_candidate_atomic",
      {
        p_organization_id: organizationId,
        p_candidate_id: candidateId,
        p_action: action,
        p_expected_lifecycle_state: expectedLifecycleState,
        p_expected_content_sha256: expectedContentSha256,
        p_actor_user_id: context.user.id,
        p_actor_display_name: approvedByName,
        p_action_note: approvalNote,
      },
    );
    if (actionError || !result) {
      databaseError(actionError, "Atomic candidate approval could not be completed.");
    }

    return jsonResponse(200, result);
  })
);
