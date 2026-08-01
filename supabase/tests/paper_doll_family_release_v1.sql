\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(12);

SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

SELECT ok(
  (
    SELECT count(*) = 6
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY (ARRAY[
        'paper_doll_components',
        'paper_doll_component_versions',
        'paper_doll_qa_results',
        'paper_doll_family_releases',
        'paper_doll_family_release_assets',
        'paper_doll_publish_runs'
      ])
  ),
  'all six paper-doll release ledger tables exist'
);

SELECT ok(
  (
    SELECT count(*) = 6 AND bool_and(c.relrowsecurity)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (ARRAY[
        'paper_doll_components',
        'paper_doll_component_versions',
        'paper_doll_qa_results',
        'paper_doll_family_releases',
        'paper_doll_family_release_assets',
        'paper_doll_publish_runs'
      ])
  ),
  'RLS is enabled on all six ledger tables'
);

SELECT ok(
  (
    SELECT count(*) = 6
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'paper_doll_components',
        'paper_doll_component_versions',
        'paper_doll_qa_results',
        'paper_doll_family_releases',
        'paper_doll_family_release_assets',
        'paper_doll_publish_runs'
      ])
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
      AND qual LIKE '%is_organization_member%'
  ),
  'each table has one authenticated organization-member read policy'
);

INSERT INTO public.organizations (id, name, slug)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Paper Doll Fixture Org', 'paper-doll-fixture-org'),
  ('10000000-0000-4000-8000-000000000002', 'Paper Doll Other Org', 'paper-doll-other-org');

INSERT INTO public.paper_doll_components (
  id, organization_id, component_key, geometry_family_id, slot, display_name
) VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'body-clear', 'CYL-9ML', 'body', 'Clear body'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'body-frosted', 'CYL-9ML', 'body', 'Frosted body'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'body-swirl', 'CYL-9ML', 'body', 'Swirl body'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'body-amber', 'CYL-9ML', 'body', 'Amber body'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'body-cobalt', 'CYL-9ML', 'body', 'Cobalt body'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'cap-silver', 'closure__17-415__rollon-overcap__v1', 'cap', 'Silver cap'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'cap-matte-white', 'closure__17-415__rollon-overcap__v1', 'cap', 'Matte white cap'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 'cap-glossy-black', 'closure__17-415__rollon-overcap__v1', 'cap', 'Glossy black cap'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', 'cap-translucent', 'closure__17-415__rollon-overcap__v1', 'cap', 'Translucent cap');

CREATE OR REPLACE FUNCTION pg_temp.duplicate_component_is_rejected()
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.paper_doll_components (
    organization_id, component_key, geometry_family_id, slot, display_name
  ) VALUES (
    '10000000-0000-4000-8000-000000000001', 'body-clear', 'CYL-9ML', 'body', 'Duplicate'
  );
  RETURN false;
EXCEPTION WHEN unique_violation THEN RETURN true;
END;
$$;

SELECT ok(pg_temp.duplicate_component_is_rejected(), 'component_key is unique within an organization');

CREATE OR REPLACE FUNCTION pg_temp.component_org_mismatch_is_rejected()
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.paper_doll_component_versions (
    organization_id, component_id, version_key, material_variant,
    image_path, image_sha256, geometry_mask_path, geometry_mask_sha256,
    width_px, height_px, alpha_bounds, mount_axis_x_px, seat_y_px, approval_status
  ) VALUES (
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001', '1', 'clear-glass',
    'fixture.png', repeat('a', 64), NULL, NULL,
    2080, 2288, '{"left":1,"top":1,"right":2,"bottom":2}', 1040, 2100, 'candidate'
  );
  RETURN false;
EXCEPTION WHEN foreign_key_violation THEN RETURN true;
END;
$$;

SELECT ok(pg_temp.component_org_mismatch_is_rejected(), 'component version organization must match its component');

INSERT INTO public.paper_doll_component_versions (
  id, organization_id, component_id, version_key, material_variant,
  image_path, image_sha256, geometry_mask_path, geometry_mask_sha256,
  width_px, height_px, alpha_bounds, mount_axis_x_px, seat_y_px,
  approval_status, provenance
)
SELECT
  ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '1',
  CASE WHEN n <= 5 THEN 'glass' WHEN n = 6 THEN 'mirror-chrome' WHEN n = 7 THEN 'matte-white'
       WHEN n = 8 THEN 'glossy-black' ELSE 'translucent-frosted' END,
  'fixture-' || n || '.png',
  repeat(to_hex(n), 64),
  CASE WHEN n <= 5 THEN NULL ELSE 'closure-mask.png' END,
  CASE WHEN n <= 5 THEN NULL ELSE repeat('f', 64) END,
  2080, 2288,
  '{"left":860,"top":740,"right":1225,"bottom":2115}'::jsonb,
  1040, 750,
  CASE WHEN n = 9 THEN 'blocked' ELSE 'approved' END,
  jsonb_build_object('fixture', true)
FROM generate_series(1, 9) AS n;

