-- =====================================================================
-- Coachella QR guest check-in migration
-- Run this AFTER your existing Supabase setup, in SQL Editor.
-- Safe to run again. Does not delete or reset guest data.
-- =====================================================================

alter table public.guests
  add column if not exists qr_token text,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by text;

-- Backfill existing guests with unguessable 256-bit QR tokens.
update public.guests
set qr_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where qr_token is null;

create unique index if not exists guests_qr_token_uidx
  on public.guests(qr_token);

-- Updated login: preserves nickname login behavior and ensures every guest
-- receives a permanent QR token. Token is returned only to that guest session.
create or replace function public.login_guest(p_nickname text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := lower(trim(p_nickname));
  g public.guests;
begin
  if length(k) < 2 or length(k) > 24 then
    raise exception 'Nickname must be 2 to 24 characters';
  end if;

  perform pg_advisory_xact_lock(hashtext(k));
  select * into g from public.guests where nick_key = k for update;

  if found then
    if g.qr_token is null then
      update public.guests
      set qr_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
      where id = g.id
      returning * into g;
    end if;
    return json_build_object('guest', row_to_json(g), 'is_new', false);
  end if;

  insert into public.guests (nickname, nick_key, qr_token)
  values (trim(p_nickname), k, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
  returning * into g;

  return json_build_object('guest', row_to_json(g), 'is_new', true);
end;
$$;

-- Used by invitation email endpoints after the existing invite-copy limit check.
-- This matches the project's existing nickname-based guest access model.
create or replace function public.get_guest_qr_token(p_nickname text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  token text;
begin
  select qr_token into token
  from public.guests
  where nick_key = lower(trim(p_nickname));

  if token is null then
    raise exception 'Guest QR code not found';
  end if;
  return token;
end;
$$;

-- Organizer-only, atomic check-in. Re-scanning a guest returns the original
-- check-in timestamp and does not create a second attendance record.
create or replace function public.admin_checkin(p_password text, p_qr_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.guests;
  was_checked_in boolean;
begin
  if p_password is distinct from (
    select value from public.admin_config where key = 'admin_password'
  ) then
    perform pg_sleep(1);
    raise exception 'Wrong organizer password';
  end if;

  if coalesce(length(trim(p_qr_token)), 0) < 32 then
    raise exception 'Invalid QR code';
  end if;

  select * into g
  from public.guests
  where qr_token = trim(p_qr_token)
  for update;

  if not found then
    raise exception 'QR code not recognized. Ask the guest to open their invitation again.';
  end if;

  was_checked_in := g.checked_in_at is not null;

  if not was_checked_in then
    update public.guests
    set checked_in_at = now(), checked_in_by = 'organizer'
    where id = g.id
    returning * into g;
  end if;

  return json_build_object(
    'already_checked_in', was_checked_in,
    'guest', json_build_object(
      'nickname', g.nickname,
      'raffle_number', g.raffle_number,
      'checked_in_at', g.checked_in_at
    )
  );
end;
$$;

grant execute on function public.login_guest(text) to anon;
grant execute on function public.get_guest_qr_token(text) to anon;
grant execute on function public.admin_checkin(text, text) to anon;
