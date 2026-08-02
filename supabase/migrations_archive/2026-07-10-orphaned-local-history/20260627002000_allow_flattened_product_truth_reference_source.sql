-- Allow flattened Photoshop product-truth references to be tracked as a
-- first-class Best Bottles reference source.

ALTER TABLE public.best_bottles_pipeline_sku_jobs
  DROP CONSTRAINT IF EXISTS best_bottles_pipeline_sku_jobs_reference_source_check;

ALTER TABLE public.best_bottles_pipeline_sku_jobs
  ADD CONSTRAINT best_bottles_pipeline_sku_jobs_reference_source_check
  CHECK (
    reference_source IS NULL OR reference_source IN (
      'canonical-render',
      'flattened-product-truth',
      'local-legacy',
      'bestbottles-live',
      'manual',
      'none'
    )
  );

COMMENT ON COLUMN public.best_bottles_pipeline_sku_jobs.reference_source IS
  'How Madison sourced the SKU reference image: canonical render, flattened product-truth export, local legacy asset, bestbottles.com live image, manual upload, or none.';
