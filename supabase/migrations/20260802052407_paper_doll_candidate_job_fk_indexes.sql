-- Cover every foreign key introduced by the Paper-Doll candidate ledger.
-- This follow-up is separate because it responds to the post-DDL Supabase
-- performance advisor without changing the already-applied ledger migration.

CREATE INDEX paper_doll_candidate_jobs_component_org_idx
  ON public.paper_doll_candidate_jobs (component_id, organization_id);
CREATE INDEX paper_doll_candidate_jobs_parent_org_idx
  ON public.paper_doll_candidate_jobs (parent_component_version_id, organization_id);
CREATE INDEX paper_doll_candidate_jobs_generation_attempt_idx
  ON public.paper_doll_candidate_jobs (generation_attempt_id)
  WHERE generation_attempt_id IS NOT NULL;
CREATE INDEX paper_doll_candidate_jobs_initiated_by_idx
  ON public.paper_doll_candidate_jobs (initiated_by);
CREATE INDEX paper_doll_candidate_jobs_candidate_version_org_idx
  ON public.paper_doll_candidate_jobs (candidate_component_version_id, organization_id);
CREATE INDEX paper_doll_component_approvals_job_org_idx
  ON public.paper_doll_component_approvals (candidate_job_id, organization_id);
CREATE INDEX paper_doll_component_approvals_candidate_org_idx
  ON public.paper_doll_component_approvals (candidate_component_version_id, organization_id);
CREATE INDEX paper_doll_component_approvals_result_org_idx
  ON public.paper_doll_component_approvals (resulting_approved_component_version_id, organization_id);
CREATE INDEX paper_doll_component_approvals_approver_idx
  ON public.paper_doll_component_approvals (approver_user_id);
