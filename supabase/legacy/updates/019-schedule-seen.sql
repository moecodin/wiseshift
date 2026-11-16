-- Update 019: "seen" ticks on the schedule (like Humanity's "logged in since
-- shift was posted", shown WhatsApp style).
--
-- Run once in Supabase → SQL Editor. Safe to re-run. Doesn't need 018.
--
-- After this update:
--   * Each shift remembers when it was posted (shifts.posted_at): when it's
--     published, and again whenever a published shift is changed.
--   * The app notes when each person last opened it (employee_seen), through
--     mark_seen(). Only that person and managers can see it.
--   * Managers see ✓ (posted, not opened since) or blue ✓✓ (opened since it
--     was posted) next to each person on the Schedule.

-- ---------- 1. When each shift was posted ----------

alter table public.shifts add column if not exists posted_at timestamptz;
update public.shifts set posted_at = created_at where published and posted_at is null;

create or replace function public.shift_posted_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not new.published then
    new.posted_at := null;
  elsif tg_op = 'INSERT' or not old.published
     or (new.employee_id, new.date, new.start_min, new.end_min, new.break_min, new.title, new.note)
        is distinct from (old.employee_id, old.date, old.start_min, old.end_min, old.break_min, old.title, old.note) then
    new.posted_at := now();
  else
    new.posted_at := old.posted_at;
  end if;
  return new;
end;
$$;

drop trigger if exists shifts_posted_at on public.shifts;
create trigger shifts_posted_at before insert or update on public.shifts
  for each row execute function public.shift_posted_at();

-- ---------- 2. When each person last opened the app ----------

create table if not exists public.employee_seen (
  employee_id  uuid primary key references public.employees (id) on delete cascade,
  seen_at      timestamptz not null default now()
);
alter table public.employee_seen enable row level security;

drop policy if exists "Own or managers" on public.employee_seen;
create policy "Own or managers" on public.employee_seen
  for select to authenticated using (employee_id = (select public.my_employee_id()) or (select public.is_team_manager()));

create or replace function public.mark_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_employee_id();
begin
  if me is null then
    return;
  end if;
  insert into employee_seen (employee_id, seen_at) values (me, now())
  on conflict (employee_id) do update set seen_at = excluded.seen_at;
end;
$$;

revoke all on function public.mark_seen() from public, anon;
grant execute on function public.mark_seen() to authenticated;

notify pgrst, 'reload schema';
