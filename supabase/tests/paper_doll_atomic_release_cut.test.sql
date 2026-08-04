\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

SELECT has_function(
  'public',
  'paper_doll_cut_release_atomic',
  ARRAY['uuid','text','text','jsonb','text','jsonb','bigint','uuid','text','text'],
  'atomic release-cut function exists'
);

INSERT INTO public.organizations (id, name, slug)
VALUES ('81000000-0000-4000-8000-000000000001', 'Atomic Cut Fixture', 'atomic-cut-fixture');

INSERT INTO public.paper_doll_components (
  id, organization_id, component_key, geometry_family_id, slot, display_name
) VALUES (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
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
  '83000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'authority-v1', 'shiny-gold', 'authority.png', repeat('e', 64),
  'authority-mask.png', repeat('b', 64), 2080, 2288,
  '{"left":869,"top":500,"right":1212,"bottom":1001}', 1041, 1002, 'approved'
);

INSERT INTO public.paper_doll_candidate_requests (
  id, organization_id, request_key, family_key, component_id, variant_key,
  original_filename, provider, model, request_payload, requested_by
) VALUES (
  '84000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  'CYL9:SGLD:atomic', 'CYL-9ML',
  '82000000-0000-4000-8000-000000000001', 'SGLD',
  'gold-cap.png', 'manual', 'manual-v1', '{}',
  '85000000-0000-4000-8000-000000000001'
);

INSERT INTO public.paper_doll_candidate_attempts (
  id, organization_id, request_id, attempt_number, attempt_status,
  worker_id, result, completed_at
) VALUES (
  '86000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001', 1, 'succeeded',
  'atomic-test', '{"ok":true}', now()
);

INSERT INTO public.paper_doll_component_candidates (
  id, organization_id, request_id, attempt_id, component_id, variant_key,
  original_filename, source_path, source_sha256, normalized_path,
  normalized_sha256, layer_path, layer_sha256, authority_mask_path,
  authority_mask_sha256, source_bounds, edit_bounds, authority_bounds,
  placement_bounds, provider, model, qa, lifecycle_state
) VALUES (
  '87000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001',
  '86000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001', 'SGLD',
  'gold-cap.png', 'raw/gold-cap.png', repeat('c', 64),
  'candidates/gold-cap.png', repeat('d', 64),
  'layers/gold-cap.png', repeat('e', 64),
  'authority-mask.png', repeat('b', 64),
  '{"left":0,"top":0,"width":344,"height":502}',
  '{"left":0,"top":0,"width":344,"height":502}',
  '{"left":0,"top":0,"width":344,"height":502}',
  '{"left":869,"top":500,"width":344,"height":502}',
  'manual', 'manual-v1',
  '{"geometryLocked":true,"minIoU":1,"mismatchedPixels":0}',
  'placement-locked'
);

INSERT INTO public.paper_doll_factory_placement_versions (
  id, organization_id, family_key, geometry_family_id, version_number,
  width_px, center_x_px, seat_y_px, placement_bounds,
  authority_mask_sha256, placement_status, locked_by_user_id,
  locked_by_display_name, lock_note, locked_at
) VALUES (
  '89000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001', 'CYL-9ML',
  'closure__17-415__rollon-overcap__v2', 1, 344, 1041, 1002,
  '{"left":869,"top":500,"width":344,"height":502}', repeat('b', 64),
  'locked', '85000000-0000-4000-8000-000000000001',
  'Jordan Richter', 'Atomic fixture fit', now()
);

INSERT INTO public.paper_doll_approval_events (
  organization_id, candidate_id, action, approver_user_id,
  approver_display_name, approval_note, evidence
) VALUES (
  '81000000-0000-4000-8000-000000000001',
  '87000000-0000-4000-8000-000000000001',
  'placement-locked',
  '85000000-0000-4000-8000-000000000001',
  'Jordan Richter',
  'Atomic fixture placement',
  '{"placementVersionId":"89000000-0000-4000-8000-000000000001"}'
);

