-- Update 034: private manager notes on a person, and a history of pay-rate changes.
--
--   * employee_notes: a manager writes a note about someone (a conversation, a reminder, praise, a warning). ONLY managers can read,
--     add or delete notes. Staff never see them, not even notes about themselves.
--   * pay_history: every time someone's hourly rate changes (or is first set), one row is kept: the rate, the one before it and
--     when. A person can see their own history, managers see everyone's. It is written by a trigger, so nobody can edit it.
-- Safe to run more than once.

create table if not exists public.employee_notes (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  body         text not null check (char_length(btrim(body)) between 1 and 2000),
  author_id    uuid references public.employees (id) on delete set null default public.my_employee_id(),
  created_at   timestamptz not null default now()
);
create index if not exists employee_notes_employee on public.employee_notes (employee_id, created_at desc);
alter table public.employee_notes enable row level security;
drop policy if exists "Managers read notes" on public.employee_notes;
create policy "Managers read notes" on public.employee_notes for select to authenticated using ((select public.is_team_manager()));
drop policy if exists "Managers add notes" on public.employee_notes;
create policy "Managers add notes" on public.employee_notes for insert to authenticated with check ((select public.is_team_manager()));
drop policy if exists "Managers delete notes" on public.employee_notes;
create policy "Managers delete notes" on public.employee_notes for delete to authenticated using ((select public.is_team_manager()));

create table if not exists public.pay_history (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees (id) on delete cascade,
  hourly_rate   numeric(8, 2) not null,
  previous_rate numeric(8, 2),
  changed_by    uuid references public.employees (id) on delete set null,
  changed_at    timestamptz not null default now()
);
create index if not exists pay_history_employee on public.pay_history (employee_id, changed_at desc);
alter table public.pay_history enable row level security;
drop policy if exists "Own pay history or managers" on public.pay_history;
create policy "Own pay history or managers" on public.pay_history for select to authenticated
  using (employee_id = (select public.my_employee_id()) or (select public.is_team_manager()));

create or replace function public.record_pay_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.pay_history (employee_id, hourly_rate, previous_rate, changed_by) values (new.employee_id, new.hourly_rate, null, public.my_employee_id());
  elsif new.hourly_rate is distinct from old.hourly_rate then
    insert into public.pay_history (employee_id, hourly_rate, previous_rate, changed_by) values (new.employee_id, new.hourly_rate, old.hourly_rate, public.my_employee_id());
  end if;
  return new;
end $$;
drop trigger if exists employee_pay_history on public.employee_pay;
create trigger employee_pay_history after insert or update of hourly_rate on public.employee_pay for each row execute function public.record_pay_change();

-- Today's rates become the first history rows, so the list is never empty.
insert into public.pay_history (employee_id, hourly_rate, previous_rate, changed_at)
select p.employee_id, p.hourly_rate, null, p.updated_at from public.employee_pay p
where not exists (select 1 from public.pay_history h where h.employee_id = p.employee_id);
