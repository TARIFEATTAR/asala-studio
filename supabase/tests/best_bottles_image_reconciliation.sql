\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT COALESCE(condition, false) THEN
    RAISE EXCEPTION 'assertion failed: %', message;
  END IF;
END;
$$;

INSERT INTO public.organizations (id, name, slug)
VALUES
  ('00000000-0000-4000-8000-000000000101', 'Reconciliation Test Org', 'reconciliation-test-org'),
  ('00000000-0000-4000-8000-000000000102', 'Other Reconciliation Org', 'other-reconciliation-test-org');

INSERT INTO public.generated_images (
  id,
  organization_id,
  user_id,
  goal_type,
  aspect_ratio,
  final_prompt,
  image_url,
  library_tags
)
VALUES
  (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000901',
    'best-bottles-master',
    '10:11',
    'fixture prompt shared image',
    'https://example.invalid/shared.png',
    ARRAY['brand:best-bottles', 'status:unreviewed']::text[]
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000901',
    'best-bottles-master',
    '10:11',
    'fixture prompt replacement image',
    'https://example.invalid/replacement.png',
    ARRAY['brand:best-bottles', 'status:unreviewed']::text[]
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000902',
    'best-bottles-master',
    '10:11',
    'fixture prompt cross organization image',
    'https://example.invalid/cross-org.png',
    ARRAY['brand:best-bottles', 'status:unreviewed']::text[]
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000901',
    'best-bottles-master',
    '10:11',
    'fixture prompt model shadow image',
    'https://example.invalid/model-shadow.png',
    ARRAY['brand:best-bottles', 'status:unreviewed']::text[]
  );

INSERT INTO public.best_bottles_pipeline_sku_jobs (
  id,
  organization_id,
  product_group_slug,
  family,
  grace_sku,
  website_sku,
  status
)
VALUES
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000101',
    'fixture-family-a',
    'Fixture Family',
    'SKU-A',
    'WEB-A',
    'ready-to-generate'
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000101',
    'fixture-family-b',
    'Fixture Family',
    'SKU-B',
    'WEB-B',
    'ready-to-generate'
  ),
  (
    '00000000-0000-4000-8000-000000000303',
    '00000000-0000-4000-8000-000000000101',
    'fixture-family-c',
    'Fixture Family',
    'SKU-C',
    'WEB-C',
    'ready-to-generate'
  ),
  (
    '00000000-0000-4000-8000-000000000304',
    '00000000-0000-4000-8000-000000000101',
    'fixture-family-d',
    'Fixture Family',
    'SKU-D',
    'WEB-D',
    'ready-to-generate'
  );

