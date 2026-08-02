-- Narrow, hash-bound review path for cosmetic model-shadow detector misses.
-- This does not relax identity, canonical geometry, reference, topology, or
-- missing-contact requirements. Exceptions and revocations are append-only.

ALTER TABLE public.best_bottles_image_reconciliations
  ADD COLUMN IF NOT EXISTS final_image_hash TEXT,
  ADD COLUMN IF NOT EXISTS shadow_report_hash TEXT,
  ADD COLUMN IF NOT EXISTS shadow_topology_hash TEXT;

CREATE TABLE IF NOT EXISTS public.best_bottles_shadow_review_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  image_id UUID NOT NULL REFERENCES public.generated_images(id) ON DELETE CASCADE,
  pipeline_sku_job_id UUID NOT NULL REFERENCES public.best_bottles_pipeline_sku_jobs(id) ON DELETE CASCADE,
  policy_version TEXT NOT NULL CHECK (policy_version = 'best-bottles-shadow-review-exception-v1'),
  reason_code TEXT NOT NULL CHECK (reason_code IN (
    'extension-ratio-boundary',
    'contact-density-boundary',
    'vertical-depth-boundary',
    'detector-sensitivity'
  )),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) >= 20),
  final_image_hash TEXT NOT NULL CHECK (final_image_hash ~ '^[a-f0-9]{64}$'),
  source_reference_hash TEXT NOT NULL CHECK (source_reference_hash ~ '^[a-f0-9]{64}$'),
  prompt_hash TEXT NOT NULL CHECK (prompt_hash ~ '^[a-f0-9]{64}$'),
  shadow_report_hash TEXT NOT NULL CHECK (shadow_report_hash ~ '^[a-f0-9]{64}$'),
  shadow_topology_hash TEXT NOT NULL CHECK (shadow_topology_hash ~ '^[a-f0-9]{64}$'),
  shadow_contract TEXT NOT NULL CHECK (shadow_contract = 'contact-back-right-v1'),
  shadow_topology_kind TEXT NOT NULL,
  expected_contacts JSONB NOT NULL CHECK (
    jsonb_typeof(expected_contacts) = 'array' AND jsonb_array_length(expected_contacts) > 0
  ),
  reviewed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (
    organization_id,
    image_id,
    pipeline_sku_job_id,
    final_image_hash,
    source_reference_hash,
    prompt_hash,
    shadow_report_hash,
    shadow_topology_hash
  )
);

CREATE TABLE IF NOT EXISTS public.best_bottles_shadow_review_exception_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  exception_id UUID NOT NULL UNIQUE REFERENCES public.best_bottles_shadow_review_exceptions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) >= 10),
  revoked_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_best_bottles_shadow_review_exceptions_lookup
  ON public.best_bottles_shadow_review_exceptions
  (organization_id, pipeline_sku_job_id, image_id);

