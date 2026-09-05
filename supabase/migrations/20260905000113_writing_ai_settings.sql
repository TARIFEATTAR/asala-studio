-- Provider selection is readable by members; keys are only accessible to server RPCs.
create extension if not exists supabase_vault with schema vault;
create schema if not exists writing_ai_private;
revoke all on schema writing_ai_private from public, anon, authenticated;
create table public.writing_ai_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai', 'gemini', 'openrouter')),
  model text not null check (length(model) between 1 and 150),
  key_source text not null check (key_source in ('managed', 'custom')),
  updated_at timestamptz not null default now(),
  check (provider <> 'openrouter' or model = 'openrouter/free' or model like '%:free')
);
alter table public.writing_ai_settings enable row level security;
revoke all on public.writing_ai_settings from anon, authenticated;
grant select on public.writing_ai_settings to authenticated;
grant all on public.writing_ai_settings to service_role;
create policy writing_ai_member_read on public.writing_ai_settings for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = writing_ai_settings.organization_id and m.user_id = (select auth.uid())));
create table writing_ai_private.writing_ai_keys (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai', 'gemini', 'openrouter')),
  secret_id uuid not null references vault.secrets(id),
  primary key (organization_id, provider)
);
alter table writing_ai_private.writing_ai_keys enable row level security;
revoke all on writing_ai_private.writing_ai_keys from public, anon, authenticated;

-- These functions are callable ONLY by service_role after Edge authentication.
create function public.read_writing_ai_key(p_organization_id uuid, p_provider text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then raise exception 'Forbidden'; end if;
  return (select s.decrypted_secret from writing_ai_private.writing_ai_keys k join vault.decrypted_secrets s on s.id = k.secret_id where k.organization_id = p_organization_id and k.provider = p_provider);
end; $$;
create function public.writing_ai_key_status(p_organization_id uuid)
returns table(provider text) language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then raise exception 'Forbidden'; end if;
  return query select k.provider from writing_ai_private.writing_ai_keys k where k.organization_id = p_organization_id;
end; $$;
create function public.save_writing_ai_settings(p_organization_id uuid, p_provider text, p_model text, p_key_source text, p_api_key text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_secret_id uuid;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then raise exception 'Forbidden'; end if;
  -- Serialize key rotation and settings writes for this organization.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text, 0));
  if p_api_key is not null then
    if length(trim(p_api_key)) < 10 or length(p_api_key) > 4096 then raise exception 'Invalid key'; end if;
    select secret_id into v_secret_id from writing_ai_private.writing_ai_keys where organization_id = p_organization_id and provider = p_provider;
    if v_secret_id is null then
      select vault.create_secret(p_api_key) into v_secret_id;
      insert into writing_ai_private.writing_ai_keys values (p_organization_id, p_provider, v_secret_id);
    else
      perform vault.update_secret(v_secret_id, p_api_key);
    end if;
  end if;
  if p_key_source = 'custom' and not exists (select 1 from writing_ai_private.writing_ai_keys where organization_id = p_organization_id and provider = p_provider) then raise exception 'Connect a key first'; end if;
  insert into public.writing_ai_settings(organization_id, provider, model, key_source) values (p_organization_id, p_provider, p_model, p_key_source)
  on conflict (organization_id) do update set provider = excluded.provider, model = excluded.model, key_source = excluded.key_source, updated_at = now();
end; $$;
revoke all on function public.read_writing_ai_key(uuid, text) from public, anon, authenticated;
revoke all on function public.writing_ai_key_status(uuid) from public, anon, authenticated;
revoke all on function public.save_writing_ai_settings(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.read_writing_ai_key(uuid, text) to service_role;
grant execute on function public.writing_ai_key_status(uuid) to service_role;
grant execute on function public.save_writing_ai_settings(uuid, text, text, text, text) to service_role;
