-- Atomically append a paper-doll release cut, attach immutable assets, advance
-- Current Release, and record lifecycle events. Any failure rolls back the
-- entire named action; an Edge Function never performs a partial cut.

CREATE OR REPLACE FUNCTION public.paper_doll_cut_release_atomic(
  p_organization_id UUID,
  p_family_key TEXT,
  p_release_version TEXT,
  p_manifest JSONB,
  p_manifest_sha256 TEXT,
  p_assets JSONB,
  p_expected_head_revision BIGINT,
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
  cut_row public.paper_doll_release_cuts%ROWTYPE;
  head_row public.paper_doll_release_heads%ROWTYPE;
  asset_count INTEGER;
  version_count INTEGER;
  candidate_count INTEGER;
  placement_count INTEGER;
  resulting_revision BIGINT;
  was_idempotent BOOLEAN := FALSE;
BEGIN
  IF length(btrim(p_family_key)) = 0 OR length(btrim(p_release_version)) = 0 THEN
    RAISE EXCEPTION 'Family key and release version are required';
  END IF;
  IF p_manifest_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'A canonical release manifest SHA-256 is required';
  END IF;
  IF length(btrim(p_actor_display_name)) = 0 OR length(btrim(p_action_note)) = 0 THEN
    RAISE EXCEPTION 'Named release approval and note are required';
  END IF;
  IF jsonb_typeof(p_assets) <> 'array' OR jsonb_array_length(p_assets) = 0 THEN
    RAISE EXCEPTION 'Release cut assets are required';
  END IF;
  IF p_expected_head_revision < 0 THEN
    RAISE EXCEPTION 'Expected release-head revision must be non-negative';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_organization_id::TEXT || ':' || p_family_key, 0)
  );

  SELECT * INTO head_row
  FROM public.paper_doll_release_heads h
  WHERE h.organization_id = p_organization_id AND h.family_key = p_family_key
  FOR UPDATE;

  IF FOUND AND head_row.revision <> p_expected_head_revision THEN
    RAISE EXCEPTION 'Release head compare-and-swap conflict';
  ELSIF NOT FOUND AND p_expected_head_revision <> 0 THEN
    RAISE EXCEPTION 'Initial release head requires expected revision zero';
  END IF;

  WITH rows AS (
    SELECT * FROM jsonb_to_recordset(p_assets) AS x(
      component_candidate_id UUID,
      component_version_id UUID,
      placement_version_id UUID,
      slot TEXT,
      variant_key TEXT,
      source_bounds JSONB,
      edit_bounds JSONB,
      authority_bounds JSONB,
      placement_bounds JSONB
    )
  )
  SELECT count(*), count(DISTINCT (slot, variant_key))
  INTO asset_count, version_count
  FROM rows;
  IF asset_count <> version_count THEN
    RAISE EXCEPTION 'Release cut contains duplicate slot and variant memberships';
  END IF;

  WITH rows AS (
    SELECT DISTINCT component_version_id
    FROM jsonb_to_recordset(p_assets) AS x(component_version_id UUID)
  )
  SELECT count(*) INTO version_count
  FROM rows r
  JOIN public.paper_doll_component_versions v
    ON v.id = r.component_version_id
   AND v.organization_id = p_organization_id
   AND v.approval_status = 'approved';
  IF version_count <> (
    SELECT count(DISTINCT (asset->>'component_version_id'))
    FROM jsonb_array_elements(p_assets) asset
  ) THEN
    RAISE EXCEPTION 'Every release component version must be approved';
  END IF;

  WITH rows AS (
    SELECT DISTINCT component_candidate_id
    FROM jsonb_to_recordset(p_assets) AS x(component_candidate_id UUID, slot TEXT)
    WHERE slot <> 'body'
  )
  SELECT count(*) INTO candidate_count
  FROM rows r
  JOIN public.paper_doll_component_candidates c
    ON c.id = r.component_candidate_id
   AND c.organization_id = p_organization_id
   AND c.lifecycle_state IN ('placement-locked','released','sanity-draft','published');
  IF candidate_count <> (
    SELECT count(DISTINCT (asset->>'component_candidate_id'))
    FROM jsonb_array_elements(p_assets) asset
    WHERE asset->>'slot' <> 'body'
  ) THEN
    RAISE EXCEPTION 'Every non-body candidate must have immutable locked placement';
  END IF;

  WITH rows AS (
    SELECT DISTINCT placement_version_id
    FROM jsonb_to_recordset(p_assets) AS x(placement_version_id UUID, slot TEXT)
    WHERE slot <> 'body'
  )
  SELECT count(*) INTO placement_count
  FROM rows r
  JOIN public.paper_doll_placement_versions p
    ON p.id = r.placement_version_id
   AND p.organization_id = p_organization_id
   AND p.family_key = p_family_key
   AND p.placement_status = 'locked';
  IF placement_count <> (
    SELECT count(DISTINCT (asset->>'placement_version_id'))
    FROM jsonb_array_elements(p_assets) asset
    WHERE asset->>'slot' <> 'body'
  ) THEN
    RAISE EXCEPTION 'Every non-body placement version must be locked for this family';
  END IF;

  SELECT * INTO cut_row
  FROM public.paper_doll_release_cuts c
  WHERE c.organization_id = p_organization_id
    AND c.family_key = p_family_key
    AND c.manifest_sha256 = p_manifest_sha256;

  IF FOUND THEN
    was_idempotent := TRUE;
    IF cut_row.release_version <> p_release_version THEN
      RAISE EXCEPTION 'Manifest hash already belongs to another release version';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.paper_doll_release_cuts c
      WHERE c.organization_id = p_organization_id
        AND c.family_key = p_family_key
        AND c.release_version = p_release_version
    ) THEN
      RAISE EXCEPTION 'Release version already exists with different content';
    END IF;
    INSERT INTO public.paper_doll_release_cuts (
      organization_id, family_key, release_version, validation_status,
      manifest, manifest_sha256, approved_by_user_id,
      approved_by_display_name, approval_note
    ) VALUES (
      p_organization_id, p_family_key, p_release_version, 'validated',
      p_manifest, p_manifest_sha256, p_actor_user_id,
      btrim(p_actor_display_name), btrim(p_action_note)
    ) RETURNING * INTO cut_row;
  END IF;

  INSERT INTO public.paper_doll_release_cut_assets (
    organization_id, release_cut_id, component_candidate_id,
    component_version_id, placement_version_id, slot, variant_key,
    source_bounds, edit_bounds, authority_bounds, placement_bounds
  )
  SELECT
    p_organization_id, cut_row.id, x.component_candidate_id,
    x.component_version_id, x.placement_version_id, x.slot, x.variant_key,
    x.source_bounds, x.edit_bounds, x.authority_bounds, x.placement_bounds
  FROM jsonb_to_recordset(p_assets) AS x(
    component_candidate_id UUID,
    component_version_id UUID,
    placement_version_id UUID,
    slot TEXT,
    variant_key TEXT,
    source_bounds JSONB,
    edit_bounds JSONB,
    authority_bounds JSONB,
    placement_bounds JSONB
  )
  ON CONFLICT (release_cut_id, slot, variant_key) DO NOTHING;

  UPDATE public.paper_doll_component_candidates c
  SET lifecycle_state = 'released'
  FROM (
    SELECT DISTINCT component_candidate_id
    FROM jsonb_to_recordset(p_assets) AS x(component_candidate_id UUID, slot TEXT)
    WHERE slot <> 'body'
  ) selected
  WHERE c.id = selected.component_candidate_id
    AND c.organization_id = p_organization_id
    AND c.lifecycle_state = 'placement-locked';

  INSERT INTO public.paper_doll_approval_events (
    organization_id, candidate_id, action, approver_user_id,
    approver_display_name, approval_note, evidence
  )
  SELECT
    p_organization_id, selected.component_candidate_id, 'released', p_actor_user_id,
    btrim(p_actor_display_name), btrim(p_action_note),
    jsonb_build_object('releaseCutId', cut_row.id, 'manifestSha256', p_manifest_sha256)
  FROM (
    SELECT DISTINCT component_candidate_id
    FROM jsonb_to_recordset(p_assets) AS x(component_candidate_id UUID, slot TEXT)
    WHERE slot <> 'body'
  ) selected
  ON CONFLICT (candidate_id, action) DO NOTHING;

  IF head_row.id IS NULL THEN
    INSERT INTO public.paper_doll_release_heads (
      organization_id, family_key, current_release_cut_id, revision
    ) VALUES (p_organization_id, p_family_key, cut_row.id, 0)
    RETURNING revision INTO resulting_revision;
  ELSIF head_row.current_release_cut_id = cut_row.id THEN
    resulting_revision := head_row.revision;
  ELSE
    PERFORM set_config('paper_doll.release_head_advance', 'on', TRUE);
    UPDATE public.paper_doll_release_heads
    SET current_release_cut_id = cut_row.id, revision = revision + 1
    WHERE id = head_row.id
    RETURNING revision INTO resulting_revision;
    INSERT INTO public.paper_doll_release_head_events (
      organization_id, release_head_id, previous_release_cut_id,
      next_release_cut_id, expected_revision, resulting_revision,
      actor_user_id, actor_display_name, action_note
    ) VALUES (
      p_organization_id, head_row.id, head_row.current_release_cut_id,
      cut_row.id, p_expected_head_revision, resulting_revision,
      p_actor_user_id, btrim(p_actor_display_name), btrim(p_action_note)
    );
    PERFORM set_config('paper_doll.release_head_advance', 'off', TRUE);
  END IF;

  RETURN jsonb_build_object(
    'releaseCutId', cut_row.id,
    'manifestSha256', cut_row.manifest_sha256,
    'headRevision', resulting_revision,
    'idempotent', was_idempotent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.paper_doll_cut_release_atomic(
  UUID, TEXT, TEXT, JSONB, TEXT, JSONB, BIGINT, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paper_doll_cut_release_atomic(
  UUID, TEXT, TEXT, JSONB, TEXT, JSONB, BIGINT, UUID, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.paper_doll_cut_release_atomic(
  UUID, TEXT, TEXT, JSONB, TEXT, JSONB, BIGINT, UUID, TEXT, TEXT
) IS 'Atomically appends a validated release cut, immutable assets, candidate events, and Current Release advancement.';
