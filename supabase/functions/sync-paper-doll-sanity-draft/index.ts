import {
  createPaperDollActionContext,
  databaseError,
  jsonResponse,
  requireRecord,
  requireString,
  runPaperDollAction,
  sha256Hex,
} from "../_shared/paperDollEdge.ts";
import {
  buildSanityMutation,
  validateNamedAction,
} from "../_shared/paperDollLifecycle.ts";
import {
  type SanityMutationResult,
  writeSanityDocument,
} from "../_shared/paperDollSanity.ts";

Deno.serve((request) =>
  runPaperDollAction(request, async () => {
    const body = requireRecord(await request.json());
    const organizationId = requireString(body.organizationId, "organizationId");
    const releaseCutId = requireString(body.releaseCutId, "releaseCutId");
    const documentId = requireString(body.documentId, "documentId");
    const approvedByName = requireString(body.approvedByName, "approvedByName");
    const approvalNote = requireString(body.approvalNote, "approvalNote");
    const document = requireRecord(body.document, "document");
    const context = await createPaperDollActionContext(request, organizationId);
    validateNamedAction({
      userId: context.user.id,
      organizationMember: true,
      approvedByName,
      approvalNote,
    });

    const { data: head, error: headError } = await context.service
      .from("paper_doll_release_heads")
      .select("current_release_cut_id")
      .eq("organization_id", organizationId)
      .eq("current_release_cut_id", releaseCutId)
      .maybeSingle();
    if (headError || !head) {
      databaseError(
        headError,
        "Only the Current Release can be synced to a Sanity draft.",
      );
    }

    const operation = buildSanityMutation({
      action: "draft",
      documentId,
      document,
    });
    const requestSha256 = await sha256Hex(operation.document);
    const { data: prior, error: priorError } = await context.service
      .from("paper_doll_sanity_syncs")
      .select("id, sync_status, result")
      .eq("organization_id", organizationId)
      .eq("release_cut_id", releaseCutId)
      .eq("sync_action", "draft")
      .eq("request_sha256", requestSha256)
      .maybeSingle();
    if (priorError) {
      databaseError(priorError, "Sanity draft ledger lookup failed.");
    }
    let sync = prior;
    if (!sync) {
      const queued = await context.service
        .from("paper_doll_sanity_syncs")
        .insert({
          organization_id: organizationId,
          release_cut_id: releaseCutId,
          sanity_document_id: operation.documentId,
          sync_action: "draft",
          sync_status: "queued",
          request_sha256: requestSha256,
          approved_by_user_id: context.user.id,
          approved_by_display_name: approvedByName,
          approval_note: approvalNote,
        })
        .select("id, sync_status, result")
        .single();
      if (queued.error || !queued.data) {
        databaseError(queued.error, "Sanity draft sync could not be queued.");
      }
      sync = queued.data;
    }

    let result = sync.result as Partial<SanityMutationResult>;
    if (sync.sync_status !== "success") {
      try {
        result = await writeSanityDocument(operation.document);
      } catch (error) {
        await context.service.from("paper_doll_sanity_syncs").update({
          sync_status: "failed",
          error_message: error instanceof Error ? error.message : "Sanity draft sync failed.",
          completed_at: new Date().toISOString(),
        }).eq("id", sync.id).eq("sync_status", "queued");
        throw error;
      }
    }

    const { data: finalized, error: finalizeError } = await context.service.rpc(
      "paper_doll_finalize_sanity_sync_atomic",
      {
        p_organization_id: organizationId,
        p_sync_id: sync.id,
        p_release_cut_id: releaseCutId,
        p_sync_action: "draft",
        p_request_sha256: requestSha256,
        p_result: result,
        p_actor_user_id: context.user.id,
        p_actor_display_name: approvedByName,
        p_action_note: approvalNote,
      },
    );
    if (finalizeError || !finalized) {
      databaseError(finalizeError, "Sanity draft lifecycle finalization is pending; retry safely.");
    }
    return jsonResponse(200, {
      syncId: sync.id,
      releaseCutId,
      documentId: operation.documentId,
      revision: result.revision,
      status: "success",
      idempotent: finalized.idempotent === true,
      publicPublished: false,
    });
  })
);
