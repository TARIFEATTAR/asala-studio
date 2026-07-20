-- Best Bottles Grid Pipeline — pinned master reference per shape group
--
-- The Pipeline page shows a reference-thumbnail strip per shape group
-- (e.g. "Cylinder · 5ml · 13-415" may have four rows each with their own
-- scraped product-page hero image). Up to now, the Launch button picked
-- "first row with a URL" as the master reference. This migration adds a
-- boolean flag so the operator can pin a specific row as the preferred
-- master; Launch then prefers the pinned row.
--
-- At most one row per (organization_id, family, capacity_ml, thread_size)
-- shape group may be pinned. Enforced by a partial unique index that only
-- includes rows where is_master_reference = TRUE. COALESCE is used on the
-- nullable shape-key columns so NULL values collide as equal (Postgres
-- otherwise treats NULL as distinct, which would allow two pinned rows in
-- a group where capacity_ml is NULL).

ALTER TABLE public.best_bottles_pipeline_groups
  ADD COLUMN IF NOT EXISTS is_master_reference BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_best_bottles_pipeline_one_master_per_shape
  ON public.best_bottles_pipeline_groups (
    organization_id,
    family,
    COALESCE(capacity_ml, -1),
    COALESCE(thread_size, '')
  )
  WHERE is_master_reference = TRUE;

COMMENT ON COLUMN public.best_bottles_pipeline_groups.is_master_reference IS
  'Operator-pinned master reference row for its shape group. At most one row per (org, family, capacity_ml, thread_size) may have this set. When set, the Pipeline Launch button uses this row''s legacy_hero_image_url as the master reference for Consistency Mode; otherwise falls back to the first row in the group with a URL.';
