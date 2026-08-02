-- Immutable, organization-scoped placement truth for one approved fitment
-- geometry across the five locked CYL-9ML body plates.

CREATE TABLE public.paper_doll_placement_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  family_key TEXT NOT NULL CHECK (length(btrim(family_key)) > 0),
  fitment_geometry_key TEXT NOT NULL CHECK (length(btrim(fitment_geometry_key)) > 0),
  authority_mask_sha256 TEXT NOT NULL CHECK (authority_mask_sha256 ~ '^[a-f0-9]{64}$'),
  canvas_width_px INTEGER NOT NULL CHECK (canvas_width_px = 2080),
  canvas_height_px INTEGER NOT NULL CHECK (canvas_height_px = 2288),
  translate_x_px NUMERIC NOT NULL,
  translate_y_px NUMERIC NOT NULL,
  uniform_scale NUMERIC NOT NULL CHECK (uniform_scale > 0),
  mount_axis_x_px NUMERIC NOT NULL,
  contact_y_px NUMERIC NOT NULL,
  calibration_component_version_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_placement_versions_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_placement_versions_calibration_org_fk
    FOREIGN KEY (calibration_component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_placement_versions_exact_unique UNIQUE (
    organization_id, family_key, fitment_geometry_key, authority_mask_sha256,
    canvas_width_px, canvas_height_px, translate_x_px, translate_y_px, uniform_scale
  )
);

