-- Backfill axis-1 lineage tags on the existing Best Bottles library.
--
-- Context: docs/BEST-BOTTLES-IMAGE-PIPELINE-BRIEF.md §0/§1 + UI target #2. The
-- two-axis model separates LINEAGE (axis 1: what reference an image was made
-- from) from QUALITY (axis 2: status:approved-keep). The Image Library now has a
-- "Clean / new" vs "Legacy" filter driven by `reference-lineage:*` tags, but the
-- ~2,274 existing generations carry no lineage tag yet. This stamps them
-- `reference-lineage:legacy` so the Legacy/All views are durable rather than
-- inferred.
--
-- Scope: the Best Bottles org only. Within it the library is 2,274 generations +
-- 642 keeper-backfill imports (brief §1). We tag the generations legacy and
-- leave the keepers as keepers (they are detected by their keeper-backfill tag /
-- brand_context_used.source and shown with their own "Keeper import" badge; the
-- filter already groups them on the legacy side).
--
-- Guardrails honored (brief §8): reclassify, never wipe. This ONLY appends a tag
-- to legacy generations. It does NOT touch keepers, does NOT touch clean work
-- (there is none yet — the clean count must start at 0), does NOT delete or
-- archive anything, and does NOT write any quality (status:*) verdict — that is
-- Cowork's reviewed-artifact lane.
--
-- Idempotent: re-running is a no-op because already-legacy / already-clean rows
-- are excluded. Reversible: to undo, run
--   UPDATE public.generated_images
--     SET library_tags = array_remove(library_tags, 'reference-lineage:legacy')
--   WHERE organization_id = '4ab1ac72-cd7e-4faf-9152-5aa5f2862411';
--
-- DRY RUN (run this SELECT before applying to preview the affected count):
--   SELECT count(*) FROM public.generated_images
--   WHERE organization_id = '4ab1ac72-cd7e-4faf-9152-5aa5f2862411'
--     AND NOT (library_tags @> ARRAY['reference-lineage:legacy'])
--     AND NOT (library_tags @> ARRAY['reference-lineage:clean'])
--     AND NOT EXISTS (SELECT 1 FROM unnest(library_tags) AS t WHERE t LIKE 'keeper-backfill%')
--     AND coalesce(brand_context_used->>'source', '') <> 'keeper-backfill';

DO $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.generated_images
  SET library_tags = array_append(library_tags, 'reference-lineage:legacy')
  WHERE organization_id = '4ab1ac72-cd7e-4faf-9152-5aa5f2862411'
    -- not already tagged on either lineage axis (idempotent + never demote clean)
    AND NOT (library_tags @> ARRAY['reference-lineage:legacy'])
    AND NOT (library_tags @> ARRAY['reference-lineage:clean'])
    -- exclude keeper-backfill imports (kept as their own bucket)
    AND NOT EXISTS (
      SELECT 1 FROM unnest(library_tags) AS t WHERE t LIKE 'keeper-backfill%'
    )
    AND coalesce(brand_context_used->>'source', '') <> 'keeper-backfill';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'reference-lineage:legacy backfill tagged % Best Bottles images', affected;
END $$;
