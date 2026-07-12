-- Durable Best Bottles image reconciliation control plane.
--
-- Image provenance, catalog truth, pixel geometry, and QA are one row per
-- generated image. SKU fulfillment and destination verification are one row
-- per image/SKU-job assignment so one valid image may serve multiple exact
-- SKU jobs without overwriting linkage or verification evidence.

CREATE TABLE IF NOT EXISTS public.best_bottles_image_reconciliations (
  image_id UUID PRIMARY KEY REFERENCES public.generated_images(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  grace_sku TEXT,
  website_sku TEXT,
  family TEXT,
  source_reference_url TEXT,
  source_reference_hash TEXT,
  prompt_hash TEXT,
  prompt_version TEXT,
  rig_version TEXT,
  provider_model TEXT,
  catalog_truth JSONB,
  catalog_truth_hash TEXT,
  asset_role TEXT NOT NULL DEFAULT 'pdp-primary'
    CHECK (asset_role IN ('pdp-primary', 'pdp-secondary', 'marketing', 'scene')),
  requires_pipeline_reconciliation BOOLEAN NOT NULL DEFAULT TRUE,

  raw_image_url TEXT NOT NULL,
  final_image_url TEXT,
  canvas_width_px INTEGER CHECK (canvas_width_px IS NULL OR canvas_width_px > 0),
  canvas_height_px INTEGER CHECK (canvas_height_px IS NULL OR canvas_height_px > 0),

  pre_transform_baseline_y_px INTEGER,
  detected_baseline_y_px INTEGER,
  target_baseline_y_px INTEGER,
  baseline_delta_px INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN detected_baseline_y_px IS NULL OR target_baseline_y_px IS NULL THEN NULL
      ELSE detected_baseline_y_px - target_baseline_y_px
    END
  ) STORED,
  fill_height_pct NUMERIC(8, 4),
  center_x_pct NUMERIC(8, 4),
  target_center_x_pct NUMERIC(8, 4),
  center_delta_pct NUMERIC(8, 4),
  shift_x_px INTEGER,
  shift_y_px INTEGER,
  scale_factor NUMERIC(10, 6),
  mask_controlled BOOLEAN NOT NULL DEFAULT FALSE,
  pre_transform_object_bounds JSONB,
  transform_control_bounds JSONB,
  object_bounds JSONB,
  framing_qa JSONB,
  qa_issues TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  framing_decision TEXT CHECK (framing_decision IS NULL OR framing_decision IN ('pass', 'normalize', 'reject')),

  lifecycle_state TEXT NOT NULL DEFAULT 'raw-generated'
    CHECK (lifecycle_state IN (
      'raw-generated',
      'rigging',
      'qa-passed',
      'qa-failed',
      'review-pending',
      'approved',
      'published',
      'reconciled',
      'failed'
    )),
  last_error TEXT,
  rigged_at TIMESTAMPTZ,
  qa_completed_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.best_bottles_pipeline_sku_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku_job_id UUID NOT NULL REFERENCES public.best_bottles_pipeline_sku_jobs(id) ON DELETE CASCADE,
  image_id UUID NOT NULL REFERENCES public.generated_images(id) ON DELETE RESTRICT,

  decision TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (decision IN ('unreviewed', 'approved-keep', 'needs-regen', 'superseded')),
  link_source TEXT NOT NULL DEFAULT 'generation'
    CHECK (link_source IN ('generation', 'exact-sku-tag-backfill', 'manual', 'shopify-existing')),

  expected_image_url TEXT,
  shopify_verification_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (shopify_verification_state IN ('pending', 'matched', 'mismatch', 'error')),
  shopify_verified_image_url TEXT,
  shopify_verified_image_hash TEXT,
  shopify_verified_at TIMESTAMPTZ,
  shopify_verification_error TEXT,
  convex_verification_state TEXT NOT NULL DEFAULT 'pending'
    CHECK (convex_verification_state IN ('pending', 'matched', 'mismatch', 'error')),
  convex_verified_image_url TEXT,
  convex_verified_image_hash TEXT,
  convex_verified_at TIMESTAMPTZ,
  convex_verification_error TEXT,

  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT best_bottles_pipeline_sku_images_job_image_unique UNIQUE (sku_job_id, image_id)
);