SELECT throws_ok(
  $$SELECT public.paper_doll_cut_release_atomic(
    '81000000-0000-4000-8000-000000000001', 'CYL-9ML', '1.0.0',
    '{"familyKey":"CYL-9ML","assets":[{"componentVersionId":"83000000-0000-4000-8000-000000000001","candidateId":"87000000-0000-4000-8000-000000000001","placementVersionId":"89000000-0000-4000-8000-000000000001","slot":"cap","variantKey":"SGLD","sourceBounds":{"left":0,"top":0,"width":344,"height":502},"editBounds":{"left":0,"top":0,"width":344,"height":502},"authorityBounds":{"left":0,"top":0,"width":344,"height":502},"placementBounds":{"left":869,"top":500,"width":344,"height":502}}]}', repeat('f', 64),
    '[{"component_candidate_id":"88000000-0000-4000-8000-000000000001","component_version_id":"83000000-0000-4000-8000-000000000001","placement_version_id":"89000000-0000-4000-8000-000000000001","slot":"cap","variant_key":"SGLD","source_bounds":{"left":0,"top":0,"width":344,"height":502},"edit_bounds":{"left":0,"top":0,"width":344,"height":502},"authority_bounds":{"left":0,"top":0,"width":344,"height":502},"placement_bounds":{"left":869,"top":500,"width":344,"height":502}}]',
    0, '85000000-0000-4000-8000-000000000001', 'Jordan Richter', 'Mismatched reviewed manifest'
  )$$,
  'P0001',
  'Release rows must equal the exact reviewed manifest assets',
  'release rows cannot diverge from the reviewed manifest'
);

SELECT throws_ok(
  $$SELECT public.paper_doll_cut_release_atomic(
    '81000000-0000-4000-8000-000000000001', 'CYL-9ML', '1.0.0',
    '{"familyKey":"CYL-9ML","assets":[{"componentVersionId":"83000000-0000-4000-8000-000000000001","candidateId":"88000000-0000-4000-8000-000000000001","placementVersionId":"89000000-0000-4000-8000-000000000001","slot":"cap","variantKey":"SGLD","sourceBounds":{"left":0,"top":0,"width":344,"height":502},"editBounds":{"left":0,"top":0,"width":344,"height":502},"authorityBounds":{"left":0,"top":0,"width":344,"height":502},"placementBounds":{"left":869,"top":500,"width":344,"height":502}}]}', repeat('f', 64),
    '[{"component_candidate_id":"88000000-0000-4000-8000-000000000001","component_version_id":"83000000-0000-4000-8000-000000000001","placement_version_id":"89000000-0000-4000-8000-000000000001","slot":"cap","variant_key":"SGLD","source_bounds":{"left":0,"top":0,"width":344,"height":502},"edit_bounds":{"left":0,"top":0,"width":344,"height":502},"authority_bounds":{"left":0,"top":0,"width":344,"height":502},"placement_bounds":{"left":869,"top":500,"width":344,"height":502}}]',
    0, '85000000-0000-4000-8000-000000000001', 'Jordan Richter', 'Invalid fixture'
  )$$,
  'P0001',
  'Every non-body asset must bind its exact candidate, component version, slot, variant, placement, bounds, mask, and lock evidence',
  'failed validation aborts the transaction'
);

SELECT is(
  (SELECT count(*)::text FROM public.paper_doll_release_cuts
   WHERE organization_id = '81000000-0000-4000-8000-000000000001'),
  '0',
  'failed atomic cut leaves no release cut'
);

CREATE TEMP TABLE atomic_result AS
SELECT public.paper_doll_cut_release_atomic(
  '81000000-0000-4000-8000-000000000001', 'CYL-9ML', '1.0.0',
  '{"familyKey":"CYL-9ML","assets":[{"componentVersionId":"83000000-0000-4000-8000-000000000001","candidateId":"87000000-0000-4000-8000-000000000001","placementVersionId":"89000000-0000-4000-8000-000000000001","slot":"cap","variantKey":"SGLD","sourceBounds":{"left":0,"top":0,"width":344,"height":502},"editBounds":{"left":0,"top":0,"width":344,"height":502},"authorityBounds":{"left":0,"top":0,"width":344,"height":502},"placementBounds":{"left":869,"top":500,"width":344,"height":502}}]}', repeat('f', 64),
  '[{"component_candidate_id":"87000000-0000-4000-8000-000000000001","component_version_id":"83000000-0000-4000-8000-000000000001","placement_version_id":"89000000-0000-4000-8000-000000000001","slot":"cap","variant_key":"SGLD","source_bounds":{"left":0,"top":0,"width":344,"height":502},"edit_bounds":{"left":0,"top":0,"width":344,"height":502},"authority_bounds":{"left":0,"top":0,"width":344,"height":502},"placement_bounds":{"left":869,"top":500,"width":344,"height":502}}]',
  0, '85000000-0000-4000-8000-000000000001', 'Jordan Richter', 'Approve atomic fixture'
) AS result;

SELECT ok(
  (result->>'releaseCutId') ~ '^[a-f0-9-]{36}$',
  'successful cut returns its immutable ID'
)
FROM atomic_result;

SELECT is(
  (SELECT count(*)::text FROM public.paper_doll_release_cut_assets
   WHERE organization_id = '81000000-0000-4000-8000-000000000001'),
  '1',
  'successful cut appends one immutable asset row'
);

SELECT ok(
  (SELECT revision = 0 FROM public.paper_doll_release_heads
   WHERE organization_id = '81000000-0000-4000-8000-000000000001'
     AND family_key = 'CYL-9ML'),
  'initial Current Release is created at revision zero'
);

SELECT is(
  (SELECT lifecycle_state FROM public.paper_doll_component_candidates
   WHERE id = '87000000-0000-4000-8000-000000000001'),
  'released',
  'candidate lifecycle advances in the same transaction'
);

SELECT is(
  (SELECT count(*)::text FROM public.paper_doll_approval_events
   WHERE candidate_id = '87000000-0000-4000-8000-000000000001'
     AND action = 'released'),
  '1',
  'release approval history is appended exactly once'
);

SELECT ok(
  (public.paper_doll_cut_release_atomic(
    '81000000-0000-4000-8000-000000000001', 'CYL-9ML', '1.0.0',
    '{"familyKey":"CYL-9ML","assets":[{"componentVersionId":"83000000-0000-4000-8000-000000000001","candidateId":"87000000-0000-4000-8000-000000000001","placementVersionId":"89000000-0000-4000-8000-000000000001","slot":"cap","variantKey":"SGLD","sourceBounds":{"left":0,"top":0,"width":344,"height":502},"editBounds":{"left":0,"top":0,"width":344,"height":502},"authorityBounds":{"left":0,"top":0,"width":344,"height":502},"placementBounds":{"left":869,"top":500,"width":344,"height":502}}]}', repeat('f', 64),
    '[{"component_candidate_id":"87000000-0000-4000-8000-000000000001","component_version_id":"83000000-0000-4000-8000-000000000001","placement_version_id":"89000000-0000-4000-8000-000000000001","slot":"cap","variant_key":"SGLD","source_bounds":{"left":0,"top":0,"width":344,"height":502},"edit_bounds":{"left":0,"top":0,"width":344,"height":502},"authority_bounds":{"left":0,"top":0,"width":344,"height":502},"placement_bounds":{"left":869,"top":500,"width":344,"height":502}}]',
    0, '85000000-0000-4000-8000-000000000001', 'Jordan Richter', 'Retry atomic fixture'
  )->>'idempotent')::BOOLEAN
  AND (SELECT count(*) = 1 FROM public.paper_doll_release_cuts
       WHERE organization_id = '81000000-0000-4000-8000-000000000001')
  AND (SELECT count(*) = 1 FROM public.paper_doll_approval_events
       WHERE candidate_id = '87000000-0000-4000-8000-000000000001' AND action = 'released'),
  'retry is idempotent and does not duplicate immutable rows'
);

SELECT * FROM finish();
ROLLBACK;
