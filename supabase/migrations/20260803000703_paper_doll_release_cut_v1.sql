-- Controlled Paper-Doll release cuts.
--
-- A release becomes Current only through the explicit family head. Cuts,
-- memberships, readiness rows, publication attempts, and public approvals are
-- immutable evidence. Browser sessions can read their organization only; all
-- mutations are service transactions reached through authenticated Edge
-- Functions.

CREATE TABLE public.paper_doll_release_cuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  family_key TEXT NOT NULL CHECK (length(btrim(family_key)) > 0),
  source_release_id UUID NOT NULL,
  resulting_release_id UUID NOT NULL,
  approver_user_id UUID NOT NULL,
  approver_display_name TEXT NOT NULL CHECK (length(btrim(approver_display_name)) > 0),
  approval_note TEXT NOT NULL CHECK (length(btrim(approval_note)) > 0),
  selected_components JSONB NOT NULL CHECK (jsonb_typeof(selected_components) = 'array'),
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_release_cuts_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_release_cuts_result_unique UNIQUE (resulting_release_id),
  CONSTRAINT paper_doll_release_cuts_source_org_fk FOREIGN KEY (source_release_id, organization_id)
    REFERENCES public.paper_doll_family_releases(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT paper_doll_release_cuts_result_org_fk FOREIGN KEY (resulting_release_id, organization_id)
    REFERENCES public.paper_doll_family_releases(id, organization_id) ON DELETE RESTRICT
);

CREATE TABLE public.paper_doll_family_release_heads (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  family_key TEXT NOT NULL CHECK (length(btrim(family_key)) > 0),
  release_id UUID NOT NULL,
  release_cut_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, family_key),
  CONSTRAINT paper_doll_family_release_heads_release_org_fk FOREIGN KEY (release_id, organization_id)
    REFERENCES public.paper_doll_family_releases(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT paper_doll_family_release_heads_cut_org_fk FOREIGN KEY (release_cut_id, organization_id)
    REFERENCES public.paper_doll_release_cuts(id, organization_id) ON DELETE RESTRICT
);

CREATE TABLE public.paper_doll_release_sku_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  release_id UUID NOT NULL,
  mapping_key TEXT NOT NULL CHECK (length(btrim(mapping_key)) > 0),
  website_sku TEXT NOT NULL CHECK (length(btrim(website_sku)) > 0),
  grace_sku TEXT NOT NULL CHECK (length(btrim(grace_sku)) > 0),
  readiness_status TEXT NOT NULL CHECK (readiness_status IN ('ready','incomplete')),
  missing_reasons TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_release_sku_readiness_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_release_sku_readiness_mapping_unique UNIQUE (release_id, mapping_key),
  CONSTRAINT paper_doll_release_sku_readiness_release_org_fk FOREIGN KEY (release_id, organization_id)
    REFERENCES public.paper_doll_family_releases(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT paper_doll_release_sku_readiness_consistent CHECK (
    (readiness_status = 'ready' AND cardinality(missing_reasons) = 0)
    OR (readiness_status = 'incomplete' AND cardinality(missing_reasons) > 0)
  )
);

