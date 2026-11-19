-- Update 021: shift roles, cover requests, manager notes and tasks, punch notes, language.
--
-- Run once in Supabase → SQL Editor, after 020 and before 025. Safe to re-run.
--
-- WiseShift's screens use these (roles on shifts, Shift swaps and cover, Manager notes and
-- tasks, notes about punches, English/Spanish). They were first written in the Roosevelt Pups
-- repo (its update 027 and the language part of its 021); this is the same SQL without
-- Roosevelt Pups' starting roles and the daycare parts, so a new WiseShift project has them.
-- Nobody can write to the new tables directly: changes go through the functions below.

-- ---------- 1. Shift roles ----------

alter table public.shifts add column if not exists role text not null default '';

-- A published shift is "posted again" (for the ✓✓ seen ticks) when its role changes too.
create or replace function public.shift_posted_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not new.published then
    new.posted_at := null;
  elsif tg_op = 'INSERT' or not old.published
     or (new.employee_id, new.date, new.start_min, new.end_min, new.break_min, new.title, new.note, new.role)
        is distinct from (old.employee_id, old.date, old.start_min, old.end_min, old.break_min, old.title, old.note, old.role) then
    new.posted_at := now();
  else
    new.posted_at := old.posted_at;
  end if;
  return new;
end;
$$;

-- ---------- 2. Roles list and feature switches ----------
-- roles:    [{"name": "Manager", "color": 0}, …]  (colors 0 to 7, like the shift types)
-- features: {"payRates": true, …}  Anything not listed uses the app's default.

alter table public.team_settings add column if not exists roles    jsonb not null default '[]'::jsonb;
alter table public.team_settings add column if not exists features jsonb not null default '{}'::jsonb;

-- ---------- 3. New page or old page, for each person ----------
-- 'new' (the default) or 'classic'. Follows the person to any phone or computer.

alter table public.employee_prefs add column if not exists team_ui text not null default 'new';
alter table public.employee_prefs drop constraint if exists employee_prefs_team_ui_check;
alter table public.employee_prefs add constraint employee_prefs_team_ui_check check (team_ui in ('new', 'classic'));

create or replace function public.set_my_team_ui(ui text)
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
  if ui not in ('new', 'classic') then
    raise exception 'Pick new or classic';
  end if;
  insert into employee_prefs (employee_id, team_ui) values (me, ui)
  on conflict (employee_id) do update set team_ui = excluded.team_ui, updated_at = now();
end;
$$;

revoke all on function public.set_my_team_ui(text) from public, anon;
grant execute on function public.set_my_team_ui(text) to authenticated;

-- ---------- 4. Cover requests ----------
-- kind 'giveaway': the requester gives their shift to the whole team (target_id empty)
--                  or to one person (target_id).
-- kind 'swap':     the requester's shift for one of target_id's (swap_shift_id).
-- status: open (waiting for a coworker), taken (a coworker said yes; waiting for a
--         manager), approved, declined (by a manager), passed (the person asked said no),
--         cancelled (withdrawn, or a shift changed hands before the manager decided).

create table if not exists public.cover_requests (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null default 'giveaway' check (kind in ('giveaway', 'swap')),
  shift_id       uuid not null references public.shifts (id) on delete cascade,
  swap_shift_id  uuid references public.shifts (id) on delete cascade,
  requester_id   uuid not null references public.employees (id) on delete cascade,
  target_id      uuid references public.employees (id) on delete cascade,
  taker_id       uuid references public.employees (id) on delete set null,
  note           text not null default '' check (length(note) <= 200),
  status         text not null default 'open'
                 check (status in ('open', 'taken', 'approved', 'declined', 'passed', 'cancelled')),
  created_at     timestamptz not null default now(),
  taken_at       timestamptz,
  passed_at      timestamptz,
  decided_by     text,
  decided_at     timestamptz,
  check ((kind = 'swap') = (swap_shift_id is not null)),
  check (kind <> 'swap' or target_id is not null)
);
create index if not exists cover_requests_status on public.cover_requests (status);
-- Each shift can be in only one live request at a time.
create unique index if not exists cover_one_live_shift on public.cover_requests (shift_id)
  where status in ('open', 'taken');
create unique index if not exists cover_one_live_swap on public.cover_requests (swap_shift_id)
  where status in ('open', 'taken') and swap_shift_id is not null;
