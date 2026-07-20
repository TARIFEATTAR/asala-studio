-- Durable, server-issued, single-use authorization for guarded Shopify image writes.
-- Authenticated clients cannot create, read, update, or delete these records.
CREATE TABLE IF NOT EXISTS public.shopify_publish_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_sku_job_id UUID NOT NULL REFERENCES public.best_bottles_pipeline_sku_jobs(id) ON DELETE CASCADE,
  generated_image_id UUID NOT NULL REFERENCES public.generated_images(id) ON DELETE CASCADE,
  website_sku TEXT NOT NULL,
  grace_sku TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose = 'shopify-product-image-publish'),
  authorized_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shopify_publish_authorizations_future_expiry
    CHECK (expires_at > authorized_at),
  CONSTRAINT shopify_publish_authorizations_consumption_order
    CHECK (consumed_at IS NULL OR consumed_at >= authorized_at)
);

CREATE INDEX IF NOT EXISTS idx_shopify_publish_authorizations_guard_lookup
  ON public.shopify_publish_authorizations (
    id,
    organization_id,
    pipeline_sku_job_id,
    generated_image_id
  )
  WHERE consumed_at IS NULL;

ALTER TABLE public.shopify_publish_authorizations ENABLE ROW LEVEL SECURITY;

-- No client policies are defined. Only the service-role edge function may
-- issue, resolve, or atomically consume authorization records.
REVOKE ALL ON TABLE public.shopify_publish_authorizations
  FROM PUBLIC, anon, authenticated;
