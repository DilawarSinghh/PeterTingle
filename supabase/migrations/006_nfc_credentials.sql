-- Migration 006: NFC tap-to-login
-- Creates nfc_credentials (card -> user bindings) + nfc_login_logs (audit).
-- Run in: Supabase Dashboard -> SQL Editor
-- Fully re-runnable: uses if not exists / drop policy if exists.

-- === nfc_credentials ========================================================
create table if not exists public.nfc_credentials (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  nfc_tag_id   text not null unique,
  label        text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists nfc_credentials_user_id_idx on public.nfc_credentials(user_id);

alter table public.nfc_credentials enable row level security;

-- Users can read their own cards (for the Settings list).
drop policy if exists "nfc: owner can read own cards" on public.nfc_credentials;
create policy "nfc: owner can read own cards"
  on public.nfc_credentials
  for select
  using (auth.uid() = user_id);

-- Inserts/updates/deletes happen ONLY via the service role (API routes),
-- so no insert/update/delete policies are created for regular users.

-- === nfc_login_logs (audit trail, service-role only) ========================
create table if not exists public.nfc_login_logs (
  id         bigserial primary key,
  nfc_tag_id text,
  user_id    uuid,
  ip         text,
  success    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists nfc_login_logs_created_at_idx on public.nfc_login_logs(created_at desc);

alter table public.nfc_login_logs enable row level security;
-- No policies: only the service role (API routes) may read/write.
