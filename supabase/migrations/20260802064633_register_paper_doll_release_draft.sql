CREATE OR REPLACE FUNCTION public.register_paper_doll_release_draft(
  p_organization_id UUID,
  p_manifest JSONB,
  p_manifest_sha256 TEXT,
  p_source_git_commit TEXT,
  p_renderer_version TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_release public.paper_doll_family_releases%ROWTYPE;
  v_asset JSONB;
  v_version RECORD;
  v_asset_count INTEGER;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role is required to register a paper-doll release';
  END IF;
  IF p_manifest_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Manifest SHA is invalid';
  END IF;
  IF p_manifest->>'familyKey' <> 'CYL-9ML'
    OR p_manifest->>'status' NOT IN ('blocked', 'ready')
    OR (p_manifest#>>'{canvas,widthPx}')::INTEGER <> 2080
    OR (p_manifest#>>'{canvas,heightPx}')::INTEGER <> 2288
    OR p_manifest#>>'{canvas,backgroundHex}' <> '#F5F3EF'
  THEN
    RAISE EXCEPTION 'Release manifest violates the CYL-9ML canvas/status contract';
  END IF;

  SELECT * INTO v_release
  FROM public.paper_doll_family_releases
  WHERE organization_id = p_organization_id
    AND family_key = p_manifest->>'familyKey'
    AND release_version = p_manifest->>'releaseVersion';

  IF FOUND THEN
    IF v_release.manifest_sha256 <> p_manifest_sha256 OR v_release.manifest <> p_manifest THEN
      RAISE EXCEPTION 'Existing release version has a different immutable manifest identity';
    END IF;
    SELECT count(*) INTO v_asset_count
    FROM public.paper_doll_family_release_assets
    WHERE release_id = v_release.id AND organization_id = p_organization_id;
    IF v_asset_count <> jsonb_array_length(p_manifest->'assets') THEN
      RAISE EXCEPTION 'Existing release membership count does not match its manifest';
    END IF;
    RETURN jsonb_build_object(
      'releaseId', v_release.id,
      'releaseVersion', v_release.release_version,
      'releaseStatus', v_release.release_status,
      'manifestSha256', v_release.manifest_sha256,
      'assetCount', v_asset_count,
      'created', false,
      'sanityPublished', false
    );
  END IF;

  INSERT INTO public.paper_doll_family_releases (
    organization_id, family_key, release_version, release_status,
    canvas_width_px, canvas_height_px, background_hex,
    manifest, manifest_sha256, source_git_commit, renderer_version
  ) VALUES (
    p_organization_id,
    p_manifest->>'familyKey',
    p_manifest->>'releaseVersion',
    p_manifest->>'status',
    2080,
    2288,
    '#F5F3EF',
    p_manifest,
    p_manifest_sha256,
    p_source_git_commit,
    p_renderer_version
  ) RETURNING * INTO v_release;

  FOR v_asset IN SELECT value FROM jsonb_array_elements(p_manifest->'assets')
  LOOP
    SELECT
      version.id,
      version.image_path,
      version.image_sha256,
      version.geometry_mask_path,
      version.geometry_mask_sha256,
      version.width_px,
      version.height_px,
      version.alpha_bounds,
      version.mount_axis_x_px,
      version.seat_y_px,
      version.approval_status,
      component.component_key,
      component.geometry_family_id,
      component.slot
    INTO v_version
    FROM public.paper_doll_component_versions AS version
    JOIN public.paper_doll_components AS component
      ON component.id = version.component_id
     AND component.organization_id = version.organization_id
    WHERE version.id = (v_asset->>'componentVersionId')::UUID
      AND version.organization_id = p_organization_id;

    IF NOT FOUND
      OR v_version.approval_status <> 'approved'
      OR v_asset->>'approvalStatus' <> 'approved'
      OR v_version.component_key <> v_asset->>'componentKey'
      OR v_version.geometry_family_id <> v_asset->>'geometryFamilyId'
      OR v_version.slot <> v_asset->>'slot'
      OR v_version.image_path <> v_asset->>'imagePath'
      OR v_version.image_sha256 <> v_asset->>'imageSha256'
      OR v_version.geometry_mask_path IS DISTINCT FROM NULLIF(v_asset->>'geometryMaskPath', '')
      OR v_version.geometry_mask_sha256 IS DISTINCT FROM NULLIF(v_asset->>'geometryMaskSha256', '')
      OR v_version.width_px <> (v_asset->>'widthPx')::INTEGER
      OR v_version.height_px <> (v_asset->>'heightPx')::INTEGER
      OR v_version.alpha_bounds <> v_asset->'alphaBounds'
      OR v_version.mount_axis_x_px <> (v_asset->>'mountAxisXPx')::NUMERIC
      OR v_version.seat_y_px <> (v_asset->>'seatYPx')::NUMERIC
    THEN
      RAISE EXCEPTION 'Manifest asset % does not match an exact approved component version', v_asset->>'componentVersionId';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.paper_doll_qa_results AS qa
      WHERE qa.organization_id = p_organization_id
        AND qa.component_version_id = v_version.id
        AND qa.blocking = true
        AND qa.qa_status = 'passed'
    ) OR EXISTS (
      SELECT 1 FROM public.paper_doll_qa_results AS qa
      WHERE qa.organization_id = p_organization_id
        AND qa.component_version_id = v_version.id
        AND qa.blocking = true
        AND qa.qa_status <> 'passed'
    ) THEN
      RAISE EXCEPTION 'Manifest asset % has not passed all blocking QA', v_version.id;
    END IF;

    INSERT INTO public.paper_doll_family_release_assets (
      organization_id, release_id, component_version_id, slot, variant_key
    ) VALUES (
      p_organization_id,
      v_release.id,
      v_version.id,
      v_asset->>'slot',
      v_asset->>'variantKey'
    );
  END LOOP;

  SELECT count(*) INTO v_asset_count
  FROM public.paper_doll_family_release_assets
  WHERE release_id = v_release.id AND organization_id = p_organization_id;
  IF v_asset_count <> jsonb_array_length(p_manifest->'assets') THEN
    RAISE EXCEPTION 'Inserted release membership count does not match its manifest';
  END IF;

  RETURN jsonb_build_object(
    'releaseId', v_release.id,
    'releaseVersion', v_release.release_version,
    'releaseStatus', v_release.release_status,
    'manifestSha256', v_release.manifest_sha256,
    'assetCount', v_asset_count,
    'created', true,
    'sanityPublished', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_paper_doll_release_draft(UUID, JSONB, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_paper_doll_release_draft(UUID, JSONB, TEXT, TEXT, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.register_paper_doll_release_draft(UUID, JSONB, TEXT, TEXT, TEXT) IS
  'Atomically registers an exact approved-version CYL-9ML release draft; never publishes to Sanity.';