INSERT INTO public.best_bottles_image_reconciliations (
  image_id,
  organization_id,
  grace_sku,
  website_sku,
  family,
  catalog_truth,
  raw_image_url,
  final_image_url,
  canvas_width_px,
  canvas_height_px,
  detected_baseline_y_px,
  target_baseline_y_px,
  fill_height_pct,
  center_x_pct,
  target_center_x_pct,
  center_delta_pct,
  framing_decision,
  qa_issues,
  lifecycle_state,
  shadow_owner,
  shadow_qa
)
VALUES
  (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000101',
    'SKU-A',
    'WEB-A',
    'Fixture Family',
    '{
      "graceSku":"SKU-A",
      "websiteSku":"WEB-A",
      "eligibleGraceSkus":["SKU-A","SKU-B"],
      "eligibleWebsiteSkus":["WEB-A","WEB-B"],
      "identityStatus":"ready",
      "identityBlockers":[],
      "websiteTruthStatus":"ready",
      "heightWithoutCap":"70 mm",
      "diameter":"20 mm"
    }'::jsonb,
    'https://example.invalid/shared-raw.png',
    'https://example.invalid/shared.png',
    2080,
    2288,
    2105,
    2105,
    82.25,
    50.0,
    50.0,
    0.0,
    'pass',
    '{}'::text[],
    'qa-passed',
    'rig',
    NULL
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000101',
    'SKU-A',
    'WEB-A',
    'Fixture Family',
    '{"graceSku":"SKU-A","eligibleGraceSkus":["SKU-A"]}'::jsonb,
    'https://example.invalid/replacement-raw.png',
    'https://example.invalid/replacement.png',
    2080,
    2288,
    NULL,
    NULL,
    82.25,
    50.0,
    50.0,
    0.0,
    'pass',
    '{}'::text[],
    'qa-passed',
    'rig',
    NULL
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000102',
    'SKU-A',
    'WEB-A',
    'Fixture Family',
    '{
      "graceSku":"SKU-A",
      "eligibleGraceSkus":["SKU-A"],
      "identityStatus":"ready",
      "identityBlockers":[],
      "websiteTruthStatus":"ready",
      "heightWithoutCap":"70 mm",
      "diameter":"20 mm"
    }'::jsonb,
    'https://example.invalid/cross-org-raw.png',
    'https://example.invalid/cross-org.png',
    2080,
    2288,
    2105,
    2105,
    82.25,
    50.0,
    50.0,
    0.0,
    'pass',
    '{}'::text[],
    'qa-passed',
    'rig',
    NULL
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000101',
    'SKU-D',
    'WEB-D',
    'Fixture Family',
    '{
      "graceSku":"SKU-D",
      "websiteSku":"WEB-D",
      "eligibleGraceSkus":["SKU-D"],
      "identityStatus":"ready",
      "identityBlockers":[],
      "websiteTruthStatus":"ready",
      "heightWithoutCap":"70 mm",
      "diameter":"20 mm"
    }'::jsonb,
    'https://example.invalid/model-shadow-raw.png',
    'https://example.invalid/model-shadow.png',
    2080,
    2288,
    2105,
    2105,
    82.25,
    50.0,
    50.0,
    0.0,
    'pass',
    '{}'::text[],
    'qa-passed',
    'model',
    '{
      "status":"review",
      "failures":[],
      "warnings":[],
      "measurements":{"contactGapPx":0,"contactCoreDensity":0.36,"rightExtensionPx":18,"rightExtensionRatio":0.28,"leftExtensionPx":2,"verticalDepthPx":8,"componentCount":1,"shadowPixelCount":120},
      "target":{"maxContactGapPx":2,"rightExtensionRatio":{"min":0.2,"max":0.3},"contract":"contact-back-right-v1"}
    }'::jsonb
  );

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.best_bottles_image_reconciliations
    WHERE image_id = '00000000-0000-4000-8000-000000000201'
      AND organization_id = '00000000-0000-4000-8000-000000000101'
  ),
  'image evidence was not inserted for its organization'
);

SELECT public.link_best_bottles_generated_image(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201'
);
SELECT public.link_best_bottles_generated_image(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000201'
);
SELECT public.link_best_bottles_generated_image(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000202'
);
SELECT public.link_best_bottles_generated_image(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000304',
  '00000000-0000-4000-8000-000000000204'
);

SELECT pg_temp.assert_true(
  (SELECT shadow_owner = 'model' AND shadow_qa->>'status' = 'review'
   FROM public.best_bottles_image_reconciliation_status
   WHERE image_id = '00000000-0000-4000-8000-000000000204'),
  'model-owned shadow evidence was not durable'
);
SELECT pg_temp.assert_true(
  (SELECT reconciliation_status = 'review-pending'
   FROM public.best_bottles_image_reconciliation_status
   WHERE image_id = '00000000-0000-4000-8000-000000000204'),
  'model-owned review evidence did not block status'
);

DO $$
DECLARE
  rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.approve_best_bottles_reconciled_image(
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000304',
      '00000000-0000-4000-8000-000000000204'
    );
  EXCEPTION WHEN OTHERS THEN
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'assertion failed: model-owned shadow review was approved';
  END IF;
END;
$$;

UPDATE public.best_bottles_image_reconciliations
SET shadow_qa = jsonb_set(shadow_qa, '{status}', '"pass"'::jsonb)
WHERE image_id = '00000000-0000-4000-8000-000000000204';

