-- Expose the immutable approved child beside its candidate history entry.
-- This is read-only workbench data and does not change release membership.

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
          'approvedVersion', (
            SELECT to_jsonb(approved_version)
            FROM public.paper_doll_component_approvals AS approved_decision
            JOIN public.paper_doll_component_versions AS approved_version
              ON approved_version.id = approved_decision.resulting_approved_component_version_id
             AND approved_version.organization_id = approved_decision.organization_id
            WHERE approved_decision.organization_id = job.organization_id
              AND approved_decision.candidate_component_version_id = job.candidate_component_version_id
              AND approved_decision.decision = 'approved'
            ORDER BY approved_decision.created_at DESC
            LIMIT 1
          ),
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
            ORDER BY approval.created_at DESC
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

COMMENT ON FUNCTION public.get_paper_doll_candidate_workbench(UUID, TEXT) IS
  'Returns immutable candidate, approval, and approved-child history for organization members; never changes a release.';
