-- External object-storage contract for the Paper-Doll Rig.
--
-- Buckets are provisioned through the Storage API by the audited
-- scripts/paper-doll/provision-storage.ts command. This migration deliberately
-- does not INSERT into the storage schema: Supabase treats that schema as
-- service-owned metadata and file/bucket operations belong behind its API.
--
-- Every object name begins with an organization UUID:
--   <organization_id>/<family>/<asset-id>/<sha256>.<extension>
--
-- Authenticated organization members may append source and candidate files.
-- They cannot overwrite or delete files, and only trusted server code may put
-- objects in the approved bucket. Versioning therefore happens by writing a
-- new content-addressed object and a new component-version row.

ALTER TABLE public.paper_doll_component_versions
  ADD COLUMN storage_bucket TEXT NOT NULL,
  ADD COLUMN content_type TEXT NOT NULL,
  ADD COLUMN byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  ADD COLUMN parent_component_version_id UUID;

ALTER TABLE public.paper_doll_component_versions
  ADD CONSTRAINT paper_doll_component_versions_storage_bucket_check
    CHECK (storage_bucket IN (
      'paper-doll-sources',
      'paper-doll-candidates',
      'paper-doll-approved'
    )),
  ADD CONSTRAINT paper_doll_component_versions_image_path_relative_check
    CHECK (
      image_path !~ '^[a-z][a-z0-9+.-]*://'
      AND image_path !~ '^/'
      AND split_part(image_path, '/', 1) = organization_id::TEXT
      AND image_path ~ ('/' || image_sha256 || '\.[a-z0-9]+$')
    ),
  ADD CONSTRAINT paper_doll_component_versions_mask_path_relative_check
    CHECK (
      geometry_mask_path IS NULL
      OR (
        geometry_mask_path !~ '^[a-z][a-z0-9+.-]*://'
        AND geometry_mask_path !~ '^/'
        AND split_part(geometry_mask_path, '/', 1) = organization_id::TEXT
        AND geometry_mask_path ~ ('/' || geometry_mask_sha256 || '\.[a-z0-9]+$')
      )
    ),
  ADD CONSTRAINT paper_doll_component_versions_parent_org_fk
    FOREIGN KEY (parent_component_version_id, organization_id)
    REFERENCES public.paper_doll_component_versions(id, organization_id)
    ON DELETE RESTRICT;

CREATE INDEX paper_doll_component_versions_parent_idx
  ON public.paper_doll_component_versions (parent_component_version_id)
  WHERE parent_component_version_id IS NOT NULL;

COMMENT ON COLUMN public.paper_doll_component_versions.storage_bucket IS
  'Private Supabase Storage bucket. The browser resolves image_path to a short-lived URL at runtime.';
COMMENT ON COLUMN public.paper_doll_component_versions.image_path IS
  'Immutable object path, never a public or signed URL. First path segment is organization_id.';
COMMENT ON COLUMN public.paper_doll_component_versions.parent_component_version_id IS
  'Previous immutable version when this asset was painted, adjusted, regenerated, or otherwise derived.';

-- Extend the approved-version immutability guard to the storage contract.
CREATE OR REPLACE FUNCTION public.paper_doll_lock_approved_component_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.approval_status = 'approved'
    AND ROW(
      OLD.organization_id, OLD.component_id, OLD.version_key,
      OLD.material_variant, OLD.storage_bucket, OLD.image_path,
      OLD.image_sha256, OLD.geometry_mask_path, OLD.geometry_mask_sha256,
      OLD.content_type, OLD.byte_size, OLD.parent_component_version_id,
      OLD.width_px, OLD.height_px, OLD.alpha_bounds,
      OLD.mount_axis_x_px, OLD.seat_y_px, OLD.approval_status, OLD.provenance
    ) IS DISTINCT FROM ROW(
      NEW.organization_id, NEW.component_id, NEW.version_key,
      NEW.material_variant, NEW.storage_bucket, NEW.image_path,
      NEW.image_sha256, NEW.geometry_mask_path, NEW.geometry_mask_sha256,
      NEW.content_type, NEW.byte_size, NEW.parent_component_version_id,
      NEW.width_px, NEW.height_px, NEW.alpha_bounds,
      NEW.mount_axis_x_px, NEW.seat_y_px, NEW.approval_status, NEW.provenance
    )
  THEN
    RAISE EXCEPTION 'Approved paper-doll component versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

-- Private-object reads are scoped to the organization encoded in the first
-- object-path segment. No user-editable JWT metadata participates in access.
CREATE POLICY paper_doll_storage_select_org_members
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id IN (
      'paper-doll-sources',
      'paper-doll-candidates',
      'paper-doll-approved'
    )
    AND EXISTS (
      SELECT 1
      FROM public.organization_members AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.organization_id::TEXT = split_part(storage.objects.name, '/', 1)
    )
  );

-- Browser uploads are append-only and limited to source/candidate buckets.
-- Approved assets can only be written by trusted server code (service_role).
CREATE POLICY paper_doll_storage_insert_org_members
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('paper-doll-sources', 'paper-doll-candidates')
    AND EXISTS (
      SELECT 1
      FROM public.organization_members AS membership
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.organization_id::TEXT = split_part(storage.objects.name, '/', 1)
    )
  );

COMMENT ON POLICY paper_doll_storage_select_org_members ON storage.objects IS
  'Organization members can resolve private source, candidate, and approved assets.';
COMMENT ON POLICY paper_doll_storage_insert_org_members ON storage.objects IS
  'Organization members may append immutable source/candidate objects; no authenticated update/delete policy exists.';

-- One read-only API boundary keeps the browser from stitching ledger rows
-- together with privileged queries. SECURITY INVOKER preserves table RLS.
CREATE OR REPLACE FUNCTION public.get_paper_doll_release_workbench(
  p_organization_id UUID,
  p_family_key TEXT
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH chosen_release AS (
    SELECT release.*
    FROM public.paper_doll_family_releases AS release
    WHERE release.organization_id = p_organization_id
      AND release.family_key = p_family_key
    ORDER BY release.created_at DESC, release.release_version DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'release', to_jsonb(release),
    'assets', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'slot', membership.slot,
          'variantKey', membership.variant_key,
          'component', to_jsonb(component),
          'version', to_jsonb(version),
          'qa', COALESCE((
            SELECT jsonb_agg(to_jsonb(qa_result) ORDER BY qa_result.created_at DESC)
            FROM public.paper_doll_qa_results AS qa_result
            WHERE qa_result.organization_id = release.organization_id
              AND qa_result.component_version_id = version.id
          ), '[]'::JSONB)
        )
        ORDER BY membership.slot, membership.variant_key
      )
      FROM public.paper_doll_family_release_assets AS membership
      JOIN public.paper_doll_component_versions AS version
        ON version.id = membership.component_version_id
       AND version.organization_id = membership.organization_id
      JOIN public.paper_doll_components AS component
        ON component.id = version.component_id
       AND component.organization_id = version.organization_id
      WHERE membership.release_id = release.id
        AND membership.organization_id = release.organization_id
    ), '[]'::JSONB)
  )
  FROM chosen_release AS release;
$$;

REVOKE ALL ON FUNCTION public.get_paper_doll_release_workbench(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_paper_doll_release_workbench(UUID, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_paper_doll_release_workbench(UUID, TEXT) IS
  'Read-only, RLS-preserving release payload. Asset object paths are resolved to short-lived URLs by authenticated clients.';
