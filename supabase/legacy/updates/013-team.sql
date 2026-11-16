-- Update 013: the team page (staff.rooseveltpups.com/team): time clock,
-- staff schedules, hours and paycheck estimates, and time-off requests.
--
-- Run once in Supabase → SQL Editor, after 012. Safe to re-run.
-- Run it on rooseveltpups-dev first, then on the live project, BEFORE pushing
-- the site version that has the team page.
--
-- Who can use the team page:
--   * Anyone whose sign-in email is on the team list (public.employees) and
--     marked active. Nothing else about the account matters, so each employee
--     just needs a login with that email (Authentication → Users → Add user,
--     Auto Confirm). The grooming sheet still only opens for "staff" logins,
--     so an employee's own login can't see dogs, phone numbers or prices.
--   * A manager (is_manager) makes schedules (shifts stay drafts, seen only by
--     managers, until Publish), approves time off, fixes
--     punches and sees everyone's hours and pay. Everyone else sees the whole
--     team's schedule and who's off, but only their own punches, pay rate and
--     tax settings.
--   * Clock-in and clock-out times come from the database's clock, not the
--     phone, so nobody can type in their own times. Only a manager can fix one.
--
-- Last step (at the bottom): put Maureen on the list as the first manager.

-- ---------- 1. The team list ----------

create table if not exists public.employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  is_manager  boolean not null default false,
  position    text not null default '',  -- Manager, Asst. Manager, Daycare Staff…
  pay_type    text not null default 'hourly' check (pay_type in ('hourly', 'commission')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists employees_email on public.employees (lower(email));
alter table public.employees enable row level security;

-- Pay rate and tax settings (federal W-4, New York IT-2104). Only the employee
-- and managers can see a row.
create table if not exists public.employee_pay (
  employee_id        uuid primary key references public.employees (id) on delete cascade,
  hourly_rate        numeric(8, 2) not null default 0 check (hourly_rate >= 0),
  filing_status      text not null default 'single' check (filing_status in ('single', 'married', 'head')),
  step2              boolean not null default false,  -- W-4 Step 2 box (two jobs)
  dependents         numeric(10, 2) not null default 0, -- W-4 Step 3, dollars a year
  other_income       numeric(10, 2) not null default 0, -- W-4 Step 4(a), dollars a year
  deductions         numeric(10, 2) not null default 0, -- W-4 Step 4(b), dollars a year
  extra_withholding  numeric(8, 2) not null default 0,  -- W-4 Step 4(c), dollars a paycheck
  pretax             numeric(8, 2) not null default 0,  -- 401(k) and similar, dollars a paycheck
  ny_status          text not null default 'single' check (ny_status in ('single', 'married')),
  ny_allowances      smallint not null default 0 check (ny_allowances >= 0),
  ny_extra           numeric(8, 2) not null default 0,  -- IT-2104 extra, dollars a paycheck
  nyc_resident       boolean not null default false,
  updated_at         timestamptz not null default now()
);
alter table public.employee_pay enable row level security;

-- ---------- 2. Schedules, punches, time off ----------

-- One scheduled shift. Times are minutes after midnight (540 = 9:00), like the sheet.
create table if not exists public.shifts (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  date         date not null,
  start_min    smallint not null check (start_min between 0 and 1439),
  end_min      smallint not null check (end_min between 1 and 1440),
  break_min    smallint not null default 0 check (break_min >= 0),
  title        text not null default '',  -- Open, Close, All Day…
  note         text not null default '',
  published    boolean not null default false, -- employees only see published shifts
  created_at   timestamptz not null default now(),
  check (end_min > start_min)
);
create index if not exists shifts_date on public.shifts (date);
alter table public.shifts enable row level security;

-- One clock-in to clock-out. Clocking out for lunch and back in makes two punches.
create table if not exists public.punches (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  clock_in     timestamptz not null default now(),
  clock_out    timestamptz,
  note         text not null default '',
  edited_by    text,          -- the manager's name, when a manager added or fixed it
  edited_at    timestamptz,
  check (clock_out is null or clock_out > clock_in)
);
create index if not exists punches_clock_in on public.punches (clock_in);
-- Nobody can be clocked in twice at once.
create unique index if not exists punches_one_open on public.punches (employee_id) where clock_out is null;
alter table public.punches enable row level security;

create table if not exists public.time_off (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  reason       text not null default '',
  status       text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by   text,
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists time_off_end on public.time_off (end_date);
alter table public.time_off enable row level security;

-- ---------- 3. Who is who ----------

-- The signed-in person's row on the team list (null when they aren't on it).
-- Only a confirmed email counts.
create or replace function public.my_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
    from public.employees e
    join auth.users u on lower(u.email) = lower(e.email)
   where u.id = auth.uid()
     and u.email_confirmed_at is not null
     and e.active
$$;

create or replace function public.is_team_member()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.my_employee_id() is not null
$$;

create or replace function public.is_team_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select e.is_manager from public.employees e where e.id = public.my_employee_id()), false)
$$;

