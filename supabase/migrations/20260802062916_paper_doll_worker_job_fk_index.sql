CREATE INDEX paper_doll_worker_heartbeats_job_org_idx
  ON public.paper_doll_worker_heartbeats (current_job_id, organization_id)
  WHERE current_job_id IS NOT NULL;
