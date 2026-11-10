-- Coachella Event Hub add-on. Run once in Supabase SQL Editor.
-- Adds public announcements, guest table assignments, and one feedback entry per guest.
create table if not exists public.event_announcements (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 90),
  message text not null check (char_length(message) between 1 and 600),
  created_at timestamptz not null default now(),
  active boolean not null default true
);
create table if not exists public.event_table_assignments (
  guest_id bigint primary key references public.guests(id) on delete cascade,
  table_label text not null check (char_length(table_label) between 1 and 40),
  updated_at timestamptz not null default now()
);
create table if not exists public.event_feedback (
  guest_id bigint primary key references public.guests(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 600),
  created_at timestamptz not null default now()
);
alter table public.event_announcements enable row level security;
alter table public.event_table_assignments enable row level security;
alter table public.event_feedback enable row level security;

create or replace function public.event_hub_data(p_nickname text default '')
returns json language plpgsql security definer set search_path = public as $$
declare g public.guests; result_table json;
begin
  if length(trim(coalesce(p_nickname,''))) > 0 then
    select * into g from public.guests where nick_key = lower(trim(p_nickname));
    if not found then raise exception 'Guest nickname not found. Use the nickname from your invitation.'; end if;
    select json_build_object('table_label', a.table_label, 'updated_at', a.updated_at)
      into result_table from public.event_table_assignments a where a.guest_id = g.id;
  end if;
  return json_build_object(
    'announcements', coalesce((select json_agg(json_build_object('id',id,'title',title,'message',message,'created_at',created_at) order by created_at desc)
      from public.event_announcements where active), '[]'::json),
    'table_assignment', result_table
  );
end $$;

create or replace function public.submit_event_feedback(p_nickname text, p_rating int, p_comment text default '')
returns json language plpgsql security definer set search_path = public as $$
declare g public.guests;
begin
  if p_rating not between 1 and 5 then raise exception 'Rating must be from 1 to 5'; end if;
  if char_length(coalesce(p_comment,'')) > 600 then raise exception 'Feedback is too long'; end if;
  select * into g from public.guests where nick_key = lower(trim(p_nickname));
  if not found then raise exception 'Guest nickname not found'; end if;
  insert into public.event_feedback(guest_id,rating,comment) values(g.id,p_rating,trim(coalesce(p_comment,'')))
  on conflict(guest_id) do update set rating=excluded.rating, comment=excluded.comment, created_at=now();
  return json_build_object('saved',true);
end $$;

create or replace function public.admin_publish_announcement(p_password text, p_title text, p_message text)
returns json language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if p_password is distinct from (select value from public.admin_config where key='admin_password') then raise exception 'Wrong organizer password'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 1 and 90 then raise exception 'Title must be 1 to 90 characters'; end if;
  if char_length(trim(coalesce(p_message,''))) not between 1 and 600 then raise exception 'Message must be 1 to 600 characters'; end if;
  insert into public.event_announcements(title,message) values(trim(p_title),trim(p_message)) returning id into new_id;
  return json_build_object('id',new_id);
end $$;

create or replace function public.admin_assign_table(p_password text, p_nickname text, p_table_label text)
returns json language plpgsql security definer set search_path = public as $$
declare g public.guests;
begin
  if p_password is distinct from (select value from public.admin_config where key='admin_password') then raise exception 'Wrong organizer password'; end if;
  if char_length(trim(coalesce(p_table_label,''))) not between 1 and 40 then raise exception 'Table name must be 1 to 40 characters'; end if;
  select * into g from public.guests where nick_key=lower(trim(p_nickname));
  if not found then raise exception 'Guest nickname not found'; end if;
  insert into public.event_table_assignments(guest_id,table_label) values(g.id,trim(p_table_label))
  on conflict(guest_id) do update set table_label=excluded.table_label, updated_at=now();
  return json_build_object('saved',true);
end $$;

grant execute on function public.event_hub_data(text) to anon, authenticated;
grant execute on function public.submit_event_feedback(text,int,text) to anon, authenticated;
grant execute on function public.admin_publish_announcement(text,text,text) to anon, authenticated;
grant execute on function public.admin_assign_table(text,text,text) to anon, authenticated;
