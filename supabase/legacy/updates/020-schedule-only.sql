-- Update 020: "schedule only" people, and Nema.
--
-- Run once in Supabase → SQL Editor, after 019. Safe to re-run.
--
-- After this update:
--   * Someone can be on the team just to show on the schedule (pay_type
--     'none'): a name and shifts, no email, no login, no pay, no clock.
--     Managers add them on the Team tab (Paid by → Schedule only).
--   * Nema is added that way. Add her shifts on the Schedule like anyone's.

alter table public.employees alter column email drop not null;

alter table public.employees drop constraint if exists employees_pay_type_check;
alter table public.employees add constraint employees_pay_type_check check (pay_type in ('hourly', 'commission', 'none'));

-- Schedule-only people never get an email (so they can never sign in).
alter table public.employees drop constraint if exists employees_none_no_email;
alter table public.employees add constraint employees_none_no_email check (pay_type <> 'none' or email is null);

insert into public.employees (name, email, position, pay_type)
select 'Nema', null, '', 'none'
where not exists (select 1 from public.employees where lower(name) = 'nema');

notify pgrst, 'reload schema';
