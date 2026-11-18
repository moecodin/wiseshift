-- Update 029: team tasks (a day's to-do list that staff claim, and managers can hand out).
--
-- Run once in Supabase → SQL Editor, after 028. Safe to re-run. Dev project first, then live,
-- BEFORE pushing the site version that has the Tasks tab. Nothing changes for anyone until the
-- site version is out; the Tasks tab can be switched off in Settings → Features.
--
-- After this update:
--   * Managers add a task for a day (title, optional time, optional note). It can be left open,
--     or handed to one person.
--   * Everyone on the team can see the day's tasks and who has each one (so nobody doubles up).
--   * An open task shows "I'll take it". First tap wins; the person who took it can give it
--     back. A task a manager handed out can't be given back by the person; a manager can
--     reassign or unassign it.
--   * The person who has a task (or a manager) marks it done.
--   * Only managers add, edit or delete tasks directly. Everything staff do goes through the
--     two functions below, so they can only touch the claim and done fields.
--
-- This is separate from the managers' sticky notes and tasks (manager_notes).

create table if not exists public.team_tasks (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  time         smallint check (time is null or time between 0 and 1439),  -- minutes after midnight; null = any time
  title        text not null check (length(title) between 1 and 120),
  note         text not null default '' check (length(note) <= 500),
  claimed_by   uuid references public.employees (id) on delete set null,
  assigned     boolean not null default false,   -- true when a manager handed it out
  assigned_by  text,
  claimed_at   timestamptz,
  done_at      timestamptz,
  done_by      text,
  created_by   text,
  created_at   timestamptz not null default now()
);
create index if not exists team_tasks_date on public.team_tasks (date);
alter table public.team_tasks enable row level security;

drop policy if exists "Team sees tasks" on public.team_tasks;
create policy "Team sees tasks" on public.team_tasks
  for select to authenticated using ((select public.is_team_member()));
drop policy if exists "Managers plan tasks" on public.team_tasks;
create policy "Managers plan tasks" on public.team_tasks
  for all to authenticated using ((select public.is_team_manager())) with check ((select public.is_team_manager()));

-- Take a task, give it back, or (managers) hand it to someone or take it off them.
--   who = your own id            take it (only while it's open)
--   who = null                   give it back (the holder, if they took it themselves; or a manager)
--   who = someone else's id      managers only: hand it to them
create or replace function public.set_team_task(task uuid, who uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_employee_id();
  boss boolean := public.is_team_manager();
  tk public.team_tasks;
  my_name text;
begin
  if me is null then
    raise exception 'Not on the team list';
  end if;
  select * into tk from public.team_tasks where id = task for update;
  if not found then
    raise exception 'That task is gone';
  end if;
  select e.name into my_name from public.employees e where e.id = me;

  if who is null then
    if tk.claimed_by is null then
      return;
    end if;
    if not boss and (tk.claimed_by <> me or tk.assigned) then
      raise exception 'Only the person who took it can give it back';
    end if;
    update public.team_tasks
       set claimed_by = null, assigned = false, assigned_by = null, claimed_at = null, done_at = null, done_by = null
     where id = task;
  elsif who = me and not boss then
    if tk.claimed_by is not null and tk.claimed_by <> me then
      raise exception 'Someone already took this one';
    end if;
    update public.team_tasks set claimed_by = me, assigned = false, assigned_by = null, claimed_at = now() where id = task;
  else
    if not boss and who <> me then
      raise exception 'Only a manager can hand a task to someone else';
    end if;
    -- A manager picking themselves counts as taking it; handing to someone else is "assigned".
    update public.team_tasks
       set claimed_by = who, assigned = (who <> me), assigned_by = case when who <> me then my_name end,
           claimed_at = now(), done_at = null, done_by = null
     where id = task;
  end if;
end;
$$;

-- Mark a task done (or not done): the person who has it, or a manager.
create or replace function public.finish_team_task(task uuid, is_done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_employee_id();
  boss boolean := public.is_team_manager();
  holder uuid;
  my_name text;
begin
  if me is null then
    raise exception 'Not on the team list';
  end if;
  select claimed_by into holder from public.team_tasks where id = task;
  if not found then
    raise exception 'That task is gone';
  end if;
  if not boss and holder is distinct from me then
    raise exception 'Take the task first';
  end if;
  select e.name into my_name from public.employees e where e.id = me;
  update public.team_tasks
     set done_at = case when is_done then now() end, done_by = case when is_done then my_name end
   where id = task;
end;
$$;

revoke all on function public.set_team_task(uuid, uuid) from public, anon;
revoke all on function public.finish_team_task(uuid, boolean) from public, anon;
grant execute on function public.set_team_task(uuid, uuid) to authenticated;
grant execute on function public.finish_team_task(uuid, boolean) to authenticated;
