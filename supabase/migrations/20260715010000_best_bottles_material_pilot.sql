-- Renderer-agnostic, role-clean Best Bottles material benchmark ledger.
-- Benchmark attempts are deliberately isolated from production reconciliation
-- and are never publish eligible. Promotion continues through the existing
-- reconciliation, approval, and single-use publish authorization controls.

CREATE TABLE IF NOT EXISTS public.best_bottles_material_pilot_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  family TEXT NOT NULL CHECK (family IN ('Cylinder', 'Tall Cylinder')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'review-pending', 'completed', 'failed', 'cancelled')),
  cohort_version TEXT NOT NULL,
  cohort_manifest JSONB NOT NULL,
  renderer_ids TEXT[] NOT NULL,
  prompt_version TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  canonical_truth_hash TEXT NOT NULL,
  code_version TEXT,
  price_card_version TEXT,
  price_card JSONB NOT NULL DEFAULT '{}'::JSONB,
  planned_attempts INTEGER NOT NULL CHECK (planned_attempts > 0),
  launched_attempts INTEGER NOT NULL DEFAULT 0 CHECK (launched_attempts >= 0),
  completed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (completed_attempts >= 0),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.best_bottles_material_pilot_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.best_bottles_material_pilot_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_key TEXT NOT NULL,
  website_sku TEXT NOT NULL,
  grace_sku TEXT NOT NULL,
  family TEXT NOT NULL CHECK (family IN ('Cylinder', 'Tall Cylinder')),
  asset_role TEXT NOT NULL CHECK (asset_role IN ('cap-on', 'sidecar')),
  renderer_id TEXT NOT NULL CHECK (
    renderer_id IN ('openai-gpt-image-2', 'google-nano-banana-2', 'higgsfield-future')
  ),
  gateway_provider TEXT NOT NULL,
  underlying_provider TEXT NOT NULL,
  model_identifier TEXT NOT NULL,
  endpoint_identifier TEXT NOT NULL,
  attempt_ordinal INTEGER NOT NULL CHECK (attempt_ordinal > 0),
  retry_of_attempt_id UUID REFERENCES public.best_bottles_material_pilot_attempts(id),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),

  reference_manifest JSONB NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  canonical_truth JSONB NOT NULL,
  canonical_truth_hash TEXT NOT NULL,
  request_parameters JSONB NOT NULL DEFAULT '{}'::JSONB,
  provider_request_id TEXT,
  provider_response_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  requested_width_px INTEGER NOT NULL CHECK (requested_width_px > 0),
  requested_height_px INTEGER NOT NULL CHECK (requested_height_px > 0),
  returned_width_px INTEGER CHECK (returned_width_px IS NULL OR returned_width_px > 0),
  returned_height_px INTEGER CHECK (returned_height_px IS NULL OR returned_height_px > 0),
  returned_mime_type TEXT,
  raw_image_url TEXT,
  raw_image_hash TEXT,
  final_image_url TEXT,
  final_image_hash TEXT,
  transform_recipe JSONB,
  background_mutated BOOLEAN NOT NULL DEFAULT FALSE CHECK (background_mutated = FALSE),
  publish_eligible BOOLEAN NOT NULL DEFAULT FALSE CHECK (publish_eligible = FALSE),

  native_bone_qa JSONB,
  framing_qa JSONB,
  shadow_qa JSONB,
  semantic_qa JSONB,
  automated_decision TEXT CHECK (automated_decision IS NULL OR automated_decision IN ('pass', 'reject')),
  failure_stage TEXT,
  failure_code TEXT,
  failure_reasons TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  error_message TEXT,

  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  actual_cost_usd NUMERIC(12, 6) CHECK (actual_cost_usd IS NULL OR actual_cost_usd >= 0),
  cost_currency TEXT NOT NULL DEFAULT 'USD',
  price_card_version TEXT,
  usage_evidence JSONB NOT NULL DEFAULT '{}'::JSONB,

  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_started_at TIMESTAMPTZ,
  provider_completed_at TIMESTAMPTZ,
  qa_completed_at TIMESTAMPTZ,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  code_version TEXT,
  function_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT best_bottles_material_pilot_attempt_identity_unique
    UNIQUE (run_id, job_key, renderer_id, attempt_ordinal)
);

