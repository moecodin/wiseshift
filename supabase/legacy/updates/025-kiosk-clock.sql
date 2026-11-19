-- Update 025: kiosk clock-in (a store computer where people clock in with a PIN).
--
-- Run once in Supabase → SQL Editor, after 020 (it needs 013, 015, 018 and 020). Safe to re-run.
-- Run it on the dev project first, then live, BEFORE pushing the site version that
-- has the kiosk page. Nothing changes for anyone until a business turns on
-- Settings → Features → Kiosk clock-in AND a manager registers a kiosk device.
--
-- After this update:
--   * Each person can have a PIN (4 to 6 digits). A manager sets or clears anyone's;
--     a person can set their own. PINs are stored hashed, in a table nobody can read
--     directly, so they never show up in the team list. A PIN is unique among the
--     people on the team.
--   * A manager registers a kiosk device (the store computer). The device gets a long
--     random token, shown once and stored hashed. The kiosk page sends the token and
--     the PIN; it needs no sign-in, so the computer never holds a person's login.
--     Revoking a device stops it at once.
--   * kiosk_lookup(token, pin) says who a PIN belongs to and what a punch would do; the
--     kiosk shows "Hi Maria, clock in?" and, on Confirm, kiosk_punch(token, pin, anyway)
--     clocks the person in, or out if they are clocked in. Clocking in follows the same
--     early window as the phone; "Clock in anyway" skips it (when Settings allows) and
--     Hours review flags the punch. The time comes from the database's clock. Five wrong
--     PINs in a row lock that device for five minutes.
--   * A punch remembers which device clocked it in or out (in_kiosk_id, out_kiosk_id).
--     Null means the phone (or a manager's fix).
--
-- Needs pgcrypto, which Supabase has in the "extensions" schema.

create extension if not exists pgcrypto with schema extensions;

-- ---------- 1. PINs ----------
-- Row level security on, and no rules: only the functions below (which run as the
-- table owner) can read or write it.

create table if not exists public.employee_pins (
  employee_id  uuid primary key references public.employees (id) on delete cascade,
  pin_hash     text not null,
  set_at       timestamptz not null default now()
);
alter table public.employee_pins enable row level security;
revoke all on public.employee_pins from public, anon, authenticated;

-- ---------- 2. Kiosk devices ----------

create table if not exists public.kiosk_devices (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 1 and 60),
  token_hash    text not null unique,            -- sha256 of the token; the token itself is never stored
  fails         smallint not null default 0,     -- wrong PINs in a row
  locked_until  timestamptz,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
alter table public.kiosk_devices enable row level security;
revoke all on public.kiosk_devices from public, anon, authenticated;

-- Managers can see the list of devices (never the token hashes).
drop policy if exists "Managers see kiosk devices" on public.kiosk_devices;
create policy "Managers see kiosk devices" on public.kiosk_devices
  for select to authenticated using ((select public.is_team_manager()));
grant select (id, name, last_used_at, revoked_at, created_at) on public.kiosk_devices to authenticated;

-- ---------- 3. Which punches came from a kiosk ----------

alter table public.punches
  add column if not exists in_kiosk_id  uuid references public.kiosk_devices (id) on delete set null,
  add column if not exists out_kiosk_id uuid references public.kiosk_devices (id) on delete set null;

-- Is the Kiosk clock-in feature on for this business? (Settings → Features; off until a
-- manager turns it on. Needs the time clock on too.)
alter table public.team_settings add column if not exists features jsonb not null default '{}';

create or replace function public.kiosk_feature_on()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((s.features ->> 'kioskClock')::boolean, false)
     and coalesce((s.features ->> 'timeClock')::boolean, true)
    from team_settings s
   where s.id = 1
$$;

-- ---------- 4. Setting PINs ----------

-- Checks a PIN's shape and that nobody else on the team already has it.
create or replace function public.check_new_pin(emp uuid, pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if pin is null or pin !~ '^[0-9]{4,6}$' then
    raise exception 'A PIN is 4 to 6 digits';
  end if;
  if exists (select 1 from employee_pins p where p.employee_id <> emp and p.pin_hash = crypt(pin, p.pin_hash)) then
    raise exception 'Someone else already uses that PIN. Pick another.';
  end if;
end;
$$;

create or replace function public.set_kiosk_pin(emp uuid, pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_team_manager() then
    raise exception 'Managers only';
  end if;
  if not exists (select 1 from employees e where e.id = emp and e.pay_type <> 'none') then
    raise exception 'That person does not clock in';
  end if;
  perform public.check_new_pin(emp, pin);
  insert into employee_pins (employee_id, pin_hash) values (emp, crypt(pin, gen_salt('bf', 8)))
  on conflict (employee_id) do update set pin_hash = excluded.pin_hash, set_at = now();
end;
$$;

create or replace function public.set_my_kiosk_pin(pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me uuid := public.my_employee_id();
begin
  if me is null then
    raise exception 'Not on the team list';
  end if;
  perform public.check_new_pin(me, pin);
  insert into employee_pins (employee_id, pin_hash) values (me, crypt(pin, gen_salt('bf', 8)))
  on conflict (employee_id) do update set pin_hash = excluded.pin_hash, set_at = now();
end;
$$;

create or replace function public.clear_kiosk_pin(emp uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_team_manager() or emp = public.my_employee_id()) then
    raise exception 'Managers only';
  end if;
  delete from employee_pins where employee_id = emp;
end;
$$;

-- Who has a PIN (not the PIN): managers see everyone, a person sees themselves.
create or replace function public.kiosk_pin_status()
returns table (employee_id uuid, set_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.employee_id, p.set_at
    from employee_pins p
   where public.is_team_manager() or p.employee_id = public.my_employee_id()
$$;

-- ---------- 5. Registering a kiosk ----------

-- Returns the token. It is shown once: paste it into the kiosk page, then it is gone.
create or replace function public.new_kiosk_device(device_name text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  token text := encode(gen_random_bytes(24), 'hex');
begin
  if not public.is_team_manager() then
    raise exception 'Managers only';
  end if;
  insert into kiosk_devices (name, token_hash)
  values (btrim(device_name), encode(digest(token, 'sha256'), 'hex'));
  return token;
end;
$$;

create or replace function public.revoke_kiosk_device(device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_team_manager() then
    raise exception 'Managers only';
  end if;
  update kiosk_devices set revoked_at = now() where id = device_id and revoked_at is null;
end;
$$;

-- ---------- 6. The kiosk itself ----------
-- Two calls, both answering with a row instead of raising, so a wrong PIN can still be
-- counted (an error would roll the count back):
--   kiosk_lookup(token, pin)          who is this, and what would a punch do? Saves nothing.
--   kiosk_punch(token, pin, anyway)   clocks them in, or out if they are clocked in.
-- status is one of:
--   ok        recognised (lookup) or punched (punch); action is 'in' or 'out'
--   bad_pin   no one has that PIN; tries_left says how many more before the lock
--   locked    too many wrong PINs; retry_seconds says how long to wait
--   too_early (punch only) clocking in outside the early window and anyway was false
--   not_allowed clocking in outside a shift while Settings turned "clock in anyway" off
--   just_now  that person punched less than 15 seconds ago, so nothing changed
--   off       the feature is off, or this device is unknown or revoked
-- outside = clocking in now is outside the early window of any shift (the phone's rule);
-- anyway_ok = the business lets people clock in anyway. Clocking out is never blocked.
-- Times use New York time, like the rest of these scripts.

-- Shared: identify the device and the person, and count wrong PINs.
create or replace function public.kiosk_check(device_token text, pin text)
returns table (status text, dev_id uuid, emp_id uuid, emp_name text, tries_left int, retry_seconds int)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  dev kiosk_devices;
  emp record;
  max_fails constant int := 5;
begin
  select * into dev from kiosk_devices d
   where d.token_hash = encode(digest(coalesce(device_token, ''), 'sha256'), 'hex') and d.revoked_at is null;
  if dev.id is null or not public.kiosk_feature_on() then
    return query select 'off', null::uuid, null::uuid, null::text, null::int, null::int;
    return;
  end if;

  if dev.locked_until is not null and dev.locked_until > now() then
    return query select 'locked', dev.id, null::uuid, null::text, 0, ceil(extract(epoch from dev.locked_until - now()))::int;
    return;
  end if;

  select e.id, e.name into emp
    from employee_pins p
    join employees e on e.id = p.employee_id
   where e.active and e.pay_type <> 'none'
     and pin ~ '^[0-9]{4,6}$'
     and p.pin_hash = crypt(pin, p.pin_hash)
   limit 1;

  if emp.id is null then
    update kiosk_devices set
      fails = case when fails + 1 >= max_fails then 0 else fails + 1 end,
      locked_until = case when fails + 1 >= max_fails then now() + interval '5 minutes' else locked_until end,
      last_used_at = now()
    where id = dev.id
    returning fails, locked_until into dev.fails, dev.locked_until;
    if dev.locked_until is not null and dev.locked_until > now() then
      return query select 'locked', dev.id, null::uuid, null::text, 0, ceil(extract(epoch from dev.locked_until - now()))::int;
    else
      return query select 'bad_pin', dev.id, null::uuid, null::text, max_fails - dev.fails, null::int;
    end if;
    return;
  end if;

  update kiosk_devices set fails = 0, locked_until = null, last_used_at = now() where id = dev.id;
  return query select 'ok', dev.id, emp.id, emp.name, null::int, null::int;
end;
$$;

create or replace function public.kiosk_lookup(device_token text, pin text)
returns table (status text, person text, action text, at timestamptz, tries_left int, retry_seconds int,
               shift_start int, shift_end int, since timestamptz, outside boolean, anyway_ok boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  open_in timestamptz;
  local_now timestamp := now() at time zone 'America/New_York';
  today date := (now() at time zone 'America/New_York')::date;
  nowmin int := extract(hour from now() at time zone 'America/New_York')::int * 60 + extract(minute from now() at time zone 'America/New_York')::int;
  early int;
  anyway boolean;
  win shifts;
  nxt shifts;
begin
  select * into r from public.kiosk_check(device_token, pin);
  if r.status <> 'ok' then
    return query select r.status, null::text, null::text, null::timestamptz, r.tries_left, r.retry_seconds, null::int, null::int, null::timestamptz, null::boolean, null::boolean;
    return;
  end if;

  select coalesce(s.clock_in_early, 30), coalesce(s.allow_anyway, true) into early, anyway from team_settings s where s.id = 1;
  early := coalesce(early, 30);
  anyway := coalesce(anyway, true);

  select p.clock_in into open_in from punches p where p.employee_id = r.emp_id and p.clock_out is null limit 1;

  select * into win from shifts s
   where s.employee_id = r.emp_id and s.published and s.date = today
     and nowmin >= s.start_min - early and nowmin < s.end_min
   order by s.start_min limit 1;
  select * into nxt from shifts s
   where s.employee_id = r.emp_id and s.published and s.date = today and s.end_min > nowmin
   order by s.start_min limit 1;

  return query select 'ok', r.emp_name, case when open_in is null then 'in' else 'out' end, now(), null::int, null::int,
    coalesce(win.start_min, nxt.start_min)::int, coalesce(win.end_min, nxt.end_min)::int, open_in,
    (open_in is null and win.id is null), anyway;
end;
$$;

create or replace function public.kiosk_punch(device_token text, pin text, anyway boolean default false)
returns table (status text, person text, action text, at timestamptz, tries_left int, retry_seconds int)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  l record;
  open_id uuid;
  last_event timestamptz;
begin
  select * into r from public.kiosk_check(device_token, pin);
  if r.status <> 'ok' then
    return query select r.status, null::text, null::text, null::timestamptz, r.tries_left, r.retry_seconds;
    return;
  end if;

  -- Guard against a double tap clocking someone in and straight back out.
  select max(greatest(p.clock_in, coalesce(p.clock_out, p.clock_in))) into last_event
    from punches p where p.employee_id = r.emp_id;
  if last_event is not null and last_event > now() - interval '15 seconds' then
    return query select 'just_now', r.emp_name, null::text, last_event, null::int, null::int;
    return;
  end if;

  select p.id into open_id from punches p where p.employee_id = r.emp_id and p.clock_out is null;
  if open_id is not null then
    update punches set clock_out = now(), out_kiosk_id = r.dev_id where id = open_id;
    return query select 'ok', r.emp_name, 'out', now(), null::int, null::int;
    return;
  end if;

  -- Clocking in: the same early window as the phone. "Clock in anyway" skips it when the
  -- business allows that; Hours review flags the punch (early, or no shift that day).
  select * into l from public.kiosk_lookup(device_token, pin);
  if l.outside and not coalesce(anyway, false) then
    return query select 'too_early', r.emp_name, 'in', now(), null::int, null::int;
    return;
  end if;
  if l.outside and not l.anyway_ok then
    return query select 'not_allowed', r.emp_name, 'in', now(), null::int, null::int;
    return;
  end if;

  insert into punches (employee_id, clock_in, in_kiosk_id) values (r.emp_id, now(), r.dev_id);
  return query select 'ok', r.emp_name, 'in', now(), null::int, null::int;
end;
$$;

-- ---------- 7. Who may call what ----------

revoke all on function public.kiosk_feature_on() from public, anon, authenticated;
revoke all on function public.check_new_pin(uuid, text) from public, anon, authenticated;
revoke all on function public.kiosk_check(text, text) from public, anon, authenticated;
revoke all on function public.set_kiosk_pin(uuid, text) from public, anon;
revoke all on function public.set_my_kiosk_pin(text) from public, anon;
revoke all on function public.clear_kiosk_pin(uuid) from public, anon;
revoke all on function public.kiosk_pin_status() from public, anon;
revoke all on function public.new_kiosk_device(text) from public, anon;
revoke all on function public.revoke_kiosk_device(uuid) from public, anon;
revoke all on function public.kiosk_lookup(text, text) from public;
revoke all on function public.kiosk_punch(text, text, boolean) from public;

grant execute on function public.kiosk_feature_on() to authenticated;
grant execute on function public.set_kiosk_pin(uuid, text) to authenticated;
grant execute on function public.set_my_kiosk_pin(text) to authenticated;
grant execute on function public.clear_kiosk_pin(uuid) to authenticated;
grant execute on function public.kiosk_pin_status() to authenticated;
grant execute on function public.new_kiosk_device(text) to authenticated;
grant execute on function public.revoke_kiosk_device(uuid) to authenticated;
-- The kiosk page has no sign-in: the device token is what proves it's a registered kiosk.
grant execute on function public.kiosk_lookup(text, text) to anon, authenticated;
grant execute on function public.kiosk_punch(text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