CREATE TABLE public.paper_doll_publication_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  release_cut_id UUID NOT NULL,
  publish_run_id UUID NOT NULL,
  expected_draft_sha256 TEXT NOT NULL CHECK (expected_draft_sha256 ~ '^[a-f0-9]{64}$'),
  approver_user_id UUID NOT NULL,
  approver_display_name TEXT NOT NULL CHECK (length(btrim(approver_display_name)) > 0),
  approval_note TEXT NOT NULL CHECK (length(btrim(approval_note)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_publication_approvals_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_publication_approvals_run_unique UNIQUE (publish_run_id),
  CONSTRAINT paper_doll_publication_approvals_cut_org_fk FOREIGN KEY (release_cut_id, organization_id)
    REFERENCES public.paper_doll_release_cuts(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT paper_doll_publication_approvals_run_org_fk FOREIGN KEY (publish_run_id, organization_id)
    REFERENCES public.paper_doll_publish_runs(id, organization_id) ON DELETE RESTRICT
);

CREATE TABLE public.paper_doll_component_source_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  family_key TEXT NOT NULL CHECK (length(btrim(family_key)) > 0),
  component_version_id UUID NOT NULL,
  variant_key TEXT NOT NULL CHECK (length(btrim(variant_key)) > 0),
  original_filename TEXT NOT NULL CHECK (length(btrim(original_filename)) > 0),
  registrar_user_id UUID NOT NULL,
  registrar_display_name TEXT NOT NULL CHECK (length(btrim(registrar_display_name)) > 0),
  intake_note TEXT NOT NULL CHECK (length(btrim(intake_note)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_component_source_intakes_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_component_source_intakes_version_unique UNIQUE (component_version_id),
  CONSTRAINT paper_doll_component_source_intakes_version_org_fk FOREIGN KEY (component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id) ON DELETE RESTRICT
);

ALTER TABLE public.paper_doll_publish_runs
  DROP CONSTRAINT paper_doll_publish_runs_publish_status_check,
  ADD COLUMN release_cut_id UUID,
  ADD COLUMN sanity_document_id TEXT,
  ADD COLUMN attempt_sequence INTEGER NOT NULL DEFAULT 1 CHECK (attempt_sequence > 0),
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD CONSTRAINT paper_doll_publish_runs_publish_status_check CHECK (
    publish_status IN (
      'dry_run','success','failed','blocked',
      'queued','running','draft_synced','public_dry_run','published'
    )
  ),
  ADD CONSTRAINT paper_doll_publish_runs_cut_org_fk FOREIGN KEY (release_cut_id, organization_id)
    REFERENCES public.paper_doll_release_cuts(id, organization_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX paper_doll_publish_runs_cut_destination_attempt_unique
  ON public.paper_doll_publish_runs (release_cut_id, destination, attempt_sequence)
  WHERE release_cut_id IS NOT NULL;
CREATE INDEX paper_doll_release_cuts_family_created_idx
  ON public.paper_doll_release_cuts (organization_id, family_key, created_at DESC);
CREATE INDEX paper_doll_release_readiness_release_status_idx
  ON public.paper_doll_release_sku_readiness (release_id, readiness_status);
CREATE INDEX paper_doll_component_source_intakes_family_created_idx
  ON public.paper_doll_component_source_intakes (organization_id, family_key, created_at DESC);

-- CAP is the canonical new intake name. OVERCAP remains accepted so the
-- immutable pre-cut candidate history and v1 catalog snapshot stay readable.
ALTER TABLE public.paper_doll_candidate_jobs
  DROP CONSTRAINT paper_doll_candidate_jobs_requirement_key_check,
  ADD CONSTRAINT paper_doll_candidate_jobs_requirement_key_check CHECK (
    requirement_key ~ '^CYL-9ML:(BODY|CAP|OVERCAP|ROLLER|SPRAYER|PUMP):'
  );

-- Deterministic one-time heads for pre-cut releases. This does not create a
-- synthetic cut; release_cut_id remains NULL until the first named cut.
INSERT INTO public.paper_doll_family_release_heads (organization_id, family_key, release_id)
SELECT DISTINCT ON (organization_id, family_key)
  organization_id, family_key, id
FROM public.paper_doll_family_releases
ORDER BY organization_id, family_key, created_at DESC, id DESC
ON CONFLICT (organization_id, family_key) DO NOTHING;

CREATE TRIGGER paper_doll_release_cuts_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_release_cuts
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_qa_mutation();
CREATE TRIGGER paper_doll_release_readiness_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_release_sku_readiness
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_qa_mutation();
CREATE TRIGGER paper_doll_publication_approvals_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_publication_approvals
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_qa_mutation();
CREATE TRIGGER paper_doll_component_source_intakes_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_component_source_intakes
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_qa_mutation();

ALTER TABLE public.paper_doll_release_cuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_family_release_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_release_sku_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_publication_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_component_source_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY paper_doll_release_cuts_select_org_members ON public.paper_doll_release_cuts
  FOR SELECT TO authenticated USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_family_release_heads_select_org_members ON public.paper_doll_family_release_heads
  FOR SELECT TO authenticated USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_release_sku_readiness_select_org_members ON public.paper_doll_release_sku_readiness
  FOR SELECT TO authenticated USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_publication_approvals_select_org_members ON public.paper_doll_publication_approvals
  FOR SELECT TO authenticated USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_component_source_intakes_select_org_members ON public.paper_doll_component_source_intakes
  FOR SELECT TO authenticated USING (public.is_organization_member((SELECT auth.uid()), organization_id));

REVOKE ALL ON TABLE public.paper_doll_release_cuts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_family_release_heads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_release_sku_readiness FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_publication_approvals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_component_source_intakes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.paper_doll_release_cuts TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_family_release_heads TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_release_sku_readiness TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_publication_approvals TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_component_source_intakes TO authenticated;
GRANT ALL ON TABLE public.paper_doll_release_cuts TO service_role;
GRANT ALL ON TABLE public.paper_doll_family_release_heads TO service_role;
GRANT ALL ON TABLE public.paper_doll_release_sku_readiness TO service_role;
GRANT ALL ON TABLE public.paper_doll_publication_approvals TO service_role;
GRANT ALL ON TABLE public.paper_doll_component_source_intakes TO service_role;

CREATE OR REPLACE FUNCTION public.register_paper_doll_component_source(
  p_organization_id UUID,
  p_family_key TEXT,
  p_component JSONB,
  p_version JSONB,
  p_variant_key TEXT,
  p_original_filename TEXT,
  p_registrar_user_id UUID,
  p_registrar_display_name TEXT,
  p_intake_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  component_row public.paper_doll_components%ROWTYPE;
  version_row public.paper_doll_component_versions%ROWTYPE;
  intake_id UUID;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role is required to register a paper-doll component source';
  END IF;
  IF p_family_key <> 'CYL-9ML'
    OR jsonb_typeof(p_component) <> 'object'
    OR jsonb_typeof(p_version) <> 'object'
    OR COALESCE(p_component->>'slot', '') NOT IN ('cap','roller','sprayer','overcap','pump')
    OR length(btrim(COALESCE(p_component->>'componentKey', ''))) < 3
    OR length(btrim(COALESCE(p_component->>'geometryFamilyId', ''))) < 3
    OR length(btrim(COALESCE(p_component->>'displayName', ''))) < 2
    OR length(btrim(COALESCE(p_version->>'versionKey', ''))) < 1
    OR length(btrim(COALESCE(p_version->>'materialVariant', ''))) < 2
    OR p_version->>'approvalStatus' IS DISTINCT FROM 'candidate'
    OR p_version->>'storageBucket' IS DISTINCT FROM 'paper-doll-sources'
    OR p_version->>'contentType' IS DISTINCT FROM 'image/png'
    OR (p_version->>'widthPx')::INTEGER <> 2080
    OR (p_version->>'heightPx')::INTEGER <> 2288
    OR p_version->>'imageSha256' !~ '^[a-f0-9]{64}$'
    OR p_version->>'geometryMaskSha256' !~ '^[a-f0-9]{64}$'
    OR p_version->>'imagePath' !~ ('^' || p_organization_id::TEXT || '/')
    OR p_version->>'geometryMaskPath' !~ ('^' || p_organization_id::TEXT || '/')
    OR jsonb_typeof(p_version->'alphaBounds') <> 'object'
    OR NOT (p_version->'alphaBounds' ?& ARRAY['left','top','right','bottom'])
    OR length(btrim(p_variant_key)) < 1
    OR length(btrim(p_original_filename)) < 1
    OR length(btrim(p_registrar_display_name)) < 1
    OR length(btrim(p_intake_note)) < 1
  THEN RAISE EXCEPTION 'Component source intake contract is invalid'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_organization_id::TEXT || ':' || p_component->>'componentKey', 0
  ));
  INSERT INTO public.paper_doll_components (
    organization_id, component_key, geometry_family_id, slot, display_name
  ) VALUES (
    p_organization_id, p_component->>'componentKey', p_component->>'geometryFamilyId',
    p_component->>'slot', p_component->>'displayName'
  ) ON CONFLICT (organization_id, component_key) DO NOTHING;

  SELECT * INTO STRICT component_row FROM public.paper_doll_components
  WHERE organization_id = p_organization_id AND component_key = p_component->>'componentKey';
  IF component_row.geometry_family_id <> p_component->>'geometryFamilyId'
    OR component_row.slot <> p_component->>'slot'
    OR component_row.display_name <> p_component->>'displayName'
  THEN RAISE EXCEPTION 'Existing component identity differs from proposed source'; END IF;

  SELECT * INTO version_row FROM public.paper_doll_component_versions
  WHERE organization_id = p_organization_id AND component_id = component_row.id
    AND version_key = p_version->>'versionKey';
  IF FOUND THEN
    IF version_row.image_sha256 <> p_version->>'imageSha256'
      OR version_row.geometry_mask_sha256 <> p_version->>'geometryMaskSha256'
      OR version_row.approval_status <> 'candidate'
    THEN RAISE EXCEPTION 'Existing proposed source version has different immutable bytes'; END IF;
  ELSE
    INSERT INTO public.paper_doll_component_versions (
      organization_id, component_id, version_key, material_variant,
      storage_bucket, image_path, image_sha256, geometry_mask_path,
      geometry_mask_sha256, content_type, byte_size, width_px, height_px,
      alpha_bounds, mount_axis_x_px, seat_y_px, approval_status,
      parent_component_version_id, provenance
    ) VALUES (
      p_organization_id, component_row.id, p_version->>'versionKey', p_version->>'materialVariant',
      p_version->>'storageBucket', p_version->>'imagePath', p_version->>'imageSha256',
      p_version->>'geometryMaskPath', p_version->>'geometryMaskSha256', p_version->>'contentType',
      (p_version->>'byteSize')::BIGINT, 2080, 2288, p_version->'alphaBounds',
      (p_version->>'mountAxisXPx')::NUMERIC, (p_version->>'seatYPx')::NUMERIC,
      'candidate', NULL, COALESCE(p_version->'provenance', '{}'::JSONB)
    ) RETURNING * INTO version_row;
  END IF;

  INSERT INTO public.paper_doll_component_source_intakes (
    organization_id, family_key, component_version_id, variant_key,
    original_filename, registrar_user_id, registrar_display_name, intake_note
  ) VALUES (
    p_organization_id, p_family_key, version_row.id, btrim(p_variant_key),
    p_original_filename, p_registrar_user_id, btrim(p_registrar_display_name), btrim(p_intake_note)
  ) ON CONFLICT (component_version_id) DO NOTHING
  RETURNING id INTO intake_id;
  IF intake_id IS NULL THEN
    SELECT id INTO STRICT intake_id FROM public.paper_doll_component_source_intakes
    WHERE component_version_id = version_row.id;
  END IF;
  RETURN jsonb_build_object(
    'intakeId', intake_id, 'componentId', component_row.id,
    'componentVersionId', version_row.id, 'approvalStatus', version_row.approval_status,
    'releaseChanged', false, 'geometryLocked', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_paper_doll_component_source(
  UUID, TEXT, JSONB, JSONB, TEXT, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_paper_doll_component_source(
  UUID, TEXT, JSONB, JSONB, TEXT, TEXT, UUID, TEXT, TEXT
) TO service_role;

-- Generalize the already-proven roller placement transaction to any registered
-- non-body fitment geometry. The mask identity, five explicit plates, named
-- review, and append-only placement evidence remain mandatory.
CREATE OR REPLACE FUNCTION public.lock_paper_doll_shared_placement(
  p_organization_id UUID,
  p_family_key TEXT,
  p_fitment_geometry_key TEXT,
  p_calibration_component_version_id UUID,
  p_expected_authority_mask_sha256 TEXT,
  p_canvas_width_px INTEGER,
  p_canvas_height_px INTEGER,
  p_translate_x_px NUMERIC,
  p_translate_y_px NUMERIC,
  p_uniform_scale NUMERIC,
  p_compatible_body_component_version_ids UUID[],
  p_approver_user_id UUID,
  p_approver_display_name TEXT,
  p_approval_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  calibration public.paper_doll_component_versions%ROWTYPE;
  calibration_component public.paper_doll_components%ROWTYPE;
  active_release_id UUID;
  release_body_ids UUID[];
  placement_id UUID;
  approval_id UUID;
  review_ids UUID[];
BEGIN
  IF p_family_key <> 'CYL-9ML'
    OR p_fitment_geometry_key !~ '^[a-z0-9][a-z0-9_.-]{2,179}$'
    OR p_canvas_width_px <> 2080 OR p_canvas_height_px <> 2288
    OR p_uniform_scale <= 0
    OR cardinality(p_compatible_body_component_version_ids) <> 5
    OR (SELECT count(DISTINCT id) FROM unnest(p_compatible_body_component_version_ids) AS id) <> 5
    OR length(btrim(p_approver_display_name)) < 1
    OR length(btrim(p_approval_note)) < 1
  THEN RAISE EXCEPTION 'Shared placement contract is invalid'; END IF;

  SELECT * INTO calibration FROM public.paper_doll_component_versions
  WHERE id = p_calibration_component_version_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND OR calibration.approval_status <> 'approved'
    OR calibration.geometry_mask_sha256 <> p_expected_authority_mask_sha256
    OR calibration.width_px <> p_canvas_width_px OR calibration.height_px <> p_canvas_height_px
  THEN RAISE EXCEPTION 'Approved calibration identity, mask, or canvas is stale'; END IF;

  SELECT * INTO calibration_component FROM public.paper_doll_components
  WHERE id = calibration.component_id AND organization_id = calibration.organization_id;
  IF NOT FOUND OR calibration_component.slot = 'body'
    OR calibration_component.geometry_family_id <> p_fitment_geometry_key
  THEN RAISE EXCEPTION 'Calibration component does not own the requested fitment geometry'; END IF;

  SELECT release_id INTO active_release_id FROM public.paper_doll_family_release_heads
  WHERE organization_id = p_organization_id AND family_key = p_family_key
  FOR UPDATE;
  IF active_release_id IS NULL THEN RAISE EXCEPTION 'Current family release is unavailable'; END IF;

  SELECT array_agg(asset.component_version_id ORDER BY asset.component_version_id) INTO release_body_ids
  FROM public.paper_doll_family_release_assets AS asset
  JOIN public.paper_doll_component_versions AS body_version
    ON body_version.id = asset.component_version_id AND body_version.organization_id = asset.organization_id
  JOIN public.paper_doll_components AS body_component
    ON body_component.id = body_version.component_id AND body_component.organization_id = body_version.organization_id
  WHERE asset.organization_id = p_organization_id AND asset.release_id = active_release_id
    AND asset.slot = 'body' AND body_component.slot = 'body' AND body_version.approval_status = 'approved';
  IF cardinality(release_body_ids) <> 5
    OR NOT (release_body_ids <@ p_compatible_body_component_version_ids)
    OR NOT (p_compatible_body_component_version_ids <@ release_body_ids)
  THEN RAISE EXCEPTION 'Placement must cover the exact five approved Current Release body plates'; END IF;

  INSERT INTO public.paper_doll_placement_versions (
    organization_id, family_key, fitment_geometry_key, authority_mask_sha256,
    canvas_width_px, canvas_height_px, translate_x_px, translate_y_px,
    uniform_scale, mount_axis_x_px, contact_y_px, calibration_component_version_id, created_by
  ) VALUES (
    p_organization_id, p_family_key, p_fitment_geometry_key, p_expected_authority_mask_sha256,
    p_canvas_width_px, p_canvas_height_px, p_translate_x_px, p_translate_y_px,
    p_uniform_scale, calibration.mount_axis_x_px, calibration.seat_y_px,
    calibration.id, p_approver_user_id
  ) ON CONFLICT ON CONSTRAINT paper_doll_placement_versions_exact_unique DO NOTHING
  RETURNING id INTO placement_id;
  IF placement_id IS NULL THEN
    SELECT id INTO STRICT placement_id FROM public.paper_doll_placement_versions
    WHERE organization_id = p_organization_id AND family_key = p_family_key
      AND fitment_geometry_key = p_fitment_geometry_key
      AND authority_mask_sha256 = p_expected_authority_mask_sha256
      AND canvas_width_px = p_canvas_width_px AND canvas_height_px = p_canvas_height_px
      AND translate_x_px = p_translate_x_px AND translate_y_px = p_translate_y_px
      AND uniform_scale = p_uniform_scale;
  END IF;

  INSERT INTO public.paper_doll_placement_reviews (
    organization_id, placement_version_id, body_component_version_id,
    review_status, gate_key, reviewed_by, reviewer_display_name
  ) SELECT p_organization_id, placement_id, body_id, 'passed', 'assembly-context',
      p_approver_user_id, btrim(p_approver_display_name)
    FROM unnest(p_compatible_body_component_version_ids) AS body_id
  ON CONFLICT (placement_version_id, body_component_version_id) DO NOTHING;
  SELECT array_agg(id ORDER BY id) INTO review_ids FROM public.paper_doll_placement_reviews
  WHERE organization_id = p_organization_id AND placement_version_id = placement_id;
  IF cardinality(review_ids) <> 5 THEN RAISE EXCEPTION 'Five assembly-context reviews are required'; END IF;

  INSERT INTO public.paper_doll_placement_approvals (
    organization_id, placement_version_id, approver_user_id,
    approver_display_name, approval_note, review_ids
  ) VALUES (
    p_organization_id, placement_id, p_approver_user_id,
    btrim(p_approver_display_name), btrim(p_approval_note), review_ids
  ) ON CONFLICT (placement_version_id) DO NOTHING RETURNING id INTO approval_id;
  IF approval_id IS NULL THEN
    SELECT id INTO STRICT approval_id FROM public.paper_doll_placement_approvals
    WHERE organization_id = p_organization_id AND placement_version_id = placement_id;
  END IF;

  RETURN (SELECT public.get_paper_doll_family_placement(
    p_organization_id, p_family_key, p_fitment_geometry_key, p_expected_authority_mask_sha256
  )) || jsonb_build_object('approvalId', approval_id, 'releaseChanged', false, 'sanityPublished', false);
END;
$$;

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
  p_renderer_version TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  current_release public.paper_doll_family_releases%ROWTYPE;
  new_release_id UUID := gen_random_uuid();
  new_cut_id UUID := gen_random_uuid();
  new_publish_run_id UUID := gen_random_uuid();
  manifest_sha TEXT;
  selected_count INTEGER;
  ready_count INTEGER;
  incomplete_count INTEGER;
BEGIN
  IF p_family_key <> 'CYL-9ML'
    OR length(btrim(p_release_version)) < 1
    OR length(btrim(p_approver_display_name)) < 1
    OR length(btrim(p_approval_note)) < 1
    OR cardinality(p_body_component_version_ids) <> 5
    OR (SELECT count(DISTINCT id) FROM unnest(p_body_component_version_ids) AS id) <> 5
    OR jsonb_typeof(p_selected_components) <> 'array'
    OR jsonb_array_length(p_selected_components) < 1
    OR jsonb_typeof(p_sku_readiness) <> 'array'
    OR jsonb_array_length(p_sku_readiness) < 1
  THEN RAISE EXCEPTION 'Release cut contract is invalid'; END IF;

  SELECT release.* INTO current_release
  FROM public.paper_doll_family_release_heads AS head
  JOIN public.paper_doll_family_releases AS release
    ON release.id = head.release_id AND release.organization_id = head.organization_id
  WHERE head.organization_id = p_organization_id AND head.family_key = p_family_key
  FOR UPDATE OF head;
  IF NOT FOUND OR current_release.id <> p_expected_current_release_id THEN
    RAISE EXCEPTION 'Current Release changed; refresh before cutting';
  END IF;

  IF p_manifest->>'familyKey' <> p_family_key
    OR p_manifest->>'releaseVersion' <> p_release_version
    OR (p_manifest#>>'{canvas,widthPx}')::INTEGER <> 2080
    OR (p_manifest#>>'{canvas,heightPx}')::INTEGER <> 2288
  THEN RAISE EXCEPTION 'Manifest identity or canvas is invalid'; END IF;

  SELECT count(*) INTO selected_count FROM jsonb_array_elements(p_selected_components);
  IF selected_count <> (
    SELECT count(*)
    FROM jsonb_array_elements(p_selected_components) AS item
    JOIN public.paper_doll_component_versions AS version
      ON version.id = (item->>'componentVersionId')::UUID
     AND version.organization_id = p_organization_id
     AND version.approval_status = 'approved'
    JOIN public.paper_doll_components AS component
      ON component.id = version.component_id
     AND component.organization_id = version.organization_id
     AND component.slot = item->>'slot'
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_manifest->'assets') AS asset
      WHERE asset->>'componentVersionId' = version.id::TEXT
        AND asset->>'slot' = item->>'slot'
        AND asset->>'variantKey' = item->>'variantKey'
        AND asset->>'imageSha256' = version.image_sha256
    )
      AND (
        item->>'placementVersionId' IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.paper_doll_placement_versions AS placement
          JOIN public.paper_doll_placement_approvals AS approval
            ON approval.placement_version_id = placement.id
           AND approval.organization_id = placement.organization_id
          WHERE placement.id = (item->>'placementVersionId')::UUID
            AND placement.organization_id = p_organization_id
            AND placement.family_key = p_family_key
            AND placement.authority_mask_sha256 = version.geometry_mask_sha256
        )
      )
  ) THEN RAISE EXCEPTION 'Selected component approval, manifest identity, or placement is stale'; END IF;

  IF 5 <> (
    SELECT count(*)
    FROM public.paper_doll_family_release_assets AS membership
    JOIN public.paper_doll_component_versions AS version
      ON version.id = membership.component_version_id
     AND version.organization_id = membership.organization_id
     AND version.approval_status = 'approved'
    WHERE membership.organization_id = p_organization_id
      AND membership.release_id = current_release.id
      AND membership.slot = 'body'
      AND membership.component_version_id = ANY(p_body_component_version_ids)
  ) THEN RAISE EXCEPTION 'The exact five approved Current Release bodies are required'; END IF;

  manifest_sha := encode(extensions.digest(convert_to(p_manifest::TEXT, 'UTF8'), 'sha256'), 'hex');
  INSERT INTO public.paper_doll_family_releases (
    id, organization_id, family_key, release_version, release_status,
    canvas_width_px, canvas_height_px, background_hex, manifest,
    manifest_sha256, source_git_commit, renderer_version
  ) VALUES (
    new_release_id, p_organization_id, p_family_key, btrim(p_release_version),
    CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_sku_readiness) AS row
      WHERE row->>'status' = 'incomplete'
    ) THEN 'blocked' ELSE 'ready' END,
    2080, 2288, '#F5F3EF', p_manifest, manifest_sha,
    btrim(p_source_git_commit), btrim(p_renderer_version)
  );

  INSERT INTO public.paper_doll_family_release_assets (
    organization_id, release_id, component_version_id, slot, variant_key
  )
  SELECT p_organization_id, new_release_id,
    (asset->>'componentVersionId')::UUID, asset->>'slot', asset->>'variantKey'
  FROM jsonb_array_elements(p_manifest->'assets') AS asset;

  INSERT INTO public.paper_doll_release_cuts (
    id, organization_id, family_key, source_release_id, resulting_release_id,
    approver_user_id, approver_display_name, approval_note,
    selected_components, manifest_sha256
  ) VALUES (
    new_cut_id, p_organization_id, p_family_key, current_release.id, new_release_id,
    p_approver_user_id, btrim(p_approver_display_name), btrim(p_approval_note),
    p_selected_components, manifest_sha
  );

  INSERT INTO public.paper_doll_release_sku_readiness (
    organization_id, release_id, mapping_key, website_sku, grace_sku,
    readiness_status, missing_reasons
  )
  SELECT p_organization_id, new_release_id,
    row->>'mappingKey', row->>'websiteSku', row->>'graceSku', row->>'status',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(row->'missingReasons', '[]'::JSONB)))
  FROM jsonb_array_elements(p_sku_readiness) AS row;

  UPDATE public.paper_doll_family_release_heads
  SET release_id = new_release_id, release_cut_id = new_cut_id, updated_at = now()
  WHERE organization_id = p_organization_id AND family_key = p_family_key;

  INSERT INTO public.paper_doll_publish_runs (
    id, organization_id, release_id, release_cut_id, destination,
    sanity_document_id, publish_status, request_sha256, result
  ) VALUES (
    new_publish_run_id, p_organization_id, new_release_id, new_cut_id,
    'sanity:draft', 'drafts.paperDollFamily.' || p_family_key,
    'queued', manifest_sha, jsonb_build_object('publicDocumentId', 'paperDollFamily.' || p_family_key)
  );

  SELECT count(*) FILTER (WHERE readiness_status = 'ready'),
         count(*) FILTER (WHERE readiness_status = 'incomplete')
  INTO ready_count, incomplete_count
  FROM public.paper_doll_release_sku_readiness WHERE release_id = new_release_id;

  RETURN jsonb_build_object(
    'releaseId', new_release_id,
    'releaseCutId', new_cut_id,
    'publishRunId', new_publish_run_id,
    'manifestSha256', manifest_sha,
    'releaseStatus', CASE WHEN incomplete_count > 0 THEN 'blocked' ELSE 'ready' END,
    'readiness', jsonb_build_object('ready', ready_count, 'incomplete', incomplete_count),
    'draftDocumentId', 'drafts.paperDollFamily.' || p_family_key,
    'publicDocumentId', 'paperDollFamily.' || p_family_key,
    'sanityPublished', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cut_paper_doll_release(
  UUID, TEXT, UUID, TEXT, JSONB, JSONB, UUID[], JSONB, UUID, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cut_paper_doll_release(
  UUID, TEXT, UUID, TEXT, JSONB, JSONB, UUID[], JSONB, UUID, TEXT, TEXT, TEXT, TEXT
) TO service_role;

-- Head-first workbench read. It is impossible for a newly inserted draft to
-- become Current merely because it has the newest timestamp.
CREATE OR REPLACE FUNCTION public.get_paper_doll_release_workbench(
  p_organization_id UUID,
  p_family_key TEXT
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH chosen_release AS (
    SELECT release.*, head.release_cut_id
    FROM public.paper_doll_family_release_heads AS head
    JOIN public.paper_doll_family_releases AS release
      ON release.id = head.release_id AND release.organization_id = head.organization_id
    WHERE head.organization_id = p_organization_id AND head.family_key = p_family_key
  )
  SELECT jsonb_build_object(
    'release', to_jsonb(release),
    'releaseCut', (
      SELECT to_jsonb(cut) FROM public.paper_doll_release_cuts AS cut
      WHERE cut.id = release.release_cut_id AND cut.organization_id = release.organization_id
    ),
    'readiness', COALESCE((
      SELECT jsonb_agg(to_jsonb(readiness) ORDER BY readiness.mapping_key)
      FROM public.paper_doll_release_sku_readiness AS readiness
      WHERE readiness.release_id = release.id AND readiness.organization_id = release.organization_id
    ), '[]'::JSONB),
    'publishRuns', COALESCE((
      SELECT jsonb_agg(to_jsonb(run) ORDER BY run.created_at DESC)
      FROM public.paper_doll_publish_runs AS run
      WHERE run.release_id = release.id AND run.organization_id = release.organization_id
    ), '[]'::JSONB),
    'sources', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'slot', component.slot, 'variantKey', intake.variant_key,
        'component', to_jsonb(component), 'version', to_jsonb(version),
        'qa', COALESCE((SELECT jsonb_agg(to_jsonb(qa_result) ORDER BY qa_result.created_at DESC)
          FROM public.paper_doll_qa_results AS qa_result
          WHERE qa_result.organization_id = release.organization_id
            AND qa_result.component_version_id = version.id), '[]'::JSONB)
      ) ORDER BY intake.created_at DESC)
      FROM public.paper_doll_component_source_intakes AS intake
      JOIN public.paper_doll_component_versions AS version
        ON version.id = intake.component_version_id AND version.organization_id = intake.organization_id
      JOIN public.paper_doll_components AS component
        ON component.id = version.component_id AND component.organization_id = version.organization_id
      WHERE intake.organization_id = release.organization_id AND intake.family_key = release.family_key
        AND NOT EXISTS (
          SELECT 1 FROM public.paper_doll_family_release_assets AS membership
          WHERE membership.release_id = release.id
            AND membership.organization_id = release.organization_id
            AND membership.component_version_id = version.id
        )
    ), '[]'::JSONB),
    'assets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'slot', membership.slot, 'variantKey', membership.variant_key,
        'component', to_jsonb(component), 'version', to_jsonb(version),
        'qa', COALESCE((SELECT jsonb_agg(to_jsonb(qa_result) ORDER BY qa_result.created_at DESC)
          FROM public.paper_doll_qa_results AS qa_result
          WHERE qa_result.organization_id = release.organization_id
            AND qa_result.component_version_id = version.id), '[]'::JSONB)
      ) ORDER BY membership.slot, membership.variant_key)
      FROM public.paper_doll_family_release_assets AS membership
      JOIN public.paper_doll_component_versions AS version
        ON version.id = membership.component_version_id AND version.organization_id = membership.organization_id
      JOIN public.paper_doll_components AS component
        ON component.id = version.component_id AND component.organization_id = version.organization_id
      WHERE membership.release_id = release.id AND membership.organization_id = release.organization_id
    ), '[]'::JSONB)
  ) FROM chosen_release AS release;
$$;

COMMENT ON TABLE public.paper_doll_family_release_heads IS
  'Explicit Current Release pointer; newest timestamp never implies current.';
COMMENT ON TABLE public.paper_doll_release_cuts IS
  'Append-only named release decisions binding source, resulting manifest, approved component IDs, and placement IDs.';
COMMENT ON TABLE public.paper_doll_release_sku_readiness IS
  'Per-SKU readiness for incremental draft sync; incomplete SKUs never become storefront-visible.';
COMMENT ON TABLE public.paper_doll_publication_approvals IS
  'Second named approval required after a public dry-run hash and before public Sanity mutation.';
