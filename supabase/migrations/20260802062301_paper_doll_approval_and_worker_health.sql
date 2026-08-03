-- Immutable candidate promotion and truthful worker health for the Paper-Doll
-- production loop. Storage copies happen before the transaction; this RPC
-- re-verifies every database identity and never edits release membership.

ALTER TABLE public.paper_doll_candidate_jobs
  ADD COLUMN manual_output_ref JSONB;
ALTER TABLE public.paper_doll_candidate_jobs
  ADD CONSTRAINT paper_doll_candidate_jobs_manual_output_ref_check CHECK (
    (provider = 'manual' AND manual_output_ref IS NOT NULL
      AND public.paper_doll_asset_ref_is_valid(manual_output_ref, organization_id))
    OR (provider <> 'manual' AND manual_output_ref IS NULL)
  );

CREATE OR REPLACE FUNCTION public.paper_doll_lock_candidate_manual_output()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.manual_output_ref IS DISTINCT FROM NEW.manual_output_ref THEN
    RAISE EXCEPTION 'Candidate manual output identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER paper_doll_candidate_jobs_lock_manual_output
  BEFORE UPDATE ON public.paper_doll_candidate_jobs
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_lock_candidate_manual_output();

CREATE TABLE public.paper_doll_worker_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_key TEXT NOT NULL CHECK (length(btrim(worker_key)) > 0),
  worker_status TEXT NOT NULL CHECK (worker_status IN ('offline', 'ready', 'busy', 'error')),
  current_job_id UUID,
  error_message TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_worker_heartbeats_org_key_unique UNIQUE (organization_id, worker_key),
  CONSTRAINT paper_doll_worker_heartbeats_job_org_fk
    FOREIGN KEY (current_job_id, organization_id)
    REFERENCES public.paper_doll_candidate_jobs(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_worker_heartbeats_error_check CHECK (
    worker_status <> 'error' OR length(btrim(error_message)) > 0
  )
);

CREATE INDEX paper_doll_worker_heartbeats_last_seen_idx
  ON public.paper_doll_worker_heartbeats (organization_id, last_seen_at DESC);

ALTER TABLE public.paper_doll_worker_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY paper_doll_worker_heartbeats_select_org_members
  ON public.paper_doll_worker_heartbeats FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
REVOKE ALL ON TABLE public.paper_doll_worker_heartbeats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.paper_doll_worker_heartbeats TO authenticated;
GRANT ALL ON TABLE public.paper_doll_worker_heartbeats TO service_role;

