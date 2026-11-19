-- Update 031: onboarding (business name and logo, and "first setup done").
--
-- Run once in Supabase → SQL Editor, after 030. Safe to re-run. Dev project first, then live,
-- BEFORE pushing the site version that has the setup wizard.
--
-- After this update:
--   * Settings → Business has a business name and a small logo. They replace "WiseShift" in the header,
--     the side menu and on the kiosk.
--   * Settings → Business has store hours (open, close, closed days). They set the day view's time range and, if
--     asked, the Open / Close / All Day quick-pick shifts.
--   * team_settings.setup_done says whether the owner has been through the first-setup wizard.
--     Every business that already exists is marked done (so nobody is surprised); a new business is
--     created with setup_done = false and the owner sees the wizard once.

alter table public.team_settings
  add column if not exists business_name text not null default '' check (length(business_name) <= 60),
  add column if not exists business_logo text not null default '' check (length(business_logo) <= 120000 and (business_logo = '' or business_logo like 'data:image/%')),
  add column if not exists setup_done boolean not null default true,
  -- When the business is open: { "open": minutes, "close": minutes, "closed": [weekday numbers, 0 = Sunday] }, or {} if not set.
  add column if not exists store_hours jsonb not null default '{}'::jsonb;

-- The existing rules already let the whole team read settings, and only managers change them,
-- so no new policies are needed.

-- The kiosk page has no sign-in, so it asks for the business's name and logo with its device token
-- (a registered, unrevoked kiosk only). This is separate from kiosk_info so that function keeps its shape.
create or replace function public.kiosk_brand(device_token text)
returns table (business_name text, business_logo text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select s.business_name, s.business_logo
    from team_settings s
   where s.id = 1
     and exists (select 1 from kiosk_devices d where d.token_hash = encode(digest(coalesce(device_token, ''), 'sha256'), 'hex') and d.revoked_at is null)
$$;

revoke all on function public.kiosk_brand(text) from public;
grant execute on function public.kiosk_brand(text) to anon, authenticated;

notify pgrst, 'reload schema';
