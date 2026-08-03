-- Bind each release cut to the already-existing Sanity editorial document.
-- The overload wraps the v1 transaction, then rewrites the queued draft target
-- in the same PostgreSQL transaction. A failure rolls back the entire cut.

CREATE OR REPLACE FUNCTION public.cut_paper_doll_release(
  p_organization_id UUID,
  p_family_key TEXT,
  p_expected_current_release_id UUID,
  p_release_version TEXT,
  p_manifest JSONB,
  p_selected_components JSONB,
  p_body_component_version_ids UUID[],
  p_sku_readiness JSONB,
  p_approver_user_id UUID,
  p_approver_display_name TEXT,
  p_approval_note TEXT,
  p_source_git_commit TEXT,
  p_renderer_version TEXT,
  p_sanity_public_document_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  cut_result JSONB;
  canonical_public_id TEXT := btrim(p_sanity_public_document_id);
  canonical_draft_id TEXT;
  publish_run_id UUID;
BEGIN
  IF canonical_public_id !~ '^[A-Za-z0-9._-]+$' OR canonical_public_id ~ '^drafts\.' THEN
    RAISE EXCEPTION 'Canonical Sanity document ID is invalid';
  END IF;
  canonical_draft_id := 'drafts.' || canonical_public_id;

  cut_result := public.cut_paper_doll_release(
    p_organization_id,
    p_family_key,
    p_expected_current_release_id,
    p_release_version,
    p_manifest,
    p_selected_components,
    p_body_component_version_ids,
    p_sku_readiness,
    p_approver_user_id,
    p_approver_display_name,
    p_approval_note,
    p_source_git_commit,
    p_renderer_version
  );
  publish_run_id := (cut_result->>'publishRunId')::UUID;

  UPDATE public.paper_doll_publish_runs AS run
  SET sanity_document_id = canonical_draft_id,
      result = jsonb_set(
        COALESCE(run.result, '{}'::JSONB),
        '{publicDocumentId}',
        to_jsonb(canonical_public_id),
        true
      )
  WHERE run.id = publish_run_id
    AND run.organization_id = p_organization_id
    AND run.release_cut_id = (cut_result->>'releaseCutId')::UUID
    AND run.destination = 'sanity:draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Queued Sanity draft target is unavailable'; END IF;

  RETURN cut_result || jsonb_build_object(
    'draftDocumentId', canonical_draft_id,
    'publicDocumentId', canonical_public_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cut_paper_doll_release(
  UUID, TEXT, UUID, TEXT, JSONB, JSONB, UUID[], JSONB, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cut_paper_doll_release(
  UUID, TEXT, UUID, TEXT, JSONB, JSONB, UUID[], JSONB, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
