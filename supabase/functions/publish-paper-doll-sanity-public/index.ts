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
  validatePublicPublicationRequest,
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
    const expectedDraftRequestSha256 = requireString(
      body.expectedDraftRequestSha256,
      "expectedDraftRequestSha256",
    );
    const document = requireRecord(body.document, "document");
    const downstreamScopeConfirmed = body.downstreamScopeConfirmed === true;
    const context = await createPaperDollActionContext(request, organizationId);

    const { data: head, error: headError } = await context.service
      .from("paper_doll_release_heads")
      .select("current_release_cut_id")
      .eq("organization_id", organizationId)
      .eq("current_release_cut_id", releaseCutId)
      .maybeSingle();
    if (headError || !head) {
      databaseError(
        headError,
        "Only the Current Release can be publicly published.",
      );
    }

    const draftOperation = buildSanityMutation({
      action: "draft",
      documentId,
      document,
    });
    const draftRequestSha256 = await sha256Hex(draftOperation.document);
    if (draftRequestSha256 !== expectedDraftRequestSha256) {
      databaseError(
        null,
        "The reviewed Sanity draft content changed before publication.",
      );
    }
    const { data: successfulDraft, error: draftError } = await context.service
      .from("paper_doll_sanity_syncs")
      .select(
        "id, release_cut_id, approved_by_user_id, approved_by_display_name",
      )
      .eq("organization_id", organizationId)
      .eq("release_cut_id", releaseCutId)
      .eq("sync_action", "draft")
      .eq("sync_status", "success")
      .eq("request_sha256", draftRequestSha256)
      .maybeSingle();
    if (draftError) {
      databaseError(draftError, "Successful draft lookup failed.");
    }

    validatePublicPublicationRequest({
      userId: context.user.id,
      organizationMember: true,
      approvedByName,
      approvalNote,
      downstreamScopeConfirmed,
      releaseCutId,
      successfulDraftReleaseCutId: successfulDraft?.release_cut_id ?? null,
    });

    const operation = buildSanityMutation({
      action: "public",
      documentId,
      document,
    });
    const requestSha256 = await sha256Hex({
      document: operation.document,
      draftRequestSha256,
      downstreamScopeConfirmed,
      approvedByName,
      approvalNote,
    });
    const { data: prior, error: priorError } = await context.service
      .from("paper_doll_sanity_syncs")
      .select("id, sync_status, result")
      .eq("organization_id", organizationId)
      .eq("release_cut_id", releaseCutId)
      .eq("sync_action", "public")
      .eq("request_sha256", requestSha256)
      .maybeSingle();
    if (priorError) {
      databaseError(priorError, "Public publication ledger lookup failed.");
    }
    let sync = prior;
    if (!sync) {
      const queued = await context.service
        .from("paper_doll_sanity_syncs")
        .insert({
          organization_id: organizationId,
          release_cut_id: releaseCutId,
          sanity_document_id: operation.documentId,
          sync_action: "public",
          sync_status: "queued",
          request_sha256: requestSha256,
          approved_by_user_id: context.user.id,
          approved_by_display_name: approvedByName,
          approval_note: approvalNote,
          result: {
            successfulDraftSyncId: successfulDraft!.id,
            draftRequestSha256,
          },
        })
        .select("id, sync_status, result")
        .single();
      if (queued.error || !queued.data) {
        databaseError(queued.error, "Public publication could not be queued.");
      }
      sync = queued.data;
    }

    let result = sync.result as Partial<SanityMutationResult> & Record<string, unknown>;
    if (sync.sync_status !== "success") {
      try {
        const sanityResult = await writeSanityDocument(operation.document);
        result = {
          ...sanityResult,
          successfulDraftSyncId: successfulDraft!.id,
          draftRequestSha256,
          downstreamScopeConfirmed,
        };
      } catch (error) {
        await context.service.from("paper_doll_sanity_syncs").update({
          sync_status: "failed",
          error_message: error instanceof Error ? error.message : "Public Sanity publication failed.",
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
        p_sync_action: "public",
        p_request_sha256: requestSha256,
        p_result: result,
        p_actor_user_id: context.user.id,
        p_actor_display_name: approvedByName,
        p_action_note: approvalNote,
      },
    );
    if (finalizeError || !finalized) {
      databaseError(finalizeError, "Public lifecycle finalization is pending; retry safely.");
    }
    return jsonResponse(200, {
      syncId: sync.id,
      releaseCutId,
      documentId: operation.documentId,
      revision: result.revision,
      status: "success",
      idempotent: finalized.idempotent === true,
      publicPublished: true,
    });
  })
);