SELECT public.approve_best_bottles_reconciled_image(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000304',
  '00000000-0000-4000-8000-000000000204'
);

SELECT pg_temp.assert_true(
  (SELECT shadow_owner = 'rig' AND shadow_qa IS NULL
   FROM public.best_bottles_image_reconciliation_status
   WHERE image_id = '00000000-0000-4000-8000-000000000201'),
  'legacy rig-owned evidence was not compatible with null shadow QA'
);

SELECT pg_temp.assert_true(
  (SELECT count(*) = 2
   FROM public.best_bottles_pipeline_sku_images
   WHERE image_id = '00000000-0000-4000-8000-000000000201'),
  'explicitly eligible shared image did not retain both SKU assignments'
);

DO $$
DECLARE
  rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.link_best_bottles_generated_image(
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000303',
      '00000000-0000-4000-8000-000000000201'
    );
  EXCEPTION WHEN OTHERS THEN
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'assertion failed: unlisted SKU was accepted';
  END IF;
END;
$$;

DO $$
DECLARE
  rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.link_best_bottles_generated_image(
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000301',
      '00000000-0000-4000-8000-000000000203'
    );
  EXCEPTION WHEN OTHERS THEN
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'assertion failed: cross-organization image was accepted';
  END IF;
END;
$$;

DO $$
DECLARE
  rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.approve_best_bottles_reconciled_image(
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000301',
      '00000000-0000-4000-8000-000000000202'
    );
  EXCEPTION WHEN OTHERS THEN
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'assertion failed: incomplete product truth and geometry passed approval';
  END IF;
END;
$$;

SELECT public.approve_best_bottles_reconciled_image(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201'
);
SELECT public.approve_best_bottles_reconciled_image(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000201'
);

UPDATE public.best_bottles_pipeline_sku_jobs
SET status = 'synced',
    shopify_media_id = 'gid://shopify/MediaImage/fixture-a',
    shopify_image_url = 'https://cdn.shopify.invalid/shared.png',
    shopify_pushed_at = now(),
    convex_synced_at = now()
WHERE id IN (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000302'
);

SELECT pg_temp.assert_true(
  (SELECT reconciliation_status = 'shopify-verification-pending' AND NOT is_reconciled
   FROM public.best_bottles_image_reconciliation_status
   WHERE image_id = '00000000-0000-4000-8000-000000000201'),
  'write receipts without read-back did not remain verification-pending'
);

