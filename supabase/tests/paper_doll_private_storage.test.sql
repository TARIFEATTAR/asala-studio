\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(6);

SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'paper-doll-authority'),
  FALSE,
  'authority bucket is private'
);
SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'paper-doll-candidates'),
  FALSE,
  'candidate bucket is private'
);
SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'paper-doll-releases'),
  FALSE,
  'release bucket is private'
);
SELECT is(
  (SELECT file_size_limit FROM storage.buckets WHERE id = 'paper-doll-candidates'),
  52428800::BIGINT,
  'candidate bucket has an explicit 50 MB limit'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'paper_doll_%'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ),
  'no authenticated paper-doll storage write policy exists'
);
SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN (
        'paper_doll_authority_select_org_members',
        'paper_doll_candidates_select_org_members',
        'paper_doll_releases_select_org_members'
      )
      AND cmd = 'SELECT'
  ),
  3,
  'all three buckets have organization-scoped read policies'
);

SELECT * FROM finish();
ROLLBACK;