CREATE TABLE public.paper_doll_placement_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  placement_version_id UUID NOT NULL,
  body_component_version_id UUID NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status = 'passed'),
  gate_key TEXT NOT NULL CHECK (gate_key = 'assembly-context'),
  reviewed_by UUID NOT NULL,
  reviewer_display_name TEXT NOT NULL CHECK (length(btrim(reviewer_display_name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_placement_reviews_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_placement_reviews_placement_org_fk
    FOREIGN KEY (placement_version_id, organization_id)
    REFERENCES public.paper_doll_placement_versions(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_placement_reviews_body_org_fk
    FOREIGN KEY (body_component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_placement_reviews_body_unique UNIQUE (placement_version_id, body_component_version_id)
);

CREATE TABLE public.paper_doll_placement_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  placement_version_id UUID NOT NULL,
  approver_user_id UUID NOT NULL,
  approver_display_name TEXT NOT NULL CHECK (length(btrim(approver_display_name)) > 0),
  approval_note TEXT NOT NULL CHECK (length(btrim(approval_note)) > 0),
  review_ids UUID[] NOT NULL CHECK (cardinality(review_ids) = 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_placement_approvals_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_placement_approvals_placement_org_fk
    FOREIGN KEY (placement_version_id, organization_id)
    REFERENCES public.paper_doll_placement_versions(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_placement_approvals_placement_unique UNIQUE (placement_version_id)
);

CREATE INDEX paper_doll_placement_versions_geometry_idx
  ON public.paper_doll_placement_versions (
    organization_id, family_key, fitment_geometry_key, authority_mask_sha256, created_at DESC
  );
CREATE INDEX paper_doll_placement_reviews_placement_idx
  ON public.paper_doll_placement_reviews (placement_version_id, created_at);

CREATE TRIGGER paper_doll_placement_versions_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_placement_versions
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_qa_mutation();
CREATE TRIGGER paper_doll_placement_reviews_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_placement_reviews
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_qa_mutation();
CREATE TRIGGER paper_doll_placement_approvals_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_placement_approvals
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_qa_mutation();

ALTER TABLE public.paper_doll_placement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_placement_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_placement_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY paper_doll_placement_versions_select_org_members
  ON public.paper_doll_placement_versions FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_placement_reviews_select_org_members
  ON public.paper_doll_placement_reviews FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_placement_approvals_select_org_members
  ON public.paper_doll_placement_approvals FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));

REVOKE ALL ON TABLE public.paper_doll_placement_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_placement_reviews FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_placement_approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.paper_doll_placement_versions TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_placement_reviews TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_placement_approvals TO authenticated;
GRANT ALL ON TABLE public.paper_doll_placement_versions TO service_role;
GRANT ALL ON TABLE public.paper_doll_placement_reviews TO service_role;
GRANT ALL ON TABLE public.paper_doll_placement_approvals TO service_role;

CREATE OR REPLACE FUNCTION public.get_paper_doll_family_placement(
  p_organization_id UUID,
  p_family_key TEXT,
  p_fitment_geometry_key TEXT,
  p_authority_mask_sha256 TEXT
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', placement.id,
    'familyKey', placement.family_key,
    'fitmentGeometryKey', placement.fitment_geometry_key,
    'authorityMaskSha256', placement.authority_mask_sha256,
    'canvas', jsonb_build_object('widthPx', placement.canvas_width_px, 'heightPx', placement.canvas_height_px),
    'transform', jsonb_build_object(
      'translateXPx', placement.translate_x_px,
      'translateYPx', placement.translate_y_px,
      'uniformScale', placement.uniform_scale
    ),
    'compatibleBodyComponentVersionIds', (
      SELECT jsonb_agg(review.body_component_version_id ORDER BY review.body_component_version_id)
      FROM public.paper_doll_placement_reviews AS review
      WHERE review.organization_id = placement.organization_id
        AND review.placement_version_id = placement.id
    ),
    'approverDisplayName', approval.approver_display_name,
    'approvalNote', approval.approval_note,
    'approvedAt', approval.created_at
  )
  FROM public.paper_doll_placement_versions AS placement
  JOIN public.paper_doll_placement_approvals AS approval
    ON approval.organization_id = placement.organization_id
   AND approval.placement_version_id = placement.id
  WHERE placement.organization_id = p_organization_id
    AND placement.family_key = p_family_key
    AND placement.fitment_geometry_key = p_fitment_geometry_key
    AND placement.authority_mask_sha256 = p_authority_mask_sha256
  ORDER BY approval.created_at DESC
  LIMIT 1;
$$;

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
    OR p_fitment_geometry_key <> 'fitment__roller-ball__17-415__v1'
    OR p_canvas_width_px <> 2080 OR p_canvas_height_px <> 2288
    OR p_uniform_scale <= 0
    OR cardinality(p_compatible_body_component_version_ids) <> 5
    OR (SELECT count(DISTINCT id) FROM unnest(p_compatible_body_component_version_ids) AS id) <> 5
    OR length(btrim(p_approver_display_name)) < 1
    OR length(btrim(p_approval_note)) < 1
  THEN
    RAISE EXCEPTION 'Shared placement contract is invalid';
  END IF;

  SELECT * INTO calibration
  FROM public.paper_doll_component_versions
  WHERE id = p_calibration_component_version_id
    AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND
    OR calibration.approval_status <> 'approved'
    OR calibration.geometry_mask_sha256 <> p_expected_authority_mask_sha256
    OR calibration.width_px <> p_canvas_width_px
    OR calibration.height_px <> p_canvas_height_px
  THEN
    RAISE EXCEPTION 'Approved calibration identity, mask, or canvas is stale';
  END IF;

  SELECT * INTO calibration_component
  FROM public.paper_doll_components
  WHERE id = calibration.component_id
    AND organization_id = calibration.organization_id;
  IF NOT FOUND
    OR calibration_component.slot <> 'roller'
    OR calibration_component.geometry_family_id <> p_fitment_geometry_key
  THEN
    RAISE EXCEPTION 'Calibration component does not own the requested roller geometry';
  END IF;

  SELECT release.id INTO active_release_id
  FROM public.paper_doll_family_releases AS release
  WHERE release.organization_id = p_organization_id
    AND release.family_key = p_family_key
    AND release.release_status <> 'superseded'
  ORDER BY release.created_at DESC
  LIMIT 1;
  IF active_release_id IS NULL THEN RAISE EXCEPTION 'Current family release is unavailable'; END IF;

  SELECT array_agg(asset.component_version_id ORDER BY asset.component_version_id) INTO release_body_ids
  FROM public.paper_doll_family_release_assets AS asset
  JOIN public.paper_doll_component_versions AS body_version
    ON body_version.id = asset.component_version_id
   AND body_version.organization_id = asset.organization_id
  JOIN public.paper_doll_components AS body_component
    ON body_component.id = body_version.component_id
   AND body_component.organization_id = body_version.organization_id
  WHERE asset.organization_id = p_organization_id
    AND asset.release_id = active_release_id
    AND asset.slot = 'body'
    AND body_component.slot = 'body'
    AND body_version.approval_status = 'approved';
  IF cardinality(release_body_ids) <> 5
    OR NOT (release_body_ids <@ p_compatible_body_component_version_ids)
    OR NOT (p_compatible_body_component_version_ids <@ release_body_ids)
  THEN
    RAISE EXCEPTION 'Placement must cover the exact five approved Current Release body plates';
  END IF;

  INSERT INTO public.paper_doll_placement_versions (
    organization_id, family_key, fitment_geometry_key, authority_mask_sha256,
    canvas_width_px, canvas_height_px, translate_x_px, translate_y_px,
    uniform_scale, mount_axis_x_px, contact_y_px,
    calibration_component_version_id, created_by
  ) VALUES (
    p_organization_id, p_family_key, p_fitment_geometry_key, p_expected_authority_mask_sha256,
    p_canvas_width_px, p_canvas_height_px, p_translate_x_px, p_translate_y_px,
    p_uniform_scale, calibration.mount_axis_x_px, calibration.seat_y_px,
    calibration.id, p_approver_user_id
  )
  ON CONFLICT ON CONSTRAINT paper_doll_placement_versions_exact_unique DO NOTHING
  RETURNING id INTO placement_id;
  IF placement_id IS NULL THEN
    SELECT id INTO placement_id
    FROM public.paper_doll_placement_versions
    WHERE organization_id = p_organization_id
      AND family_key = p_family_key
      AND fitment_geometry_key = p_fitment_geometry_key
      AND authority_mask_sha256 = p_expected_authority_mask_sha256
      AND canvas_width_px = p_canvas_width_px
      AND canvas_height_px = p_canvas_height_px
      AND translate_x_px = p_translate_x_px
      AND translate_y_px = p_translate_y_px
      AND uniform_scale = p_uniform_scale;
  END IF;

  INSERT INTO public.paper_doll_placement_reviews (
    organization_id, placement_version_id, body_component_version_id,
    review_status, gate_key, reviewed_by, reviewer_display_name
  )
  SELECT p_organization_id, placement_id, body_id,
    'passed', 'assembly-context', p_approver_user_id, btrim(p_approver_display_name)
  FROM unnest(p_compatible_body_component_version_ids) AS body_id
  ON CONFLICT (placement_version_id, body_component_version_id) DO NOTHING;

  SELECT array_agg(id ORDER BY id) INTO review_ids
  FROM public.paper_doll_placement_reviews
  WHERE organization_id = p_organization_id
    AND placement_version_id = placement_id;
  IF cardinality(review_ids) <> 5 THEN RAISE EXCEPTION 'Five assembly-context reviews are required'; END IF;

  INSERT INTO public.paper_doll_placement_approvals (
    organization_id, placement_version_id, approver_user_id,
    approver_display_name, approval_note, review_ids
  ) VALUES (
    p_organization_id, placement_id, p_approver_user_id,
    btrim(p_approver_display_name), btrim(p_approval_note), review_ids
  )
  ON CONFLICT (placement_version_id) DO NOTHING
  RETURNING id INTO approval_id;
  IF approval_id IS NULL THEN
    SELECT id INTO approval_id
    FROM public.paper_doll_placement_approvals
    WHERE organization_id = p_organization_id
      AND placement_version_id = placement_id;
  END IF;

  RETURN (SELECT public.get_paper_doll_family_placement(
    p_organization_id, p_family_key, p_fitment_geometry_key, p_expected_authority_mask_sha256
  )) || jsonb_build_object(
    'approvalId', approval_id,
    'releaseChanged', false,
    'sanityPublished', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_paper_doll_family_placement(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_paper_doll_family_placement(UUID, TEXT, TEXT, TEXT)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.lock_paper_doll_shared_placement(
  UUID, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, UUID[], UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_paper_doll_shared_placement(
  UUID, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, UUID[], UUID, TEXT, TEXT
) TO service_role;

COMMENT ON TABLE public.paper_doll_placement_versions IS
  'Immutable shared placement transforms keyed to exact approved fitment geometry and mask identity.';
COMMENT ON FUNCTION public.lock_paper_doll_shared_placement(
  UUID, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, UUID[], UUID, TEXT, TEXT
) IS 'Locks one named, five-body placement decision; never mutates a release or publishes to Sanity.';
