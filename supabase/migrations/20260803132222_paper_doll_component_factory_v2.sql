-- Paper-Doll Component Factory v2
--
-- This migration adds candidate generation, named approvals, shared placement,
-- immutable release cuts, audited release heads, and explicit Sanity sync
-- history. Browser sessions are organization-scoped and read-only. All writes
-- are reserved for server-side service-role actions.

CREATE OR REPLACE FUNCTION public.paper_doll_valid_pixel_bounds(bounds JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
BEGIN
  IF NOT (bounds ?& ARRAY['left', 'top', 'width', 'height']) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(bounds->'left') <> 'number'
    OR jsonb_typeof(bounds->'top') <> 'number'
    OR jsonb_typeof(bounds->'width') <> 'number'
    OR jsonb_typeof(bounds->'height') <> 'number'
  THEN
    RETURN FALSE;
  END IF;
  RETURN (bounds->>'left')::NUMERIC >= 0
    AND (bounds->>'top')::NUMERIC >= 0
    AND (bounds->>'width')::NUMERIC > 0
    AND (bounds->>'height')::NUMERIC > 0;
END;
$$;

CREATE TABLE public.paper_doll_candidate_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL CHECK (length(btrim(request_key)) > 0),
  family_key TEXT NOT NULL CHECK (length(btrim(family_key)) > 0),
  component_id UUID NOT NULL,
  variant_key TEXT NOT NULL CHECK (length(btrim(variant_key)) > 0),
  original_filename TEXT NOT NULL CHECK (
    length(btrim(original_filename)) > 0
    AND position('/' IN original_filename) = 0
    AND position(chr(92) IN original_filename) = 0
  ),
  provider TEXT NOT NULL CHECK (
    provider IN ('openai','google','higgsfield','manual','blender','deterministic')
  ),
  model TEXT NOT NULL CHECK (length(btrim(model)) > 0),
  prompt_sha256 TEXT CHECK (prompt_sha256 IS NULL OR prompt_sha256 ~ '^[a-f0-9]{64}$'),
  request_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  request_status TEXT NOT NULL DEFAULT 'queued' CHECK (
    request_status IN ('queued','claimed','succeeded','failed')
  ),
  requested_by UUID NOT NULL,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_candidate_requests_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_candidate_requests_request_key_unique
    UNIQUE (organization_id, request_key),
  CONSTRAINT paper_doll_candidate_requests_component_org_fk
    FOREIGN KEY (component_id, organization_id)
    REFERENCES public.paper_doll_components(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_candidate_requests_state_fields CHECK (
    (request_status = 'queued' AND claimed_by IS NULL AND claimed_at IS NULL AND completed_at IS NULL)
    OR (request_status = 'claimed' AND claimed_by IS NOT NULL AND claimed_at IS NOT NULL AND completed_at IS NULL)
    OR (request_status IN ('succeeded','failed') AND claimed_by IS NOT NULL AND claimed_at IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE TABLE public.paper_doll_candidate_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  attempt_status TEXT NOT NULL CHECK (attempt_status IN ('running','succeeded','failed')),
  worker_id TEXT NOT NULL CHECK (length(btrim(worker_id)) > 0),
  provider_request_id TEXT,
  result JSONB NOT NULL DEFAULT '{}'::JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_candidate_attempts_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_candidate_attempts_number_unique UNIQUE (request_id, attempt_number),
  CONSTRAINT paper_doll_candidate_attempts_request_org_fk
    FOREIGN KEY (request_id, organization_id)
    REFERENCES public.paper_doll_candidate_requests(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_candidate_attempts_state_fields CHECK (
    (attempt_status = 'running' AND completed_at IS NULL)
    OR (attempt_status IN ('succeeded','failed') AND completed_at IS NOT NULL)
  )
);

CREATE TABLE public.paper_doll_component_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  attempt_id UUID NOT NULL,
  component_id UUID NOT NULL,
  variant_key TEXT NOT NULL CHECK (length(btrim(variant_key)) > 0),
  original_filename TEXT NOT NULL CHECK (
    length(btrim(original_filename)) > 0
    AND position('/' IN original_filename) = 0
    AND position(chr(92) IN original_filename) = 0
  ),
  source_path TEXT NOT NULL CHECK (length(btrim(source_path)) > 0),
  source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  normalized_path TEXT NOT NULL CHECK (length(btrim(normalized_path)) > 0),
  normalized_sha256 TEXT NOT NULL CHECK (normalized_sha256 ~ '^[a-f0-9]{64}$'),
  layer_path TEXT NOT NULL CHECK (length(btrim(layer_path)) > 0),
  layer_sha256 TEXT NOT NULL CHECK (layer_sha256 ~ '^[a-f0-9]{64}$'),
  authority_mask_path TEXT NOT NULL CHECK (length(btrim(authority_mask_path)) > 0),
  authority_mask_sha256 TEXT NOT NULL CHECK (authority_mask_sha256 ~ '^[a-f0-9]{64}$'),
  source_bounds JSONB NOT NULL CHECK (public.paper_doll_valid_pixel_bounds(source_bounds)),
  edit_bounds JSONB NOT NULL CHECK (public.paper_doll_valid_pixel_bounds(edit_bounds)),
  authority_bounds JSONB NOT NULL CHECK (public.paper_doll_valid_pixel_bounds(authority_bounds)),
  placement_bounds JSONB NOT NULL CHECK (public.paper_doll_valid_pixel_bounds(placement_bounds)),
  provider TEXT NOT NULL CHECK (
    provider IN ('openai','google','higgsfield','manual','blender','deterministic')
  ),
  model TEXT NOT NULL CHECK (length(btrim(model)) > 0),
  prompt_sha256 TEXT CHECK (prompt_sha256 IS NULL OR prompt_sha256 ~ '^[a-f0-9]{64}$'),
  estimated_cost_usd NUMERIC(12,6) CHECK (estimated_cost_usd IS NULL OR estimated_cost_usd >= 0),
  qa JSONB NOT NULL CHECK (
    qa ?& ARRAY['geometryLocked','minIoU','mismatchedPixels']
  ),
  lifecycle_state TEXT NOT NULL DEFAULT 'candidate' CHECK (
    lifecycle_state IN (
      'candidate','pixels-approved','family-fit-approved','placement-locked',
      'released','sanity-draft','published','rejected'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_component_candidates_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_component_candidates_attempt_unique UNIQUE (attempt_id),
  CONSTRAINT paper_doll_component_candidates_request_org_fk
    FOREIGN KEY (request_id, organization_id)
    REFERENCES public.paper_doll_candidate_requests(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_component_candidates_attempt_org_fk
    FOREIGN KEY (attempt_id, organization_id)
    REFERENCES public.paper_doll_candidate_attempts(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_component_candidates_component_org_fk
    FOREIGN KEY (component_id, organization_id)
    REFERENCES public.paper_doll_components(id, organization_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.paper_doll_approval_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (
    action IN (
      'pixels-approved','family-fit-approved','placement-locked',
      'released','sanity-draft','published','rejected'
    )
  ),
  approver_user_id UUID NOT NULL,
  approver_display_name TEXT NOT NULL CHECK (length(btrim(approver_display_name)) > 0),
  approval_note TEXT NOT NULL CHECK (length(btrim(approval_note)) > 0),
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_approval_events_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_approval_events_candidate_action_unique UNIQUE (candidate_id, action),
  CONSTRAINT paper_doll_approval_events_candidate_org_fk
    FOREIGN KEY (candidate_id, organization_id)
    REFERENCES public.paper_doll_component_candidates(id, organization_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.paper_doll_factory_placement_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  family_key TEXT NOT NULL CHECK (length(btrim(family_key)) > 0),
  geometry_family_id TEXT NOT NULL CHECK (length(btrim(geometry_family_id)) > 0),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  width_px INTEGER NOT NULL CHECK (width_px > 0),
  center_x_px NUMERIC NOT NULL,
  seat_y_px NUMERIC NOT NULL,
  placement_bounds JSONB NOT NULL CHECK (public.paper_doll_valid_pixel_bounds(placement_bounds)),
  authority_mask_sha256 TEXT NOT NULL CHECK (authority_mask_sha256 ~ '^[a-f0-9]{64}$'),
  placement_status TEXT NOT NULL DEFAULT 'candidate' CHECK (
    placement_status IN ('candidate','locked','rejected')
  ),
  locked_by_user_id UUID,
  locked_by_display_name TEXT,
  lock_note TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_factory_placement_versions_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_factory_placement_versions_family_version_unique
    UNIQUE (organization_id, family_key, geometry_family_id, version_number),
  CONSTRAINT paper_doll_factory_placement_versions_lock_fields CHECK (
    (placement_status = 'locked'
      AND locked_by_user_id IS NOT NULL
      AND length(btrim(locked_by_display_name)) > 0
      AND length(btrim(lock_note)) > 0
      AND locked_at IS NOT NULL)
    OR (placement_status <> 'locked'
      AND locked_by_user_id IS NULL
      AND locked_by_display_name IS NULL
      AND lock_note IS NULL
      AND locked_at IS NULL)
  )
);

CREATE TABLE public.paper_doll_factory_placement_plates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  placement_version_id UUID NOT NULL,
  body_variant_key TEXT NOT NULL CHECK (length(btrim(body_variant_key)) > 0),
  body_component_version_id UUID NOT NULL,
  adjustment JSONB NOT NULL CHECK (
    adjustment ?& ARRAY['deltaX','deltaY','scale']
    AND (adjustment->>'scale')::NUMERIC > 0
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_factory_placement_plates_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_factory_placement_plates_body_unique
    UNIQUE (placement_version_id, body_variant_key),
  CONSTRAINT paper_doll_factory_placement_plates_placement_org_fk
    FOREIGN KEY (placement_version_id, organization_id)
    REFERENCES public.paper_doll_factory_placement_versions(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_factory_placement_plates_body_version_org_fk
    FOREIGN KEY (body_component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.paper_doll_release_cuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  family_key TEXT NOT NULL CHECK (length(btrim(family_key)) > 0),
  release_version TEXT NOT NULL CHECK (length(btrim(release_version)) > 0),
  validation_status TEXT NOT NULL CHECK (validation_status IN ('draft','validated')),
  manifest JSONB NOT NULL,
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  approved_by_user_id UUID NOT NULL,
  approved_by_display_name TEXT NOT NULL CHECK (length(btrim(approved_by_display_name)) > 0),
  approval_note TEXT NOT NULL CHECK (length(btrim(approval_note)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_release_cuts_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_release_cuts_version_unique
    UNIQUE (organization_id, family_key, release_version),
  CONSTRAINT paper_doll_release_cuts_manifest_unique
    UNIQUE (organization_id, family_key, manifest_sha256)
);

CREATE TABLE public.paper_doll_release_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  family_key TEXT NOT NULL CHECK (length(btrim(family_key)) > 0),
  current_release_cut_id UUID NOT NULL,
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_release_heads_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_release_heads_family_unique UNIQUE (organization_id, family_key),
  CONSTRAINT paper_doll_release_heads_cut_org_fk
    FOREIGN KEY (current_release_cut_id, organization_id)
    REFERENCES public.paper_doll_release_cuts(id, organization_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.paper_doll_release_head_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  release_head_id UUID NOT NULL,
  previous_release_cut_id UUID NOT NULL,
  next_release_cut_id UUID NOT NULL,
  expected_revision BIGINT NOT NULL CHECK (expected_revision >= 0),
  resulting_revision BIGINT NOT NULL CHECK (resulting_revision = expected_revision + 1),
  actor_user_id UUID NOT NULL,
  actor_display_name TEXT NOT NULL CHECK (length(btrim(actor_display_name)) > 0),
  action_note TEXT NOT NULL CHECK (length(btrim(action_note)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_release_head_events_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_release_head_events_revision_unique
    UNIQUE (release_head_id, resulting_revision),
  CONSTRAINT paper_doll_release_head_events_head_org_fk
    FOREIGN KEY (release_head_id, organization_id)
    REFERENCES public.paper_doll_release_heads(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_release_head_events_previous_cut_org_fk
    FOREIGN KEY (previous_release_cut_id, organization_id)
    REFERENCES public.paper_doll_release_cuts(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_release_head_events_next_cut_org_fk
    FOREIGN KEY (next_release_cut_id, organization_id)
    REFERENCES public.paper_doll_release_cuts(id, organization_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.paper_doll_release_cut_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  release_cut_id UUID NOT NULL,
  component_candidate_id UUID,
  component_version_id UUID NOT NULL,
  placement_version_id UUID,
  slot TEXT NOT NULL CHECK (slot IN ('body','cap','roller','sprayer','overcap','pump')),
  variant_key TEXT NOT NULL CHECK (length(btrim(variant_key)) > 0),
  source_bounds JSONB CHECK (source_bounds IS NULL OR public.paper_doll_valid_pixel_bounds(source_bounds)),
  edit_bounds JSONB CHECK (edit_bounds IS NULL OR public.paper_doll_valid_pixel_bounds(edit_bounds)),
  authority_bounds JSONB CHECK (authority_bounds IS NULL OR public.paper_doll_valid_pixel_bounds(authority_bounds)),
  placement_bounds JSONB CHECK (placement_bounds IS NULL OR public.paper_doll_valid_pixel_bounds(placement_bounds)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paper_doll_release_cut_assets_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_release_cut_assets_membership_unique
    UNIQUE (release_cut_id, slot, variant_key),
  CONSTRAINT paper_doll_release_cut_assets_component_boxes CHECK (
    (slot = 'body' AND component_candidate_id IS NULL
      AND source_bounds IS NULL AND edit_bounds IS NULL
      AND authority_bounds IS NULL AND placement_bounds IS NULL)
    OR (slot <> 'body' AND component_candidate_id IS NOT NULL
      AND source_bounds IS NOT NULL AND edit_bounds IS NOT NULL
      AND authority_bounds IS NOT NULL AND placement_bounds IS NOT NULL)
  ),
  CONSTRAINT paper_doll_release_cut_assets_cut_org_fk
    FOREIGN KEY (release_cut_id, organization_id)
    REFERENCES public.paper_doll_release_cuts(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_release_cut_assets_candidate_org_fk
    FOREIGN KEY (component_candidate_id, organization_id)
    REFERENCES public.paper_doll_component_candidates(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_release_cut_assets_component_version_org_fk
    FOREIGN KEY (component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_release_cut_assets_placement_org_fk
    FOREIGN KEY (placement_version_id, organization_id)
    REFERENCES public.paper_doll_factory_placement_versions(id, organization_id)
    ON DELETE RESTRICT
);

CREATE TABLE public.paper_doll_sanity_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  release_cut_id UUID NOT NULL,
  sanity_document_id TEXT NOT NULL CHECK (length(btrim(sanity_document_id)) > 0),
  sync_action TEXT NOT NULL CHECK (sync_action IN ('draft','public')),
  sync_status TEXT NOT NULL CHECK (sync_status IN ('queued','success','failed')),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  result JSONB NOT NULL DEFAULT '{}'::JSONB,
  error_message TEXT,
  approved_by_user_id UUID NOT NULL,
  approved_by_display_name TEXT NOT NULL CHECK (length(btrim(approved_by_display_name)) > 0),
  approval_note TEXT NOT NULL CHECK (length(btrim(approval_note)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT paper_doll_sanity_syncs_id_org_unique UNIQUE (id, organization_id),
  CONSTRAINT paper_doll_sanity_syncs_request_unique
    UNIQUE (organization_id, release_cut_id, sync_action, request_sha256),
  CONSTRAINT paper_doll_sanity_syncs_cut_org_fk
    FOREIGN KEY (release_cut_id, organization_id)
    REFERENCES public.paper_doll_release_cuts(id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT paper_doll_sanity_syncs_document_scope CHECK (
    (sync_action = 'draft' AND sanity_document_id LIKE 'drafts.%')
    OR (sync_action = 'public' AND sanity_document_id NOT LIKE 'drafts.%')
  ),
  CONSTRAINT paper_doll_sanity_syncs_completion CHECK (
    (sync_status = 'queued' AND completed_at IS NULL)
    OR (sync_status IN ('success','failed') AND completed_at IS NOT NULL)
  )
);

CREATE INDEX paper_doll_candidate_requests_queue_idx
  ON public.paper_doll_candidate_requests (organization_id, created_at, id)
  WHERE request_status = 'queued';
CREATE UNIQUE INDEX paper_doll_candidate_requests_active_worker_idx
  ON public.paper_doll_candidate_requests (organization_id, claimed_by)
  WHERE request_status = 'claimed';
CREATE INDEX paper_doll_candidate_requests_component_idx
  ON public.paper_doll_candidate_requests (component_id);
CREATE INDEX paper_doll_candidate_attempts_request_idx
  ON public.paper_doll_candidate_attempts (request_id, attempt_number DESC);
CREATE INDEX paper_doll_component_candidates_request_idx
  ON public.paper_doll_component_candidates (request_id);
CREATE INDEX paper_doll_component_candidates_component_state_idx
  ON public.paper_doll_component_candidates (organization_id, component_id, lifecycle_state);
CREATE INDEX paper_doll_approval_events_candidate_idx
  ON public.paper_doll_approval_events (candidate_id, created_at);
CREATE INDEX paper_doll_factory_placement_versions_family_idx
  ON public.paper_doll_factory_placement_versions (organization_id, family_key, geometry_family_id, version_number DESC);
CREATE INDEX paper_doll_factory_placement_plates_body_version_idx
  ON public.paper_doll_factory_placement_plates (body_component_version_id);
CREATE INDEX paper_doll_release_heads_cut_idx
  ON public.paper_doll_release_heads (current_release_cut_id);
CREATE INDEX paper_doll_release_head_events_previous_cut_idx
  ON public.paper_doll_release_head_events (previous_release_cut_id);
CREATE INDEX paper_doll_release_head_events_next_cut_idx
  ON public.paper_doll_release_head_events (next_release_cut_id);
CREATE INDEX paper_doll_release_cuts_family_created_idx
  ON public.paper_doll_release_cuts (organization_id, family_key, created_at DESC);
CREATE INDEX paper_doll_release_cut_assets_candidate_idx
  ON public.paper_doll_release_cut_assets (component_candidate_id)
  WHERE component_candidate_id IS NOT NULL;
CREATE INDEX paper_doll_release_cut_assets_component_version_idx
  ON public.paper_doll_release_cut_assets (component_version_id);
CREATE INDEX paper_doll_release_cut_assets_placement_idx
  ON public.paper_doll_release_cut_assets (placement_version_id)
  WHERE placement_version_id IS NOT NULL;
CREATE INDEX paper_doll_sanity_syncs_cut_created_idx
  ON public.paper_doll_sanity_syncs (release_cut_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.paper_doll_guard_candidate_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Paper-doll candidate requests are append-only';
  END IF;
  IF ROW(
    OLD.organization_id, OLD.request_key, OLD.family_key, OLD.component_id,
    OLD.variant_key, OLD.original_filename, OLD.provider, OLD.model,
    OLD.prompt_sha256, OLD.request_payload, OLD.requested_by, OLD.created_at
  ) IS DISTINCT FROM ROW(
    NEW.organization_id, NEW.request_key, NEW.family_key, NEW.component_id,
    NEW.variant_key, NEW.original_filename, NEW.provider, NEW.model,
    NEW.prompt_sha256, NEW.request_payload, NEW.requested_by, NEW.created_at
  ) THEN
    RAISE EXCEPTION 'Paper-doll candidate request identity is immutable';
  END IF;
  IF NOT (
    (OLD.request_status = 'queued' AND NEW.request_status = 'claimed')
    OR (OLD.request_status = 'claimed' AND NEW.request_status IN ('succeeded','failed'))
    OR (OLD.request_status = 'failed' AND NEW.request_status = 'queued')
  ) THEN
    RAISE EXCEPTION 'Invalid paper-doll candidate request transition: % -> %',
      OLD.request_status, NEW.request_status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_guard_candidate_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.attempt_status IN ('succeeded','failed') THEN
    RAISE EXCEPTION 'Completed paper-doll candidate attempts are immutable';
  END IF;
  IF OLD.attempt_status <> 'running' OR NEW.attempt_status NOT IN ('succeeded','failed') THEN
    RAISE EXCEPTION 'Invalid paper-doll candidate attempt transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_guard_component_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  evidence_changed BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Paper-doll component candidates are append-only';
  END IF;
  evidence_changed := (to_jsonb(OLD) - ARRAY['lifecycle_state','updated_at'])
    IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['lifecycle_state','updated_at']);
  IF OLD.lifecycle_state <> 'candidate' AND evidence_changed THEN
    RAISE EXCEPTION 'Pixel-approved paper-doll candidate evidence is immutable';
  END IF;
  IF OLD.lifecycle_state = 'candidate' AND NEW.lifecycle_state = 'pixels-approved' THEN
    IF evidence_changed THEN
      RAISE EXCEPTION 'Candidate evidence must be finalized before pixel approval';
    END IF;
    IF COALESCE((NEW.qa->>'geometryLocked')::BOOLEAN, FALSE) IS NOT TRUE
      OR COALESCE((NEW.qa->>'minIoU')::NUMERIC, 0) <> 1
      OR COALESCE((NEW.qa->>'mismatchedPixels')::INTEGER, -1) <> 0
    THEN
      RAISE EXCEPTION 'Pixel approval requires exact geometry QA';
    END IF;
  ELSIF NOT (
    OLD.lifecycle_state = NEW.lifecycle_state
    OR (OLD.lifecycle_state = 'pixels-approved' AND NEW.lifecycle_state = 'family-fit-approved')
    OR (OLD.lifecycle_state = 'family-fit-approved' AND NEW.lifecycle_state = 'placement-locked')
    OR (OLD.lifecycle_state = 'placement-locked' AND NEW.lifecycle_state = 'released')
    OR (OLD.lifecycle_state = 'released' AND NEW.lifecycle_state = 'sanity-draft')
    OR (OLD.lifecycle_state = 'sanity-draft' AND NEW.lifecycle_state = 'published')
    OR (OLD.lifecycle_state IN ('candidate','pixels-approved','family-fit-approved')
      AND NEW.lifecycle_state = 'rejected')
  ) THEN
    RAISE EXCEPTION 'Invalid paper-doll candidate lifecycle transition: % -> %',
      OLD.lifecycle_state, NEW.lifecycle_state;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_reject_approval_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Paper-doll approval events are append-only';
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_guard_placement_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.placement_status = 'locked' THEN
    RAISE EXCEPTION 'Locked paper-doll placement versions are immutable';
  END IF;
  IF OLD.placement_status = 'candidate'
    AND NEW.placement_status NOT IN ('locked','rejected')
  THEN
    RAISE EXCEPTION 'Invalid paper-doll placement transition';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_guard_placement_plate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_status TEXT;
BEGIN
  SELECT placement_status INTO parent_status
  FROM public.paper_doll_factory_placement_versions
  WHERE id = OLD.placement_version_id AND organization_id = OLD.organization_id;
  IF parent_status = 'locked' THEN
    RAISE EXCEPTION 'Plates belonging to a locked paper-doll placement are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_reject_release_cut_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Paper-doll release cuts are append-only';
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_validate_release_head()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  cut_valid BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE'
    AND COALESCE(current_setting('paper_doll.release_head_advance', TRUE), '') <> 'on'
  THEN
    RAISE EXCEPTION 'Release heads may only advance through the audited compare-and-swap function';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.paper_doll_release_cuts c
    WHERE c.id = NEW.current_release_cut_id
      AND c.organization_id = NEW.organization_id
      AND c.family_key = NEW.family_key
      AND c.validation_status = 'validated'
  ) INTO cut_valid;
  IF NOT cut_valid THEN
    RAISE EXCEPTION 'Release head must reference a validated release cut';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_reject_release_head_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Paper-doll release-head events are append-only';
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_reject_release_cut_asset_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Paper-doll release-cut assets are append-only';
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_guard_sanity_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.sync_status = 'success' THEN
    RAISE EXCEPTION 'Successful paper-doll Sanity syncs are immutable';
  END IF;
  IF OLD.sync_status <> 'queued' OR NEW.sync_status NOT IN ('success','failed') THEN
    RAISE EXCEPTION 'Invalid paper-doll Sanity sync transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER paper_doll_candidate_requests_guard
  BEFORE UPDATE OR DELETE ON public.paper_doll_candidate_requests
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_guard_candidate_request();
CREATE TRIGGER paper_doll_candidate_attempts_guard
  BEFORE UPDATE OR DELETE ON public.paper_doll_candidate_attempts
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_guard_candidate_attempt();
CREATE TRIGGER paper_doll_component_candidates_guard
  BEFORE UPDATE OR DELETE ON public.paper_doll_component_candidates
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_guard_component_candidate();
CREATE TRIGGER paper_doll_approval_events_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_approval_events
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_approval_event_mutation();
CREATE TRIGGER paper_doll_factory_placement_versions_guard
  BEFORE UPDATE OR DELETE ON public.paper_doll_factory_placement_versions
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_guard_placement_version();
CREATE TRIGGER paper_doll_factory_placement_plates_guard
  BEFORE UPDATE OR DELETE ON public.paper_doll_factory_placement_plates
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_guard_placement_plate();
CREATE TRIGGER paper_doll_release_cuts_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_release_cuts
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_release_cut_mutation();
CREATE TRIGGER paper_doll_release_heads_validate
  BEFORE INSERT OR UPDATE ON public.paper_doll_release_heads
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_validate_release_head();
CREATE TRIGGER paper_doll_release_head_events_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_release_head_events
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_release_head_event_mutation();
CREATE TRIGGER paper_doll_release_cut_assets_append_only
  BEFORE UPDATE OR DELETE ON public.paper_doll_release_cut_assets
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_reject_release_cut_asset_mutation();
CREATE TRIGGER paper_doll_sanity_syncs_guard
  BEFORE UPDATE OR DELETE ON public.paper_doll_sanity_syncs
  FOR EACH ROW EXECUTE FUNCTION public.paper_doll_guard_sanity_sync();

CREATE OR REPLACE FUNCTION public.paper_doll_claim_candidate_request(
  p_organization_id UUID,
  p_worker_id TEXT
)
RETURNS SETOF public.paper_doll_candidate_requests
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF length(btrim(p_worker_id)) = 0 THEN
    RAISE EXCEPTION 'Worker ID is required';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_organization_id::TEXT || ':' || p_worker_id, 0)
  );
  RETURN QUERY
    SELECT r.*
    FROM public.paper_doll_candidate_requests r
    WHERE r.organization_id = p_organization_id
      AND r.request_status = 'claimed'
      AND r.claimed_by = p_worker_id
    ORDER BY r.claimed_at, r.id
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
    WITH next_request AS (
      SELECT r.id
      FROM public.paper_doll_candidate_requests r
      WHERE r.organization_id = p_organization_id
        AND r.request_status = 'queued'
      ORDER BY r.created_at, r.id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.paper_doll_candidate_requests r
    SET request_status = 'claimed', claimed_by = p_worker_id, claimed_at = now()
    FROM next_request n
    WHERE r.id = n.id
    RETURNING r.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.paper_doll_advance_release_head(
  p_organization_id UUID,
  p_family_key TEXT,
  p_next_release_cut_id UUID,
  p_expected_revision BIGINT,
  p_actor_user_id UUID,
  p_actor_display_name TEXT,
  p_action_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  head_row public.paper_doll_release_heads%ROWTYPE;
BEGIN
  SELECT * INTO head_row
  FROM public.paper_doll_release_heads h
  WHERE h.organization_id = p_organization_id AND h.family_key = p_family_key
  FOR UPDATE;

  IF NOT FOUND OR head_row.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'Release head compare-and-swap conflict';
  END IF;
  IF head_row.current_release_cut_id = p_next_release_cut_id THEN
    RAISE EXCEPTION 'Release head already references the requested cut';
  END IF;
  IF length(btrim(p_actor_display_name)) = 0 OR length(btrim(p_action_note)) = 0 THEN
    RAISE EXCEPTION 'Named release-head approval and note are required';
  END IF;

  PERFORM set_config('paper_doll.release_head_advance', 'on', TRUE);
  UPDATE public.paper_doll_release_heads
  SET current_release_cut_id = p_next_release_cut_id,
      revision = revision + 1
  WHERE id = head_row.id;

  INSERT INTO public.paper_doll_release_head_events (
    organization_id, release_head_id, previous_release_cut_id,
    next_release_cut_id, expected_revision, resulting_revision,
    actor_user_id, actor_display_name, action_note
  ) VALUES (
    p_organization_id, head_row.id, head_row.current_release_cut_id,
    p_next_release_cut_id, p_expected_revision, p_expected_revision + 1,
    p_actor_user_id, p_actor_display_name, p_action_note
  );
  PERFORM set_config('paper_doll.release_head_advance', 'off', TRUE);
  RETURN head_row.id;
END;
$$;

ALTER TABLE public.paper_doll_candidate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_candidate_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_component_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_approval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_factory_placement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_factory_placement_plates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_release_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_release_head_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_release_cuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_release_cut_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_doll_sanity_syncs ENABLE ROW LEVEL SECURITY;

CREATE POLICY paper_doll_candidate_requests_select_org_members
  ON public.paper_doll_candidate_requests FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_candidate_attempts_select_org_members
  ON public.paper_doll_candidate_attempts FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_component_candidates_select_org_members
  ON public.paper_doll_component_candidates FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_approval_events_select_org_members
  ON public.paper_doll_approval_events FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_factory_placement_versions_select_org_members
  ON public.paper_doll_factory_placement_versions FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_factory_placement_plates_select_org_members
  ON public.paper_doll_factory_placement_plates FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_release_heads_select_org_members
  ON public.paper_doll_release_heads FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_release_head_events_select_org_members
  ON public.paper_doll_release_head_events FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_release_cuts_select_org_members
  ON public.paper_doll_release_cuts FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_release_cut_assets_select_org_members
  ON public.paper_doll_release_cut_assets FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));
CREATE POLICY paper_doll_sanity_syncs_select_org_members
  ON public.paper_doll_sanity_syncs FOR SELECT TO authenticated
  USING (public.is_organization_member((SELECT auth.uid()), organization_id));

REVOKE ALL ON TABLE public.paper_doll_candidate_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_candidate_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_component_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_approval_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_factory_placement_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_factory_placement_plates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_release_heads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_release_head_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_release_cuts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_release_cut_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.paper_doll_sanity_syncs FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.paper_doll_candidate_requests TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_candidate_attempts TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_component_candidates TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_approval_events TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_factory_placement_versions TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_factory_placement_plates TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_release_heads TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_release_head_events TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_release_cuts TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_release_cut_assets TO authenticated;
GRANT SELECT ON TABLE public.paper_doll_sanity_syncs TO authenticated;

GRANT ALL ON TABLE public.paper_doll_candidate_requests TO service_role;
GRANT ALL ON TABLE public.paper_doll_candidate_attempts TO service_role;
GRANT ALL ON TABLE public.paper_doll_component_candidates TO service_role;
GRANT ALL ON TABLE public.paper_doll_approval_events TO service_role;
GRANT ALL ON TABLE public.paper_doll_factory_placement_versions TO service_role;
GRANT ALL ON TABLE public.paper_doll_factory_placement_plates TO service_role;
GRANT ALL ON TABLE public.paper_doll_release_heads TO service_role;
GRANT ALL ON TABLE public.paper_doll_release_head_events TO service_role;
GRANT ALL ON TABLE public.paper_doll_release_cuts TO service_role;
GRANT ALL ON TABLE public.paper_doll_release_cut_assets TO service_role;
GRANT ALL ON TABLE public.paper_doll_sanity_syncs TO service_role;

REVOKE ALL ON FUNCTION public.paper_doll_valid_pixel_bounds(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paper_doll_valid_pixel_bounds(JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.paper_doll_claim_candidate_request(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paper_doll_claim_candidate_request(UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.paper_doll_advance_release_head(UUID, TEXT, UUID, BIGINT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.paper_doll_advance_release_head(UUID, TEXT, UUID, BIGINT, UUID, TEXT, TEXT)
  TO service_role;

COMMENT ON TABLE public.paper_doll_candidate_requests IS
  'Idempotent generation or upload requests; explicit original filename and provider input are preserved.';
COMMENT ON TABLE public.paper_doll_candidate_attempts IS
  'Immutable terminal worker-attempt history; retries append new rows.';
COMMENT ON TABLE public.paper_doll_component_candidates IS
  'Candidate-only normalized material, exact authority-mask QA, four pixel boxes, and lifecycle state.';
COMMENT ON TABLE public.paper_doll_approval_events IS
  'Append-only named approvals and rejections for component candidates.';
COMMENT ON TABLE public.paper_doll_factory_placement_versions IS
  'Versioned uniform-scale shared placement; locked rows are immutable.';
COMMENT ON TABLE public.paper_doll_factory_placement_plates IS
  'Explicit compatible body plates and versioned per-body fit evidence for one shared placement.';
COMMENT ON TABLE public.paper_doll_release_cuts IS
  'Immutable family release manifests, idempotent by manifest SHA.';
COMMENT ON TABLE public.paper_doll_release_heads IS
  'One compare-and-swap current release pointer per organization and family.';
COMMENT ON TABLE public.paper_doll_release_head_events IS
  'Append-only audit log for every current-release pointer advancement.';
COMMENT ON TABLE public.paper_doll_release_cut_assets IS
  'Append-only component and body membership, including exact candidate and four-box evidence.';
COMMENT ON TABLE public.paper_doll_sanity_syncs IS
  'Separate named draft-sync and public-publication attempts for immutable release cuts.';
