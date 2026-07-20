-- Restore the approval-field protection function and trigger that are present
-- in the canonical reconciliation migration but absent from the live schema.
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

REVOKE ALL ON FUNCTION public.protect_best_bottles_sku_job_approval_fields()
  FROM PUBLIC, anon, authenticated;
