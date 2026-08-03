-- Private, organization-scoped storage for the paper-doll component factory.
-- Service-role Edge Functions are the only writers. Authenticated organization
-- members may read objects whose first path segment is their organization UUID.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('paper-doll-authority', 'paper-doll-authority', FALSE, 52428800, ARRAY['image/png', 'application/json']),
  ('paper-doll-candidates', 'paper-doll-candidates', FALSE, 52428800, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/json']),
  ('paper-doll-releases', 'paper-doll-releases', FALSE, 52428800, ARRAY['image/png', 'application/json'])
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS paper_doll_authority_select_org_members ON storage.objects;
DROP POLICY IF EXISTS paper_doll_candidates_select_org_members ON storage.objects;
DROP POLICY IF EXISTS paper_doll_releases_select_org_members ON storage.objects;

CREATE POLICY paper_doll_authority_select_org_members
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'paper-doll-authority'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND public.is_organization_member(((storage.foldername(name))[1])::UUID, auth.uid())
  );

CREATE POLICY paper_doll_candidates_select_org_members
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'paper-doll-candidates'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND public.is_organization_member(((storage.foldername(name))[1])::UUID, auth.uid())
  );

CREATE POLICY paper_doll_releases_select_org_members
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'paper-doll-releases'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND public.is_organization_member(((storage.foldername(name))[1])::UUID, auth.uid())
  );

COMMENT ON POLICY paper_doll_authority_select_org_members ON storage.objects IS
  'Organization members may read immutable paper-doll authority masks; writes remain service-only.';
COMMENT ON POLICY paper_doll_candidates_select_org_members ON storage.objects IS
  'Organization members may read candidate artifacts; writes remain service-only.';
COMMENT ON POLICY paper_doll_releases_select_org_members ON storage.objects IS
  'Organization members may read release artifacts; writes remain service-only.';
