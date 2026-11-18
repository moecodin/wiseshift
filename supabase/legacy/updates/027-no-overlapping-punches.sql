-- Update 027: no overlapping punches for one person.
--
-- Run once in Supabase → SQL Editor, after 026. Safe to re-run. Dev project first, then live.
--
-- Why: update 013 already allows only ONE open punch per person (so a double tap or a
-- second phone can't make two open punches). But nothing stopped a finished punch, or a
-- punch a manager added or fixed, from overlapping another one (for example Johnatan on
-- Tue Nov 17). Phone clock-in, kiosk clock-in and the manager's Add/Fix punch all insert
-- or update the punches table, so one guard here covers all three.
--
-- After this update, saving a punch that overlaps another punch of the same person is
-- refused with a plain message. Punches that already overlap are left alone (so the
-- update can't fail on old data); they only count again if someone edits their times.
-- To find the existing ones, run the check at the bottom.

create or replace function public.punch_no_overlap()
returns trigger
language plpgsql
as $$
declare
  clash record;
begin
  -- Only when the person or the times changed (approving, notes, kiosk ids don't re-check).
  if tg_op = 'UPDATE'
     and new.employee_id is not distinct from old.employee_id
     and new.clock_in    is not distinct from old.clock_in
     and new.clock_out   is not distinct from old.clock_out then
    return new;
  end if;

  select p.clock_in, p.clock_out into clash
    from punches p
   where p.employee_id = new.employee_id
     and p.id is distinct from new.id
     and p.clock_in < coalesce(new.clock_out, 'infinity'::timestamptz)
     and new.clock_in < coalesce(p.clock_out, 'infinity'::timestamptz)
   limit 1;

  if found then
    raise exception 'This overlaps another punch for the same person (% to %)',
      public.ny_clock(clash.clock_in),
      public.ny_clock(clash.clock_out);
  end if;
  return new;
end;
$$;

drop trigger if exists punch_no_overlap on public.punches;
create trigger punch_no_overlap before insert or update on public.punches
  for each row execute function public.punch_no_overlap();

-- Check for punches that already overlap (run on its own; changes nothing):
--
-- select e.name, a.clock_in as a_in, a.clock_out as a_out, b.clock_in as b_in, b.clock_out as b_out
--   from punches a
--   join punches b on a.employee_id = b.employee_id and a.id < b.id
--    and a.clock_in < coalesce(b.clock_out, 'infinity') and b.clock_in < coalesce(a.clock_out, 'infinity')
--   join employees e on e.id = a.employee_id
--  order by a.clock_in desc;
