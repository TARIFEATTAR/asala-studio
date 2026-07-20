-- Prompt descriptor overrides for the Madison product-image system.
--
-- Code in `src/config/familyShapeDescriptors.ts` and
-- `src/config/applicatorShapeDescriptors.ts` ships static defaults for every
-- bottle family and applicator type. Operators can override any descriptor
-- per-organization via the descriptors editor without code changes; rows in
-- this table are loaded at generation time and merged on top of the defaults.
--
-- An empty table = system uses pure code defaults. Each row is one override.

create type prompt_descriptor_type as enum (
  'family',
  'applicator',
  'body_variant'
);

create table public.prompt_descriptors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  descriptor_type prompt_descriptor_type not null,
  descriptor_key text not null,
  descriptor_text text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (organization_id, descriptor_type, descriptor_key)
);

create index prompt_descriptors_org_type_idx
  on public.prompt_descriptors (organization_id, descriptor_type);

comment on table public.prompt_descriptors is
  'Operator-editable overrides for paper-doll prompt descriptors. NULL/missing rows fall back to code defaults in src/config/*ShapeDescriptors.ts.';
comment on column public.prompt_descriptors.descriptor_key is
  'Lookup key — for type=family, the family name (e.g. "Empire"); for type=applicator, the applicator name (e.g. "Vintage Bulb Sprayer"); for type=body_variant, "no-tube" or "with-tube".';

-- RLS — members of the organization can read; only members with edit
-- permission (any member for now, can tighten later) can write.
alter table public.prompt_descriptors enable row level security;

create policy "members can read prompt_descriptors"
  on public.prompt_descriptors for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "members can insert prompt_descriptors"
  on public.prompt_descriptors for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "members can update prompt_descriptors"
  on public.prompt_descriptors for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "members can delete prompt_descriptors"
  on public.prompt_descriptors for delete
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );
