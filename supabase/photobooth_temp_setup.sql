-- Coachella Photo Booth: private temporary storage + automatic cleanup
-- Run this in Supabase SQL Editor after enabling Vault, pg_cron, and pg_net.

create table if not exists public.photobooth_temp_photos (
  token_hash text primary key,
  object_path text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.photobooth_temp_photos enable row level security;
create index if not exists photobooth_temp_photos_expires_at_idx on public.photobooth_temp_photos (expires_at);
revoke all on table public.photobooth_temp_photos from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photobooth-temp', 'photobooth-temp', false, 8388608, array['image/jpeg']::text[])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg']::text[];

-- Store these three secrets in Supabase Vault (replace the values before running):
-- select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co/functions/v1/photobooth-share', 'photobooth_cleanup_url');
-- select vault.create_secret('YOUR_SUPABASE_SERVICE_ROLE_KEY', 'photobooth_cleanup_service_key');
-- select vault.create_secret('YOUR_RANDOM_CLEANUP_SECRET', 'photobooth_cleanup_secret');

-- Enable extensions in Dashboard > Database > Extensions if not already enabled:
-- pg_cron, pg_net, supabase_vault

-- Schedule cleanup every minute. It deletes expired objects from Storage and their DB records.
-- Run only AFTER creating the three Vault secrets above.
select cron.schedule(
  'coachella-photobooth-temp-cleanup',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'photobooth_cleanup_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'photobooth_cleanup_service_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'photobooth_cleanup_service_key'),
      'x-action', 'cleanup',
      'x-cleanup-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'photobooth_cleanup_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
