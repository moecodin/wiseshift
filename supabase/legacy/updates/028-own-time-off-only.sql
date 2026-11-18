-- Update 028: staff see only their own time off.
--
-- Run once in Supabase → SQL Editor, after 027. Safe to re-run. Dev project first, then live.
--
-- Until now team_time_off() gave every signed-in team member everyone's approved time
-- off (no reasons). The time_off table itself was already limited to your own rows (or
-- all rows for managers), so this function was the one leak. After this update it
-- returns everyone's approved time off to managers, and only your own to staff.
-- The staff screens only ever use their own days (to show "Off" on their schedule),
-- so nothing they need goes away.

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
     and (public.is_team_manager() or t.employee_id = public.my_employee_id())
     and t.status = 'approved'
     and t.end_date >= from_date
     and t.start_date <= to_date
   order by t.start_date;
$$;

revoke all on function public.team_time_off(date, date) from public, anon;
grant execute on function public.team_time_off(date, date) to authenticated;
