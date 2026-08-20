-- Migration 003: BYOK (Bring Your Own Key) + platform quota tables

-- Enable pgcrypto for server-side key encryption
create extension if not exists pgcrypto;

-- ─── user_api_keys ────────────────────────────────────────────────────────────
create table if not exists public.user_api_keys (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  provider         text not null,
  encrypted_key    text not null,       -- pgp_sym_encrypt(raw_key, KEY_ENCRYPTION_SECRET)
  last_verified_at timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.user_api_keys enable row level security;

drop policy if exists "users manage own keys" on public.user_api_keys;
create policy "users manage own keys"
  on public.user_api_keys
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_api_keys_user_id_idx
  on public.user_api_keys (user_id, provider);

-- ─── platform_usage ───────────────────────────────────────────────────────────
create table if not exists public.platform_usage (
  provider      text primary key,
  period_start  date not null default date_trunc('month', now())::date,
  tokens_used   bigint not null default 0,
  monthly_quota bigint not null default 1000000   -- 1M tokens default quota
);

-- Seed one row per provider (admin manages quotas)
insert into public.platform_usage (provider, monthly_quota) values
  ('openai',     500000),
  ('anthropic',  500000),
  ('groq',       2000000),
  ('openrouter', 5000000)
on conflict (provider) do nothing;

-- Only service-role can write platform_usage (no user RLS needed)
-- Reads are server-side only via service client