SELECT pg_temp.assert_true(
  NOT has_function_privilege(
    'authenticated',
    'public.record_best_bottles_destination_verification(uuid,uuid,uuid,text,text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated role can forge destination verification'
);
SELECT pg_temp.assert_true(
  NOT has_table_privilege('authenticated', 'public.best_bottles_pipeline_sku_images', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.best_bottles_pipeline_sku_images', 'UPDATE'),
  'authenticated role can directly mutate assignment verification evidence'
);
SELECT pg_temp.assert_true(
  NOT has_table_privilege('anon', 'public.best_bottles_image_reconciliations', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.best_bottles_image_reconciliations', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.best_bottles_pipeline_sku_images', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.best_bottles_image_reconciliation_status', 'SELECT'),
  'anonymous role retained reconciliation table or view privileges'
);
SELECT pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.best_bottles_image_reconciliations', 'SELECT')
  AND has_table_privilege('authenticated', 'public.best_bottles_image_reconciliations', 'INSERT')
  AND has_table_privilege('authenticated', 'public.best_bottles_image_reconciliations', 'UPDATE')
  AND has_table_privilege('authenticated', 'public.best_bottles_image_reconciliations', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.best_bottles_image_reconciliations', 'TRUNCATE')
  AND has_table_privilege('authenticated', 'public.best_bottles_pipeline_sku_images', 'SELECT')
  AND has_table_privilege('authenticated', 'public.best_bottles_image_reconciliation_status', 'SELECT'),
  'authenticated reconciliation privileges do not match the intended contract'
);
SELECT pg_temp.assert_true(
  NOT has_function_privilege('anon', 'public.best_bottles_reconciliation_touch_updated_at()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.best_bottles_reconciliation_touch_updated_at()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.validate_best_bottles_image_reconciliation_org()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.validate_best_bottles_image_reconciliation_org()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.validate_best_bottles_sku_image_assignment_org()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.validate_best_bottles_sku_image_assignment_org()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.sync_best_bottles_image_assignment_from_sku_job()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.sync_best_bottles_image_assignment_from_sku_job()', 'EXECUTE'),
  'API roles retained execute access to internal reconciliation functions'
);

SELECT public.record_best_bottles_destination_verification(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201',
  'shopify',
  'matched',
  'https://cdn.shopify.invalid/shared.png',
  NULL,
  NULL
);
SELECT public.record_best_bottles_destination_verification(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201',
  'convex',
  'matched',
  'https://cdn.shopify.invalid/shared.png',
  NULL,
  NULL
);
SELECT public.record_best_bottles_destination_verification(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000201',
  'shopify',
  'matched',
  'https://cdn.shopify.invalid/shared.png',
  NULL,
  NULL
);
SELECT public.record_best_bottles_destination_verification(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000201',
  'convex',
  'mismatch',
  'https://cdn.shopify.invalid/wrong.png',
  NULL,
  'fixture mismatch'
);

SELECT pg_temp.assert_true(
  (SELECT assignment_count = 2
      AND any_destination_mismatch
      AND reconciliation_status = 'destination-mismatch'
      AND NOT is_reconciled
   FROM public.best_bottles_image_reconciliation_status
   WHERE image_id = '00000000-0000-4000-8000-000000000201'),
  'aggregate view hid a failing assignment'
);

SELECT public.record_best_bottles_destination_verification(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000201',
  'convex',
  'matched',
  'https://cdn.shopify.invalid/shared.png',
  NULL,
  NULL
);

SELECT pg_temp.assert_true(
  (SELECT assignment_count = 2
      AND reconciliation_status = 'reconciled'
      AND is_reconciled
   FROM public.best_bottles_image_reconciliation_status
   WHERE image_id = '00000000-0000-4000-8000-000000000201'),
  'all verified active assignments did not reconcile the image'
);

UPDATE public.best_bottles_image_reconciliations
SET catalog_truth = '{
      "graceSku":"SKU-A",
      "websiteSku":"WEB-A",
      "eligibleGraceSkus":["SKU-A"],
      "eligibleWebsiteSkus":["WEB-A"],
      "identityStatus":"ready",
      "identityBlockers":[],
      "websiteTruthStatus":"ready",
      "heightWithoutCap":"70 mm",
      "diameter":"20 mm"
    }'::jsonb,
    detected_baseline_y_px = 2105,
    target_baseline_y_px = 2105,
    lifecycle_state = 'review-pending'
WHERE image_id = '00000000-0000-4000-8000-000000000202';

SELECT public.approve_best_bottles_reconciled_image(
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000202'
);

SELECT pg_temp.assert_true(
  (SELECT approved_image_id = '00000000-0000-4000-8000-000000000202'
   FROM public.best_bottles_pipeline_sku_jobs
   WHERE id = '00000000-0000-4000-8000-000000000301'),
  'replacement image was not recorded on the SKU job'
);
SELECT pg_temp.assert_true(
  (SELECT decision = 'superseded'
   FROM public.best_bottles_pipeline_sku_images
   WHERE sku_job_id = '00000000-0000-4000-8000-000000000301'
     AND image_id = '00000000-0000-4000-8000-000000000201'),
  'old approved assignment was not superseded'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) = 1
   FROM public.best_bottles_pipeline_sku_images
   WHERE sku_job_id = '00000000-0000-4000-8000-000000000301'
     AND decision = 'approved-keep'),
  'SKU job has more than one active approved image'
);

ROLLBACK;

\echo 'Best Bottles reconciliation lifecycle assertions passed.'
