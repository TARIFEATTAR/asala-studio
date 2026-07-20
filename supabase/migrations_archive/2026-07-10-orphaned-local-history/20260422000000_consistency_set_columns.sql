-- Consistency Mode (Bulk Variation Generation)
--
-- Adds grouping columns to generated_images so a "set" of related variations
-- (e.g. 5 bottle colors of the same BestBottles master) can be tracked and
-- displayed together in the Library.
--
-- All columns are nullable and have no default constraints, so the migration
-- is fully backward-compatible: existing single-image generations just leave
-- the new columns NULL. Rollback: drop the three columns + index.

ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS consistency_set_id UUID,
  ADD COLUMN IF NOT EXISTS variation_descriptor TEXT,
  ADD COLUMN IF NOT EXISTS set_position INTEGER;

-- Index the grouping column so Library queries filtering by set are fast
-- even as the table grows.
CREATE INDEX IF NOT EXISTS idx_generated_images_consistency_set
  ON public.generated_images (consistency_set_id)
  WHERE consistency_set_id IS NOT NULL;

-- Helpful composite for ordered retrieval of a full set.
CREATE INDEX IF NOT EXISTS idx_generated_images_consistency_set_position
  ON public.generated_images (consistency_set_id, set_position)
  WHERE consistency_set_id IS NOT NULL;

COMMENT ON COLUMN public.generated_images.consistency_set_id IS
  'Groups images produced together via Consistency Mode (bulk variation generation). NULL for single-image generations.';
COMMENT ON COLUMN public.generated_images.variation_descriptor IS
  'Short human-readable description of what varies for this image within a set (e.g. "amber glass, polished gold cap").';
COMMENT ON COLUMN public.generated_images.set_position IS
  'Ordering within a Consistency Mode set (0-indexed).';
