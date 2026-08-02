-- Atomically register a pre-existing, named-review-approved source as an
-- immutable component version with its calibrated QA evidence. Storage bytes
-- are uploaded and download-verified before this RPC is called. This function
-- deliberately has no release-membership or publication side effects.

CREATE OR REPLACE FUNCTION public.register_paper_doll_approved_source(
  p_organization_id UUID,
  p_component JSONB,
  p_version JSONB,
  p_qa_results JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_component public.paper_doll_components%ROWTYPE;
  v_version public.paper_doll_component_versions%ROWTYPE;
  v_qa JSONB;
  v_component_insert_count INTEGER := 0;
  v_version_created BOOLEAN := false;
  v_qa_identity_matches BOOLEAN := false;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role is required to register an approved paper-doll source';
  END IF;
  IF jsonb_typeof(p_component) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_version) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_qa_results) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_qa_results) < 1
  THEN
    RAISE EXCEPTION 'Approved-source registration requires component, version, and QA evidence';
  END IF;
  IF p_version->>'storageBucket' IS DISTINCT FROM 'paper-doll-approved'
    OR p_version->>'approvalStatus' IS DISTINCT FROM 'approved'
    OR p_version->>'contentType' IS DISTINCT FROM 'image/png'
    OR p_version->>'imageSha256' !~ '^[a-f0-9]{64}$'
    OR p_version->>'geometryMaskSha256' !~ '^[a-f0-9]{64}$'
  THEN
    RAISE EXCEPTION 'Approved-source version violates the immutable approved-asset contract';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_qa_results) AS qa(value)
    GROUP BY qa.value->>'gateKey', qa.value->>'gateVersion'
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_qa_results) AS qa(value)
    WHERE qa.value->>'qaStatus' IS DISTINCT FROM 'passed'
      OR COALESCE((qa.value->>'blocking')::BOOLEAN, false) IS DISTINCT FROM true
      OR jsonb_typeof(qa.value->'calibratedWith') IS DISTINCT FROM 'array'
      OR jsonb_array_length(qa.value->'calibratedWith') < 1
  ) THEN
    RAISE EXCEPTION 'Approved-source QA must be unique, blocking, calibrated, and passed';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_organization_id::TEXT || ':' || COALESCE(p_component->>'componentKey', ''),
    0
  ));

  INSERT INTO public.paper_doll_components (
    organization_id,
    component_key,
    geometry_family_id,
    slot,
    display_name
  ) VALUES (
    p_organization_id,
    p_component->>'componentKey',
    p_component->>'geometryFamilyId',
    p_component->>'slot',
    p_component->>'displayName'
  )
  ON CONFLICT (organization_id, component_key) DO NOTHING;
  GET DIAGNOSTICS v_component_insert_count = ROW_COUNT;

  SELECT * INTO STRICT v_component
  FROM public.paper_doll_components
  WHERE organization_id = p_organization_id
    AND component_key = p_component->>'componentKey';

  IF v_component.geometry_family_id IS DISTINCT FROM p_component->>'geometryFamilyId'
    OR v_component.slot IS DISTINCT FROM p_component->>'slot'
    OR v_component.display_name IS DISTINCT FROM p_component->>'displayName'
  THEN
    RAISE EXCEPTION 'Existing paper-doll component identity differs from approved source';
  END IF;

  SELECT * INTO v_version
  FROM public.paper_doll_component_versions
  WHERE organization_id = p_organization_id
    AND component_id = v_component.id
    AND version_key = p_version->>'versionKey';

  IF FOUND THEN
    IF v_version.material_variant IS DISTINCT FROM p_version->>'materialVariant'
      OR v_version.storage_bucket IS DISTINCT FROM p_version->>'storageBucket'
      OR v_version.image_path IS DISTINCT FROM p_version->>'imagePath'
      OR v_version.image_sha256 IS DISTINCT FROM p_version->>'imageSha256'
      OR v_version.geometry_mask_path IS DISTINCT FROM p_version->>'geometryMaskPath'
      OR v_version.geometry_mask_sha256 IS DISTINCT FROM p_version->>'geometryMaskSha256'
      OR v_version.content_type IS DISTINCT FROM p_version->>'contentType'
      OR v_version.byte_size IS DISTINCT FROM (p_version->>'byteSize')::BIGINT
      OR v_version.width_px IS DISTINCT FROM (p_version->>'widthPx')::INTEGER
      OR v_version.height_px IS DISTINCT FROM (p_version->>'heightPx')::INTEGER
      OR v_version.alpha_bounds IS DISTINCT FROM p_version->'alphaBounds'
      OR v_version.mount_axis_x_px IS DISTINCT FROM (p_version->>'mountAxisXPx')::NUMERIC
      OR v_version.seat_y_px IS DISTINCT FROM (p_version->>'seatYPx')::NUMERIC
      OR v_version.approval_status IS DISTINCT FROM p_version->>'approvalStatus'
      OR v_version.parent_component_version_id IS NOT NULL
      OR v_version.provenance IS DISTINCT FROM COALESCE(p_version->'provenance', '{}'::JSONB)
    THEN
      RAISE EXCEPTION 'Existing approved component version identity differs';
    END IF;
  ELSE
    INSERT INTO public.paper_doll_component_versions (
      organization_id,
      component_id,
      version_key,
      material_variant,
      storage_bucket,
      image_path,
      image_sha256,
      geometry_mask_path,
      geometry_mask_sha256,
      content_type,
      byte_size,
      width_px,
      height_px,
      alpha_bounds,
      mount_axis_x_px,
      seat_y_px,
      approval_status,
      parent_component_version_id,
      provenance
    ) VALUES (
      p_organization_id,
      v_component.id,
      p_version->>'versionKey',
      p_version->>'materialVariant',
      p_version->>'storageBucket',
      p_version->>'imagePath',
      p_version->>'imageSha256',
      p_version->>'geometryMaskPath',
      p_version->>'geometryMaskSha256',
      p_version->>'contentType',
      (p_version->>'byteSize')::BIGINT,
      (p_version->>'widthPx')::INTEGER,
      (p_version->>'heightPx')::INTEGER,
      p_version->'alphaBounds',
      (p_version->>'mountAxisXPx')::NUMERIC,
      (p_version->>'seatYPx')::NUMERIC,
      p_version->>'approvalStatus',
      NULL,
      COALESCE(p_version->'provenance', '{}'::JSONB)
    )
    RETURNING * INTO v_version;
    v_version_created := true;
  END IF;

  IF v_version_created THEN
    FOR v_qa IN SELECT value FROM jsonb_array_elements(p_qa_results)
    LOOP
      INSERT INTO public.paper_doll_qa_results (
        organization_id,
        component_version_id,
        gate_key,
        gate_version,
        qa_status,
        blocking,
        calibrated_with,
        measurements,
        issues
      ) VALUES (
        p_organization_id,
        v_version.id,
        v_qa->>'gateKey',
        v_qa->>'gateVersion',
        v_qa->>'qaStatus',
        (v_qa->>'blocking')::BOOLEAN,
        ARRAY(SELECT jsonb_array_elements_text(v_qa->'calibratedWith')),
        COALESCE(v_qa->'measurements', '{}'::JSONB),
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_qa->'issues', '[]'::JSONB)))
      );
    END LOOP;
  ELSE
    SELECT
      count(*) = jsonb_array_length(p_qa_results)
      AND NOT EXISTS (
        SELECT 1
        FROM public.paper_doll_qa_results AS existing
        WHERE existing.organization_id = p_organization_id
          AND existing.component_version_id = v_version.id
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p_qa_results) AS expected(value)
            WHERE expected.value->>'gateKey' = existing.gate_key
              AND expected.value->>'gateVersion' = existing.gate_version
              AND expected.value->>'qaStatus' = existing.qa_status
              AND (expected.value->>'blocking')::BOOLEAN = existing.blocking
              AND ARRAY(SELECT jsonb_array_elements_text(expected.value->'calibratedWith')) = existing.calibrated_with
              AND COALESCE(expected.value->'measurements', '{}'::JSONB) = existing.measurements
              AND ARRAY(SELECT jsonb_array_elements_text(COALESCE(expected.value->'issues', '[]'::JSONB))) = existing.issues
          )
      )
    INTO v_qa_identity_matches
    FROM public.paper_doll_qa_results
    WHERE organization_id = p_organization_id
      AND component_version_id = v_version.id;

    IF NOT v_qa_identity_matches THEN
      RAISE EXCEPTION 'Existing approved-source QA identity differs';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'componentId', v_component.id,
    'componentVersionId', v_version.id,
    'componentCreated', v_component_insert_count = 1,
    'versionCreated', v_version_created,
    'qaResultCount', jsonb_array_length(p_qa_results),
    'releaseMutation', false,
    'sanityPublished', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_paper_doll_approved_source(UUID, JSONB, JSONB, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_paper_doll_approved_source(UUID, JSONB, JSONB, JSONB)
  TO service_role;

COMMENT ON FUNCTION public.register_paper_doll_approved_source(UUID, JSONB, JSONB, JSONB) IS
  'Registers one exact approved source and calibrated QA set idempotently; never mutates a release or publishes to Sanity.';
