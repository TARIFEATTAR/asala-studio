-- Immutable candidate-job and named-approval ledger for the Paper-Doll Rig.
-- Browser sessions are read-only. Trusted server code creates jobs, advances
-- their state, runs the clamp, writes candidate versions, and records approval.

CREATE OR REPLACE FUNCTION public.paper_doll_asset_ref_is_valid(
  p_reference JSONB,
  p_organization_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    p_reference ?& ARRAY['bucket', 'path', 'sha256', 'contentType', 'byteSize']
    AND p_reference->>'bucket' IN (
      'paper-doll-sources', 'paper-doll-candidates', 'paper-doll-approved'
    )
    AND p_reference->>'path' !~ '^[a-z][a-z0-9+.-]*://'
    AND p_reference->>'path' !~ '^/'
    AND p_reference->>'path' !~ '(^|/)\.\.(/|$)'
    AND split_part(p_reference->>'path', '/', 1) = p_organization_id::TEXT
    AND p_reference->>'sha256' ~ '^[a-f0-9]{64}$'
    AND p_reference->>'path' ~ ('/' || (p_reference->>'sha256') || '\.[a-z0-9]+$')
    AND length(btrim(p_reference->>'contentType')) > 0
    AND (p_reference->>'byteSize') ~ '^[1-9][0-9]*$';
$$;

CREATE TABLE public.paper_doll_candidate_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requirement_key TEXT NOT NULL CHECK (requirement_key ~ '^CYL-9ML:(BODY|OVERCAP|ROLLER):'),
  component_id UUID NOT NULL,
  parent_component_version_id UUID NOT NULL,
  parent_sha256 TEXT NOT NULL CHECK (parent_sha256 ~ '^[a-f0-9]{64}$'),
  provider TEXT NOT NULL CHECK (provider IN ('blender', 'openai', 'google', 'manual')),
  model TEXT NOT NULL CHECK (length(btrim(model)) > 0),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'running', 'clamping', 'qa', 'candidate_ready', 'failed', 'cancelled')
  ),
  prompt TEXT NOT NULL CHECK (length(btrim(prompt)) > 0),
  prompt_sha256 TEXT NOT NULL CHECK (prompt_sha256 ~ '^[a-f0-9]{64}$'),
  source_ref JSONB NOT NULL,
  authoritative_mask_ref JSONB NOT NULL,
  edit_mask_ref JSONB NOT NULL,
  assembly_context_ref JSONB,
  transform JSONB NOT NULL CHECK (
    transform ?& ARRAY['translateXPx', 'translateYPx', 'scaleX', 'scaleY']
    AND (transform->>'scaleX')::NUMERIC > 0
    AND (transform->>'scaleX')::NUMERIC = (transform->>'scaleY')::NUMERIC
  ),
  selection_kind TEXT NOT NULL DEFAULT 'whole-layer' CHECK (
    selection_kind IN ('whole-layer', 'rectangle', 'brush')
  ),
  generation_attempt_id UUID REFERENCES public.generation_attempts(id) ON DELETE RESTRICT,
  candidate_component_version_id UUID,
  output_ref JSONB,
  output_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  initiated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT paper_doll_candidate_jobs_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_candidate_jobs_component_org_fk
    FOREIGN KEY (component_id, organization_id)
    REFERENCES public.paper_doll_components(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_candidate_jobs_parent_org_fk
    FOREIGN KEY (parent_component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_candidate_jobs_candidate_version_org_fk
    FOREIGN KEY (candidate_component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_candidate_jobs_source_ref_check
    CHECK (public.paper_doll_asset_ref_is_valid(source_ref, organization_id)),
  CONSTRAINT paper_doll_candidate_jobs_authority_ref_check
    CHECK (public.paper_doll_asset_ref_is_valid(authoritative_mask_ref, organization_id)),
  CONSTRAINT paper_doll_candidate_jobs_edit_ref_check
    CHECK (public.paper_doll_asset_ref_is_valid(edit_mask_ref, organization_id)),
  CONSTRAINT paper_doll_candidate_jobs_context_ref_check
    CHECK (
      assembly_context_ref IS NULL
      OR public.paper_doll_asset_ref_is_valid(assembly_context_ref, organization_id)
    ),
  CONSTRAINT paper_doll_candidate_jobs_output_ref_check
    CHECK (
      output_ref IS NULL
      OR public.paper_doll_asset_ref_is_valid(output_ref, organization_id)
    ),
  CONSTRAINT paper_doll_candidate_jobs_completion_check CHECK (
    (status IN ('candidate_ready', 'failed', 'cancelled')) = (completed_at IS NOT NULL)
  ),
  CONSTRAINT paper_doll_candidate_jobs_error_check CHECK (
    status <> 'failed' OR length(btrim(error_message)) > 0
  )
);

CREATE TABLE public.paper_doll_component_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_job_id UUID,
  candidate_component_version_id UUID NOT NULL,
  resulting_approved_component_version_id UUID,
  approver_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approver_display_name TEXT NOT NULL CHECK (length(btrim(approver_display_name)) > 0),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  evidence_ids UUID[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  expected_candidate_sha256 TEXT NOT NULL CHECK (expected_candidate_sha256 ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_component_approvals_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_component_approvals_candidate_unique
    UNIQUE (organization_id, candidate_component_version_id),
  CONSTRAINT paper_doll_component_approvals_job_org_fk
    FOREIGN KEY (candidate_job_id, organization_id)
    REFERENCES public.paper_doll_candidate_jobs(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_component_approvals_candidate_org_fk
    FOREIGN KEY (candidate_component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_component_approvals_result_org_fk
    FOREIGN KEY (resulting_approved_component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_component_approvals_decision_result_check CHECK (
    (decision = 'approved') = (resulting_approved_component_version_id IS NOT NULL)
  )
);

CREATE INDEX paper_doll_candidate_jobs_org_created_idx
  ON public.paper_doll_candidate_jobs (organization_id, created_at DESC);
CREATE INDEX paper_doll_candidate_jobs_requirement_status_idx
  ON public.paper_doll_candidate_jobs (organization_id, requirement_key, status);
CREATE INDEX paper_doll_candidate_jobs_parent_idx
  ON public.paper_doll_candidate_jobs (parent_component_version_id);
CREATE UNIQUE INDEX paper_doll_candidate_jobs_candidate_version_unique
  ON public.paper_doll_candidate_jobs (organization_id, candidate_component_version_id)
  WHERE candidate_component_version_id IS NOT NULL;
CREATE INDEX paper_doll_component_approvals_org_created_idx
  ON public.paper_doll_component_approvals (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.paper_doll_validate_candidate_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_row public.paper_doll_component_versions%ROWTYPE;
  candidate_row public.paper_doll_component_versions%ROWTYPE;
  attempt_organization_id UUID;
BEGIN
  SELECT * INTO parent_row
  FROM public.paper_doll_component_versions
  WHERE id = NEW.parent_component_version_id
    AND organization_id = NEW.organization_id;

  IF NOT FOUND
    OR parent_row.component_id <> NEW.component_id
    OR parent_row.image_sha256 <> NEW.parent_sha256
  THEN
    RAISE EXCEPTION 'Candidate parent identity or expected SHA does not match';
  END IF;

  IF NEW.generation_attempt_id IS NOT NULL THEN
    SELECT organization_id INTO attempt_organization_id
    FROM public.generation_attempts
    WHERE id = NEW.generation_attempt_id;
    IF NOT FOUND OR attempt_organization_id IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'Generation attempt organization does not match candidate job';
    END IF;
  END IF;

  IF NEW.candidate_component_version_id IS NOT NULL THEN
    SELECT * INTO candidate_row
    FROM public.paper_doll_component_versions
    WHERE id = NEW.candidate_component_version_id
      AND organization_id = NEW.organization_id;
    IF NOT FOUND
      OR candidate_row.component_id <> NEW.component_id
      OR candidate_row.parent_component_version_id <> NEW.parent_component_version_id
      OR candidate_row.approval_status NOT IN ('candidate', 'blocked')
      OR NEW.output_ref IS NULL
      OR candidate_row.image_sha256 <> NEW.output_ref->>'sha256'
    THEN
      RAISE EXCEPTION 'Candidate output version does not match job identity';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF ROW(
      OLD.organization_id, OLD.requirement_key, OLD.component_id,
      OLD.parent_component_version_id, OLD.parent_sha256,
      OLD.provider, OLD.model, OLD.prompt, OLD.prompt_sha256,
      OLD.source_ref, OLD.authoritative_mask_ref, OLD.edit_mask_ref,
      OLD.assembly_context_ref, OLD.transform, OLD.selection_kind,
      OLD.initiated_by, OLD.created_at
    ) IS DISTINCT FROM ROW(
      NEW.organization_id, NEW.requirement_key, NEW.component_id,
      NEW.parent_component_version_id, NEW.parent_sha256,
      NEW.provider, NEW.model, NEW.prompt, NEW.prompt_sha256,
      NEW.source_ref, NEW.authoritative_mask_ref, NEW.edit_mask_ref,
      NEW.assembly_context_ref, NEW.transform, NEW.selection_kind,
      NEW.initiated_by, NEW.created_at
    ) THEN
      RAISE EXCEPTION 'Candidate job identity is immutable';
    END IF;

    IF OLD.status IN ('candidate_ready', 'failed', 'cancelled') THEN
      RAISE EXCEPTION 'Terminal candidate jobs are immutable';
    END IF;
    IF NOT (
      (OLD.status = 'queued' AND NEW.status IN ('queued', 'running', 'failed', 'cancelled'))
      OR (OLD.status = 'running' AND NEW.status IN ('running', 'clamping', 'failed', 'cancelled'))
      OR (OLD.status = 'clamping' AND NEW.status IN ('clamping', 'qa', 'failed', 'cancelled'))
      OR (OLD.status = 'qa' AND NEW.status IN ('qa', 'candidate_ready', 'failed', 'cancelled'))
    ) THEN
      RAISE EXCEPTION 'Invalid candidate job status transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_validate_component_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  candidate_row public.paper_doll_component_versions%ROWTYPE;
  approved_row public.paper_doll_component_versions%ROWTYPE;
  evidence_count INTEGER;
BEGIN
  SELECT * INTO candidate_row
  FROM public.paper_doll_component_versions
  WHERE id = NEW.candidate_component_version_id
    AND organization_id = NEW.organization_id;

  IF NOT FOUND
    OR candidate_row.image_sha256 <> NEW.expected_candidate_sha256
    OR candidate_row.approval_status NOT IN ('candidate', 'blocked')
  THEN
    RAISE EXCEPTION 'Approval candidate identity or expected SHA does not match';
  END IF;

  SELECT count(*) INTO evidence_count
  FROM public.paper_doll_qa_results
  WHERE id = ANY(NEW.evidence_ids)
    AND organization_id = NEW.organization_id
    AND component_version_id = NEW.candidate_component_version_id;
  IF evidence_count <> cardinality(NEW.evidence_ids) THEN
    RAISE EXCEPTION 'Approval evidence must belong to the exact candidate version';
  END IF;

  IF NEW.decision = 'approved' THEN
    SELECT * INTO approved_row
    FROM public.paper_doll_component_versions
    WHERE id = NEW.resulting_approved_component_version_id
      AND organization_id = NEW.organization_id;
    IF NOT FOUND
      OR approved_row.approval_status <> 'approved'
      OR approved_row.storage_bucket <> 'paper-doll-approved'
      OR approved_row.parent_component_version_id <> NEW.candidate_component_version_id
      OR approved_row.image_sha256 <> NEW.expected_candidate_sha256
    THEN
      RAISE EXCEPTION 'Approved child version does not preserve candidate identity';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_reject_candidate_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Paper-doll approvals are append-only and candidate jobs cannot be deleted';
END;
$$;

CREATE TRIGGER paper_doll_candidate_jobs_validate
  BEFORE INSERT OR UPDATE ON public.paper_doll_candidate_jobs
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_validate_candidate_job();
CREATE TRIGGER paper_doll_candidate_jobs_no_delete
  BEFORE DELETE ON public.paper_doll_candidate_jobs
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_candidate_ledger_mutation();
CREATE TRIGGER paper_doll_component_approvals_validate
  BEFORE INSERT ON public.paper_doll_component_approvals
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_validate_component_approval();
CREATE TRIGGER paper_doll_component_approvals_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_component_approvals
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_candidate_ledger_mutation();

ALTER TABLE public.paper_doll_candidate_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_component_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY paper_doll_candidate_jobs_select_org_members
  ON public.paper_doll_candidate_jobs FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_component_approvals_select_org_members
  ON public.paper_doll_component_approvals FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));

REVOKE ALL ON TABLE public.paper_doll_candidate_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_component_approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.paper_doll_candidate_jobs TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_component_approvals TO authenticated;
GRANT ALL ON TABLE public.paper_doll_candidate_jobs TO service_role;
GRANT ALL ON TABLE public.paper_doll_component_approvals TO service_role;

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
          'candidateVersion', CASE
            WHEN candidate_version.id IS NULL THEN NULL
            ELSE to_jsonb(candidate_version)
          END,
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
        )
        ORDER BY job.created_at DESC
      )
      FROM public.paper_doll_candidate_jobs AS job
      JOIN public.paper_doll_components AS component
        ON component.id = job.component_id
       AND component.organization_id = job.organization_id
      JOIN public.paper_doll_component_versions AS parent_version
        ON parent_version.id = job.parent_component_version_id
       AND parent_version.organization_id = job.organization_id
      LEFT JOIN public.paper_doll_component_versions AS candidate_version
        ON candidate_version.id = job.candidate_component_version_id
       AND candidate_version.organization_id = job.organization_id
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
    ), '[]'::JSONB)
  );
$$;

REVOKE ALL ON FUNCTION public.get_paper_doll_candidate_workbench(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_paper_doll_candidate_workbench(UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON TABLE public.paper_doll_candidate_jobs IS
  'Versioned candidate work: immutable parent/provider/prompt/masks plus server-owned state transitions and outputs.';
COMMENT ON TABLE public.paper_doll_component_approvals IS
  'Paper-doll approvals are append-only, named, SHA-bound, and backed by QA evidence.';
COMMENT ON FUNCTION public.get_paper_doll_candidate_workbench(UUID, TEXT) IS
  'Read-only, RLS-preserving candidate and approval payload without signed asset URLs.';
