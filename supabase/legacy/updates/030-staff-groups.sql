-- Update 030: staff groups (Cashiers, Waiters, Kitchen…) for bigger teams.
--
-- Run once in Supabase → SQL Editor, after 029. Safe to re-run. Dev project first, then live,
-- BEFORE pushing the site version that has the Groups settings.
--
-- After this update:
--   * A manager sets up the business's groups once in Settings → Business → Groups (a name and a
--     color each, in the order they should appear).
--   * Each person can be put in one group (Team tab → open the person → Group).
--   * Hours → Review shows the punches in one column per group, so a team of twenty reads as
--     four short lists instead of one long one.
-- Nothing changes for anyone until groups are set up.

alter table public.team_settings
  add column if not exists staff_groups jsonb not null default '[]'::jsonb;

alter table public.employees
  add column if not exists group_name text check (group_name is null or length(group_name) between 1 and 40);

-- The existing rules already let the whole team read employees and settings, and only managers
-- change them, so no new policies are needed.