CREATE TABLE IF NOT EXISTS public.best_bottles_material_pilot_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.best_bottles_material_pilot_runs(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.best_bottles_material_pilot_attempts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  blinded BOOLEAN NOT NULL DEFAULT TRUE CHECK (blinded = TRUE),
  decision TEXT NOT NULL CHECK (decision IN ('approved-keep', 'needs-regen', 'superseded')),
  failure_reasons TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  checklist JSONB NOT NULL DEFAULT '{}'::JSONB,
  review_note TEXT,
  review_duration_ms INTEGER CHECK (review_duration_ms IS NULL OR review_duration_ms >= 0),
  reviewed_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_best_bottles_material_pilot_runs_org_status
  ON public.best_bottles_material_pilot_runs (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_best_bottles_material_pilot_attempts_run_renderer
  ON public.best_bottles_material_pilot_attempts (run_id, renderer_id, status);
CREATE INDEX IF NOT EXISTS idx_best_bottles_material_pilot_attempts_identity
  ON public.best_bottles_material_pilot_attempts (organization_id, website_sku, grace_sku, asset_role);
CREATE INDEX IF NOT EXISTS idx_best_bottles_material_pilot_reviews_run_decision
  ON public.best_bottles_material_pilot_reviews (run_id, decision);

CREATE OR REPLACE FUNCTION public.best_bottles_material_pilot_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.best_bottles_material_pilot_mark_attempt_launched(
  target_run_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_count INTEGER;
BEGIN
  UPDATE public.best_bottles_material_pilot_runs
  SET launched_attempts = launched_attempts + 1,
      status = 'running',
      started_at = COALESCE(started_at, now())
  WHERE id = target_run_id
  RETURNING launched_attempts INTO next_count;
  IF next_count IS NULL THEN RAISE EXCEPTION 'Material pilot run not found'; END IF;
  RETURN next_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.best_bottles_material_pilot_mark_attempt_completed(
  target_run_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_count INTEGER;
BEGIN
  UPDATE public.best_bottles_material_pilot_runs
  SET completed_attempts = completed_attempts + 1
  WHERE id = target_run_id
  RETURNING completed_attempts INTO next_count;
  IF next_count IS NULL THEN RAISE EXCEPTION 'Material pilot run not found'; END IF;
  RETURN next_count;
END;
$$;

REVOKE ALL ON FUNCTION public.best_bottles_material_pilot_mark_attempt_launched(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.best_bottles_material_pilot_mark_attempt_completed(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.best_bottles_material_pilot_mark_attempt_launched(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.best_bottles_material_pilot_mark_attempt_completed(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.best_bottles_material_pilot_validate_attempt_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.best_bottles_material_pilot_runs r
    WHERE r.id = NEW.run_id AND r.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Material pilot attempt organization does not match its run';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.best_bottles_material_pilot_validate_review_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.best_bottles_material_pilot_attempts a
    WHERE a.id = NEW.attempt_id
      AND a.run_id = NEW.run_id
      AND a.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Material pilot review identity does not match its attempt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.best_bottles_material_pilot_lock_attempt_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF ROW(
    OLD.run_id, OLD.organization_id, OLD.job_key, OLD.website_sku, OLD.grace_sku,
    OLD.family, OLD.asset_role, OLD.renderer_id, OLD.attempt_ordinal,
    OLD.reference_manifest, OLD.prompt_hash, OLD.prompt_version,
    OLD.canonical_truth_hash
  ) IS DISTINCT FROM ROW(
    NEW.run_id, NEW.organization_id, NEW.job_key, NEW.website_sku, NEW.grace_sku,
    NEW.family, NEW.asset_role, NEW.renderer_id, NEW.attempt_ordinal,
    NEW.reference_manifest, NEW.prompt_hash, NEW.prompt_version,
    NEW.canonical_truth_hash
  ) THEN
    RAISE EXCEPTION 'Material pilot attempt identity and evidence are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS best_bottles_material_pilot_runs_touch_updated_at
  ON public.best_bottles_material_pilot_runs;
CREATE TRIGGER best_bottles_material_pilot_runs_touch_updated_at
  BEFORE UPDATE ON public.best_bottles_material_pilot_runs
  FOR EACH ROW EXECUTE FUNCTION public.best_bottles_material_pilot_touch_updated_at();

DROP TRIGGER IF EXISTS best_bottles_material_pilot_attempts_touch_updated_at
  ON public.best_bottles_material_pilot_attempts;
CREATE TRIGGER best_bottles_material_pilot_attempts_touch_updated_at
  BEFORE UPDATE ON public.best_bottles_material_pilot_attempts
  FOR EACH ROW EXECUTE FUNCTION public.best_bottles_material_pilot_touch_updated_at();

DROP TRIGGER IF EXISTS best_bottles_material_pilot_reviews_touch_updated_at
  ON public.best_bottles_material_pilot_reviews;
CREATE TRIGGER best_bottles_material_pilot_reviews_touch_updated_at
  BEFORE UPDATE ON public.best_bottles_material_pilot_reviews
  FOR EACH ROW EXECUTE FUNCTION public.best_bottles_material_pilot_touch_updated_at();

DROP TRIGGER IF EXISTS best_bottles_material_pilot_attempts_validate_org
  ON public.best_bottles_material_pilot_attempts;
CREATE TRIGGER best_bottles_material_pilot_attempts_validate_org
  BEFORE INSERT OR UPDATE OF run_id, organization_id
  ON public.best_bottles_material_pilot_attempts
  FOR EACH ROW EXECUTE FUNCTION public.best_bottles_material_pilot_validate_attempt_org();

DROP TRIGGER IF EXISTS best_bottles_material_pilot_reviews_validate_org
  ON public.best_bottles_material_pilot_reviews;
CREATE TRIGGER best_bottles_material_pilot_reviews_validate_org
  BEFORE INSERT OR UPDATE OF run_id, attempt_id, organization_id
  ON public.best_bottles_material_pilot_reviews
  FOR EACH ROW EXECUTE FUNCTION public.best_bottles_material_pilot_validate_review_org();

DROP TRIGGER IF EXISTS best_bottles_material_pilot_attempts_lock_identity
  ON public.best_bottles_material_pilot_attempts;
CREATE TRIGGER best_bottles_material_pilot_attempts_lock_identity
  BEFORE UPDATE ON public.best_bottles_material_pilot_attempts
  FOR EACH ROW EXECUTE FUNCTION public.best_bottles_material_pilot_lock_attempt_identity();

ALTER TABLE public.best_bottles_material_pilot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.best_bottles_material_pilot_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.best_bottles_material_pilot_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_pilot_runs_select_org_members"
  ON public.best_bottles_material_pilot_runs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_id AND m.user_id = auth.uid()
  ));
CREATE POLICY "material_pilot_runs_insert_org_members"
  ON public.best_bottles_material_pilot_runs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_id AND m.user_id = auth.uid()
  ));
CREATE POLICY "material_pilot_runs_update_org_members"
  ON public.best_bottles_material_pilot_runs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_id AND m.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "material_pilot_attempts_select_org_members"
  ON public.best_bottles_material_pilot_attempts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_id AND m.user_id = auth.uid()
  ));
CREATE POLICY "material_pilot_attempts_insert_org_members"
  ON public.best_bottles_material_pilot_attempts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_id AND m.user_id = auth.uid()
  ));
