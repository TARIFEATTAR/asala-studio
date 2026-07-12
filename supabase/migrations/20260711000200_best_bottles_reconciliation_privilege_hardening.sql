-- Harden Best Bottles reconciliation privileges after project-level default
-- privileges granted broader access to newly created tables and functions.

REVOKE ALL ON TABLE public.best_bottles_image_reconciliations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.best_bottles_image_reconciliations
  TO authenticated;

REVOKE ALL ON TABLE public.best_bottles_pipeline_sku_images FROM anon, authenticated;
GRANT SELECT
  ON TABLE public.best_bottles_pipeline_sku_images
  TO authenticated;

REVOKE ALL ON TABLE public.best_bottles_image_reconciliation_status FROM anon, authenticated;
GRANT SELECT
  ON TABLE public.best_bottles_image_reconciliation_status
  TO authenticated;

REVOKE ALL ON FUNCTION public.best_bottles_reconciliation_touch_updated_at()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_best_bottles_image_reconciliation_org()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_best_bottles_sku_image_assignment_org()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_best_bottles_image_assignment_from_sku_job()
  FROM PUBLIC, anon, authenticated;
