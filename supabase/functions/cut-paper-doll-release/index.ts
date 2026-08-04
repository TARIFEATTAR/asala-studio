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
  PaperDollActionError,
  validateNamedAction,
} from "../_shared/paperDollLifecycle.ts";
import { deriveReleaseAssetRows } from "../_shared/paperDollReleaseAssetContract.ts";

Deno.serve((request) =>
  runPaperDollAction(request, async () => {
    const body = requireRecord(await request.json());
    const organizationId = requireString(body.organizationId, "organizationId");
    const familyKey = requireString(body.familyKey, "familyKey");
    const releaseVersion = requireString(body.releaseVersion, "releaseVersion");
    const approvedByName = requireString(body.approvedByName, "approvedByName");
    const approvalNote = requireString(body.approvalNote, "approvalNote");
    const manifest = requireRecord(body.manifest, "manifest");
    const expectedHeadRevision = Number(body.expectedHeadRevision);
    if (!Number.isInteger(expectedHeadRevision) || expectedHeadRevision < 0) {
      throw new PaperDollActionError(
        422,
        "invalid_request",
        "expectedHeadRevision must be a non-negative integer.",
        [
          {
            field: "expectedHeadRevision",
            message: "Expected release-head revision is required.",
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

    const manifestSha256 = await sha256Hex(manifest);
    if (
      body.expectedManifestSha256 &&
      body.expectedManifestSha256 !== manifestSha256
    ) {
      throw new PaperDollActionError(
        409,
        "stale_manifest_hash",
        "Release manifest hash does not match the reviewed manifest.",
        [
          {
            field: "expectedManifestSha256",
            message: "Release manifest changed before cut.",
          },
        ],
      );
    }

    // The immutable rows are derived from the exact reviewed manifest. The
    // request cannot smuggle in a second, unrelated asset list.
    const rows = deriveReleaseAssetRows(manifest);
    const { data: cutResult, error: cutError } = await context.service.rpc(
      "paper_doll_cut_release_atomic",
      {
        p_organization_id: organizationId,
        p_family_key: familyKey,
        p_release_version: releaseVersion,
        p_manifest: manifest,
        p_manifest_sha256: manifestSha256,
        p_assets: rows,
        p_expected_head_revision: expectedHeadRevision,
        p_actor_user_id: context.user.id,
        p_actor_display_name: approvedByName,
        p_action_note: approvalNote,
      },
    );
    if (cutError || !cutResult) {
      databaseError(cutError, "Atomic release cut could not be completed.");
    }

    return jsonResponse(200, {
      releaseCutId: cutResult.releaseCutId,
      familyKey,
      releaseVersion,
      manifestSha256,
      headRevision: cutResult.headRevision,
      idempotent: cutResult.idempotent,
      currentRelease: true,
      sanityChanged: false,
    });
  })
);