revoke all on function public.my_employee_id() from public, anon;
revoke all on function public.is_team_member() from public, anon;
revoke all on function public.is_team_manager() from public, anon;
grant execute on function public.my_employee_id() to authenticated;
grant execute on function public.is_team_member() to authenticated;
grant execute on function public.is_team_manager() to authenticated;

-- ---------- 4. Rules ----------
-- "(select ...)" makes the check run once per query instead of once per row.

drop policy if exists "Team can see the team" on public.employees;
create policy "Team can see the team" on public.employees
  for select to authenticated using ((select public.is_team_member()));
drop policy if exists "Managers change the team" on public.employees;
create policy "Managers change the team" on public.employees
  for all to authenticated using ((select public.is_team_manager())) with check ((select public.is_team_manager()));

drop policy if exists "Own pay or managers" on public.employee_pay;
create policy "Own pay or managers" on public.employee_pay
  for select to authenticated using (employee_id = (select public.my_employee_id()) or (select public.is_team_manager()));
drop policy if exists "Managers change pay" on public.employee_pay;
create policy "Managers change pay" on public.employee_pay
  for all to authenticated using ((select public.is_team_manager())) with check ((select public.is_team_manager()));

drop policy if exists "Team can see shifts" on public.shifts;
create policy "Team can see shifts" on public.shifts
  for select to authenticated using ((select public.is_team_member()) and published);
drop policy if exists "Managers change shifts" on public.shifts;
create policy "Managers change shifts" on public.shifts
  for all to authenticated using ((select public.is_team_manager())) with check ((select public.is_team_manager()));

drop policy if exists "Own punches or managers" on public.punches;
create policy "Own punches or managers" on public.punches
  for select to authenticated using (employee_id = (select public.my_employee_id()) or (select public.is_team_manager()));
drop policy if exists "Managers fix punches" on public.punches;
create policy "Managers fix punches" on public.punches
  for all to authenticated using ((select public.is_team_manager())) with check ((select public.is_team_manager()));

drop policy if exists "Own requests or managers" on public.time_off;
create policy "Own requests or managers" on public.time_off
  for select to authenticated using (employee_id = (select public.my_employee_id()) or (select public.is_team_manager()));
drop policy if exists "Managers decide time off" on public.time_off;
create policy "Managers decide time off" on public.time_off
  for all to authenticated using ((select public.is_team_manager())) with check ((select public.is_team_manager()));

-- ---------- 5. What everyone's phone can do ----------

-- Clock in now. Fails if already clocked in.
create or replace function public.clock_in()
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
  if exists (select 1 from punches where employee_id = me and clock_out is null) then
    raise exception 'Already clocked in';
  end if;
  insert into punches (employee_id, clock_in) values (me, now());
end;
$$;

-- Clock out now.
create or replace function public.clock_out()
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
  update punches set clock_out = now() where employee_id = me and clock_out is null;
  if not found then
    raise exception 'Not clocked in';
  end if;
end;
$$;

-- Ask for time off (a manager approves it on the team page).
create or replace function public.request_time_off(first_day date, last_day date, reason text)
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
  if first_day < current_date then
    raise exception 'That day has already passed';
  end if;
  if last_day < first_day or last_day > first_day + 60 then
    raise exception 'Pick an end date on or after the start, at most 60 days later';
  end if;
  insert into time_off (employee_id, start_date, end_date, reason)
  values (me, first_day, last_day, left(coalesce(reason, ''), 300));
end;
$$;

-- Take back a request that's still waiting, or clear a declined one.
create or replace function public.withdraw_time_off(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from time_off
   where id = request_id
     and employee_id = public.my_employee_id()
     and status in ('pending', 'declined');
end;
$$;

-- Everyone's approved time off between two dates, without the reasons, so the
-- whole team can see who's off.
create or replace function public.team_time_off(from_date date, to_date date)
returns table (id uuid, employee_id uuid, start_date date, end_date date)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.employee_id, t.start_date, t.end_date
    from time_off t
   where public.is_team_member()
     and t.status = 'approved'
     and t.end_date >= from_date
     and t.start_date <= to_date
   order by t.start_date;
$$;

revoke all on function public.clock_in() from public, anon;
revoke all on function public.clock_out() from public, anon;
revoke all on function public.request_time_off(date, date, text) from public, anon;
revoke all on function public.withdraw_time_off(uuid) from public, anon;
revoke all on function public.team_time_off(date, date) from public, anon;
grant execute on function public.clock_in() to authenticated;
grant execute on function public.clock_out() to authenticated;
grant execute on function public.request_time_off(date, date, text) to authenticated;
grant execute on function public.withdraw_time_off(uuid) to authenticated;
grant execute on function public.team_time_off(date, date) to authenticated;

-- ---------- Last step: Maureen is the first manager ----------
-- Replace the email with the one Maureen signs in with, then run just this.
-- After that she adds everyone else on the team page (Team tab).
--
-- insert into public.employees (name, email, is_manager)
-- values ('Maureen', 'MAUREENS-EMAIL-HERE', true)
-- on conflict ((lower(email))) do update set is_manager = true, active = true;
