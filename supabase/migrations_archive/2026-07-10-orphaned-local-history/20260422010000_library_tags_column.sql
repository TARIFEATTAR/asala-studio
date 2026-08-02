-- Library Tags — durable curation for generated images.
--
-- Enables "hero" tagging (and future labels like "client-approved",
-- "published", "archived") on any generated image without requiring a new
-- column for each state. The array shape keeps the taxonomy open while
-- staying fast to query via a GIN index.
--
-- Fully additive, backward-compatible: existing rows default to an empty
-- array. Rollback: drop the column + index.

ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS library_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- GIN index supports fast "is this image a hero?" lookups via the array
-- containment operator, e.g.
--   SELECT * FROM generated_images WHERE library_tags @> ARRAY['hero'];
CREATE INDEX IF NOT EXISTS idx_generated_images_library_tags
  ON public.generated_images USING GIN (library_tags);

COMMENT ON COLUMN public.generated_images.library_tags IS
  'Durable curation tags on a generated image. Known values today: "hero" (featured render for a SKU / variation family). Free-form array for future labels like "client-approved", "published", "archived".';
