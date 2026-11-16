-- Update 018: settings (⚙️ on the team page).
--
-- Run once in Supabase → SQL Editor, after 017. Safe to re-run.
--
-- After this update:
--   * Business settings a manager can change (team_settings): the shop's
--     address, how early Clock in
--     opens, "clock in anyway", rounding punches to the hour, shift quick picks, positions, reminder timing,
--     quiet hours, and the location notice text. The send-push function reads
--     the reminder timing and quiet hours from here.
--   * Each person's private details (employee_private): phone, emergency
--     contact, and when they acknowledged the location notice (New York Civil
--     Rights Law § 52-c). Only that person and managers can see them; people
--     change their own through the functions below.

-- ---------- 1. Business settings ----------

alter table public.team_settings
  add column if not exists shop_address    text     not null default '',   -- the shop's street address, for showing
  add column if not exists clock_in_early  smallint not null default 30,   -- minutes before a shift
  add column if not exists allow_anyway    boolean  not null default true, -- "clock in anyway" link
  add column if not exists round_within    smallint not null default 10,   -- round punches to the hour within this many minutes (0 = off)
  add column if not exists shift_presets   jsonb    not null default '[{"title":"Open","start":480,"end":840},{"title":"Close","start":840,"end":1200},{"title":"All Day","start":480,"end":1200},{"title":"All Day Saturday","start":480,"end":1140}]',
  add column if not exists positions       text[]   not null default '{"Manager","Asst. Manager","Daycare Staff","Groomer","Front desk"}',
  add column if not exists remind_before   smallint not null default 30,   -- shift reminder
  add column if not exists remind_after    smallint not null default 30,   -- "still clocked in?"
  add column if not exists late_after      smallint not null default 15,   -- late alert to managers
  add column if not exists quiet_from      smallint not null default 1260, -- 9 PM, minutes after midnight
  add column if not exists quiet_to        smallint not null default 360,  -- 6 AM
  add column if not exists notice_text     text     not null default '',
  add column if not exists notice_version  integer  not null default 1;

insert into public.team_settings (id) values (1) on conflict (id) do nothing;

-- The starting notice (managers can edit it in ⚙️ → Business). Only filled in if empty.
update public.team_settings set notice_text =
'Notice of electronic monitoring (New York Civil Rights Law § 52-c)

Roosevelt Pups records the location of your phone at the moment you clock in and the moment you clock out in the Island Schedule app. It is used to confirm where work started and ended (for example at the shop, or at a dog pick-up), and is kept with your time records.

Your location is not tracked at any other time. You can see your own clock-in and clock-out places in the app, and managers can see them for everyone.

By tapping "I''ve read this", you acknowledge that you received this notice.'
where id = 1 and notice_text = '';

-- ---------- 2. Each person's private details ----------

create table if not exists public.employee_private (
  employee_id      uuid primary key references public.employees (id) on delete cascade,
  phone            text not null default '',
  emergency_name   text not null default '',
  emergency_phone  text not null default '',
  notice_ack_at    timestamptz,
  notice_version   integer,
  updated_at       timestamptz not null default now()
);
alter table public.employee_private enable row level security;

drop policy if exists "Own details or managers" on public.employee_private;
create policy "Own details or managers" on public.employee_private
  for select to authenticated using (employee_id = (select public.my_employee_id()) or (select public.is_team_manager()));

create or replace function public.set_my_contact(new_phone text, new_emergency_name text, new_emergency_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_employee_id();
begin
  if me is null then
    raise exception 'Not on the team list';
  end if;
  insert into employee_private (employee_id, phone, emergency_name, emergency_phone)
  values (me, left(coalesce(new_phone, ''), 40), left(coalesce(new_emergency_name, ''), 80), left(coalesce(new_emergency_phone, ''), 40))
  on conflict (employee_id) do update set phone = excluded.phone, emergency_name = excluded.emergency_name,
    emergency_phone = excluded.emergency_phone, updated_at = now();
end;
$$;

-- "I've read this": saves when, and which version of the notice.
create or replace function public.ack_location_notice()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_employee_id();
begin
  if me is null then
    raise exception 'Not on the team list';
  end if;
  insert into employee_private (employee_id, notice_ack_at, notice_version)
  values (me, now(), (select s.notice_version from team_settings s where s.id = 1))
  on conflict (employee_id) do update set notice_ack_at = excluded.notice_ack_at, notice_version = excluded.notice_version, updated_at = now();
end;
$$;

revoke all on function public.set_my_contact(text, text, text) from public, anon;
revoke all on function public.ack_location_notice() from public, anon;
grant execute on function public.set_my_contact(text, text, text) to authenticated;
grant execute on function public.ack_location_notice() to authenticated;

notify pgrst, 'reload schema';
