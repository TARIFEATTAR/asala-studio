-- Org-scoped Sanity publishing foundation.
--
-- Tokens are intentionally not stored here. `write_token_secret_name` points
-- to a Supabase Edge Function secret, e.g. SANITY_BEST_BOTTLES_WRITE_TOKEN.

create table if not exists public.sanity_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'Default Sanity project',
  project_id text not null,
  dataset text not null default 'production',
  studio_url text,
  api_version text not null default '2024-01-01',
  write_token_secret_name text not null,
  schema_profile text not null default 'generic',
  is_active boolean not null default true,
  last_schema_inspected_at timestamptz,
  last_schema_status text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sanity_connections_project_dataset_check
    check (project_id ~ '^[a-z0-9]+$' and dataset ~ '^[A-Za-z0-9_-]+$'),
  constraint sanity_connections_secret_name_check
    check (write_token_secret_name ~ '^[A-Z0-9_]+$'),
  constraint sanity_connections_schema_profile_check
    check (schema_profile ~ '^[a-z0-9_]+$')
);

create unique index if not exists sanity_connections_active_org_unique
  on public.sanity_connections (organization_id)
  where is_active;

create index if not exists sanity_connections_org_idx
  on public.sanity_connections (organization_id);

alter table public.sanity_connections enable row level security;

drop policy if exists "members can read sanity connections" on public.sanity_connections;
create policy "members can read sanity connections"
  on public.sanity_connections
  for select
  to authenticated
  using (public.is_organization_member((select auth.uid()), organization_id));

drop policy if exists "admins can insert sanity connections" on public.sanity_connections;
create policy "admins can insert sanity connections"
  on public.sanity_connections
  for insert
  to authenticated
  with check (
    public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role) or
    public.has_organization_role((select auth.uid()), organization_id, 'admin'::organization_role)
  );

drop policy if exists "admins can update sanity connections" on public.sanity_connections;
create policy "admins can update sanity connections"
  on public.sanity_connections
  for update
  to authenticated
  using (
    public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role) or
    public.has_organization_role((select auth.uid()), organization_id, 'admin'::organization_role)
  )
  with check (
    public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role) or
    public.has_organization_role((select auth.uid()), organization_id, 'admin'::organization_role)
  );

drop policy if exists "admins can delete sanity connections" on public.sanity_connections;
create policy "admins can delete sanity connections"
  on public.sanity_connections
  for delete
  to authenticated
  using (
    public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role) or
    public.has_organization_role((select auth.uid()), organization_id, 'admin'::organization_role)
  );

drop trigger if exists update_sanity_connections_updated_at on public.sanity_connections;
create trigger update_sanity_connections_updated_at
before update on public.sanity_connections
for each row
execute function public.update_updated_at_column();

create table if not exists public.sanity_destination_registry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  destination_key text not null check (
    destination_key in (
      'blog_post',
      'homepage_hero',
      'product_family_hero',
      'product_main_image',
      'paper_doll_component'
    )
  ),
  schema_profile text not null default 'generic' check (schema_profile ~ '^[a-z0-9_]+$'),
  label text not null,
  sanity_document_type text not null,
  selector_query text not null,
  selector_params jsonb not null default '{}'::jsonb,
  target_field_path text not null check (target_field_path ~ '^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$'),
  publish_mode text not null default 'preserve' check (publish_mode in ('draft', 'published', 'preserve')),
  requires_image boolean not null default true,
  required_metadata jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sanity_destination_registry_unique_scope
  on public.sanity_destination_registry (
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    schema_profile,
    destination_key
  );

create index if not exists sanity_destination_registry_lookup_idx
  on public.sanity_destination_registry (destination_key, schema_profile, is_active);

alter table public.sanity_destination_registry enable row level security;

drop policy if exists "members can read sanity destination registry" on public.sanity_destination_registry;
create policy "members can read sanity destination registry"
  on public.sanity_destination_registry
  for select
  to authenticated
  using (
    organization_id is null or
    public.is_organization_member((select auth.uid()), organization_id)
  );

drop policy if exists "admins can insert org sanity destination registry" on public.sanity_destination_registry;
create policy "admins can insert org sanity destination registry"
  on public.sanity_destination_registry
  for insert
  to authenticated
  with check (
    organization_id is not null and
    (
      public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role) or
      public.has_organization_role((select auth.uid()), organization_id, 'admin'::organization_role)
    )
  );

drop policy if exists "admins can update org sanity destination registry" on public.sanity_destination_registry;
create policy "admins can update org sanity destination registry"
  on public.sanity_destination_registry
  for update
  to authenticated
  using (
    organization_id is not null and
    (
      public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role) or
      public.has_organization_role((select auth.uid()), organization_id, 'admin'::organization_role)
    )
  )
  with check (
    organization_id is not null and
    (
      public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role) or
      public.has_organization_role((select auth.uid()), organization_id, 'admin'::organization_role)
    )
  );

drop policy if exists "admins can delete org sanity destination registry" on public.sanity_destination_registry;
create policy "admins can delete org sanity destination registry"
  on public.sanity_destination_registry
  for delete
  to authenticated
  using (
    organization_id is not null and
    (
      public.has_organization_role((select auth.uid()), organization_id, 'owner'::organization_role) or
      public.has_organization_role((select auth.uid()), organization_id, 'admin'::organization_role)
    )
  );