CREATE OR REPLACE FUNCTION public.approve_paper_doll_candidate(
  p_organization_id UUID,
  p_candidate_component_version_id UUID,
  p_expected_candidate_sha256 TEXT,
  p_decision TEXT,
  p_approver_user_id UUID,
  p_approver_display_name TEXT,
  p_evidence_ids UUID[],
  p_approved_ref JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  candidate public.paper_doll_component_versions%ROWTYPE;
  component public.paper_doll_components%ROWTYPE;
  job public.paper_doll_candidate_jobs%ROWTYPE;
  evidence_count INTEGER;
  blocking_count INTEGER;
  blocking_failure_count INTEGER;
  geometry_gate_count INTEGER;
  metal_white_gate_count INTEGER;
  approved_version_id UUID;
  approval_id UUID;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;
  IF length(btrim(p_approver_display_name)) < 1 OR cardinality(p_evidence_ids) < 1 THEN
    RAISE EXCEPTION 'Named approval and QA evidence are required';
  END IF;

  SELECT * INTO candidate
  FROM public.paper_doll_component_versions
  WHERE id = p_candidate_component_version_id
    AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND
    OR candidate.image_sha256 <> p_expected_candidate_sha256
    OR candidate.approval_status <> 'candidate'
    OR candidate.storage_bucket <> 'paper-doll-candidates'
  THEN
    RAISE EXCEPTION 'Candidate identity, SHA, status, or organization is stale';
  END IF;

  SELECT * INTO component
  FROM public.paper_doll_components
  WHERE id = candidate.component_id
    AND organization_id = candidate.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate component is unavailable'; END IF;

  SELECT * INTO job
  FROM public.paper_doll_candidate_jobs
  WHERE candidate_component_version_id = candidate.id
    AND organization_id = candidate.organization_id
    AND status = 'candidate_ready';
  IF NOT FOUND OR job.output_ref->>'sha256' <> candidate.image_sha256 THEN
    RAISE EXCEPTION 'Candidate is not the ready output of an immutable job';
  END IF;

  SELECT count(*) INTO evidence_count
  FROM public.paper_doll_qa_results
  WHERE id = ANY(p_evidence_ids)
    AND organization_id = candidate.organization_id
    AND component_version_id = candidate.id;
  IF evidence_count <> cardinality(p_evidence_ids) THEN
    RAISE EXCEPTION 'Approval evidence does not belong to the exact candidate';
  END IF;

  SELECT count(*) INTO blocking_count
  FROM public.paper_doll_qa_results
  WHERE organization_id = candidate.organization_id
    AND component_version_id = candidate.id
    AND blocking;
  SELECT count(*) INTO blocking_failure_count
  FROM public.paper_doll_qa_results
  WHERE organization_id = candidate.organization_id
    AND component_version_id = candidate.id
    AND blocking AND qa_status <> 'passed';
  SELECT count(*) INTO geometry_gate_count
  FROM public.paper_doll_qa_results
  WHERE organization_id = candidate.organization_id
    AND component_version_id = candidate.id
    AND gate_key = 'geometry-mask-identity'
    AND blocking AND qa_status = 'passed'
    AND id = ANY(p_evidence_ids);

  IF p_decision = 'approved' AND (
    blocking_count < 1 OR blocking_failure_count > 0 OR geometry_gate_count <> 1
  ) THEN
    RAISE EXCEPTION 'All blocking QA and exact geometry-mask identity must pass';
  END IF;

  IF p_decision = 'approved'
    AND component.slot = 'roller'
    AND job.requirement_key = 'CYL-9ML:ROLLER:METAL'
  THEN
    SELECT count(*) INTO metal_white_gate_count
    FROM public.paper_doll_qa_results
    WHERE organization_id = candidate.organization_id
      AND component_version_id = candidate.id
      AND gate_key = 'opaque-white-fraction'
      AND blocking AND qa_status = 'passed'
      AND id = ANY(p_evidence_ids);
    IF metal_white_gate_count <> 1 THEN
      RAISE EXCEPTION 'Metal roller requires passing opaque-white-fraction evidence';
    END IF;
  END IF;

  IF p_decision = 'approved' THEN
    IF p_approved_ref IS NULL
      OR NOT public.paper_doll_asset_ref_is_valid(p_approved_ref, p_organization_id)
      OR p_approved_ref->>'bucket' <> 'paper-doll-approved'
      OR p_approved_ref->>'sha256' <> candidate.image_sha256
    THEN
      RAISE EXCEPTION 'Approved Storage reference is invalid or does not preserve candidate SHA';
    END IF;

    INSERT INTO public.paper_doll_component_versions (
      organization_id, component_id, version_key, material_variant,
      storage_bucket, image_path, image_sha256,
      geometry_mask_path, geometry_mask_sha256,
      width_px, height_px, alpha_bounds, mount_axis_x_px, seat_y_px,
      byte_size, content_type, approval_status,
      parent_component_version_id, provenance
    ) VALUES (
      candidate.organization_id, candidate.component_id,
      'approved-' || candidate.id::TEXT, candidate.material_variant,
      'paper-doll-approved', p_approved_ref->>'path', candidate.image_sha256,
      candidate.geometry_mask_path, candidate.geometry_mask_sha256,
      candidate.width_px, candidate.height_px, candidate.alpha_bounds,
      candidate.mount_axis_x_px, candidate.seat_y_px,
      (p_approved_ref->>'byteSize')::BIGINT, p_approved_ref->>'contentType',
      'approved', candidate.id,
      candidate.provenance || jsonb_build_object(
        'approvedFromCandidateVersionId', candidate.id,
        'approvedByUserId', p_approver_user_id,
        'approvalEvidenceIds', to_jsonb(p_evidence_ids)
      )
    ) RETURNING id INTO approved_version_id;
  END IF;

  INSERT INTO public.paper_doll_component_approvals (
    organization_id, candidate_job_id, candidate_component_version_id,
    resulting_approved_component_version_id, approver_user_id,
    approver_display_name, decision, evidence_ids, expected_candidate_sha256
  ) VALUES (
    candidate.organization_id, job.id, candidate.id,
    approved_version_id, p_approver_user_id,
    btrim(p_approver_display_name), p_decision, p_evidence_ids, candidate.image_sha256
  ) RETURNING id INTO approval_id;

  RETURN jsonb_build_object(
    'approvalId', approval_id,
    'decision', p_decision,
    'approvedComponentVersionId', approved_version_id,
    'candidateComponentVersionId', candidate.id,
    'candidateSha256', candidate.image_sha256
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_paper_doll_candidate(
  UUID, UUID, TEXT, TEXT, UUID, TEXT, UUID[], JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_paper_doll_candidate(
  UUID, UUID, TEXT, TEXT, UUID, TEXT, UUID[], JSONB
) TO service_role;

CREATE OR REPLACE FUNCTION public.get_paper_doll_candidate_workbench(
  p_organization_id UUID,
  p_family_key TEXT
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'jobs', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'job', to_jsonb(job),
          'component', to_jsonb(component),
          'parentVersion', to_jsonb(parent_version),
          'candidateVersion', CASE WHEN candidate_version.id IS NULL THEN NULL ELSE to_jsonb(candidate_version) END,
          'qa', COALESCE((
            SELECT jsonb_agg(to_jsonb(qa_result) ORDER BY qa_result.created_at DESC)
            FROM public.paper_doll_qa_results AS qa_result
            WHERE qa_result.organization_id = job.organization_id
              AND qa_result.component_version_id = job.candidate_component_version_id
          ), '[]'::JSONB),
          'approval', (
            SELECT to_jsonb(approval)
            FROM public.paper_doll_component_approvals AS approval
            WHERE approval.organization_id = job.organization_id
              AND approval.candidate_component_version_id = job.candidate_component_version_id
            LIMIT 1
          )
        ) ORDER BY job.created_at DESC
      )
      FROM public.paper_doll_candidate_jobs AS job
      JOIN public.paper_doll_components AS component
        ON component.id = job.component_id AND component.organization_id = job.organization_id
      JOIN public.paper_doll_component_versions AS parent_version
        ON parent_version.id = job.parent_component_version_id AND parent_version.organization_id = job.organization_id
      LEFT JOIN public.paper_doll_component_versions AS candidate_version
        ON candidate_version.id = job.candidate_component_version_id AND candidate_version.organization_id = job.organization_id
      WHERE job.organization_id = p_organization_id
        AND job.requirement_key LIKE (p_family_key || ':%')
    ), '[]'::JSONB),
    'approvals', COALESCE((
      SELECT jsonb_agg(to_jsonb(approval) ORDER BY approval.created_at DESC)
      FROM public.paper_doll_component_approvals AS approval
      JOIN public.paper_doll_candidate_jobs AS approval_job
        ON approval_job.candidate_component_version_id = approval.candidate_component_version_id
       AND approval_job.organization_id = approval.organization_id
      WHERE approval.organization_id = p_organization_id
        AND approval_job.requirement_key LIKE (p_family_key || ':%')
    ), '[]'::JSONB),
    'worker', COALESCE((
      SELECT jsonb_build_object(
        'status', CASE WHEN heartbeat.last_seen_at < now() - interval '90 seconds' THEN 'offline' ELSE heartbeat.worker_status END,
        'lastSeenAt', heartbeat.last_seen_at,
        'currentJobId', heartbeat.current_job_id,
        'errorMessage', heartbeat.error_message
      )
      FROM public.paper_doll_worker_heartbeats AS heartbeat
      WHERE heartbeat.organization_id = p_organization_id
      ORDER BY heartbeat.last_seen_at DESC
      LIMIT 1
    ), jsonb_build_object('status', 'offline', 'lastSeenAt', NULL, 'currentJobId', NULL, 'errorMessage', NULL))
  );
$$;

REVOKE ALL ON FUNCTION public.get_paper_doll_candidate_workbench(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_paper_doll_candidate_workbench(UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON TABLE public.paper_doll_worker_heartbeats IS
  'Service-owned heartbeat. UI derives offline after 90 seconds and never claims a queued job is running without a current job.';
COMMENT ON FUNCTION public.approve_paper_doll_candidate(UUID, UUID, TEXT, TEXT, UUID, TEXT, UUID[], JSONB) IS
  'Transactionally creates an approved child and append-only named evidence; never changes a release.';
