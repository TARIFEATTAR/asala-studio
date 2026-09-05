-- Standalone Postgres lacks the GoTrue auth migrations; supply their JWT accessors.
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb$$;
grant usage on schema auth to authenticated, service_role, anon;
-- Only for the disposable Supabase Postgres container created by test-database.sh.
create table public.organizations(id uuid primary key);
create table public.organization_members(organization_id uuid, user_id uuid, role text);
grant select on public.organization_members to authenticated;
insert into public.organizations values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.organization_members values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner');
