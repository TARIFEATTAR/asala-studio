-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: New user onboarding fails with RLS errors on brand-document upload
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Symptom (production console):
--   POST /rest/v1/organization_members → 403
--   POST /rest/v1/brand_collections    → 403
--   "new row violates row-level security policy for table 'brand_documents'"
--
-- Root cause:
--   organization_members has had its INSERT/SELECT policies churned across
--   several migrations (20251006164614, 20251006193221, 20251105110129).
--   In production, the live policy set on organization_members and
--   organizations does not consistently allow a brand-new user to
--   self-insert their owner-membership row immediately after creating the
--   organization. Once that membership row is missing, every downstream
--   policy that uses is_organization_member() fails — including the
--   brand_documents INSERT policy that is the visible error.
--
--   In addition, brand_collections.INSERT requires has_organization_role
--   ('owner'|'admin'). On first-time onboarding the membership row does
--   not yet exist (or is being inserted in parallel — see useOnboarding
--   client fix), so the default-collection insert also fails with 403.
--
-- This migration is defensive: it drops every prior policy on
-- organizations / organization_members / brand_collections that we know
-- has been created in the migration history, then rebuilds a single
-- canonical set with the optimized (select auth.uid()) pattern.
--
-- It also backfills any user who created an organization but is missing
-- the corresponding owner-membership row (this repairs the two reported
-- broken orgs: 3cd85bf7-bfc6-4473-9846-920f1f5e7ba5 and
-- 61005d9d-dd66-4986-885e-7b473bbaa506, plus any others in the same
-- state).
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ensure RLS is enabled on the affected tables
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_collections     ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop every known prior policy on these three tables
-- ─────────────────────────────────────────────────────────────────────────────

-- organizations
DROP POLICY IF EXISTS "Users can view their organizations"               ON public.organizations;
DROP POLICY IF EXISTS "Users can view their non-deleted organizations"   ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can soft delete their organization" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations"     ON public.organizations;
DROP POLICY IF EXISTS "organizations_select"                             ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert"                             ON public.organizations;
DROP POLICY IF EXISTS "organizations_update"                             ON public.organizations;

-- organization_members
DROP POLICY IF EXISTS "Members can view their organization's members"           ON public.organization_members;
DROP POLICY IF EXISTS "Owners and admins can add members"                       ON public.organization_members;
DROP POLICY IF EXISTS "Allow organization creators and admins to add members"   ON public.organization_members;
DROP POLICY IF EXISTS "Owners and admins can update members"                    ON public.organization_members;
DROP POLICY IF EXISTS "Owners can delete members"                               ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_select"                             ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_insert"                             ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_update"                             ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_delete"                             ON public.organization_members;

-- brand_collections
DROP POLICY IF EXISTS "Members can view their organization's collections" ON public.brand_collections;
DROP POLICY IF EXISTS "Admins and owners can insert collections"          ON public.brand_collections;
DROP POLICY IF EXISTS "Admins and owners can update collections"          ON public.brand_collections;
DROP POLICY IF EXISTS "Owners can delete collections"                     ON public.brand_collections;
DROP POLICY IF EXISTS "brand_collections_select"                          ON public.brand_collections;
DROP POLICY IF EXISTS "brand_collections_insert"                          ON public.brand_collections;
DROP POLICY IF EXISTS "brand_collections_update"                          ON public.brand_collections;
DROP POLICY IF EXISTS "brand_collections_delete"                          ON public.brand_collections;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Recreate clean canonical policies
-- ─────────────────────────────────────────────────────────────────────────────

-- ── organizations ────────────────────────────────────────────────────────────
-- A user can read an organization if they are a member of it OR they created
-- it (the second clause is what allows a brand-new org creator to read their
-- own org during onboarding, before the membership row exists).
CREATE POLICY "organizations_select"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    is_deleted = false
    AND (
      created_by = (select auth.uid())
      OR public.is_organization_member((select auth.uid()), id)
    )
  );

-- Anyone authenticated can create an organization, but only as themselves.
CREATE POLICY "organizations_insert"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

-- Only owners can update an organization (covers both metadata edits and
-- soft-delete via the is_deleted flag — handled by the trigger added in
-- 20251015173024).
CREATE POLICY "organizations_update"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.has_organization_role((select auth.uid()), id, 'owner'::organization_role))
  WITH CHECK (public.has_organization_role((select auth.uid()), id, 'owner'::organization_role));


-- ── organization_members ─────────────────────────────────────────────────────
-- A user can see membership rows for orgs they belong to. The ★critical★
-- second clause — "or you created the org" — is what lets a brand-new user
-- read back the row they just inserted in step 4 below, and is what
-- getOrCreateOrganizationId() relies on to find existing memberships.
CREATE POLICY "organization_members_select"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.is_organization_member((select auth.uid()), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_members.organization_id
        AND o.created_by = (select auth.uid())
    )
  );

-- INSERT: allowed if (a) you are inserting yourself into an org you created,
-- or (b) you are already an owner/admin adding someone else, or (c) the
-- auto_accept_team_invitations() trigger is running (security-definer, so it
-- bypasses RLS — listed for completeness only). The (a) clause is the
-- onboarding fix.
CREATE POLICY "organization_members_insert"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- (a) New-org creator inserts themselves.
    (
      user_id = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_members.organization_id
          AND o.created_by = (select auth.uid())
      )
    )
    OR
    -- (b) Existing owner/admin adds someone.
    public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role)
    OR
    public.has_organization_role((select auth.uid()), organization_id, 'admin'::organization_role)
  );

CREATE POLICY "organization_members_update"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (
    public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role)
    OR public.has_organization_role((select auth.uid()), organization_id, 'admin'::organization_role)
  );

CREATE POLICY "organization_members_delete"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (
    public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role)
  );


-- ── brand_collections ────────────────────────────────────────────────────────
-- SELECT for any member of the org.
CREATE POLICY "brand_collections_select"
  ON public.brand_collections FOR SELECT
  TO authenticated
  USING (public.is_organization_member((select auth.uid()), organization_id));

-- INSERT: any member can create a collection. We also allow the org creator
-- specifically, so the default "General" collection can be created during
-- onboarding before the membership row is committed.
CREATE POLICY "brand_collections_insert"
  ON public.brand_collections FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_organization_member((select auth.uid()), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = brand_collections.organization_id
        AND o.created_by = (select auth.uid())
    )
  );

CREATE POLICY "brand_collections_update"
  ON public.brand_collections FOR UPDATE
  TO authenticated
  USING (
    public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role)
    OR public.has_organization_role((select auth.uid()), organization_id, 'admin'::organization_role)
  );

CREATE POLICY "brand_collections_delete"
  ON public.brand_collections FOR DELETE
  TO authenticated
  USING (
    public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role)
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Backfill missing owner memberships
--    Any user who created an organization but is not currently a member of it
--    gets a row inserted as 'owner'. This repairs the two reported broken
--    orgs (3cd85bf7-…, 61005d9d-…) plus every other org in the same state.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT
  o.id,
  o.created_by,
  'owner'::organization_role
FROM public.organizations o
LEFT JOIN public.organization_members om
  ON om.organization_id = o.id AND om.user_id = o.created_by
WHERE o.created_by IS NOT NULL
  AND om.user_id IS NULL
  AND COALESCE(o.is_deleted, false) = false
ON CONFLICT (organization_id, user_id) DO NOTHING;
