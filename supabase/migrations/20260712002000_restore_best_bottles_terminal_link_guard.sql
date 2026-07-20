-- Restore the terminal-state guard that is present in the canonical
-- reconciliation migration but missing from the deployed function body.
-- Without this guard a newly generated image can relink an approved,
-- Shopify-pushed, or synced SKU job and overwrite its terminal candidate.
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
