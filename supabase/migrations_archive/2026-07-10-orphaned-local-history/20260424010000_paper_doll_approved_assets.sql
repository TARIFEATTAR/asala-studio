-- Approved paper-doll component assets for the product-image system.
--
-- When an operator clicks "Approve" on a Components-tab slot, the final
-- transparent PNG URL is recorded here. Each row is one approved layer for
-- one shape cohort (family + capacity + color + optional applicator/cap).
-- The configurator on bestbottles.com (or the existing local Sanity-upload
-- scripts) reads from here to pull approved layers into production.
--
-- Constraint: one approved asset per (cohort_slug, role, body_variant,
-- applicator, cap_color) tuple — re-approving overwrites the prior URL.

create table public.paper_doll_approved_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Cohort identifiers — match the Convex productGroup the asset serves.
  cohort_slug text not null,
  family text not null,
  capacity_ml numeric,
  glass_color text,

  -- Asset role. One of: 'body' | 'fitment' | 'cap' | 'roller'
  role text not null check (role in ('body', 'fitment', 'cap', 'roller')),

  -- Body-only: which body variant. NULL for fitment / cap / roller.
  body_variant text check (body_variant in ('no-tube', 'with-tube')),

  -- Fitment-only: which applicator + colorway this asset is the layer for.
  -- NULL for body slots.
  applicator text,
  cap_color text,

  -- The approved transparent PNG URL (typically the fal.ai BiRefNet output
  -- or a re-uploaded color-corrected version stored in Supabase Storage).
  image_url text not null,

  -- Optional library record this asset corresponds to (when generated via
  -- the standard hook → generated_images flow).
  library_image_id uuid,

  -- Original AI / upload URL before bg-removal, for audit / re-derivation.
  source_image_url text,

  -- Source flag — is this an operator PSD upload, an AI generation, or
  -- an AI enhance pass on top of an upload?
  source text not null check (source in ('uploaded', 'generated', 'enhanced')),

  approved_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),

  -- Free-form notes the operator can leave on approval.
  notes text
);

-- Unique slot per cohort × role × variant × applicator × cap_color.
-- Re-approving the same slot upserts (delete + insert pattern in app code).
create unique index paper_doll_approved_assets_unique_slot
  on public.paper_doll_approved_assets (
    organization_id,
    cohort_slug,
    role,
    coalesce(body_variant, ''),
    coalesce(applicator, ''),
    coalesce(cap_color, '')
  );

create index paper_doll_approved_assets_cohort_idx
  on public.paper_doll_approved_assets (organization_id, cohort_slug);

create index paper_doll_approved_assets_family_idx
  on public.paper_doll_approved_assets (organization_id, family);

comment on table public.paper_doll_approved_assets is
  'Approved paper-doll component layers per shape cohort. Sanity / Convex sync reads from here.';

-- RLS — members of the organization can read their assets; only members
-- can write (we trust org-membership as the auth boundary for now).
alter table public.paper_doll_approved_assets enable row level security;

create policy "members can read paper_doll_approved_assets"
  on public.paper_doll_approved_assets for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "members can insert paper_doll_approved_assets"
  on public.paper_doll_approved_assets for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "members can update paper_doll_approved_assets"
  on public.paper_doll_approved_assets for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "members can delete paper_doll_approved_assets"
  on public.paper_doll_approved_assets for delete
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );
