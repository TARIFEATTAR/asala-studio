-- Best Bottles reference intake metadata
--
-- Keeps SKU-level reference sourcing visible in Madison after local legacy
-- files or bestbottles.com images are imported into the generation pipeline.

ALTER TABLE public.best_bottles_pipeline_sku_jobs
  ADD COLUMN IF NOT EXISTS reference_source TEXT
    CHECK (
      reference_source IS NULL OR reference_source IN (
        'canonical-render',
        'local-legacy',
        'bestbottles-live',
        'manual',
        'none'
      )
    ),
  ADD COLUMN IF NOT EXISTS reference_source_path TEXT,
  ADD COLUMN IF NOT EXISTS reference_source_url TEXT,
  ADD COLUMN IF NOT EXISTS reference_imported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reference_issue TEXT;

CREATE INDEX IF NOT EXISTS idx_best_bottles_pipeline_sku_jobs_reference_source
  ON public.best_bottles_pipeline_sku_jobs (organization_id, reference_source)
  WHERE reference_source IS NOT NULL;

COMMENT ON COLUMN public.best_bottles_pipeline_sku_jobs.reference_source IS
  'How Madison sourced the SKU reference image: canonical render, local legacy asset, bestbottles.com live image, manual upload, or none.';

COMMENT ON COLUMN public.best_bottles_pipeline_sku_jobs.reference_source_path IS
  'Local filesystem path used as the source before upload/import, when applicable.';

COMMENT ON COLUMN public.best_bottles_pipeline_sku_jobs.reference_source_url IS
  'External source URL used before upload/import, usually a bestbottles.com legacy image URL.';

COMMENT ON COLUMN public.best_bottles_pipeline_sku_jobs.reference_imported_at IS
  'Timestamp when the source reference was imported into a generation-usable public URL.';

COMMENT ON COLUMN public.best_bottles_pipeline_sku_jobs.reference_issue IS
  'Current reference sourcing/import issue, such as unsupported GIF that still needs conversion or no source match.';
