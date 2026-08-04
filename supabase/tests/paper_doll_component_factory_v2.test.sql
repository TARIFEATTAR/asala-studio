\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(28);

SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

SELECT ok(
  (
    SELECT count(*) = 11
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY (ARRAY[
        'paper_doll_candidate_requests',
        'paper_doll_candidate_attempts',
        'paper_doll_component_candidates',
        'paper_doll_approval_events',
        'paper_doll_factory_placement_versions',
        'paper_doll_factory_placement_plates',
        'paper_doll_release_heads',
        'paper_doll_release_head_events',
        'paper_doll_release_cuts',
        'paper_doll_release_cut_assets',
        'paper_doll_sanity_syncs'
      ])
  ),
  'all component-factory lifecycle tables exist'
);

SELECT ok(
  (
    SELECT count(*) = 11 AND bool_and(c.relrowsecurity)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (ARRAY[
        'paper_doll_candidate_requests',
        'paper_doll_candidate_attempts',
        'paper_doll_component_candidates',
        'paper_doll_approval_events',
        'paper_doll_factory_placement_versions',
        'paper_doll_factory_placement_plates',
        'paper_doll_release_heads',
        'paper_doll_release_head_events',
        'paper_doll_release_cuts',
        'paper_doll_release_cut_assets',
        'paper_doll_sanity_syncs'
      ])
  ),
  'RLS is enabled on all component-factory lifecycle tables'
);

SELECT ok(
  (
    SELECT count(*) = 11
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'paper_doll_%'
      AND tablename = ANY (ARRAY[
        'paper_doll_candidate_requests',
        'paper_doll_candidate_attempts',
        'paper_doll_component_candidates',
        'paper_doll_approval_events',
        'paper_doll_factory_placement_versions',
        'paper_doll_factory_placement_plates',
        'paper_doll_release_heads',
        'paper_doll_release_head_events',
        'paper_doll_release_cuts',
        'paper_doll_release_cut_assets',
        'paper_doll_sanity_syncs'
      ])
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
      AND qual LIKE '%is_organization_member%'
  ),
  'each lifecycle table has an organization-member read policy'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = ANY (ARRAY[
        'paper_doll_candidate_requests',
        'paper_doll_candidate_attempts',
        'paper_doll_component_candidates',
        'paper_doll_approval_events',
        'paper_doll_factory_placement_versions',
        'paper_doll_factory_placement_plates',
        'paper_doll_release_heads',
        'paper_doll_release_head_events',
        'paper_doll_release_cuts',
        'paper_doll_release_cut_assets',
        'paper_doll_sanity_syncs'
      ])
      AND grantee = 'authenticated'
      AND privilege_type <> 'SELECT'
  ),
  'authenticated clients receive no lifecycle write privileges'
);

INSERT INTO public.organizations (id, name, slug)
VALUES
  ('61000000-0000-4000-8000-000000000001', 'Factory Fixture Org', 'factory-fixture-org'),
  ('61000000-0000-4000-8000-000000000002', 'Factory Other Org', 'factory-other-org');

INSERT INTO public.paper_doll_components (
  id, organization_id, component_key, geometry_family_id, slot, display_name
) VALUES (
  '62000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  'closure__17-415__rollon-overcap__SGLD',
  'closure__17-415__rollon-overcap__v2',
  'cap',
  'Shiny gold roll-on cap'
);

INSERT INTO public.paper_doll_component_versions (
  id, organization_id, component_id, version_key, material_variant,
  image_path, image_sha256, geometry_mask_path, geometry_mask_sha256,
  width_px, height_px, alpha_bounds, mount_axis_x_px, seat_y_px, approval_status
) VALUES (
  '63000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  'authority-v1', 'shiny-gold', 'authority.png', repeat('a', 64),
  'authority-mask.png', repeat('b', 64), 2080, 2288,
  '{"left":124,"top":187,"right":1275,"bottom":1867}', 1041, 1002, 'approved'
);

INSERT INTO public.paper_doll_candidate_requests (
  id, organization_id, request_key, family_key, component_id, variant_key,
  original_filename, provider, model, prompt_sha256, request_payload, requested_by
) VALUES (
  '64000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  'CYL9:SGLD:source-a', 'CYL-9ML',
  '62000000-0000-4000-8000-000000000001', 'SGLD',
  'physical-gold-cap.jpg', 'openai', 'gpt-image-2', repeat('c', 64), '{}',
  '65000000-0000-4000-8000-000000000001'
);

SELECT is(
  (
    SELECT original_filename
    FROM public.paper_doll_candidate_requests
    WHERE id = '64000000-0000-4000-8000-000000000001'
  ),
  'physical-gold-cap.jpg',
  'candidate request preserves the original filename'
);

