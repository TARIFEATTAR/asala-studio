-- Generation-attempt ledger — Paper-Doll Rig build task 0.
-- docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md ("Build order" §0)
--
-- One row per provider call, inserted BEFORE the call (status='pending') and
-- completed after (succeeded/failed + latency + output linkage). Fixes the
-- 2026-07-15 audit §16 finding: no per-image cost, latency, retry, or failure
-- evidence is persisted anywhere. estimated_cost_usd is an UNVERIFIED UI
-- constant until reconciled against real provider billing.

create table if not exists public.generation_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  organization_id uuid,
  user_id uuid,
  session_id text,

  -- e.g. 'best-bottles-reference-locked' | 'darkroom'
  lane text not null default 'darkroom',
  provider text not null,
  model text,
  -- 'edits' | 'generations' for OpenAI; null where the split doesn't exist
  endpoint text,
  request_size text,
  request_resolution text,

  prompt_sha256 text,
  prompt_chars integer,
  reference_count integer not null default 0,
  -- SHA-256 fingerprints of the exact base64 payloads sent (never the bytes)
  reference_sha256s jsonb,
  reference_urls jsonb,

  grace_sku text,
  website_sku text,
  product_group_slug text,

  seed bigint,
  attempt_number integer,

  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed')),
  error_message text,
  latency_ms integer,

  generated_image_id uuid,
  output_url text,
  -- Provider-rewritten prompt when reported (audit: previously never persisted)
  revised_prompt text,

  -- UI-constant estimate ($0.095 gpt-image) — NOT billing truth
  estimated_cost_usd numeric(8, 4),
  code_commit text,
  request_params jsonb
);

create index if not exists generation_attempts_created_at_idx
  on public.generation_attempts (created_at desc);
create index if not exists generation_attempts_status_idx
  on public.generation_attempts (status);
create index if not exists generation_attempts_grace_sku_idx
  on public.generation_attempts (grace_sku)
  where grace_sku is not null;
create index if not exists generation_attempts_org_created_idx
  on public.generation_attempts (organization_id, created_at desc);

alter table public.generation_attempts enable row level security;

-- Writes come exclusively from edge functions using the service role (which
-- bypasses RLS); authenticated org members get read-only visibility.
create policy "Org members can read generation attempts"
  on public.generation_attempts
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

comment on table public.generation_attempts is
  'Pre-provider generation attempt ledger (Paper-Doll Rig task 0): one row per provider call with prompt/reference fingerprints, latency, status, and unverified cost estimate. Writes are service-role only.';
