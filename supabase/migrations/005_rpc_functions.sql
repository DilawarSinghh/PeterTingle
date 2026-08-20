-- Migration 005: RPC helper functions for BYOK decryption + platform usage increment

-- ─── decrypt_user_api_key ─────────────────────────────────────────────────────
-- Called server-side only (service role) to decrypt a stored API key.
create or replace function public.decrypt_user_api_key(
  p_user_id  uuid,
  p_provider text,
  p_secret   text
) returns text
language plpgsql
security definer
as $$
declare
  v_encrypted text;
begin
  select encrypted_key into v_encrypted
  from public.user_api_keys
  where user_id = p_user_id and provider = p_provider;

  if v_encrypted is null then return null; end if;

  return pgp_sym_decrypt(v_encrypted::bytea, p_secret);
exception when others then
  return null;
end;
$$;

-- ─── encrypt_and_store_api_key ───────────────────────────────────────────────
-- Called from /api/keys to store an encrypted key on behalf of the user.
create or replace function public.encrypt_and_store_api_key(
  p_user_id  uuid,
  p_provider text,
  p_raw_key  text,
  p_secret   text
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.user_api_keys (user_id, provider, encrypted_key)
  values (p_user_id, p_provider, pgp_sym_encrypt(p_raw_key, p_secret)::text)
  on conflict (user_id, provider)
  do update set
    encrypted_key    = pgp_sym_encrypt(p_raw_key, p_secret)::text,
    last_verified_at = null;  -- reset verification on re-save
end;
$$;

-- ─── mark_key_verified ───────────────────────────────────────────────────────
create or replace function public.mark_key_verified(
  p_user_id  uuid,
  p_provider text
) returns void
language plpgsql
security definer
as $$
begin
  update public.user_api_keys
  set last_verified_at = now()
  where user_id = p_user_id and provider = p_provider;
end;
$$;

-- ─── increment_platform_usage ────────────────────────────────────────────────
create or replace function public.increment_platform_usage(
  p_provider text,
  p_tokens   bigint
) returns void
language plpgsql
security definer
as $$
begin
  -- Auto-reset if period has rolled over to a new month
  update public.platform_usage
  set
    tokens_used  = case
      when period_start < date_trunc('month', now())::date
      then p_tokens
      else tokens_used + p_tokens
    end,
    period_start = date_trunc('month', now())::date
  where provider = p_provider;
end;
$$;

-- ─── get_user_key_providers ─────────────────────────────────────────────────
-- Returns which providers a user has keys for (no raw keys exposed).
create or replace function public.get_user_key_providers(p_user_id uuid)
returns table (provider text, last_verified_at timestamptz)
language plpgsql
security definer
as $$
begin
  return query
    select uk.provider, uk.last_verified_at
    from public.user_api_keys uk
    where uk.user_id = p_user_id;
end;
$$;
