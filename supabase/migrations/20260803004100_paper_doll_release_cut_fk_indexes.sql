-- Cover the composite foreign keys introduced by the controlled release-cut
-- ledger. These indexes are read-path only and do not change release state.

CREATE INDEX paper_doll_release_cuts_source_org_idx
  ON public.paper_doll_release_cuts (source_release_id, organization_id);
CREATE INDEX paper_doll_release_cuts_result_org_idx
  ON public.paper_doll_release_cuts (resulting_release_id, organization_id);

CREATE INDEX paper_doll_family_release_heads_release_org_idx
  ON public.paper_doll_family_release_heads (release_id, organization_id);
CREATE INDEX paper_doll_family_release_heads_cut_org_idx
  ON public.paper_doll_family_release_heads (release_cut_id, organization_id)
  WHERE release_cut_id IS NOT NULL;

CREATE INDEX paper_doll_release_readiness_org_idx
  ON public.paper_doll_release_sku_readiness (organization_id);
CREATE INDEX paper_doll_release_readiness_release_org_idx
  ON public.paper_doll_release_sku_readiness (release_id, organization_id);

CREATE INDEX paper_doll_publication_approvals_org_idx
  ON public.paper_doll_publication_approvals (organization_id);
CREATE INDEX paper_doll_publication_approvals_cut_org_idx
  ON public.paper_doll_publication_approvals (release_cut_id, organization_id);
CREATE INDEX paper_doll_publication_approvals_run_org_idx
  ON public.paper_doll_publication_approvals (publish_run_id, organization_id);

CREATE INDEX paper_doll_component_source_intakes_version_org_idx
  ON public.paper_doll_component_source_intakes (component_version_id, organization_id);

CREATE INDEX paper_doll_publish_runs_cut_org_idx
  ON public.paper_doll_publish_runs (release_cut_id, organization_id)
  WHERE release_cut_id IS NOT NULL;
CREATE INDEX paper_doll_publish_runs_release_org_idx
  ON public.paper_doll_publish_runs (release_id, organization_id);
