-- Update 032: a color for each person's badge (avatar), so a manager can tell people apart at a glance.
--
-- Run once in Supabase → SQL Editor, after 031. Safe to re-run. Dev project first, then live,
-- BEFORE pushing the site version that has colored badges.
--
-- After this update:
--   * Everyone's badge has a color. People who have not picked one get the least-used color automatically
--     (so a team of ten looks different), and each person can pick their own in Settings → Me.
--   * A new person added in Team is given the least-used color when they are created.

alter table public.employees
  add column if not exists avatar_color text check (avatar_color is null or avatar_color in ('slate','red','orange','amber','green','teal','blue','indigo','purple','pink'));

-- Staff cannot edit the employees table, so they change only their own color through this function.
create or replace function public.set_my_avatar_color(new_color text)
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
  update employees set avatar_color = nullif(new_color, '') where id = me;
end;
$$;

revoke all on function public.set_my_avatar_color(text) from public, anon;
grant execute on function public.set_my_avatar_color(text) to authenticated;

notify pgrst, 'reload schema';
