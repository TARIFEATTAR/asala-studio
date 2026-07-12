-- Persist shadow ownership and model-shadow QA evidence for the V6.1 smoke SKU.
-- The view uses r.*; drop it first so the two appended table columns do not
-- shift existing view column positions during CREATE OR REPLACE.
DROP VIEW IF EXISTS public.best_bottles_image_reconciliation_status;

ALTER TABLE public.best_bottles_image_reconciliations
  ADD COLUMN IF NOT EXISTS shadow_owner TEXT NOT NULL DEFAULT 'rig'
    CHECK (shadow_owner IN ('rig', 'model')),
  ADD COLUMN IF NOT EXISTS shadow_qa JSONB;

COMMENT ON COLUMN public.best_bottles_image_reconciliations.shadow_owner IS
  'Single shadow authority for this image: deterministic rig or image model.';
COMMENT ON COLUMN public.best_bottles_image_reconciliations.shadow_qa IS
  'Versioned model-shadow measurements and pass/review/fail decision.';

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
BEGIN
  PERFORM public.best_bottles_assert_org_member(p_organization_id);

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
      r.shadow_owner = 'rig'
      OR (
        r.shadow_owner = 'model'
        AND r.shadow_qa->>'status' = 'pass'
        AND r.shadow_qa->'target'->>'contract' = 'contact-back-right-v1'
      )
    );

  IF v_final_image_url IS NULL THEN
    RAISE EXCEPTION 'Image % is not linked to job % with passing framing, product-truth, and shadow QA',
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

  UPDATE public.best_bottles_image_reconciliations
  SET lifecycle_state = 'approved', updated_at = now()
  WHERE image_id = p_image_id AND organization_id = p_organization_id;
END;
$$;

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
    WHEN r.shadow_owner = 'model' AND COALESCE(r.shadow_qa->>'status', 'review') <> 'pass' THEN 'review-pending'
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
    AND (r.shadow_owner = 'rig' OR (r.shadow_owner = 'model' AND r.shadow_qa->>'status' = 'pass' AND r.shadow_qa->'target'->>'contract' = 'contact-back-right-v1'))
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

REVOKE ALL ON TABLE public.best_bottles_image_reconciliation_status FROM anon, authenticated;
GRANT SELECT
  ON TABLE public.best_bottles_image_reconciliation_status
  TO authenticated;