CREATE INDEX IF NOT EXISTS idx_best_bottles_image_reconciliations_org_state
  ON public.best_bottles_image_reconciliations (organization_id, lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_best_bottles_image_reconciliations_grace_sku
  ON public.best_bottles_image_reconciliations (organization_id, grace_sku)
  WHERE grace_sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_best_bottles_pipeline_sku_images_org_image
  ON public.best_bottles_pipeline_sku_images (organization_id, image_id);
CREATE INDEX IF NOT EXISTS idx_best_bottles_pipeline_sku_images_org_job
  ON public.best_bottles_pipeline_sku_images (organization_id, sku_job_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_best_bottles_pipeline_sku_images_one_active_approval_per_job
  ON public.best_bottles_pipeline_sku_images (sku_job_id)
  WHERE decision = 'approved-keep';

CREATE OR REPLACE FUNCTION public.best_bottles_reconciliation_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS best_bottles_image_reconciliations_touch_updated_at
  ON public.best_bottles_image_reconciliations;
CREATE TRIGGER best_bottles_image_reconciliations_touch_updated_at
  BEFORE UPDATE ON public.best_bottles_image_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.best_bottles_reconciliation_touch_updated_at();

DROP TRIGGER IF EXISTS best_bottles_pipeline_sku_images_touch_updated_at
  ON public.best_bottles_pipeline_sku_images;
CREATE TRIGGER best_bottles_pipeline_sku_images_touch_updated_at
  BEFORE UPDATE ON public.best_bottles_pipeline_sku_images
  FOR EACH ROW EXECUTE FUNCTION public.best_bottles_reconciliation_touch_updated_at();

CREATE OR REPLACE FUNCTION public.validate_best_bottles_image_reconciliation_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.generated_images g
    WHERE g.id = NEW.image_id AND g.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Generated image % does not belong to organization %', NEW.image_id, NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_best_bottles_image_reconciliation_org
  ON public.best_bottles_image_reconciliations;
CREATE TRIGGER validate_best_bottles_image_reconciliation_org
  BEFORE INSERT OR UPDATE OF image_id, organization_id
  ON public.best_bottles_image_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.validate_best_bottles_image_reconciliation_org();

CREATE OR REPLACE FUNCTION public.validate_best_bottles_sku_image_assignment_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.generated_images g
    WHERE g.id = NEW.image_id AND g.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Generated image % does not belong to organization %', NEW.image_id, NEW.organization_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.best_bottles_pipeline_sku_jobs j
    WHERE j.id = NEW.sku_job_id AND j.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'SKU job % does not belong to organization %', NEW.sku_job_id, NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_best_bottles_sku_image_assignment_org
  ON public.best_bottles_pipeline_sku_images;
CREATE TRIGGER validate_best_bottles_sku_image_assignment_org
  BEFORE INSERT OR UPDATE OF image_id, sku_job_id, organization_id
  ON public.best_bottles_pipeline_sku_images
  FOR EACH ROW EXECUTE FUNCTION public.validate_best_bottles_sku_image_assignment_org();

ALTER TABLE public.best_bottles_image_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.best_bottles_pipeline_sku_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "image_reconciliations_select_own_org" ON public.best_bottles_image_reconciliations;
CREATE POLICY "image_reconciliations_select_own_org"
  ON public.best_bottles_image_reconciliations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "image_reconciliations_insert_own_org" ON public.best_bottles_image_reconciliations;
CREATE POLICY "image_reconciliations_insert_own_org"
  ON public.best_bottles_image_reconciliations FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "image_reconciliations_update_own_org" ON public.best_bottles_image_reconciliations;
CREATE POLICY "image_reconciliations_update_own_org"
  ON public.best_bottles_image_reconciliations FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "image_reconciliations_delete_own_org" ON public.best_bottles_image_reconciliations;
CREATE POLICY "image_reconciliations_delete_own_org"
  ON public.best_bottles_image_reconciliations FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "pipeline_sku_images_select_own_org" ON public.best_bottles_pipeline_sku_images;
CREATE POLICY "pipeline_sku_images_select_own_org"
  ON public.best_bottles_pipeline_sku_images FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.best_bottles_image_reconciliations TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.best_bottles_pipeline_sku_images FROM authenticated;
GRANT SELECT ON public.best_bottles_pipeline_sku_images TO authenticated;

CREATE OR REPLACE FUNCTION public.best_bottles_assert_org_member(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p_organization_id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for organization %', p_organization_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_best_bottles_sku_job_approval_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role'
    OR current_setting('app.best_bottles_approval_rpc', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.approved_image_id IS DISTINCT FROM OLD.approved_image_id
    OR NEW.approved_image_url IS DISTINCT FROM OLD.approved_image_url
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
    OR (
      NEW.status IS DISTINCT FROM OLD.status
      AND (
        NEW.status IN ('approved', 'shopify-pushed', 'synced')
        OR OLD.status IN ('approved', 'shopify-pushed', 'synced')
      )
    ) THEN
    RAISE EXCEPTION 'Approval state for SKU job % must be changed through the approval RPC', OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_best_bottles_sku_job_approval_fields
  ON public.best_bottles_pipeline_sku_jobs;
CREATE TRIGGER protect_best_bottles_sku_job_approval_fields
  BEFORE UPDATE ON public.best_bottles_pipeline_sku_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_best_bottles_sku_job_approval_fields();

CREATE OR REPLACE FUNCTION public.link_best_bottles_generated_image(
  p_organization_id UUID,
  p_pipeline_sku_job_id UUID,
  p_image_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_final_image_url TEXT;
  v_job_status TEXT;
  v_approved_image_id UUID;
BEGIN
  PERFORM public.best_bottles_assert_org_member(p_organization_id);

  SELECT j.status, j.approved_image_id
  INTO v_job_status, v_approved_image_id
  FROM public.best_bottles_pipeline_sku_jobs j
  WHERE j.id = p_pipeline_sku_job_id
    AND j.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU job % was not found in organization %',
      p_pipeline_sku_job_id, p_organization_id;
  END IF;

  IF v_job_status IN ('approved', 'shopify-pushed', 'synced')
    OR v_approved_image_id IS NOT NULL THEN
    RAISE EXCEPTION 'Terminal SKU job % cannot be relinked from status % or approved image %',
      p_pipeline_sku_job_id, v_job_status, v_approved_image_id;
  END IF;

  SELECT r.final_image_url INTO v_final_image_url
  FROM public.best_bottles_image_reconciliations r
  JOIN public.best_bottles_pipeline_sku_jobs j
    ON j.id = p_pipeline_sku_job_id
   AND j.organization_id = p_organization_id
  WHERE r.image_id = p_image_id
    AND r.organization_id = p_organization_id
    AND r.requires_pipeline_reconciliation = TRUE
    AND r.lifecycle_state IN ('qa-passed', 'review-pending', 'approved', 'published', 'reconciled')
    AND r.framing_decision = 'pass'
    AND COALESCE(cardinality(r.qa_issues), 0) = 0
    AND (
      upper(NULLIF(r.grace_sku, '')) = upper(j.grace_sku)
      OR upper(NULLIF(r.website_sku, '')) = upper(j.website_sku)
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(r.catalog_truth->'eligibleGraceSkus', '[]'::JSONB)) eligible(grace_sku)
        WHERE upper(eligible.grace_sku) = upper(j.grace_sku)
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(r.catalog_truth->'eligibleWebsiteSkus', '[]'::JSONB)) eligible(website_sku)
        WHERE upper(eligible.website_sku) = upper(j.website_sku)
      )
    );

  IF v_final_image_url IS NULL THEN
    RAISE EXCEPTION 'Image % is missing passing QA, a final URL, or exact SKU identity for job %',
      p_image_id, p_pipeline_sku_job_id;
  END IF;

  INSERT INTO public.best_bottles_pipeline_sku_images (
    organization_id,
    sku_job_id,
    image_id,
    decision,
    link_source,
    expected_image_url,
    linked_by
  ) VALUES (
    p_organization_id,
    p_pipeline_sku_job_id,
    p_image_id,
    'unreviewed',
    'generation',
    v_final_image_url,
    auth.uid()
  )
  ON CONFLICT (sku_job_id, image_id) DO UPDATE
  SET expected_image_url = EXCLUDED.expected_image_url,
      linked_at = now(),
      linked_by = auth.uid(),
      updated_at = now();

  UPDATE public.best_bottles_pipeline_sku_jobs
  SET status = 'generated',
      generated_image_id = p_image_id,
      generated_image_url = v_final_image_url,
      last_error = NULL,
      updated_at = now()
  WHERE id = p_pipeline_sku_job_id
    AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU job % was not found in organization %', p_pipeline_sku_job_id, p_organization_id;
  END IF;

  UPDATE public.best_bottles_image_reconciliations
  SET lifecycle_state = CASE
        WHEN lifecycle_state IN ('approved', 'published', 'reconciled') THEN lifecycle_state
        ELSE 'review-pending'
      END,
      updated_at = now()
  WHERE image_id = p_image_id AND organization_id = p_organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_best_bottles_reconciled_image(
  p_organization_id UUID,
  p_pipeline_sku_job_id UUID,
  p_image_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_final_image_url TEXT;
  v_job_status TEXT;
  v_job_generated_image_id UUID;
  v_job_approved_image_id UUID;
BEGIN
  PERFORM public.best_bottles_assert_org_member(p_organization_id);

  SELECT j.status, j.generated_image_id, j.approved_image_id
  INTO v_job_status, v_job_generated_image_id, v_job_approved_image_id
  FROM public.best_bottles_pipeline_sku_jobs j
  WHERE j.id = p_pipeline_sku_job_id
    AND j.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU job % was not found in organization %',
      p_pipeline_sku_job_id, p_organization_id;
  END IF;

  IF v_job_status IN ('approved', 'shopify-pushed', 'synced')
    OR v_job_approved_image_id IS NOT NULL THEN
    RAISE EXCEPTION 'Terminal SKU job % cannot be approved from status % or approved image %',
      p_pipeline_sku_job_id, v_job_status, v_job_approved_image_id;
  END IF;

  IF v_job_generated_image_id IS DISTINCT FROM p_image_id THEN
    RAISE EXCEPTION 'Image % is not the current generated candidate for SKU job %',
      p_image_id, p_pipeline_sku_job_id;
  END IF;

  SELECT r.final_image_url INTO v_final_image_url
  FROM public.best_bottles_image_reconciliations r
  JOIN public.best_bottles_pipeline_sku_images a
    ON a.image_id = r.image_id
   AND a.sku_job_id = p_pipeline_sku_job_id
   AND a.organization_id = p_organization_id
  JOIN public.best_bottles_pipeline_sku_jobs j
    ON j.id = a.sku_job_id
   AND j.organization_id = p_organization_id
  WHERE r.image_id = p_image_id
    AND r.organization_id = p_organization_id
    AND r.requires_pipeline_reconciliation = TRUE
    AND r.lifecycle_state IN ('qa-passed', 'review-pending', 'approved')
    AND r.detected_baseline_y_px IS NOT NULL
    AND r.target_baseline_y_px IS NOT NULL
    AND r.framing_decision = 'pass'
    AND COALESCE(cardinality(r.qa_issues), 0) = 0
    AND r.catalog_truth IS NOT NULL
    AND r.catalog_truth->>'identityStatus' = 'ready'
    AND COALESCE(jsonb_array_length(r.catalog_truth->'identityBlockers'), 0) = 0
    AND r.catalog_truth->>'websiteTruthStatus' IN ('ready', 'alias_exception')
    AND NULLIF(btrim(r.catalog_truth->>'heightWithoutCap'), '') IS NOT NULL
    AND NULLIF(btrim(r.catalog_truth->>'diameter'), '') IS NOT NULL
    AND (
      upper(r.catalog_truth->>'graceSku') = upper(j.grace_sku)
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(r.catalog_truth->'eligibleGraceSkus', '[]'::JSONB)) eligible(grace_sku)
        WHERE upper(eligible.grace_sku) = upper(j.grace_sku)
      )
    );

  IF v_final_image_url IS NULL THEN
    RAISE EXCEPTION 'Image % is not linked to job % with passing framing and product-truth QA',
      p_image_id, p_pipeline_sku_job_id;
  END IF;

  UPDATE public.best_bottles_pipeline_sku_images
  SET decision = 'superseded', updated_at = now()
  WHERE sku_job_id = p_pipeline_sku_job_id
    AND organization_id = p_organization_id
    AND image_id <> p_image_id
    AND decision = 'approved-keep';

  UPDATE public.best_bottles_pipeline_sku_images
  SET decision = 'approved-keep',
      expected_image_url = v_final_image_url,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      shopify_verification_state = 'pending',
      shopify_verified_image_url = NULL,
      shopify_verified_image_hash = NULL,
      shopify_verified_at = NULL,
      shopify_verification_error = NULL,
      convex_verification_state = 'pending',
      convex_verified_image_url = NULL,
      convex_verified_image_hash = NULL,
      convex_verified_at = NULL,
      convex_verification_error = NULL,
      updated_at = now()
  WHERE sku_job_id = p_pipeline_sku_job_id
    AND image_id = p_image_id
    AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Image assignment was not found for image % and job %', p_image_id, p_pipeline_sku_job_id;
  END IF;

  UPDATE public.generated_images
  SET library_tags = array_append(
    array_remove(
      array_remove(
        array_remove(COALESCE(library_tags, '{}'::TEXT[]), 'status:approved-keep'),
        'status:needs-regen'
      ),
      'status:unreviewed'
    ),
    'status:approved-keep'
  )
  WHERE id = p_image_id AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Image Library row % was not found in organization %', p_image_id, p_organization_id;
  END IF;

  PERFORM set_config('app.best_bottles_approval_rpc', 'on', true);

  UPDATE public.best_bottles_pipeline_sku_jobs
  SET status = 'approved',
      approved_image_id = p_image_id,
      approved_image_url = v_final_image_url,
      approved_at = now(),
      approved_by = auth.uid(),
      shopify_product_id = NULL,
      shopify_variant_id = NULL,
      shopify_media_id = NULL,
      shopify_image_url = NULL,
      shopify_pushed_at = NULL,
      convex_synced_at = NULL,
      last_error = NULL,
      updated_at = now()
  WHERE id = p_pipeline_sku_job_id AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SKU job % was not found in organization %', p_pipeline_sku_job_id, p_organization_id;
  END IF;

  PERFORM set_config('app.best_bottles_approval_rpc', 'off', true);

  UPDATE public.best_bottles_image_reconciliations
  SET lifecycle_state = 'approved', updated_at = now()
  WHERE image_id = p_image_id AND organization_id = p_organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_best_bottles_image_assignment_from_sku_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approved_image_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.best_bottles_pipeline_sku_images
  SET shopify_verification_state = CASE
        WHEN NEW.shopify_pushed_at IS DISTINCT FROM OLD.shopify_pushed_at
          OR NEW.shopify_image_url IS DISTINCT FROM OLD.shopify_image_url
          OR NEW.shopify_media_id IS DISTINCT FROM OLD.shopify_media_id
        THEN 'pending' ELSE shopify_verification_state END,
      shopify_verified_image_url = CASE
        WHEN NEW.shopify_pushed_at IS DISTINCT FROM OLD.shopify_pushed_at
          OR NEW.shopify_image_url IS DISTINCT FROM OLD.shopify_image_url
          OR NEW.shopify_media_id IS DISTINCT FROM OLD.shopify_media_id
        THEN NULL ELSE shopify_verified_image_url END,
      shopify_verified_image_hash = CASE
        WHEN NEW.shopify_pushed_at IS DISTINCT FROM OLD.shopify_pushed_at
          OR NEW.shopify_image_url IS DISTINCT FROM OLD.shopify_image_url
          OR NEW.shopify_media_id IS DISTINCT FROM OLD.shopify_media_id
        THEN NULL ELSE shopify_verified_image_hash END,
      shopify_verified_at = CASE
        WHEN NEW.shopify_pushed_at IS DISTINCT FROM OLD.shopify_pushed_at
          OR NEW.shopify_image_url IS DISTINCT FROM OLD.shopify_image_url
          OR NEW.shopify_media_id IS DISTINCT FROM OLD.shopify_media_id
        THEN NULL ELSE shopify_verified_at END,
      convex_verification_state = CASE
        WHEN NEW.convex_synced_at IS DISTINCT FROM OLD.convex_synced_at
        THEN 'pending' ELSE convex_verification_state END,
      convex_verified_image_url = CASE
        WHEN NEW.convex_synced_at IS DISTINCT FROM OLD.convex_synced_at
        THEN NULL ELSE convex_verified_image_url END,
      convex_verified_image_hash = CASE
        WHEN NEW.convex_synced_at IS DISTINCT FROM OLD.convex_synced_at
        THEN NULL ELSE convex_verified_image_hash END,
      convex_verified_at = CASE
        WHEN NEW.convex_synced_at IS DISTINCT FROM OLD.convex_synced_at
        THEN NULL ELSE convex_verified_at END,
      updated_at = now()
  WHERE sku_job_id = NEW.id
    AND image_id = NEW.approved_image_id
    AND organization_id = NEW.organization_id
    AND decision = 'approved-keep';

  UPDATE public.best_bottles_image_reconciliations
  SET lifecycle_state = CASE
        WHEN NEW.shopify_pushed_at IS NOT NULL OR NEW.convex_synced_at IS NOT NULL
          OR NEW.status IN ('shopify-pushed', 'synced') THEN 'published'
        ELSE 'approved'
      END,
      reconciled_at = NULL,
      updated_at = now()
  WHERE image_id = NEW.approved_image_id AND organization_id = NEW.organization_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_best_bottles_image_assignment_from_sku_job
  ON public.best_bottles_pipeline_sku_jobs;
CREATE TRIGGER sync_best_bottles_image_assignment_from_sku_job
  AFTER UPDATE OF status, approved_image_id, shopify_media_id, shopify_image_url, shopify_pushed_at, convex_synced_at
  ON public.best_bottles_pipeline_sku_jobs
  FOR EACH ROW EXECUTE FUNCTION public.sync_best_bottles_image_assignment_from_sku_job();

CREATE OR REPLACE FUNCTION public.record_best_bottles_destination_verification(
  p_organization_id UUID,
  p_pipeline_sku_job_id UUID,
  p_image_id UUID,
  p_destination TEXT,
  p_state TEXT,
  p_verified_image_url TEXT DEFAULT NULL,
  p_verified_image_hash TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_all_matched BOOLEAN;
  v_any_mismatch BOOLEAN;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Destination verification requires the service role';
  END IF;
  IF p_destination NOT IN ('shopify', 'convex') THEN
    RAISE EXCEPTION 'Unsupported destination %', p_destination;
  END IF;
  IF p_state NOT IN ('matched', 'mismatch', 'error') THEN
    RAISE EXCEPTION 'Unsupported verification state %', p_state;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.best_bottles_pipeline_sku_jobs j
    WHERE j.id = p_pipeline_sku_job_id
      AND j.organization_id = p_organization_id
      AND j.approved_image_id = p_image_id
  ) THEN
    RAISE EXCEPTION 'Job % does not currently approve image %', p_pipeline_sku_job_id, p_image_id;
  END IF;

  UPDATE public.best_bottles_pipeline_sku_images
  SET shopify_verification_state = CASE WHEN p_destination = 'shopify' THEN p_state ELSE shopify_verification_state END,
      shopify_verified_image_url = CASE WHEN p_destination = 'shopify' THEN p_verified_image_url ELSE shopify_verified_image_url END,
      shopify_verified_image_hash = CASE WHEN p_destination = 'shopify' THEN p_verified_image_hash ELSE shopify_verified_image_hash END,
      shopify_verified_at = CASE WHEN p_destination = 'shopify' THEN now() ELSE shopify_verified_at END,
      shopify_verification_error = CASE WHEN p_destination = 'shopify' THEN p_error ELSE shopify_verification_error END,
      convex_verification_state = CASE WHEN p_destination = 'convex' THEN p_state ELSE convex_verification_state END,
      convex_verified_image_url = CASE WHEN p_destination = 'convex' THEN p_verified_image_url ELSE convex_verified_image_url END,
      convex_verified_image_hash = CASE WHEN p_destination = 'convex' THEN p_verified_image_hash ELSE convex_verified_image_hash END,
      convex_verified_at = CASE WHEN p_destination = 'convex' THEN now() ELSE convex_verified_at END,
      convex_verification_error = CASE WHEN p_destination = 'convex' THEN p_error ELSE convex_verification_error END,
      updated_at = now()
  WHERE organization_id = p_organization_id
    AND sku_job_id = p_pipeline_sku_job_id
    AND image_id = p_image_id
    AND decision = 'approved-keep';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved assignment was not found for image % and job %', p_image_id, p_pipeline_sku_job_id;
  END IF;

  SELECT
    bool_and(a.shopify_verification_state = 'matched' AND a.convex_verification_state = 'matched'),
    bool_or(a.shopify_verification_state IN ('mismatch', 'error') OR a.convex_verification_state IN ('mismatch', 'error'))
  INTO v_all_matched, v_any_mismatch
  FROM public.best_bottles_pipeline_sku_images a
  JOIN public.best_bottles_pipeline_sku_jobs j ON j.id = a.sku_job_id
  WHERE a.organization_id = p_organization_id
    AND a.image_id = p_image_id
    AND a.decision = 'approved-keep'
    AND j.approved_image_id = p_image_id;

  UPDATE public.best_bottles_image_reconciliations
  SET lifecycle_state = CASE
        WHEN COALESCE(v_all_matched, FALSE) THEN 'reconciled'
        WHEN COALESCE(v_any_mismatch, FALSE) THEN 'published'
        ELSE 'published'
      END,
      reconciled_at = CASE WHEN COALESCE(v_all_matched, FALSE) THEN now() ELSE NULL END,
      updated_at = now()
  WHERE image_id = p_image_id AND organization_id = p_organization_id;
END;
$$;

-- The remote schema grants newly-created functions to anon/authenticated through
-- ALTER DEFAULT PRIVILEGES, so revoking only PUBLIC is insufficient here.
REVOKE ALL ON FUNCTION public.best_bottles_assert_org_member(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_best_bottles_sku_job_approval_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_best_bottles_generated_image(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_best_bottles_reconciled_image(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_best_bottles_destination_verification(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_best_bottles_generated_image(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_best_bottles_reconciled_image(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_best_bottles_destination_verification(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE VIEW public.best_bottles_image_reconciliation_status
WITH (security_invoker = true)
AS
WITH assignment_facts AS (
  SELECT
    a.image_id,
    a.id AS assignment_id,
    a.sku_job_id,
    a.decision,
    a.link_source,
    a.expected_image_url,
    a.shopify_verification_state,
    a.shopify_verified_image_url,
    a.shopify_verified_image_hash,
    a.shopify_verified_at,
    a.shopify_verification_error,
    a.convex_verification_state,
    a.convex_verified_image_url,
    a.convex_verified_image_hash,
    a.convex_verified_at,
    a.convex_verification_error,
    a.linked_at,
    a.reviewed_at,
    j.grace_sku AS job_grace_sku,
    j.website_sku AS job_website_sku,
    j.status AS sku_job_status,
    j.generated_image_id,
    j.approved_image_id,
    j.shopify_pushed_at,
    j.convex_synced_at,
    (j.generated_image_id = a.image_id OR j.approved_image_id = a.image_id) AS pipeline_image_matches,
    (j.approved_image_id = a.image_id AND a.decision = 'approved-keep') AS assignment_approved,
    (j.shopify_pushed_at IS NOT NULL) AS shopify_write_recorded,
    (j.convex_synced_at IS NOT NULL) AS convex_write_recorded
  FROM public.best_bottles_pipeline_sku_images a
  JOIN public.best_bottles_pipeline_sku_jobs j ON j.id = a.sku_job_id
  WHERE a.decision <> 'superseded'
), assignment_rollup AS (
  SELECT
    image_id,
    count(*)::INTEGER AS assignment_count,
    jsonb_agg(
      jsonb_build_object(
        'assignmentId', assignment_id,
        'skuJobId', sku_job_id,
        'graceSku', job_grace_sku,
        'websiteSku', job_website_sku,
        'decision', decision,
        'linkSource', link_source,
        'expectedImageUrl', expected_image_url,
        'skuJobStatus', sku_job_status,
        'generatedImageId', generated_image_id,
        'approvedImageId', approved_image_id,
        'shopifyPushedAt', shopify_pushed_at,
        'convexSyncedAt', convex_synced_at,
        'shopifyVerificationState', shopify_verification_state,
        'shopifyVerifiedImageUrl', shopify_verified_image_url,
        'shopifyVerifiedImageHash', shopify_verified_image_hash,
        'shopifyVerifiedAt', shopify_verified_at,
        'shopifyVerificationError', shopify_verification_error,
        'convexVerificationState', convex_verification_state,
        'convexVerifiedImageUrl', convex_verified_image_url,
        'convexVerifiedImageHash', convex_verified_image_hash,
        'convexVerifiedAt', convex_verified_at,
        'convexVerificationError', convex_verification_error,
        'linkedAt', linked_at,
        'reviewedAt', reviewed_at
      ) ORDER BY linked_at
    ) AS assignments,
    bool_and(pipeline_image_matches) AS all_pipeline_images_match,
    bool_and(assignment_approved) AS all_assignments_approved,
    bool_or(assignment_approved) AS any_assignment_approved,
    bool_and(shopify_write_recorded) AS all_shopify_writes_recorded,
    bool_and(shopify_verification_state = 'matched') AS all_shopify_verified,
    bool_and(convex_write_recorded) AS all_convex_writes_recorded,
    bool_and(convex_verification_state = 'matched') AS all_convex_verified,
    bool_or(shopify_verification_state IN ('mismatch', 'error') OR convex_verification_state IN ('mismatch', 'error'))
      AS any_destination_mismatch
  FROM assignment_facts
  GROUP BY image_id
)
SELECT
  r.*,
  COALESCE(ar.assignment_count, 0) AS assignment_count,
  COALESCE(ar.assignments, '[]'::JSONB) AS assignments,
  COALESCE(ar.all_pipeline_images_match, FALSE) AS all_pipeline_images_match,
  COALESCE(ar.all_assignments_approved, FALSE) AS all_assignments_approved,
  COALESCE(ar.any_assignment_approved, FALSE) AS any_assignment_approved,
  COALESCE(ar.all_shopify_writes_recorded, FALSE) AS all_shopify_writes_recorded,
  COALESCE(ar.all_shopify_verified, FALSE) AS all_shopify_verified,
  COALESCE(ar.all_convex_writes_recorded, FALSE) AS all_convex_writes_recorded,
  COALESCE(ar.all_convex_verified, FALSE) AS all_convex_verified,
  COALESCE(ar.any_destination_mismatch, FALSE) AS any_destination_mismatch,
  COALESCE(g.library_tags, '{}'::TEXT[]) @> ARRAY['status:approved-keep']::TEXT[] AS library_approved,
  CASE
    WHEN NOT r.requires_pipeline_reconciliation THEN 'library-only'
    WHEN r.lifecycle_state IN ('failed', 'qa-failed') THEN 'qa-failed'
    WHEN r.catalog_truth IS NULL OR NULLIF(r.catalog_truth->>'websiteTruthStatus', '') IS NULL THEN 'truth-missing'
    WHEN r.catalog_truth->>'websiteTruthStatus' NOT IN ('ready', 'alias_exception')
      OR r.catalog_truth->>'identityStatus' IS DISTINCT FROM 'ready'
      OR COALESCE(jsonb_array_length(r.catalog_truth->'identityBlockers'), 0) > 0 THEN 'truth-conflict'
    WHEN r.detected_baseline_y_px IS NULL OR r.target_baseline_y_px IS NULL THEN 'measurement-missing'
    WHEN r.lifecycle_state IN ('raw-generated', 'rigging') THEN 'rig-pending'
    WHEN COALESCE(ar.assignment_count, 0) = 0 THEN 'unlinked'
    WHEN NOT COALESCE(ar.all_pipeline_images_match, FALSE) THEN 'pipeline-image-mismatch'
    WHEN COALESCE(ar.any_assignment_approved, FALSE)
      IS DISTINCT FROM (COALESCE(g.library_tags, '{}'::TEXT[]) @> ARRAY['status:approved-keep']::TEXT[])
      THEN 'approval-divergence'
    WHEN COALESCE(ar.any_destination_mismatch, FALSE) THEN 'destination-mismatch'
    WHEN NOT COALESCE(ar.all_assignments_approved, FALSE) THEN 'review-pending'
    WHEN NOT COALESCE(ar.all_shopify_writes_recorded, FALSE) THEN 'approved-pending-shopify'
    WHEN NOT COALESCE(ar.all_shopify_verified, FALSE) THEN 'shopify-verification-pending'
    WHEN NOT COALESCE(ar.all_convex_writes_recorded, FALSE) THEN 'shopify-pending-convex'
    WHEN NOT COALESCE(ar.all_convex_verified, FALSE) THEN 'convex-verification-pending'
    ELSE 'reconciled'
  END AS reconciliation_status,
  (
    r.requires_pipeline_reconciliation
    AND r.lifecycle_state NOT IN ('failed', 'qa-failed')
    AND r.detected_baseline_y_px IS NOT NULL
    AND r.target_baseline_y_px IS NOT NULL
    AND r.catalog_truth->>'identityStatus' = 'ready'
    AND r.catalog_truth->>'websiteTruthStatus' IN ('ready', 'alias_exception')
    AND COALESCE(jsonb_array_length(r.catalog_truth->'identityBlockers'), 0) = 0
    AND COALESCE(ar.assignment_count, 0) > 0
    AND COALESCE(ar.all_pipeline_images_match, FALSE)
    AND COALESCE(ar.all_assignments_approved, FALSE)
    AND COALESCE(g.library_tags, '{}'::TEXT[]) @> ARRAY['status:approved-keep']::TEXT[]
    AND COALESCE(ar.all_shopify_writes_recorded, FALSE)
    AND COALESCE(ar.all_shopify_verified, FALSE)
    AND COALESCE(ar.all_convex_writes_recorded, FALSE)
    AND COALESCE(ar.all_convex_verified, FALSE)
  ) AS is_reconciled
FROM public.best_bottles_image_reconciliations r
JOIN public.generated_images g ON g.id = r.image_id AND g.organization_id = r.organization_id
LEFT JOIN assignment_rollup ar ON ar.image_id = r.image_id;

GRANT SELECT ON public.best_bottles_image_reconciliation_status TO authenticated;

COMMENT ON TABLE public.best_bottles_image_reconciliations IS
  'One row per generated image: Best Bottles source identity, catalog truth, raw/final geometry, rig transforms, and QA.';
COMMENT ON TABLE public.best_bottles_pipeline_sku_images IS
  'Many-to-many image/SKU-job assignments with per-destination read-back verification evidence.';
COMMENT ON VIEW public.best_bottles_image_reconciliation_status IS
  'Image-level reconciliation state aggregated across every active exact SKU assignment.';
