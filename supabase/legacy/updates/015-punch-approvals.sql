-- Update 015: approving punches, street addresses, and each punch's history
-- (team page → Clock → Review).
--
-- Run once in Supabase → SQL Editor, after 014. Safe to re-run.
-- Run it BEFORE pushing the site version with Review.
--
-- After this update:
--   * A manager approves each finished punch (or all at once). Changing a
--     punch's times takes the approval away again, so it gets looked at.
--   * Clocking in or out also saves the street address the phone was at
--     (looked up on the phone from OpenStreetMap), for the punch details page.
--   * Every punch keeps a history: clocked in, clocked out, times changed (from
--     what to what, and by whom), approved, unapproved. Written by the database
--     itself, so it can't be skipped.

-- ---------- 1. Approval and addresses on each punch ----------

alter table public.punches
  add column if not exists approved_by  text,          -- the manager's name
  add column if not exists approved_at  timestamptz,
  add column if not exists in_address   text,
  add column if not exists out_address  text;

-- ---------- 2. Each punch's history ----------

create table if not exists public.punch_events (
  id         bigint generated always as identity primary key,
  punch_id   uuid not null references public.punches (id) on delete cascade,
  kind       text not null check (kind in ('in', 'out', 'added', 'changed', 'approved', 'unapproved')),
  detail     text not null default '',
  by_name    text,
  at         timestamptz not null default now()
);
create index if not exists punch_events_punch on public.punch_events (punch_id);
alter table public.punch_events enable row level security;

-- The punch's owner and managers can read it; only the trigger below writes it.
drop policy if exists "Own punch history or managers" on public.punch_events;
create policy "Own punch history or managers" on public.punch_events
  for select to authenticated
  using ((select public.is_team_manager()) or exists (
    select 1 from public.punches p where p.id = punch_id and p.employee_id = (select public.my_employee_id())
  ));

-- ---------- 3. Writing the history, and un-approving changed punches ----------

-- "9:02 AM" in New York time, for history notes.
create or replace function public.ny_clock(t timestamptz)
returns text
language sql
immutable
as $$
  select case when t is null then 'still in' else ltrim(to_char(t at time zone 'America/New_York', 'FMHH12:MI AM'), '0') end
$$;

create or replace function public.punch_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text := (select e.name from employees e where e.id = public.my_employee_id());
  changes text := '';
begin
  if tg_op = 'INSERT' then
    -- Clocked in from the phone, or added by a manager.
    if new.edited_by is null then
      insert into punch_events (punch_id, kind, by_name, at) values (new.id, 'in', who, new.clock_in);
    else
      insert into punch_events (punch_id, kind, detail, by_name)
      values (new.id, 'added', public.ny_clock(new.clock_in) || ' – ' || public.ny_clock(new.clock_out), who);
    end if;
    return new;
  end if;

  -- Clocked out from the phone.
  if old.clock_out is null and new.clock_out is not null and new.edited_at is not distinct from old.edited_at then
    insert into punch_events (punch_id, kind, by_name, at) values (new.id, 'out', who, new.clock_out);
  -- Times changed by a manager.
  elsif new.clock_in is distinct from old.clock_in or new.clock_out is distinct from old.clock_out then
    if new.clock_in is distinct from old.clock_in then
      changes := 'In ' || public.ny_clock(old.clock_in) || ' → ' || public.ny_clock(new.clock_in);
    end if;
    if new.clock_out is distinct from old.clock_out then
      changes := changes || case when changes = '' then '' else ', ' end
                 || 'Out ' || public.ny_clock(old.clock_out) || ' → ' || public.ny_clock(new.clock_out);
    end if;
    insert into punch_events (punch_id, kind, detail, by_name) values (new.id, 'changed', changes, who);
  end if;

  if new.approved_at is not null and old.approved_at is null then
    insert into punch_events (punch_id, kind, by_name) values (new.id, 'approved', coalesce(new.approved_by, who));
  elsif new.approved_at is null and old.approved_at is not null then
    insert into punch_events (punch_id, kind, by_name) values (new.id, 'unapproved', who);
  end if;
  return new;
end;
$$;

-- Changing the times takes the approval away (unless the same change approves it).
create or replace function public.punch_unapprove_on_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.clock_in is distinct from old.clock_in or new.clock_out is distinct from old.clock_out)
     and old.clock_out is not null
     and new.approved_at is not distinct from old.approved_at then
    new.approved_at := null;
    new.approved_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists punch_unapprove_on_change on public.punches;
create trigger punch_unapprove_on_change before update on public.punches
  for each row execute function public.punch_unapprove_on_change();

drop trigger if exists punch_history on public.punches;
create trigger punch_history after insert or update on public.punches
  for each row execute function public.punch_history();

-- ---------- 4. Clock in and out, now with the street address ----------
-- Replaces the versions from update 014 (every argument still optional).

drop function if exists public.clock_in(double precision, double precision, real);
drop function if exists public.clock_out(double precision, double precision, real);

create or replace function public.clock_in(lat double precision default null, lng double precision default null, accuracy real default null, address text default null)
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
  insert into punches (employee_id, clock_in, in_lat, in_lng, in_accuracy, in_address)
  values (me, now(), case when ok then lat end, case when ok then lng end, case when ok then accuracy end,
          case when ok then left(address, 200) end);
end;
$$;

create or replace function public.clock_out(lat double precision default null, lng double precision default null, accuracy real default null, address text default null)
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
         out_accuracy = case when ok then accuracy end,
         out_address = case when ok then left(address, 200) end
   where employee_id = me and clock_out is null;
  if not found then
    raise exception 'Not clocked in';
  end if;
end;
$$;

revoke all on function public.clock_in(double precision, double precision, real, text) from public, anon;
revoke all on function public.clock_out(double precision, double precision, real, text) from public, anon;
grant execute on function public.clock_in(double precision, double precision, real, text) to authenticated;
grant execute on function public.clock_out(double precision, double precision, real, text) to authenticated;

-- ---------- 5. Punches from before this update ----------
-- Everything already finished counts as approved, so Review starts clean.
-- (Remove these lines if you'd rather review old punches too.)

update public.punches
   set approved_at = now(), approved_by = 'Before review started'
 where clock_out is not null and approved_at is null and clock_out < now() - interval '7 days';
