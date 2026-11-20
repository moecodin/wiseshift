-- Update 035: payroll-ready exports.
--   * employee_pay.payroll_id: the person's ID in the payroll service (Gusto, ADP, Paychex…). It lives with pay settings,
--     so only the person and managers can see it (the existing "Own pay or managers" rule).
--   * team_settings.payroll_export: the business's saved payroll CSV layout (which columns, their names and order,
--     how people are identified, hour and date formats). Not private: it is only a list of column choices.
-- Safe to run more than once.
alter table public.employee_pay add column if not exists payroll_id text check (payroll_id is null or char_length(payroll_id) <= 40);
alter table public.team_settings add column if not exists payroll_export jsonb;