alter table public.cover_requests enable row level security;

-- Who sees a request: managers; the people in it; and everyone, for requests to the whole team.
drop policy if exists "People in it, team-wide ones, or managers" on public.cover_requests;
create policy "People in it, team-wide ones, or managers" on public.cover_requests
  for select to authenticated using (
    (select public.is_team_manager())
    or requester_id = (select public.my_employee_id())
    or target_id = (select public.my_employee_id())
    or taker_id = (select public.my_employee_id())
    or (target_id is null and (select public.is_team_member()))
  );
-- (No insert, update or delete rules: only the functions below change requests.)

-- Has this shift already ended? (Shift times are New York time.)
create or replace function public.shift_is_over(s public.shifts)
returns boolean
language sql
stable
set search_path = public
as $$
  select (s.date + make_interval(mins => s.end_min)) < (now() at time zone 'America/New_York')
$$;

-- Is this shift in a live request (given away or asked for in a swap)?
create or replace function public.shift_in_live_cover(shift uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from cover_requests c
     where c.status in ('open', 'taken') and (c.shift_id = shift or c.swap_shift_id = shift)
  )
$$;

-- Would this person taking shift s overlap their own shifts (not counting the one they'd
-- give up in a swap) or fall on their approved time off?
create or replace function public.cover_clashes(person uuid, s public.shifts, giving uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from shifts x
            where x.employee_id = person and x.id <> s.id and x.id is distinct from giving
              and x.date = s.date and x.start_min < s.end_min and s.start_min < x.end_min
         )
      or exists (
           select 1 from time_off t
            where t.employee_id = person and t.status = 'approved'
              and t.start_date <= s.date and t.end_date >= s.date
         )
$$;

revoke all on function public.shift_is_over(public.shifts) from public, anon;
revoke all on function public.shift_in_live_cover(uuid) from public, anon;
revoke all on function public.cover_clashes(uuid, public.shifts, uuid) from public, anon;