CREATE POLICY "material_pilot_attempts_update_org_members"
  ON public.best_bottles_material_pilot_attempts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_id AND m.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "material_pilot_reviews_select_org_members"
  ON public.best_bottles_material_pilot_reviews FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = organization_id AND m.user_id = auth.uid()
  ));
CREATE POLICY "material_pilot_reviews_insert_org_members"
  ON public.best_bottles_material_pilot_reviews FOR INSERT TO authenticated
  WITH CHECK (
    reviewed_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = organization_id AND m.user_id = auth.uid()
    )
  );
CREATE POLICY "material_pilot_reviews_update_reviewer"
  ON public.best_bottles_material_pilot_reviews FOR UPDATE TO authenticated
  USING (reviewed_by = auth.uid())
  WITH CHECK (reviewed_by = auth.uid());

REVOKE ALL ON public.best_bottles_material_pilot_runs FROM anon;
REVOKE ALL ON public.best_bottles_material_pilot_attempts FROM anon;
REVOKE ALL ON public.best_bottles_material_pilot_reviews FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.best_bottles_material_pilot_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.best_bottles_material_pilot_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.best_bottles_material_pilot_reviews TO authenticated;

COMMENT ON TABLE public.best_bottles_material_pilot_attempts IS
  'Non-publishable renderer benchmark attempts with immutable role/reference/canonical evidence.';
