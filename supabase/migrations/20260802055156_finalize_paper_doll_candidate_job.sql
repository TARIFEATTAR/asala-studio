-- Transactional candidate finalization. The worker has already uploaded and
-- download-verified the content-addressed object before calling this RPC.
-- Browser roles cannot execute it.

CREATE OR REPLACE FUNCTION public.finalize_paper_doll_candidate_job(
  p_job_id UUID,
  p_organization_id UUID,
  p_output_ref JSONB,
  p_output_metadata JSONB,
  p_version JSONB,
  p_qa_results JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  job public.paper_doll_candidate_jobs%ROWTYPE;
  candidate_version_id UUID;
  qa JSONB;
BEGIN
  SELECT * INTO job
  FROM public.paper_doll_candidate_jobs
  WHERE id = p_job_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND OR job.status <> 'qa' THEN
    RAISE EXCEPTION 'Candidate job must exist in qa status';
  END IF;
  IF NOT public.paper_doll_asset_ref_is_valid(p_output_ref, p_organization_id)
    OR p_output_ref->>'bucket' <> 'paper-doll-candidates'
  THEN
    RAISE EXCEPTION 'Candidate output reference is invalid';
  END IF;
  IF jsonb_typeof(p_qa_results) <> 'array' OR jsonb_array_length(p_qa_results) < 1 THEN
    RAISE EXCEPTION 'Candidate finalization requires QA evidence';
  END IF;

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
    width_px,
    height_px,
    alpha_bounds,
    mount_axis_x_px,
    seat_y_px,
    byte_size,
    content_type,
    approval_status,
    parent_component_version_id,
    provenance
  ) VALUES (
    job.organization_id,
    job.component_id,
    p_version->>'versionKey',
    p_version->>'materialVariant',
    'paper-doll-candidates',
    p_version->>'imagePath',
    p_version->>'imageSha256',
    p_version->>'geometryMaskPath',
    p_version->>'geometryMaskSha256',
    (p_version->>'widthPx')::INTEGER,
    (p_version->>'heightPx')::INTEGER,
    p_version->'alphaBounds',
    (p_version->>'mountAxisXPx')::NUMERIC,
    (p_version->>'seatYPx')::NUMERIC,
    (p_version->>'byteSize')::BIGINT,
    p_version->>'contentType',
    'candidate',
    job.parent_component_version_id,
    COALESCE(p_version->'provenance', '{}'::JSONB)
  )
  RETURNING id INTO candidate_version_id;

  FOR qa IN SELECT value FROM jsonb_array_elements(p_qa_results)
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
      job.organization_id,
      candidate_version_id,
      qa->>'gateKey',
      qa->>'gateVersion',
      qa->>'qaStatus',
      (qa->>'blocking')::BOOLEAN,
      ARRAY(SELECT jsonb_array_elements_text(qa->'calibratedWith')),
      COALESCE(qa->'measurements', '{}'::JSONB),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(qa->'issues', '[]'::JSONB)))
    );
  END LOOP;

  UPDATE public.paper_doll_candidate_jobs
  SET
    status = 'candidate_ready',
    candidate_component_version_id = candidate_version_id,
    output_ref = p_output_ref,
    output_metadata = COALESCE(p_output_metadata, '{}'::JSONB),
    completed_at = now()
  WHERE id = job.id
    AND organization_id = job.organization_id;

  RETURN candidate_version_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_paper_doll_candidate_job(
  UUID, UUID, JSONB, JSONB, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_paper_doll_candidate_job(
  UUID, UUID, JSONB, JSONB, JSONB, JSONB
) TO service_role;

COMMENT ON FUNCTION public.finalize_paper_doll_candidate_job(
  UUID, UUID, JSONB, JSONB, JSONB, JSONB
) IS 'Atomically inserts a candidate child, append-only QA evidence, and terminal job result; service-role only.';