-- Ask for cover on one of my published shifts that hasn't ended. Returns the request's id.
create or replace function public.request_cover(shift uuid, note text default '', target uuid default null, swap_shift uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_employee_id();
  s shifts;
  other shifts;
  t employees;
  new_id uuid;
begin
  if me is null then
    raise exception 'Not on the team list';
  end if;
  select * into s from shifts where id = shift;
  if not found or s.employee_id <> me then
    raise exception 'That isn''t your shift';
  end if;
  if not s.published then
    raise exception 'That shift isn''t published yet';
  end if;
  if public.shift_is_over(s) then
    raise exception 'That shift is already over';
  end if;
  if public.shift_in_live_cover(s.id) then
    raise exception 'There is already a cover request for that shift';
  end if;
  if target is not null then
    select * into t from employees where id = target and active;
    if not found or t.id = me or t.pay_type = 'none' then
      raise exception 'Pick a coworker who uses the app';
    end if;
  end if;
  if swap_shift is not null then
    if target is null then
      raise exception 'A swap needs a coworker';
    end if;
    select * into other from shifts where id = swap_shift;
    if not found or other.employee_id <> target or not other.published then
      raise exception 'That isn''t their shift';
    end if;
    if public.shift_is_over(other) then
      raise exception 'That shift is already over';
    end if;
    if public.shift_in_live_cover(other.id) then
      raise exception 'That shift already has a cover request';
    end if;
    if public.cover_clashes(me, other, s.id) then
      raise exception 'That shift overlaps one of your shifts, or you have time off that day';
    end if;
  end if;
  insert into cover_requests (kind, shift_id, swap_shift_id, requester_id, target_id, note)
  values (case when swap_shift is null then 'giveaway' else 'swap' end, s.id, swap_shift, me, target, left(coalesce(note, ''), 200))
  returning id into new_id;
  return new_id;
end;
$$;

-- Withdraw my own request while it's still open or waiting for a manager.
create or replace function public.cancel_cover(request uuid)
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
  update cover_requests set status = 'cancelled'
   where id = request and requester_id = me and status in ('open', 'taken');
  if not found then
    raise exception 'That request can''t be withdrawn';
  end if;
end;
$$;

-- Say yes: take the shift (or, for a swap, agree to trade). A manager approves after.
create or replace function public.take_cover(request uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_employee_id();
  c cover_requests;
  s shifts;
begin
  if me is null then
    raise exception 'Not on the team list';
  end if;
  select * into c from cover_requests where id = request for update;
  if not found or c.status <> 'open' then
    raise exception 'That request is no longer open';
  end if;
  if c.requester_id = me then
    raise exception 'That''s your own shift';
  end if;
  if c.target_id is not null and c.target_id <> me then
    raise exception 'That request is for someone else';
  end if;
  select * into s from shifts where id = c.shift_id;
  if not found then
    raise exception 'That shift is gone';
  end if;
  if public.cover_clashes(me, s, c.swap_shift_id) then
    raise exception 'This overlaps one of your shifts, or you have time off that day';
  end if;
  update cover_requests set status = 'taken', taker_id = me, taken_at = now() where id = c.id;
end;
$$;

-- Say no to a request made to me.
create or replace function public.pass_cover(request uuid)
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
  update cover_requests set status = 'passed', passed_at = now()
   where id = request and target_id = me and status = 'open';
  if not found then
    raise exception 'That request isn''t waiting for you';
  end if;
end;
$$;

-- Managers: approve or decline. Approving moves the shift (both shifts for a swap) in one go.
-- If either shift changed hands since the request, it's cancelled instead.
create or replace function public.decide_cover(request uuid, approve boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c cover_requests;
  s shifts;
  other shifts;
  who text := coalesce((select name from employees where id = public.my_employee_id()), '');
begin
  if not public.is_team_manager() then
    raise exception 'Only managers can do that';
  end if;
  select * into c from cover_requests where id = request for update;
  if not found or c.status <> 'taken' then
    raise exception 'That request isn''t waiting for a manager';
  end if;
  select * into s from shifts where id = c.shift_id for update;
  if c.swap_shift_id is not null then
    select * into other from shifts where id = c.swap_shift_id for update;
  end if;
  if s.id is null or s.employee_id <> c.requester_id
     or (c.swap_shift_id is not null and (other.id is null or other.employee_id <> c.taker_id)) then
    update cover_requests set status = 'cancelled', decided_by = who, decided_at = now() where id = c.id;
    return 'cancelled';
  end if;
  update cover_requests
     set status = case when approve then 'approved' else 'declined' end, decided_by = who, decided_at = now()
   where id = c.id;
  if approve then
    -- The posted_at trigger marks the changed shifts as posted again for their new people.
    update shifts set employee_id = c.taker_id where id = s.id;
    if c.swap_shift_id is not null then
      update shifts set employee_id = c.requester_id where id = other.id;
    end if;
  end if;
  return case when approve then 'approved' else 'declined' end;
end;
$$;

revoke all on function public.request_cover(uuid, text, uuid, uuid) from public, anon;
revoke all on function public.cancel_cover(uuid) from public, anon;
revoke all on function public.take_cover(uuid) from public, anon;
revoke all on function public.pass_cover(uuid) from public, anon;
revoke all on function public.decide_cover(uuid, boolean) from public, anon;
grant execute on function public.request_cover(uuid, text, uuid, uuid) to authenticated;
grant execute on function public.cancel_cover(uuid) to authenticated;
grant execute on function public.take_cover(uuid) to authenticated;
grant execute on function public.pass_cover(uuid) to authenticated;
grant execute on function public.decide_cover(uuid, boolean) to authenticated;

-- ---------- 5. Manager notes and tasks ----------
-- kind 'task' (check box, optional due date) or 'note' (a colored sticky, color 0 to 3).
-- assignees: staff tagged on it; they can see it and tick off a task.
-- notify / send_text: what the manager asked for. Sending happens in the send-push
-- function (and, one day, a texting service); nothing here sends anything.
-- (Separate from the grooming sheet's sticky_notes on purpose.)

create table if not exists public.manager_notes (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'note' check (kind in ('note', 'task')),
  text        text not null check (length(text) between 1 and 300),
  color       smallint not null default 0 check (color between 0 and 3),
  due_date    date,
  assignees   uuid[] not null default '{}',
  notify      boolean not null default false,
  send_text   boolean not null default false,
  done        boolean not null default false,
  done_by     text not null default '',
  done_at     timestamptz,
  created_by  text not null default '',
  created_at  timestamptz not null default now(),
  check (kind = 'task' or due_date is null)
);
create index if not exists manager_notes_created on public.manager_notes (created_at);
alter table public.manager_notes enable row level security;

drop policy if exists "Managers, or staff tagged on it" on public.manager_notes;
create policy "Managers, or staff tagged on it" on public.manager_notes
  for select to authenticated using (
    (select public.is_team_manager()) or (select public.my_employee_id()) = any (assignees)
  );
drop policy if exists "Managers change notes" on public.manager_notes;
create policy "Managers change notes" on public.manager_notes
  for all to authenticated using ((select public.is_team_manager())) with check ((select public.is_team_manager()));

-- Staff tagged on a task can tick it off (or untick it), and nothing else.
create or replace function public.finish_manager_task(note uuid, is_done boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_employee_id();
  who text := coalesce((select name from employees where id = public.my_employee_id()), '');
begin
  if me is null then
    raise exception 'Not on the team list';
  end if;
  update manager_notes
     set done = is_done,
         done_by = case when is_done then who else '' end,
         done_at = case when is_done then now() else null end
   where id = note and kind = 'task' and (me = any (assignees) or public.is_team_manager());
  if not found then
    raise exception 'That task isn''t yours to finish';
  end if;
end;
$$;

revoke all on function public.finish_manager_task(uuid, boolean) from public, anon;
grant execute on function public.finish_manager_task(uuid, boolean) to authenticated;

-- ---------- 6. Staff notes about their punches ----------
-- tag: forgotIn, forgotOut, outside (working outside the shop), other.
-- A person can write about today or yesterday, and remove a note until a manager has seen it.

create table if not exists public.punch_notes (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  date         date not null,
  tag          text not null default 'other' check (tag in ('forgotIn', 'forgotOut', 'outside', 'other')),
  text         text not null check (length(text) between 1 and 300),
  created_at   timestamptz not null default now(),
  ack_at       timestamptz,
  ack_by       text not null default ''
);
create index if not exists punch_notes_open on public.punch_notes (ack_at, date);
alter table public.punch_notes enable row level security;

drop policy if exists "Own notes or managers" on public.punch_notes;
create policy "Own notes or managers" on public.punch_notes
  for select to authenticated using (
    employee_id = (select public.my_employee_id()) or (select public.is_team_manager())
  );

create or replace function public.add_punch_note(day date, note_tag text, note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_employee_id();
  today date := (now() at time zone 'America/New_York')::date;
  new_id uuid;
begin
  if me is null then
    raise exception 'Not on the team list';
  end if;
  if day not in (today, today - 1) then
    raise exception 'Notes are for today or yesterday';
  end if;
  if coalesce(trim(note), '') = '' then
    raise exception 'Type a note first';
  end if;
  insert into punch_notes (employee_id, date, tag, text)
  values (me, day, coalesce(note_tag, 'other'), left(trim(note), 300))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.remove_punch_note(note uuid)
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
  delete from punch_notes where id = note and employee_id = me and ack_at is null;
  if not found then
    raise exception 'That note can''t be removed';
  end if;
end;
$$;

-- Managers: mark a note as seen.
create or replace function public.ack_punch_note(note uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  who text := coalesce((select name from employees where id = public.my_employee_id()), '');
begin
  if not public.is_team_manager() then
    raise exception 'Only managers can do that';
  end if;
  update punch_notes set ack_at = now(), ack_by = who where id = note and ack_at is null;
end;
$$;

revoke all on function public.add_punch_note(date, text, text) from public, anon;
revoke all on function public.remove_punch_note(uuid) from public, anon;
revoke all on function public.ack_punch_note(uuid) from public, anon;
grant execute on function public.add_punch_note(date, text, text) to authenticated;
grant execute on function public.remove_punch_note(uuid) to authenticated;
grant execute on function public.ack_punch_note(uuid) to authenticated;

-- ---------- 5. Language ----------

alter table public.employee_prefs add column if not exists lang text not null default 'en';
alter table public.employee_prefs drop constraint if exists employee_prefs_lang_check;
alter table public.employee_prefs add constraint employee_prefs_lang_check check (lang in ('en', 'es'));

create or replace function public.set_my_lang(new_lang text)
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
  insert into employee_prefs (employee_id, lang) values (me, new_lang)
  on conflict (employee_id) do update set lang = excluded.lang, updated_at = now();
end;
$$;

revoke all on function public.set_my_lang(text) from public, anon;
grant execute on function public.set_my_lang(text) to authenticated;
