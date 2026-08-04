-- Supabase-compatible base for a native Postgres 16 cluster.
-- Reproduces only the platform surface the migrations actually touch:
--   auth.uid / auth.role / auth.users, storage.objects / buckets / foldername,
--   the reserved roles, the extensions schema, and a net.http_post stub.
-- This stands in for `supabase start` where no Docker daemon is available.

-- ---------------------------------------------------------------- roles
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'anon','authenticated','service_role','authenticator',
    'supabase_admin','supabase_auth_admin','supabase_storage_admin','dashboard_user'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT', r);
    END IF;
  END LOOP;
END $$;

GRANT anon, authenticated, service_role TO postgres;

-- ------------------------------------------------------------- schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS net;
CREATE SCHEMA IF NOT EXISTS graphql_public;

GRANT USAGE ON SCHEMA auth, storage, extensions, net TO anon, authenticated, service_role, postgres;

-- ---------------------------------------------------------- extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto     WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector       WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgtap        WITH SCHEMA extensions;

-- uuid_generate_v4()/gen_random_uuid()/vector are referenced unqualified, so
-- `extensions` must sit on the search_path for every session in THIS database
-- (Supabase configures the same default).
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET search_path TO "$user", public, extensions',
    current_database()
  );
END $$;
SET search_path TO "$user", public, extensions;

-- --------------------------------------------------------- auth surface
-- Mirrors the columns the migrations read; not the full GoTrue table.
CREATE TABLE IF NOT EXISTS auth.users (
  id                  uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  email               text,
  encrypted_password  text,
  raw_user_meta_data  jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data   jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  email_confirmed_at  timestamptz,
  last_sign_in_at     timestamptz,
  is_super_admin      boolean DEFAULT false,
  role                text DEFAULT 'authenticated',
  aud                 text DEFAULT 'authenticated'
);

-- Supabase resolves these from the request-local JWT claims. `set_config` on
-- request.jwt.claim.* is exactly how the pgTAP test drives them.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), ''
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    'anon'
  )
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

GRANT SELECT ON auth.users TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

-- ------------------------------------------------------ storage surface
CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 text PRIMARY KEY,
  name               text NOT NULL,
  owner              uuid,
  public             boolean DEFAULT false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id               uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  bucket_id        text REFERENCES storage.buckets(id),
  name             text,
  owner            uuid,
  metadata         jsonb,
  path_tokens      text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  version          text
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE parts text[];
BEGIN
  parts := string_to_array(name, '/');
  RETURN parts[1:array_length(parts, 1) - 1];
END $$;

CREATE OR REPLACE FUNCTION storage.filename(name text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE parts text[];
BEGIN
  parts := string_to_array(name, '/');
  RETURN parts[array_length(parts, 1)];
END $$;

CREATE OR REPLACE FUNCTION storage.extension(name text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE parts text[];
BEGIN
  parts := string_to_array(storage.filename(name), '.');
  RETURN parts[array_length(parts, 1)];
END $$;

GRANT ALL ON storage.objects, storage.buckets TO service_role, postgres;
GRANT SELECT ON storage.objects, storage.buckets TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO anon, authenticated, service_role;

-- --------------------------------------------------------- pg_net stub
-- pg_net is a Supabase platform extension with no native package. A stub
-- control file is installed alongside this script so the migrations'
-- `CREATE EXTENSION IF NOT EXISTS "pg_net"` resolves normally; the extension
-- body defines net.http_post as an inert no-op so a migration replay never
-- performs network I/O.
CREATE EXTENSION IF NOT EXISTS pg_net;

GRANT USAGE ON SCHEMA net TO anon, authenticated, service_role, postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO anon, authenticated, service_role, postgres;
