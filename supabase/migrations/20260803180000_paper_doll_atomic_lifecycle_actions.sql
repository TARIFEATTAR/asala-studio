-- Transactional named lifecycle actions for Component Factory v2. The
-- existing ProductionCandidateWorkbench RPCs remain unchanged; these
-- functions operate only on the namespaced v2 ledger.

CREATE OR REPLACE FUNCTION public.paper_doll_approve_candidate_atomic(
  p_organization_id UUID,
  p_candidate_id UUID,
  p_action TEXT,
  p_expected_lifecycle_state TEXT,
  p_expected_content_sha256 TEXT,
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
  candidate public.paper_doll_component_candidates%ROWTYPE;
  existing_event public.paper_doll_approval_events%ROWTYPE;
  event_id UUID;
  component_version_id UUID;
  expected_predecessor TEXT;
BEGIN
  IF p_action NOT IN ('pixels-approved', 'family-fit-approved') THEN
    RAISE EXCEPTION 'Unsupported candidate approval action';
  END IF;
  expected_predecessor := CASE p_action
    WHEN 'pixels-approved' THEN 'candidate'
    ELSE 'pixels-approved'
  END;
  IF p_expected_lifecycle_state <> expected_predecessor
    OR p_expected_content_sha256 !~ '^[a-f0-9]{64}$'
    OR length(btrim(p_actor_display_name)) = 0
    OR length(btrim(p_action_note)) = 0
  THEN
    RAISE EXCEPTION 'Named candidate approval contract is invalid';
  END IF;

  SELECT * INTO candidate
  FROM public.paper_doll_component_candidates
  WHERE id = p_candidate_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND OR candidate.normalized_sha256 <> p_expected_content_sha256 THEN
    RAISE EXCEPTION 'Candidate content identity is stale';
  END IF;

  SELECT * INTO existing_event
  FROM public.paper_doll_approval_events
  WHERE organization_id = p_organization_id
    AND candidate_id = p_candidate_id
    AND action = p_action;
  IF FOUND THEN
    IF existing_event.approver_user_id <> p_actor_user_id
      OR existing_event.approver_display_name <> btrim(p_actor_display_name)
      OR existing_event.approval_note <> btrim(p_action_note)
      OR existing_event.evidence->>'contentSha256' <> p_expected_content_sha256
    THEN
      RAISE EXCEPTION 'Candidate approval already has different immutable evidence';
    END IF;
    RETURN jsonb_build_object(
      'candidateId', candidate.id,
      'lifecycleState', candidate.lifecycle_state,
      'approvalEventId', existing_event.id,
      'componentVersionId', existing_event.evidence->>'componentVersionId',
      'idempotent', TRUE
    );
  END IF;

  IF candidate.lifecycle_state <> expected_predecessor THEN
    RAISE EXCEPTION 'Candidate lifecycle changed before named approval';
  END IF;
  IF candidate.qa->>'geometryLocked' <> 'true'
    OR COALESCE((candidate.qa->>'minIoU')::NUMERIC, 0) < 0.985
    OR COALESCE((candidate.qa->>'mismatchedPixels')::BIGINT, -1) <> 0
  THEN
    RAISE EXCEPTION 'Exact authority-mask QA is required for named approval';
  END IF;

  IF p_action = 'pixels-approved' THEN
    SELECT id INTO component_version_id
    FROM public.paper_doll_component_versions
    WHERE organization_id = p_organization_id
      AND component_id = candidate.component_id
      AND image_sha256 = candidate.layer_sha256
      AND approval_status IN ('candidate', 'approved')
    FOR UPDATE;
    IF component_version_id IS NULL THEN
      RAISE EXCEPTION 'Pixel approval requires one exact candidate component version';
    END IF;
    UPDATE public.paper_doll_component_versions
    SET approval_status = 'approved'
    WHERE id = component_version_id
      AND organization_id = p_organization_id
      AND approval_status = 'candidate';
  END IF;

  UPDATE public.paper_doll_component_candidates
  SET lifecycle_state = p_action
  WHERE id = candidate.id
    AND organization_id = candidate.organization_id
    AND lifecycle_state = expected_predecessor
    AND normalized_sha256 = p_expected_content_sha256;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate changed before named approval';
  END IF;

  INSERT INTO public.paper_doll_approval_events (
    organization_id, candidate_id, action, approver_user_id,
    approver_display_name, approval_note, evidence
  ) VALUES (
    p_organization_id, candidate.id, p_action, p_actor_user_id,
    btrim(p_actor_display_name), btrim(p_action_note),
    jsonb_build_object(
      'expectedLifecycleState', expected_predecessor,
      'contentSha256', p_expected_content_sha256,
      'qa', candidate.qa,
      'componentVersionId', component_version_id
    )
  ) RETURNING id INTO event_id;

  RETURN jsonb_build_object(
    'candidateId', candidate.id,
    'lifecycleState', p_action,
    'approvalEventId', event_id,
    'componentVersionId', component_version_id,
    'idempotent', FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_lock_factory_placement_atomic(
  p_organization_id UUID,
  p_candidate_id UUID,
  p_family_key TEXT,
  p_geometry_family_id TEXT,
  p_expected_content_sha256 TEXT,
  p_expected_authority_mask_sha256 TEXT,
  p_width_px INTEGER,
  p_center_x_px NUMERIC,
  p_seat_y_px NUMERIC,
  p_placement_bounds JSONB,
  p_plates JSONB,
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
  candidate public.paper_doll_component_candidates%ROWTYPE;
  component public.paper_doll_components%ROWTYPE;
  existing_event public.paper_doll_approval_events%ROWTYPE;
  placement public.paper_doll_factory_placement_versions%ROWTYPE;
  plate_count INTEGER;
  event_id UUID;
  placement_reused BOOLEAN := FALSE;
BEGIN
  IF length(btrim(p_family_key)) = 0 OR length(btrim(p_geometry_family_id)) = 0
    OR p_expected_content_sha256 !~ '^[a-f0-9]{64}$'
    OR p_expected_authority_mask_sha256 !~ '^[a-f0-9]{64}$'
    OR p_width_px <= 0
    OR NOT public.paper_doll_valid_pixel_bounds(p_placement_bounds)
    OR jsonb_typeof(p_plates) <> 'array' OR jsonb_array_length(p_plates) <> 5
    OR length(btrim(p_actor_display_name)) = 0 OR length(btrim(p_action_note)) = 0
  THEN
    RAISE EXCEPTION 'Named factory placement contract is invalid';
  END IF;

  SELECT * INTO candidate
  FROM public.paper_doll_component_candidates
  WHERE id = p_candidate_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND
    OR candidate.normalized_sha256 <> p_expected_content_sha256
    OR candidate.authority_mask_sha256 <> p_expected_authority_mask_sha256
  THEN
    RAISE EXCEPTION 'Candidate or authority-mask identity is stale';
  END IF;
  SELECT * INTO component
  FROM public.paper_doll_components
  WHERE id = candidate.component_id AND organization_id = candidate.organization_id;
  IF NOT FOUND OR component.geometry_family_id <> p_geometry_family_id THEN
    RAISE EXCEPTION 'Candidate does not own the requested geometry family';
  END IF;

  SELECT * INTO existing_event
  FROM public.paper_doll_approval_events
  WHERE organization_id = p_organization_id
    AND candidate_id = p_candidate_id
    AND action = 'placement-locked';
  IF FOUND THEN
    IF existing_event.approver_user_id <> p_actor_user_id
      OR existing_event.approver_display_name <> btrim(p_actor_display_name)
      OR existing_event.approval_note <> btrim(p_action_note)
      OR existing_event.evidence->>'contentSha256' <> p_expected_content_sha256
      OR existing_event.evidence->>'authorityMaskSha256' <> p_expected_authority_mask_sha256
    THEN
      RAISE EXCEPTION 'Placement lock already has different immutable evidence';
    END IF;
    RETURN jsonb_build_object(
      'candidateId', candidate.id,
      'placementVersionId', existing_event.evidence->>'placementVersionId',
      'approvalEventId', existing_event.id,
      'lifecycleState', candidate.lifecycle_state,
      'idempotent', TRUE
    );
  END IF;
  IF candidate.lifecycle_state <> 'family-fit-approved' THEN
    RAISE EXCEPTION 'Candidate must be family-fit-approved before placement lock';
  END IF;

  WITH requested AS (
    SELECT * FROM jsonb_to_recordset(p_plates) AS x(
      body_variant_key TEXT,
      body_component_version_id UUID,
      adjustment JSONB
    )
  )
  SELECT count(*) INTO plate_count
  FROM requested r
  JOIN public.paper_doll_component_versions v
    ON v.id = r.body_component_version_id
   AND v.organization_id = p_organization_id
   AND v.approval_status = 'approved'
   AND v.width_px = 2080 AND v.height_px = 2288
  JOIN public.paper_doll_components body_component
    ON body_component.id = v.component_id
   AND body_component.organization_id = v.organization_id
   AND body_component.slot = 'body'
  WHERE length(btrim(r.body_variant_key)) > 0
    AND r.adjustment ?& ARRAY['deltaX','deltaY','scale']
    AND (r.adjustment->>'scale')::NUMERIC > 0;
  IF plate_count <> 5 OR (
    SELECT count(DISTINCT x.body_variant_key)
    FROM jsonb_to_recordset(p_plates) AS x(body_variant_key TEXT)
  ) <> 5 OR (
    SELECT count(DISTINCT x.body_component_version_id)
    FROM jsonb_to_recordset(p_plates) AS x(body_component_version_id UUID)
  ) <> 5 THEN
    RAISE EXCEPTION 'Exactly five distinct approved body plates are required';
  END IF;

  SELECT * INTO placement
  FROM public.paper_doll_factory_placement_versions p
  WHERE p.organization_id = p_organization_id
    AND p.family_key = p_family_key
    AND p.geometry_family_id = p_geometry_family_id
    AND p.width_px = p_width_px
    AND p.center_x_px = p_center_x_px
    AND p.seat_y_px = p_seat_y_px
    AND p.placement_bounds = p_placement_bounds
    AND p.authority_mask_sha256 = p_expected_authority_mask_sha256
    AND p.placement_status = 'locked'
    AND NOT EXISTS (
      SELECT body_variant_key, body_component_version_id, adjustment
      FROM public.paper_doll_factory_placement_plates existing
      WHERE existing.organization_id = p_organization_id
        AND existing.placement_version_id = p.id
      EXCEPT
      SELECT body_variant_key, body_component_version_id, adjustment
      FROM jsonb_to_recordset(p_plates) AS requested(
        body_variant_key TEXT,
        body_component_version_id UUID,
        adjustment JSONB
      )
    )
    AND NOT EXISTS (
      SELECT body_variant_key, body_component_version_id, adjustment
      FROM jsonb_to_recordset(p_plates) AS requested(
        body_variant_key TEXT,
        body_component_version_id UUID,
        adjustment JSONB
      )
      EXCEPT
      SELECT body_variant_key, body_component_version_id, adjustment
      FROM public.paper_doll_factory_placement_plates existing
      WHERE existing.organization_id = p_organization_id
        AND existing.placement_version_id = p.id
    )
  ORDER BY p.version_number DESC
  LIMIT 1;

  IF FOUND THEN
    placement_reused := TRUE;
  ELSE
    INSERT INTO public.paper_doll_factory_placement_versions (
      organization_id, family_key, geometry_family_id, version_number,
      width_px, center_x_px, seat_y_px, placement_bounds,
      authority_mask_sha256, placement_status, locked_by_user_id,
      locked_by_display_name, lock_note, locked_at
    ) VALUES (
      p_organization_id, p_family_key, p_geometry_family_id,
      COALESCE((SELECT max(version_number) FROM public.paper_doll_factory_placement_versions
        WHERE organization_id = p_organization_id AND family_key = p_family_key
          AND geometry_family_id = p_geometry_family_id), 0) + 1,
      p_width_px, p_center_x_px, p_seat_y_px, p_placement_bounds,
      p_expected_authority_mask_sha256, 'locked', p_actor_user_id,
      btrim(p_actor_display_name), btrim(p_action_note), now()
    ) RETURNING * INTO placement;

    INSERT INTO public.paper_doll_factory_placement_plates (
      organization_id, placement_version_id, body_variant_key,
      body_component_version_id, adjustment
    )
    SELECT p_organization_id, placement.id, body_variant_key,
      body_component_version_id, adjustment
    FROM jsonb_to_recordset(p_plates) AS requested(
      body_variant_key TEXT,
      body_component_version_id UUID,
      adjustment JSONB
    );
  END IF;

  UPDATE public.paper_doll_component_candidates
  SET lifecycle_state = 'placement-locked'
  WHERE id = candidate.id AND organization_id = candidate.organization_id
    AND lifecycle_state = 'family-fit-approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate changed before placement lock'; END IF;

  INSERT INTO public.paper_doll_approval_events (
    organization_id, candidate_id, action, approver_user_id,
    approver_display_name, approval_note, evidence
  ) VALUES (
    p_organization_id, candidate.id, 'placement-locked', p_actor_user_id,
    btrim(p_actor_display_name), btrim(p_action_note),
    jsonb_build_object(
      'placementVersionId', placement.id,
      'contentSha256', p_expected_content_sha256,
      'authorityMaskSha256', p_expected_authority_mask_sha256,
      'bodyComponentVersionIds', (
        SELECT jsonb_agg(body_component_version_id ORDER BY body_component_version_id)
        FROM jsonb_to_recordset(p_plates) AS x(body_component_version_id UUID)
      ),
      'placementReused', placement_reused
    )
  ) RETURNING id INTO event_id;

  RETURN jsonb_build_object(
    'candidateId', candidate.id,
    'placementVersionId', placement.id,
    'placementVersion', placement.version_number,
    'approvalEventId', event_id,
    'lifecycleState', 'placement-locked',
    'placementReused', placement_reused,
    'idempotent', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.paper_doll_approve_candidate_atomic(
  UUID, UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paper_doll_approve_candidate_atomic(
  UUID, UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.paper_doll_lock_factory_placement_atomic(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, NUMERIC, JSONB, JSONB, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paper_doll_lock_factory_placement_atomic(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, NUMERIC, JSONB, JSONB, UUID, TEXT, TEXT
) TO service_role;
