-- =====================================================================
--  McDonald's Year End Party: Supabase setup
--  Run ONCE in: Supabase dashboard > SQL Editor > New query > paste all > Run
--  Safe to run again later (it will not delete guests).
-- =====================================================================

-- STEP 1: put your organizer password below (replace the text inside the quotes) <<< CHANGE ME
create table if not exists admin_config (key text primary key, value text not null);
alter table admin_config enable row level security;
insert into admin_config (key, value) values ('admin_password', 'CHANGE-ME-TO-A-STRONG-PASSWORD')
on conflict (key) do update set value = excluded.value;

-- Guests table
create table if not exists guests (
  id bigint generated always as identity primary key,
  nickname text not null,
  nick_key text not null unique,
  raffle_number int unique check (raffle_number between 1 and 150),
  rerolled boolean not null default false,
  rsvp text not null default 'pending',
  talent_status text not null default 'pending',   -- pending | yes | no
  real_name text,
  stage_name text,
  talent_files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
-- upgrade path if an older version of the table already exists
alter table guests alter column raffle_number drop not null;
alter table guests add column if not exists rerolled boolean not null default false;
alter table guests add column if not exists talent_status text not null default 'pending';
alter table guests add column if not exists real_name text;
alter table guests add column if not exists stage_name text;
alter table guests add column if not exists talent_files jsonb not null default '[]'::jsonb;
alter table guests enable row level security;      -- the website can only use the functions below

drop function if exists update_guest(text, text, int, text);

-- Login / sign up with a nickname (no raffle number yet)
create or replace function login_guest(p_nickname text)
returns json language plpgsql security definer set search_path = public as $$
declare k text := lower(trim(p_nickname)); g guests;
begin
  if length(k) < 2 or length(k) > 24 then raise exception 'Nickname must be 2 to 24 characters'; end if;
  perform pg_advisory_xact_lock(hashtext(k));
  select * into g from guests where nick_key = k;
  if found then return json_build_object('guest', row_to_json(g), 'is_new', false); end if;
  insert into guests (nickname, nick_key) values (trim(p_nickname), k) returning * into g;
  return json_build_object('guest', row_to_json(g), 'is_new', true);
end $$;

-- "Get my raffle number": random free number 1-150 (calling twice returns the same number)
create or replace function claim_number(p_nickname text)
returns json language plpgsql security definer set search_path = public as $$
declare g guests; n int;
begin
  perform pg_advisory_xact_lock(150);
  select * into g from guests where nick_key = lower(trim(p_nickname)) for update;
  if not found then raise exception 'Guest not found'; end if;
  if g.raffle_number is not null then return row_to_json(g); end if;
  select s into n from generate_series(1, 150) s
    where s not in (select raffle_number from guests where raffle_number is not null)
    order by random() limit 1;
  if n is null then raise exception 'All 150 raffle numbers are taken'; end if;
  update guests set raffle_number = n where id = g.id returning * into g;
  return row_to_json(g);
end $$;

-- One re-roll only; the old number goes back into the pool
create or replace function reroll_number(p_nickname text)
returns json language plpgsql security definer set search_path = public as $$
declare g guests; n int;
begin
  perform pg_advisory_xact_lock(150);
  select * into g from guests where nick_key = lower(trim(p_nickname)) for update;
  if not found then raise exception 'Guest not found'; end if;
  if g.raffle_number is null then raise exception 'Get your first number before re-rolling'; end if;
  if g.rerolled then raise exception 'You already used your one re-roll'; end if;
  select s into n from generate_series(1, 150) s
    where s not in (select raffle_number from guests where raffle_number is not null)
    order by random() limit 1;
  if n is null then raise exception 'No other numbers are available right now'; end if;
  update guests set raffle_number = n, rerolled = true where id = g.id returning * into g;
  return row_to_json(g);
end $$;

-- RSVP
create or replace function save_rsvp(p_nickname text, p_rsvp text)
returns json language plpgsql security definer set search_path = public as $$
declare g guests;
begin
  if p_rsvp not in ('going', 'maybe', 'no') then raise exception 'Invalid RSVP'; end if;
  update guests set rsvp = p_rsvp where nick_key = lower(trim(p_nickname)) returning * into g;
  if not found then raise exception 'Guest not found'; end if;
  return row_to_json(g);
end $$;

-- Talent entry (files are uploaded to Storage by the website, this saves the list)
create or replace function save_talent(p_nickname text, p_will_show boolean, p_real_name text, p_stage_name text, p_files jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare g guests; files jsonb := coalesce(p_files, '[]'::jsonb);
begin
  if jsonb_typeof(files) <> 'array' or jsonb_array_length(files) > 5 then raise exception 'Up to 5 files only'; end if;
  if p_will_show and (length(trim(coalesce(p_real_name, ''))) < 1 or length(trim(coalesce(p_stage_name, ''))) < 1) then
    raise exception 'Please fill in your real name and stage name';
  end if;
  update guests set
    talent_status = case when p_will_show then 'yes' else 'no' end,
    real_name  = case when p_will_show then left(trim(p_real_name), 80) else null end,
    stage_name = case when p_will_show then left(trim(p_stage_name), 40) else null end,
    talent_files = case when p_will_show then files else '[]'::jsonb end
  where nick_key = lower(trim(p_nickname)) returning * into g;
  if not found then raise exception 'Guest not found'; end if;
  return row_to_json(g);
end $$;

-- Organizer list (needs the password from STEP 1)
create or replace function admin_list(p_password text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if p_password is distinct from (select value from admin_config where key = 'admin_password') then
    perform pg_sleep(1);
    raise exception 'Wrong organizer password';
  end if;
  return coalesce((select json_agg(row_to_json(g) order by g.raffle_number nulls last) from guests g), '[]'::json);
end $$;

grant execute on function login_guest(text) to anon;
grant execute on function claim_number(text) to anon;
grant execute on function reroll_number(text) to anon;
grant execute on function save_rsvp(text, text) to anon;
grant execute on function save_talent(text, boolean, text, text, jsonb) to anon;
grant execute on function admin_list(text) to anon;

-- Storage bucket for talent uploads (50 MB per file). Files get random folder names;
-- only organizers see the links (in the organizer desk).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('talent-uploads', 'talent-uploads', true, 52428800,
  array['image/*','video/*','audio/*','application/pdf','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "talent uploads: anyone can upload" on storage.objects;
create policy "talent uploads: anyone can upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'talent-uploads');