drop trigger if exists update_sanity_destination_registry_updated_at on public.sanity_destination_registry;
create trigger update_sanity_destination_registry_updated_at
before update on public.sanity_destination_registry
for each row
execute function public.update_updated_at_column();

create table if not exists public.sanity_schema_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.sanity_connections(id) on delete set null,
  project_id text not null,
  dataset text not null,
  status text not null check (status in ('ok', 'blocked', 'error')),
  observed_document_types jsonb not null default '[]'::jsonb,
  sampled_documents jsonb not null default '[]'::jsonb,
  destination_matches jsonb not null default '{}'::jsonb,
  error_message text,
  inspected_by uuid references auth.users(id),
  inspected_at timestamptz not null default now()
);

create index if not exists sanity_schema_inspections_org_idx
  on public.sanity_schema_inspections (organization_id, inspected_at desc);

alter table public.sanity_schema_inspections enable row level security;

drop policy if exists "members can read sanity schema inspections" on public.sanity_schema_inspections;
create policy "members can read sanity schema inspections"
  on public.sanity_schema_inspections
  for select
  to authenticated
  using (public.is_organization_member((select auth.uid()), organization_id));

create table if not exists public.sanity_publish_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.sanity_connections(id) on delete set null,
  operation text not null default 'publish' check (operation in ('inspect', 'publish')),
  destination_key text check (
    destination_key is null or destination_key in (
      'blog_post',
      'homepage_hero',
      'product_family_hero',
      'product_main_image',
      'paper_doll_component'
    )
  ),
  status text not null check (status in ('success', 'failed', 'blocked', 'dry_run')),
  source_image_url text,
  sanity_asset_id text,
  sanity_document_id text,
  sanity_document_type text,
  target_field_path text,
  metadata jsonb not null default '{}'::jsonb,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  published_by uuid references auth.users(id),
  published_at timestamptz not null default now()
);

create index if not exists sanity_publish_log_org_idx
  on public.sanity_publish_log (organization_id, published_at desc);

create index if not exists sanity_publish_log_destination_idx
  on public.sanity_publish_log (organization_id, destination_key, published_at desc);

alter table public.sanity_publish_log enable row level security;

drop policy if exists "members can read sanity publish log" on public.sanity_publish_log;
create policy "members can read sanity publish log"
  on public.sanity_publish_log
  for select
  to authenticated
  using (public.is_organization_member((select auth.uid()), organization_id));

grant select, insert, update, delete on public.sanity_connections to authenticated;
grant select, insert, update, delete on public.sanity_destination_registry to authenticated;
grant select on public.sanity_schema_inspections to authenticated;
grant select on public.sanity_publish_log to authenticated;

insert into public.sanity_destination_registry (
  organization_id,
  destination_key,
  schema_profile,
  label,
  sanity_document_type,
  selector_query,
  selector_params,
  target_field_path,
  publish_mode,
  requires_image,
  required_metadata,
  metadata
) values
  (
    null,
    'blog_post',
    'generic',
    'Blog post featured image',
    'post',
    '*[_type == $documentType && _id == $documentId][0]{_id,_type,title,slug}',
    '{}'::jsonb,
    'featuredImage',
    'preserve',
    true,
    '["documentId", "altText"]'::jsonb,
    '{"notes":"Use the existing push-to-sanity function for blog body content; this destination patches the post image field only."}'::jsonb
  ),
  (
    null,
    'homepage_hero',
    'generic',
    'Homepage hero image',
    'homePage',
    '*[_type == $documentType && _id == $documentId][0]{_id,_type,title,name}',
    '{}'::jsonb,
    'heroImage',
    'preserve',
    true,
    '["documentId", "altText"]'::jsonb,
    '{}'::jsonb
  ),
  (
    null,
    'product_family_hero',
    'generic',
    'Product family hero image',
    'productFamily',
    '*[_type == $documentType && _id == $documentId][0]{_id,_type,title,name,slug}',
    '{"familySlug":"slug"}'::jsonb,
    'heroImage',
    'preserve',
    true,
    '["documentId", "familySlug", "altText"]'::jsonb,
    '{}'::jsonb
  ),
  (
    null,
    'product_main_image',
    'generic',
    'Product main image',
    'product',
    '*[_type == $documentType && _id == $documentId][0]{_id,_type,title,name,slug}',
    '{}'::jsonb,
    'mainImage',
    'preserve',
    true,
    '["documentId", "altText"]'::jsonb,
    '{"notes":"Best Bottles commerce PDP images should use Shopify-first publishing instead of this destination."}'::jsonb
  ),
  (
    null,
    'paper_doll_component',
    'generic',
    'Paper-doll component image',
    'paperDollComponent',
    '*[_type == $documentType && _id == $documentId][0]{_id,_type,title,name,cohortSlug,role}',
    '{}'::jsonb,
    'image',
    'preserve',
    true,
    '["documentId", "cohortSlug", "role", "altText"]'::jsonb,
    '{}'::jsonb
  )
on conflict do nothing;

comment on table public.sanity_connections is
  'Organization-scoped Sanity project configuration. Token values live in Supabase Edge Function secrets; this table stores only the secret name.';
comment on table public.sanity_destination_registry is
  'Sanity placement rules for exactly targeted Madison publishes such as blog featured image, homepage hero, family hero, product image, and paper-doll component.';
comment on table public.sanity_schema_inspections is
  'Read-only Sanity Content Lake observations captured before publish attempts.';
comment on table public.sanity_publish_log is
  'Audit log for Sanity placement inspect and publish actions.';
