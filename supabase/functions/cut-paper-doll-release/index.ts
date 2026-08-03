import {
  createPaperDollActionContext,
  databaseError,
  jsonResponse,
  requireArray,
  requireRecord,
  requireString,
  runPaperDollAction,
  sha256Hex,
} from "../_shared/paperDollEdge.ts";
import {
  PaperDollActionError,
  validateNamedAction,
} from "../_shared/paperDollLifecycle.ts";

type ReleaseSlot = "body" | "cap" | "roller" | "sprayer" | "overcap" | "pump";
interface ReleaseAssetInput {
  slot?: unknown;
  variantKey?: unknown;
  componentVersionId?: unknown;
  componentCandidateId?: unknown;
  placementVersionId?: unknown;
  sourceBounds?: unknown;
  editBounds?: unknown;
  authorityBounds?: unknown;
  placementBounds?: unknown;
}

const SLOTS = new Set<ReleaseSlot>([
  "body",
  "cap",
  "roller",
  "sprayer",
  "overcap",
  "pump",
]);

Deno.serve((request) =>
  runPaperDollAction(request, async () => {
    const body = requireRecord(await request.json());
    const organizationId = requireString(body.organizationId, "organizationId");
    const familyKey = requireString(body.familyKey, "familyKey");
    const releaseVersion = requireString(body.releaseVersion, "releaseVersion");
    const approvedByName = requireString(body.approvedByName, "approvedByName");
    const approvalNote = requireString(body.approvalNote, "approvalNote");
    const manifest = requireRecord(body.manifest, "manifest");
    const assets = requireArray<ReleaseAssetInput>(body.assets, "assets");
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

    const componentVersionIds: string[] = [];
    const candidateIds: string[] = [];
    const rows = assets.map((asset, index) => {
      const slot = requireString(
        asset.slot,
        `assets.${index}.slot`,
      ) as ReleaseSlot;
      if (!SLOTS.has(slot)) {
        throw new PaperDollActionError(
          422,
          "invalid_release_slot",
          "Release asset has an unsupported slot.",
          [
            {
              field: `assets.${index}.slot`,
              message: "Unsupported release slot.",
            },
          ],
        );
      }
      const componentVersionId = requireString(
        asset.componentVersionId,
        `assets.${index}.componentVersionId`,
      );
      componentVersionIds.push(componentVersionId);
      const candidateId = slot === "body" ? null : requireString(
        asset.componentCandidateId,
        `assets.${index}.componentCandidateId`,
      );
      if (candidateId) candidateIds.push(candidateId);
      return {
        organization_id: organizationId,
        component_candidate_id: candidateId,
        component_version_id: componentVersionId,
        placement_version_id: slot === "body" ? null : requireString(
          asset.placementVersionId,
          `assets.${index}.placementVersionId`,
        ),
        slot,
        variant_key: requireString(
          asset.variantKey,
          `assets.${index}.variantKey`,
        ),
        source_bounds: slot === "body"
          ? null
          : requireRecord(asset.sourceBounds, `assets.${index}.sourceBounds`),
        edit_bounds: slot === "body"
          ? null
          : requireRecord(asset.editBounds, `assets.${index}.editBounds`),
        authority_bounds: slot === "body" ? null : requireRecord(
          asset.authorityBounds,
          `assets.${index}.authorityBounds`,
        ),
        placement_bounds: slot === "body" ? null : requireRecord(
          asset.placementBounds,
          `assets.${index}.placementBounds`,
        ),
      };
    });
    const uniqueCandidateIds = [...new Set(candidateIds)];

    const [
      { data: versions, error: versionsError },
      { data: candidates, error: candidatesError },
    ] = await Promise.all([
      context.service.from("paper_doll_component_versions")
        .select("id, approval_status")
        .eq("organization_id", organizationId)
        .in("id", componentVersionIds),
      uniqueCandidateIds.length
        ? context.service.from("paper_doll_component_candidates")
          .select("id, lifecycle_state")
          .eq("organization_id", organizationId)
          .in("id", uniqueCandidateIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (
      versionsError || !versions ||
      versions.length !== new Set(componentVersionIds).size ||
      versions.some((version) => version.approval_status !== "approved")
    ) {
      databaseError(
        versionsError,
        "Every release component version must be approved.",
      );
    }
    if (
      candidatesError || !candidates ||
      candidates.length !== uniqueCandidateIds.length ||
      candidates.some((candidate) =>
        candidate.lifecycle_state !== "placement-locked"
      )
    ) {
      databaseError(
        candidatesError,
        "Every non-body candidate must have locked placement.",
      );
    }

    const { data: head, error: headError } = await context.service
      .from("paper_doll_release_heads")
      .select("id, revision, current_release_cut_id")
      .eq("organization_id", organizationId)
      .eq("family_key", familyKey)
      .maybeSingle();
    if (headError) databaseError(headError, "Release head lookup failed.");
    if (Number(head?.revision ?? 0) !== expectedHeadRevision) {
      databaseError(
        null,
        "Current Release changed; refresh before cutting a release.",
      );
    }

    let { data: cut, error: cutError } = await context.service
      .from("paper_doll_release_cuts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("family_key", familyKey)
      .eq("manifest_sha256", manifestSha256)
      .maybeSingle();
    if (cutError) databaseError(cutError, "Release cut lookup failed.");
    if (!cut) {
      const created = await context.service.from("paper_doll_release_cuts")
        .insert({
          organization_id: organizationId,
          family_key: familyKey,
          release_version: releaseVersion,
          validation_status: "validated",
          manifest,
          manifest_sha256: manifestSha256,
          approved_by_user_id: context.user.id,
          approved_by_display_name: approvedByName,
          approval_note: approvalNote,
        }).select("id").single();
      if (created.error || !created.data) {
        databaseError(created.error, "Release cut could not be appended.");
      }
      cut = created.data;
    }

    const releaseRows = rows.map((row) => ({
      ...row,
      release_cut_id: cut!.id,
    }));
    const { error: assetsError } = await context.service
      .from("paper_doll_release_cut_assets")
      .upsert(releaseRows, {
        onConflict: "release_cut_id,slot,variant_key",
        ignoreDuplicates: true,
      });
    if (assetsError) {
      databaseError(assetsError, "Release-cut assets could not be appended.");
    }

    if (head) {
      const { error: advanceError } = await context.service.rpc(
        "paper_doll_advance_release_head",
        {
          p_organization_id: organizationId,
          p_family_key: familyKey,
          p_next_release_cut_id: cut.id,
          p_expected_revision: expectedHeadRevision,
          p_actor_user_id: context.user.id,
          p_actor_display_name: approvedByName,
          p_action_note: approvalNote,
        },
      );
      if (advanceError) {
        databaseError(advanceError, "Current Release compare-and-swap failed.");
      }
    } else {
      const { error: createHeadError } = await context.service.from(
        "paper_doll_release_heads",
      ).insert({
        organization_id: organizationId,
        family_key: familyKey,
        current_release_cut_id: cut.id,
        revision: 0,
      });
      if (createHeadError) {
        databaseError(
          createHeadError,
          "Initial Current Release could not be created.",
        );
      }
    }

    for (const candidateId of uniqueCandidateIds) {
      const { data: updated, error: updateError } = await context.service
        .from("paper_doll_component_candidates")
        .update({ lifecycle_state: "released" })
        .eq("id", candidateId)
        .eq("organization_id", organizationId)
        .eq("lifecycle_state", "placement-locked")
        .select("id")
        .maybeSingle();
      if (updateError || !updated) {
        databaseError(
          updateError,
          "Candidate release state could not be advanced.",
        );
      }
      const { error: eventError } = await context.service.from(
        "paper_doll_approval_events",
      ).insert({
        organization_id: organizationId,
        candidate_id: candidateId,
        action: "released",
        approver_user_id: context.user.id,
        approver_display_name: approvedByName,
        approval_note: approvalNote,
        evidence: { releaseCutId: cut.id, manifestSha256 },
      });
      if (eventError) {
        databaseError(
          eventError,
          "Release approval event could not be appended.",
        );
      }
    }

    return jsonResponse(200, {
      releaseCutId: cut.id,
      familyKey,
      releaseVersion,
      manifestSha256,
      currentRelease: true,
      sanityChanged: false,
    });
  })
);
