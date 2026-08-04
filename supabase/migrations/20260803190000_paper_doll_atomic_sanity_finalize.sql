-- Finalize external Sanity writes and all local lifecycle evidence in one
-- idempotent transaction. A successful external write can be retried until
-- this transaction completes; success is never recorded before lifecycle
-- state and immutable named events are durable.

CREATE OR REPLACE FUNCTION public.paper_doll_finalize_sanity_sync_atomic(
  p_organization_id UUID,
  p_sync_id UUID,
  p_release_cut_id UUID,
  p_sync_action TEXT,
  p_request_sha256 TEXT,
  p_result JSONB,
  p_actor_user_id UUID,
  p_actor_display_name TEXT,
  p_action_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  sync_row public.paper_doll_sanity_syncs%ROWTYPE;
  candidate_count INTEGER;
  unexpected_count INTEGER;
  target_state TEXT;
  predecessor_state TEXT;
  was_idempotent BOOLEAN;
BEGIN
  IF p_sync_action NOT IN ('draft', 'public')
    OR p_request_sha256 !~ '^[a-f0-9]{64}$'
    OR length(btrim(p_actor_display_name)) = 0
    OR length(btrim(p_action_note)) = 0
  THEN
    RAISE EXCEPTION 'Sanity sync finalization contract is invalid';
  END IF;
  target_state := CASE p_sync_action WHEN 'draft' THEN 'sanity-draft' ELSE 'published' END;
  predecessor_state := CASE p_sync_action WHEN 'draft' THEN 'released' ELSE 'sanity-draft' END;

  SELECT * INTO sync_row
  FROM public.paper_doll_sanity_syncs
  WHERE id = p_sync_id
    AND organization_id = p_organization_id
    AND release_cut_id = p_release_cut_id
    AND sync_action = p_sync_action
    AND request_sha256 = p_request_sha256
  FOR UPDATE;
  IF NOT FOUND OR sync_row.sync_status = 'failed' THEN
    RAISE EXCEPTION 'Sanity sync ledger is unavailable for finalization';
  END IF;
  was_idempotent := sync_row.sync_status = 'success';

  WITH selected AS (
    SELECT DISTINCT component_candidate_id AS candidate_id
    FROM public.paper_doll_release_cut_assets
    WHERE organization_id = p_organization_id
      AND release_cut_id = p_release_cut_id
      AND component_candidate_id IS NOT NULL
  )
  SELECT count(*) INTO candidate_count FROM selected;

  WITH selected AS (
    SELECT DISTINCT component_candidate_id AS candidate_id
    FROM public.paper_doll_release_cut_assets
    WHERE organization_id = p_organization_id
      AND release_cut_id = p_release_cut_id
      AND component_candidate_id IS NOT NULL
  )
  SELECT count(*) INTO unexpected_count
  FROM selected
  JOIN public.paper_doll_component_candidates candidate
    ON candidate.id = selected.candidate_id
   AND candidate.organization_id = p_organization_id
  WHERE candidate.lifecycle_state NOT IN (
    predecessor_state,
    target_state,
    CASE WHEN p_sync_action = 'draft' THEN 'published' ELSE target_state END
  );
  IF unexpected_count <> 0 THEN
    RAISE EXCEPTION 'Release candidates are not eligible for Sanity sync finalization';
  END IF;

  UPDATE public.paper_doll_component_candidates candidate
  SET lifecycle_state = target_state
  FROM (
    SELECT DISTINCT component_candidate_id AS candidate_id
    FROM public.paper_doll_release_cut_assets
    WHERE organization_id = p_organization_id
      AND release_cut_id = p_release_cut_id
      AND component_candidate_id IS NOT NULL
  ) selected
  WHERE candidate.id = selected.candidate_id
    AND candidate.organization_id = p_organization_id
    AND candidate.lifecycle_state = predecessor_state;

  INSERT INTO public.paper_doll_approval_events (
    organization_id, candidate_id, action, approver_user_id,
    approver_display_name, approval_note, evidence
  )
  SELECT
    p_organization_id, selected.component_candidate_id, target_state,
    p_actor_user_id, btrim(p_actor_display_name), btrim(p_action_note),
    jsonb_build_object(
      'releaseCutId', p_release_cut_id,
      'syncId', p_sync_id,
      'requestSha256', p_request_sha256,
      'sanityRevision', p_result->>'revision'
    )
  FROM (
    SELECT DISTINCT component_candidate_id
    FROM public.paper_doll_release_cut_assets
    WHERE organization_id = p_organization_id
      AND release_cut_id = p_release_cut_id
      AND component_candidate_id IS NOT NULL
  ) selected
  ON CONFLICT (candidate_id, action) DO NOTHING;

  IF sync_row.sync_status = 'queued' THEN
    UPDATE public.paper_doll_sanity_syncs
    SET sync_status = 'success', result = p_result, error_message = NULL,
      completed_at = now()
    WHERE id = sync_row.id AND sync_status = 'queued';
  END IF;

  RETURN jsonb_build_object(
    'syncId', sync_row.id,
    'releaseCutId', p_release_cut_id,
    'syncAction', p_sync_action,
    'candidateCount', candidate_count,
    'idempotent', was_idempotent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.paper_doll_finalize_sanity_sync_atomic(
  UUID, UUID, UUID, TEXT, TEXT, JSONB, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paper_doll_finalize_sanity_sync_atomic(
  UUID, UUID, UUID, TEXT, TEXT, JSONB, UUID, TEXT, TEXT
) TO service_role;
