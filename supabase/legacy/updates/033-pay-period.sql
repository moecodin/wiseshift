-- Update 033: the pay period is a setting (every week or every two weeks, and which day it starts).
--
-- Run once in Supabase → SQL Editor, after 032. Safe to re-run. Dev project first, then live,
-- BEFORE pushing the site version that has the Pay period setting.
--
-- Every business that already exists keeps what it has today: every two weeks, from Friday 9 Oct 2026.
-- pay_period is { "days": 7 or 14, "anchor": "YYYY-MM-DD" }, where anchor is the first day of any known period.

alter table public.team_settings
  add column if not exists pay_period jsonb not null default '{"days": 14, "anchor": "2026-10-09"}'::jsonb
    check (pay_period ? 'days' and pay_period ? 'anchor' and (pay_period->>'days') in ('7', '14'));
