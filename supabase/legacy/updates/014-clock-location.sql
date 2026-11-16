-- Update 014: where people clock in and out (team page).
--
-- Run once in Supabase → SQL Editor, after 013. Safe to re-run.
-- Run it BEFORE pushing the site version that saves locations.
--
-- After this update:
--   * Clocking in or out saves the phone's location at that moment (only then,
--     never in between), with how accurate the phone says it is. Someone who
--     doesn't allow location can still clock in; the punch just has no location.
--   * Managers see each punch's place on the team page: "At the shop", or how
--     far away it was, with a link to the map. Employees see their own.
--   * The shop's location is set once by a manager (Team tab → Shop location).
--
-- New York law (Civil Rights Law § 52-c) requires telling employees in writing,
-- when they're hired, that their location is recorded, getting their
-- acknowledgment, and posting the notice where they can see it.

-- ---------- 1. Location on each punch ----------

alter table public.punches
  add column if not exists in_lat       double precision,
  add column if not exists in_lng       double precision,
  add column if not exists in_accuracy  real,  -- meters, as reported by the phone
  add column if not exists out_lat      double precision,
  add column if not exists out_lng      double precision,
  add column if not exists out_accuracy real;

-- ---------- 2. Where the shop is ----------

create table if not exists public.team_settings (
  id            smallint primary key default 1 check (id = 1),  -- only one row
  shop_lat      double precision,
  shop_lng      double precision,
  shop_radius   real not null default 152.4,                    -- meters that count as "at the shop"
  updated_at    timestamptz not null default now()
);
insert into public.team_settings (id) values (1) on conflict (id) do nothing;
alter table public.team_settings enable row level security;

drop policy if exists "Team can see settings" on public.team_settings;
create policy "Team can see settings" on public.team_settings
  for select to authenticated using ((select public.is_team_member()));
drop policy if exists "Managers change settings" on public.team_settings;
create policy "Managers change settings" on public.team_settings
  for update to authenticated using ((select public.is_team_manager())) with check ((select public.is_team_manager()));

-- ---------- 3. Clock in and out, with the location ----------
-- Replaces the versions from update 013. Every argument is optional, so a phone
-- still showing the older page can clock in too.

drop function if exists public.clock_in();
drop function if exists public.clock_out();

-- A location only counts if it's a real place on Earth.
create or replace function public.valid_spot(lat double precision, lng double precision)
returns boolean
language sql
immutable
as $$
  select lat between -90 and 90 and lng between -180 and 180
$$;

create or replace function public.clock_in(lat double precision default null, lng double precision default null, accuracy real default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_employee_id();
  ok boolean := lat is not null and lng is not null and public.valid_spot(lat, lng);
begin
  if me is null then
    raise exception 'Not on the team list';
  end if;
  if exists (select 1 from punches where employee_id = me and clock_out is null) then
    raise exception 'Already clocked in';
  end if;
  insert into punches (employee_id, clock_in, in_lat, in_lng, in_accuracy)
  values (me, now(), case when ok then lat end, case when ok then lng end, case when ok then accuracy end);
end;
$$;

create or replace function public.clock_out(lat double precision default null, lng double precision default null, accuracy real default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_employee_id();
  ok boolean := lat is not null and lng is not null and public.valid_spot(lat, lng);
begin
  if me is null then
    raise exception 'Not on the team list';
  end if;
  update punches
     set clock_out = now(),
         out_lat = case when ok then lat end,
         out_lng = case when ok then lng end,
         out_accuracy = case when ok then accuracy end
   where employee_id = me and clock_out is null;
  if not found then
    raise exception 'Not clocked in';
  end if;
end;
$$;

revoke all on function public.clock_in(double precision, double precision, real) from public, anon;
revoke all on function public.clock_out(double precision, double precision, real) from public, anon;
grant execute on function public.clock_in(double precision, double precision, real) to authenticated;
grant execute on function public.clock_out(double precision, double precision, real) to authenticated;