ALTER TABLE public.best_bottles_shadow_review_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.best_bottles_shadow_review_exception_revocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shadow_review_exceptions_select_own_org"
  ON public.best_bottles_shadow_review_exceptions FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "shadow_review_exceptions_insert_own_org"
  ON public.best_bottles_shadow_review_exceptions FOR INSERT
  WITH CHECK (
    reviewed_by = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "shadow_review_exception_revocations_select_own_org"
  ON public.best_bottles_shadow_review_exception_revocations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "shadow_review_exception_revocations_insert_own_org"
  ON public.best_bottles_shadow_review_exception_revocations FOR INSERT
  WITH CHECK (
    revoked_by = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

REVOKE ALL ON public.best_bottles_shadow_review_exceptions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.best_bottles_shadow_review_exceptions TO authenticated;
REVOKE ALL ON public.best_bottles_shadow_review_exception_revocations FROM anon, authenticated;
GRANT SELECT, INSERT ON public.best_bottles_shadow_review_exception_revocations TO authenticated;

CREATE OR REPLACE FUNCTION public.best_bottles_shadow_review_exception_passes(
  p_organization_id UUID,
  p_pipeline_sku_job_id UUID,
  p_image_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.best_bottles_shadow_review_exceptions e
    JOIN public.best_bottles_image_reconciliations r
      ON r.organization_id = e.organization_id
     AND r.image_id = e.image_id
    JOIN public.best_bottles_pipeline_sku_images a
      ON a.organization_id = e.organization_id
     AND a.sku_job_id = e.pipeline_sku_job_id
     AND a.image_id = e.image_id
    WHERE e.organization_id = p_organization_id
      AND EXISTS (
        SELECT 1 FROM public.organization_members m
        WHERE m.organization_id = p_organization_id AND m.user_id = auth.uid()
      )
      AND e.pipeline_sku_job_id = p_pipeline_sku_job_id
      AND e.image_id = p_image_id
      AND NOT EXISTS (
        SELECT 1 FROM public.best_bottles_shadow_review_exception_revocations v
        WHERE v.exception_id = e.id
      )
      AND r.lifecycle_state = 'review-pending'
      AND r.framing_decision = 'pass'
      AND COALESCE(cardinality(r.qa_issues), 0) = 0
      AND r.catalog_truth->>'identityStatus' = 'ready'
      AND r.catalog_truth->>'websiteTruthStatus' IN ('ready', 'alias_exception')
      AND COALESCE(jsonb_array_length(r.catalog_truth->'identityBlockers'), 0) = 0
      AND r.final_image_hash = e.final_image_hash
      AND r.source_reference_hash = e.source_reference_hash
      AND r.prompt_hash = e.prompt_hash
      AND r.shadow_report_hash = e.shadow_report_hash
      AND r.shadow_topology_hash = e.shadow_topology_hash
      AND r.shadow_qa->'target'->>'contract' = e.shadow_contract
      AND r.shadow_topology->>'kind' = e.shadow_topology_kind
      AND r.shadow_topology->'expectedContacts' = e.expected_contacts
      AND jsonb_array_length(COALESCE(r.shadow_qa->'contacts', '[]'::JSONB)) =
          jsonb_array_length(e.expected_contacts)
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(e.expected_contacts) expected(contact_name)
        WHERE NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(r.shadow_qa->'contacts', '[]'::JSONB)) contact
          WHERE contact->>'contact' = expected.contact_name
            AND contact->'bounds' IS NOT NULL
            AND COALESCE((contact->'measurements'->>'shadowPixelCount')::INTEGER, 0) > 0
            AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(COALESCE(contact->'failures', '[]'::JSONB)) failure(message)
              WHERE failure.message ~* '\m(missing|absent|unresolved|duplicate|second product|unexpected contact)\M'
                 OR failure.message ~* 'no (visible )?(contact )?shadow'
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.best_bottles_shadow_review_exception_passes(UUID, UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.best_bottles_shadow_review_exception_passes(UUID, UUID, UUID)
  TO authenticated;

COMMENT ON FUNCTION public.best_bottles_shadow_review_exception_passes(UUID, UUID, UUID) IS
  'Validates an exact-hash cosmetic shadow exception; strict shadow evidence remains the default approval path.';

-- Preserve the existing terminal-state and candidate-image guards while
-- allowing exactly one additional approval route: the immutable exception
-- predicate above. No direct table mutation can bypass this RPC.
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
    )
    AND (
      public.best_bottles_shadow_evidence_passes(
        r.family,
        r.prompt_version,
        r.shadow_owner,
        r.shadow_topology,
        r.shadow_qa
      )
      OR public.best_bottles_shadow_review_exception_passes(
        p_organization_id,
        p_pipeline_sku_job_id,
        p_image_id
      )
    );

  IF v_final_image_url IS NULL THEN
    RAISE EXCEPTION 'Image % is not linked to job % with passing identity, geometry, and strict or reviewed shadow evidence',
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

REVOKE ALL ON FUNCTION public.approve_best_bottles_reconciled_image(UUID, UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_best_bottles_reconciled_image(UUID, UUID, UUID)
  TO authenticated;