INSERT INTO public.paper_doll_qa_results (
  id, organization_id, component_version_id, gate_key, gate_version,
  qa_status, blocking, calibrated_with, measurements, issues
)
SELECT
  ('40000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'fixture-gate', '1',
  CASE WHEN n = 9 THEN 'blocked' ELSE 'passed' END,
  true, ARRAY['fixture-calibration-' || n], jsonb_build_object('fixture', n),
  CASE WHEN n = 9 THEN ARRAY['assembly_context_required'] ELSE '{}'::text[] END
FROM generate_series(1, 9) AS n;

INSERT INTO public.paper_doll_family_releases (
  id, organization_id, family_key, release_version, release_status,
  canvas_width_px, canvas_height_px, background_hex,
  manifest, manifest_sha256, source_git_commit, renderer_version
) VALUES
  (
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'CYL-9ML', '1.0.0-draft.1', 'draft', 2080, 2288, '#F5F3EF',
    '{"schemaVersion":1,"fixture":true}', repeat('a', 64), 'fixture', 'fixture'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'CYL-9ML', '1.0.0-ready.1', 'ready', 2080, 2288, '#F5F3EF',
    '{"schemaVersion":1,"fixture":"ready"}', repeat('b', 64), 'fixture', 'fixture'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'CYL-9ML', '1.0.0', 'published', 2080, 2288, '#F5F3EF',
    '{"schemaVersion":1,"fixture":"published"}', repeat('c', 64), 'fixture', 'fixture'
  );

INSERT INTO public.paper_doll_family_release_assets (
  organization_id, release_id, component_version_id, slot, variant_key
)
SELECT
  '10000000-0000-4000-8000-000000000001'::uuid,
  '50000000-0000-4000-8000-000000000001'::uuid,
  ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  CASE WHEN n <= 5 THEN 'body' ELSE 'cap' END,
  CASE WHEN n <= 5 THEN 'body-' || n ELSE 'cap-' || n END
FROM generate_series(1, 9) AS n;

CREATE OR REPLACE FUNCTION pg_temp.duplicate_release_asset_is_rejected()
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.paper_doll_family_release_assets (
    organization_id, release_id, component_version_id, slot, variant_key
  ) VALUES (
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002', 'body', 'body-1'
  );
  RETURN false;
EXCEPTION WHEN unique_violation THEN RETURN true;
END;
$$;

SELECT ok(pg_temp.duplicate_release_asset_is_rejected(), 'release slot and variant membership is unique');

CREATE OR REPLACE FUNCTION pg_temp.release_asset_org_mismatch_is_rejected()
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.paper_doll_family_release_assets (
    organization_id, release_id, component_version_id, slot, variant_key
  ) VALUES (
    '10000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001', 'body', 'wrong-org'
  );
  RETURN false;
EXCEPTION WHEN foreign_key_violation THEN RETURN true;
END;
$$;

SELECT ok(pg_temp.release_asset_org_mismatch_is_rejected(), 'release asset organization matches release and component version');

CREATE OR REPLACE FUNCTION pg_temp.approved_version_is_immutable()
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.paper_doll_component_versions
  SET image_sha256 = repeat('9', 64),
      geometry_mask_sha256 = repeat('8', 64),
      material_variant = 'changed',
      alpha_bounds = '{"left":0,"top":0,"right":1,"bottom":1}',
      approval_status = 'rejected'
  WHERE id = '30000000-0000-4000-8000-000000000006';
  RETURN false;
EXCEPTION WHEN raise_exception THEN RETURN true;
END;
$$;

SELECT ok(pg_temp.approved_version_is_immutable(), 'approved component identity and approval state are immutable');

CREATE OR REPLACE FUNCTION pg_temp.qa_is_append_only()
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE update_blocked boolean := false; delete_blocked boolean := false;
BEGIN
  BEGIN
    UPDATE public.paper_doll_qa_results SET qa_status = 'failed'
    WHERE id = '40000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN raise_exception THEN update_blocked := true;
  END;
  BEGIN
    DELETE FROM public.paper_doll_qa_results
    WHERE id = '40000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN raise_exception THEN delete_blocked := true;
  END;
  RETURN update_blocked AND delete_blocked;
END;
$$;

SELECT ok(pg_temp.qa_is_append_only(), 'QA evidence rejects update and delete');

CREATE OR REPLACE FUNCTION pg_temp.locked_releases_are_immutable()
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE ready_blocked boolean := false; published_blocked boolean := false;
BEGIN
  BEGIN
    UPDATE public.paper_doll_family_releases
    SET release_version = 'changed', manifest_sha256 = repeat('d', 64)
    WHERE id = '50000000-0000-4000-8000-000000000002';
  EXCEPTION WHEN raise_exception THEN ready_blocked := true;
  END;
  BEGIN
    UPDATE public.paper_doll_family_releases
    SET release_version = 'changed-again', manifest_sha256 = repeat('e', 64)
    WHERE id = '50000000-0000-4000-8000-000000000003';
  EXCEPTION WHEN raise_exception THEN published_blocked := true;
  END;
  RETURN ready_blocked AND published_blocked;
END;
$$;

SELECT ok(pg_temp.locked_releases_are_immutable(), 'ready and published release identities are immutable');

SELECT ok(
  (SELECT count(*) = 9 FROM public.paper_doll_component_versions
    WHERE organization_id = '10000000-0000-4000-8000-000000000001')
  AND
  (SELECT count(*) = 9 FROM public.paper_doll_qa_results
    WHERE organization_id = '10000000-0000-4000-8000-000000000001')
  AND
  (SELECT count(*) = 9 FROM public.paper_doll_family_release_assets
    WHERE release_id = '50000000-0000-4000-8000-000000000001'),
  'service role can write five bodies, three approved caps, one blocked cap, QA, and a draft release'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name LIKE 'paper_doll_%'
      AND grantee = 'authenticated'
      AND privilege_type <> 'SELECT'
  ),
  'authenticated receives no ledger write privileges'
);

SELECT * FROM finish();

ROLLBACK;
