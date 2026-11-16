-- Update 017: push notifications for the Island Schedule app.
--
-- Run once in Supabase → SQL Editor, after 016. Safe to re-run.
--
-- After this update:
--   * Each phone that turns on notifications is saved here (only for its owner).
--   * Each person can turn kinds of notifications off (push_off).
--   * The send-push function (supabase/functions/send-push) reads these with its
--     built-in service key, sends, and keeps:
--       push_log    what was sent, so a reminder is never sent twice
--       push_queue  notifications held during quiet hours (9 PM – 6 AM),
--                   sent at 6 AM
--     Nobody can read those two from the app.

-- ---------- 1. Phones ----------

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  device       text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists push_subscriptions_employee on public.push_subscriptions (employee_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists "Own phones" on public.push_subscriptions;
create policy "Own phones" on public.push_subscriptions
  for select to authenticated using (employee_id = (select public.my_employee_id()));

-- Turn this phone's notifications on (or move it to whoever is signed in now).
create or replace function public.save_push_subscription(sub_endpoint text, sub_p256dh text, sub_auth text, sub_device text default '')
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
  insert into push_subscriptions (employee_id, endpoint, p256dh, auth, device)
  values (me, sub_endpoint, sub_p256dh, sub_auth, left(coalesce(sub_device, ''), 120))
  on conflict (endpoint) do update set employee_id = me, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device;
end;
$$;

-- Turn this phone's notifications off.
create or replace function public.remove_push_subscription(sub_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_subscriptions s where s.endpoint = sub_endpoint and s.employee_id = public.my_employee_id();
$$;

-- ---------- 2. Which kinds each person turned off ----------

alter table public.employee_prefs add column if not exists push_off text[] not null default '{}';

create or replace function public.set_push_off(kinds text[])
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
  insert into employee_prefs (employee_id, push_off) values (me, coalesce(kinds, '{}'))
  on conflict (employee_id) do update set push_off = excluded.push_off, updated_at = now();
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.remove_push_subscription(text) from public, anon;
revoke all on function public.set_push_off(text[]) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
grant execute on function public.set_push_off(text[]) to authenticated;

-- ---------- 3. For the send-push function only ----------
-- Row level security on with no rules: the app can't see these at all; the
-- function uses the service key, which bypasses the rules.

create table if not exists public.push_log (
  id           bigint generated always as identity primary key,
  employee_id  uuid not null references public.employees (id) on delete cascade,
  kind         text not null,
  ref          text not null,             -- e.g. the shift or punch it was about
  sent_at      timestamptz not null default now(),
  unique (employee_id, kind, ref)
);
alter table public.push_log enable row level security;

create table if not exists public.push_queue (
  id           bigint generated always as identity primary key,
  employee_id  uuid not null references public.employees (id) on delete cascade,
  kind         text not null,
  title        text not null,
  body         text not null,
  url          text not null default '/team',
  created_at   timestamptz not null default now()
);
alter table public.push_queue enable row level security;