SELECT throws_ok(
  $$
    INSERT INTO public.paper_doll_candidate_requests (
      organization_id, request_key, family_key, component_id, variant_key,
      original_filename, provider, model, request_payload, requested_by
    ) VALUES (
      '61000000-0000-4000-8000-000000000001',
      'CYL9:SGLD:source-a', 'CYL-9ML',
      '62000000-0000-4000-8000-000000000001', 'SGLD',
      'physical-gold-cap.jpg', 'openai', 'gpt-image-2', '{}',
      '65000000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  NULL,
  'request_key makes candidate queue insertion idempotent'
);

SELECT is(
  (SELECT id::text FROM public.paper_doll_claim_candidate_request(
    '61000000-0000-4000-8000-000000000001', 'worker-a'
  )),
  '64000000-0000-4000-8000-000000000001',
  'worker claims the queued request'
);

SELECT is(
  (SELECT id::text FROM public.paper_doll_claim_candidate_request(
    '61000000-0000-4000-8000-000000000001', 'worker-a'
  )),
  '64000000-0000-4000-8000-000000000001',
  'repeated worker claim returns the same active request'
);

SELECT throws_ok(
  $$UPDATE public.paper_doll_candidate_requests SET request_status = 'queued'
    WHERE id = '64000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Invalid paper-doll candidate request transition: claimed -> queued',
  'candidate request cannot skip the terminal attempt outcome'
);

INSERT INTO public.paper_doll_candidate_attempts (
  id, organization_id, request_id, attempt_number, attempt_status,
  worker_id, provider_request_id, result, error_message, completed_at
) VALUES (
  '66000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000001', 1, 'succeeded',
  'worker-a', 'provider-request-1', '{"ok":true}', NULL, now()
);

SELECT throws_ok(
  $$UPDATE public.paper_doll_candidate_attempts SET result = '{"changed":true}'
    WHERE id = '66000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Completed paper-doll candidate attempts are immutable',
  'successful attempt history cannot be overwritten'
);

SELECT throws_ok(
  $$
    INSERT INTO public.paper_doll_candidate_attempts (
      organization_id, request_id, attempt_number, attempt_status, worker_id,
      completed_at
    ) VALUES (
      '61000000-0000-4000-8000-000000000002',
      '64000000-0000-4000-8000-000000000001', 2, 'failed', 'worker-b', now()
    )
  $$,
  '23503',
  NULL,
  'candidate attempt organization must match its request'
);

INSERT INTO public.paper_doll_component_candidates (
  id, organization_id, request_id, attempt_id, component_id, variant_key,
  original_filename, source_path, source_sha256, normalized_path,
  normalized_sha256, layer_path, layer_sha256, authority_mask_path,
  authority_mask_sha256, source_bounds, edit_bounds, authority_bounds,
  placement_bounds, provider, model, qa, lifecycle_state
) VALUES (
  '67000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001', 'SGLD',
  'physical-gold-cap.jpg', 'raw/source', repeat('d', 64),
  'candidates/gold.png', repeat('e', 64), 'layers/gold.png', repeat('f', 64),
  'authority-mask.png', repeat('b', 64),
  '{"left":29,"top":24,"width":980,"height":1461}',
  '{"left":29,"top":24,"width":980,"height":1461}',
  '{"left":124,"top":187,"width":1152,"height":1681}',
  '{"left":869,"top":500,"width":344,"height":502}',
  'openai', 'gpt-image-2',
  '{"geometryLocked":true,"minIoU":1,"mismatchedPixels":0}', 'candidate'
);

SELECT throws_ok(
  $$UPDATE public.paper_doll_component_candidates SET lifecycle_state = 'placement-locked'
    WHERE id = '67000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Invalid paper-doll candidate lifecycle transition: candidate -> placement-locked',
  'candidate lifecycle cannot skip approval stages'
);

UPDATE public.paper_doll_component_candidates
SET lifecycle_state = 'pixels-approved'
WHERE id = '67000000-0000-4000-8000-000000000001';

SELECT throws_ok(
  $$UPDATE public.paper_doll_component_candidates SET source_sha256 = repeat('1', 64)
    WHERE id = '67000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Pixel-approved paper-doll candidate evidence is immutable',
  'pixel approval freezes candidate evidence'
);

INSERT INTO public.paper_doll_approval_events (
  id, organization_id, candidate_id, action, approver_user_id,
  approver_display_name, approval_note
) VALUES (
  '68000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  '67000000-0000-4000-8000-000000000001', 'pixels-approved',
  '65000000-0000-4000-8000-000000000001', 'Jordan Richter', 'Approved pixels'
);

SELECT throws_ok(
  $$UPDATE public.paper_doll_approval_events SET approval_note = 'changed'$$,
  'P0001',
  'Paper-doll approval events are append-only',
  'approval history is append-only'
);

INSERT INTO public.paper_doll_factory_placement_versions (
  id, organization_id, family_key, geometry_family_id, version_number,
  width_px, center_x_px, seat_y_px, placement_bounds,
  authority_mask_sha256, placement_status, locked_by_user_id,
  locked_by_display_name, lock_note, locked_at
) VALUES (
  '69000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001', 'CYL-9ML',
  'closure__17-415__rollon-overcap__v2', 1, 344, 1041, 1002,
  '{"left":869,"top":500,"width":344,"height":502}', repeat('b', 64),
  'locked', '65000000-0000-4000-8000-000000000001',
  'Jordan Richter', 'Approved five-body family fit', now()
);

INSERT INTO public.paper_doll_factory_placement_plates (
  organization_id, placement_version_id, body_variant_key,
  body_component_version_id, adjustment
) VALUES (
  '61000000-0000-4000-8000-000000000001',
  '69000000-0000-4000-8000-000000000001', 'AMB',
  '63000000-0000-4000-8000-000000000001',
  '{"deltaX":0,"deltaY":0,"scale":1}'
);

UPDATE public.paper_doll_component_candidates
SET lifecycle_state = 'family-fit-approved'
WHERE id = '67000000-0000-4000-8000-000000000001';

UPDATE public.paper_doll_component_candidates
SET lifecycle_state = 'placement-locked'
WHERE id = '67000000-0000-4000-8000-000000000001';

SELECT throws_ok(
  $$UPDATE public.paper_doll_factory_placement_versions SET width_px = 345
    WHERE id = '69000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Locked paper-doll placement versions are immutable',
  'locked shared placement is immutable'
);

SELECT throws_ok(
  $$UPDATE public.paper_doll_factory_placement_plates SET adjustment = '{"deltaX":1,"deltaY":0,"scale":1}'$$,
  'P0001',
  'Plates belonging to a locked paper-doll placement are immutable',
  'locked per-body placement evidence is immutable'
);

INSERT INTO public.paper_doll_release_cuts (
  id, organization_id, family_key, release_version, validation_status,
  manifest, manifest_sha256, approved_by_user_id, approved_by_display_name,
  approval_note
) VALUES
  (
    '70000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001', 'CYL-9ML', '2.0.0-draft.1',
    'draft', '{"cut":1}', repeat('1', 64),
    '65000000-0000-4000-8000-000000000001', 'Jordan Richter', 'Draft fixture'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000001', 'CYL-9ML', '2.0.0',
    'validated', '{"cut":2}', repeat('2', 64),
    '65000000-0000-4000-8000-000000000001', 'Jordan Richter', 'Validated fixture'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '61000000-0000-4000-8000-000000000001', 'CYL-9ML', '2.0.1',
    'validated', '{"cut":3}', repeat('3', 64),
    '65000000-0000-4000-8000-000000000001', 'Jordan Richter', 'Second validated fixture'
  );

SELECT throws_ok(
  $$
    INSERT INTO public.paper_doll_release_heads (
      organization_id, family_key, current_release_cut_id
    ) VALUES (
      '61000000-0000-4000-8000-000000000001', 'CYL-9ML',
      '70000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'Release head must reference a validated release cut',
  'release head rejects an unvalidated cut'
);

INSERT INTO public.paper_doll_release_heads (
  id, organization_id, family_key, current_release_cut_id
) VALUES (
  '71000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001', 'CYL-9ML',
  '70000000-0000-4000-8000-000000000002'
);

SELECT throws_ok(
  $$
    INSERT INTO public.paper_doll_release_heads (
      organization_id, family_key, current_release_cut_id
    ) VALUES (
      '61000000-0000-4000-8000-000000000001', 'CYL-9ML',
      '70000000-0000-4000-8000-000000000003'
    )
  $$,
  '23505',
  NULL,
  'only one current release head exists per organization and family'
);

SELECT throws_ok(
  $$UPDATE public.paper_doll_release_heads
    SET current_release_cut_id = '70000000-0000-4000-8000-000000000003'$$,
  'P0001',
  'Release heads may only advance through the audited compare-and-swap function',
  'direct release-head mutation is rejected'
);

SELECT is(
  public.paper_doll_advance_release_head(
    '61000000-0000-4000-8000-000000000001', 'CYL-9ML',
    '70000000-0000-4000-8000-000000000003', 0,
    '65000000-0000-4000-8000-000000000001', 'Jordan Richter', 'Advance fixture'
  )::text,
  '71000000-0000-4000-8000-000000000001',
  'audited compare-and-swap advances the release head'
);

SELECT ok(
  (SELECT revision = 1 AND current_release_cut_id = '70000000-0000-4000-8000-000000000003'
   FROM public.paper_doll_release_heads
   WHERE id = '71000000-0000-4000-8000-000000000001')
  AND
  (SELECT count(*) = 1 FROM public.paper_doll_release_head_events
   WHERE release_head_id = '71000000-0000-4000-8000-000000000001'),
  'head advancement writes one immutable audit event'
);

SELECT throws_ok(
  $$UPDATE public.paper_doll_release_head_events SET action_note = 'changed'$$,
  'P0001',
  'Paper-doll release-head events are append-only',
  'release-head audit events are append-only'
);

SELECT throws_ok(
  $$SELECT public.paper_doll_advance_release_head(
    '61000000-0000-4000-8000-000000000001', 'CYL-9ML',
    '70000000-0000-4000-8000-000000000002', 0,
    '65000000-0000-4000-8000-000000000001', 'Jordan Richter', 'Stale fixture'
  )$$,
  'P0001',
  'Release head compare-and-swap conflict',
  'stale release-head revision is rejected'
);

SELECT throws_ok(
  $$
    INSERT INTO public.paper_doll_release_cuts (
      organization_id, family_key, release_version, validation_status,
      manifest, manifest_sha256, approved_by_user_id,
      approved_by_display_name, approval_note
    ) VALUES (
      '61000000-0000-4000-8000-000000000001', 'CYL-9ML', 'duplicate-sha',
      'validated', '{"duplicate":true}', repeat('2', 64),
      '65000000-0000-4000-8000-000000000001', 'Jordan Richter', 'Duplicate fixture'
    )
  $$,
  '23505',
  NULL,
  'release cuts are idempotent by family manifest hash'
);

SELECT throws_ok(
  $$UPDATE public.paper_doll_release_cuts SET manifest = '{"changed":true}'
    WHERE id = '70000000-0000-4000-8000-000000000003'$$,
  'P0001',
  'Paper-doll release cuts are append-only',
  'release-cut manifests are append-only'
);

INSERT INTO public.paper_doll_release_cut_assets (
  organization_id, release_cut_id, component_candidate_id,
  component_version_id, placement_version_id, slot, variant_key,
  source_bounds, edit_bounds, authority_bounds, placement_bounds
) VALUES (
  '61000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000003',
  '67000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000001',
  '69000000-0000-4000-8000-000000000001',
  'cap', 'SGLD',
  '{"left":29,"top":24,"width":980,"height":1461}',
  '{"left":29,"top":24,"width":980,"height":1461}',
  '{"left":124,"top":187,"width":1152,"height":1681}',
  '{"left":869,"top":500,"width":344,"height":502}'
);

SELECT throws_ok(
  $$DELETE FROM public.paper_doll_release_cut_assets$$,
  'P0001',
  'Paper-doll release-cut assets are append-only',
  'release-cut membership is append-only'
);

INSERT INTO public.paper_doll_sanity_syncs (
  id, organization_id, release_cut_id, sanity_document_id,
  sync_action, sync_status, request_sha256, approved_by_user_id,
  approved_by_display_name, approval_note, completed_at
) VALUES
  (
    '72000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000003',
    'drafts.d5291f24-f02b-4fb7-aa99-78c5f63d8c9d', 'draft', 'success',
    repeat('4', 64), '65000000-0000-4000-8000-000000000001',
    'Jordan Richter', 'Draft only', now()
  ),
  (
    '72000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000003',
    'd5291f24-f02b-4fb7-aa99-78c5f63d8c9d', 'public', 'queued',
    repeat('5', 64), '65000000-0000-4000-8000-000000000001',
    'Jordan Richter', 'Separate public action', NULL
  );

SELECT ok(
  (SELECT count(DISTINCT sync_action) = 2
   FROM public.paper_doll_sanity_syncs
   WHERE release_cut_id = '70000000-0000-4000-8000-000000000003'),
  'Sanity draft and public publication are separate named actions'
);

SELECT throws_ok(
  $$UPDATE public.paper_doll_sanity_syncs SET result = '{"changed":true}'
    WHERE id = '72000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Successful paper-doll Sanity syncs are immutable',
  'successful Sanity sync history is immutable'
);

SELECT * FROM finish();

ROLLBACK;
