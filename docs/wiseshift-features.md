# WiseShift: what it has so far

Written 2026-11-18 from the code in `src/team` and the SQL in `supabase/legacy/updates`. "Needs update NNN" means the screen is built and works in sample mode, but the database script must be run before it works against a real Supabase project. Nothing here has been pushed.

## 1. The basics
- **One app, two kinds of login.** Staff see their own schedule, clock and hours. Managers also see everyone's, approve things, and edit the schedule.
- **Tabs:** Today, Schedule, Tasks, Hours, More. On a phone they are a floating bottom dock; on a computer a left sidebar. Tabs for features a business has switched off disappear.
- **Phone first, computer aware.** The same screens re-lay out: cards and sheets on a phone, columns and grids on a computer.
- **English and Spanish** on most screens, chosen in Settings. Light and dark themes, plus a Black & Gold dark style and a yellow light style (the November 2026 redesign).
- **Sample mode** (no Supabase needed): made-up data to try everything, with a switch between a 6-person shop and a 23-person restaurant, and a View as picker to see any person's screens.
- **Feature switches** (Settings, Features), so a business only sees what it uses: Time clock, Timesheets and payroll export, Location on punches, Kiosk clock-in (unfinished), Time-off requests, Shift swaps and cover, Shift roles, Coverage warnings, Tasks, Manager notes and tasks, Pay rates and paycheck estimates. Presets: Just scheduling, Scheduling + time clock, Everything.

## 2. Staff
**Today**
- A clock card with a hold-to-clock-in/out button, the time, today's status, and where the phone was (when location is on).
- Four tiles that open pop-ups: **Your day** (shift bullets, clock status, time left, tasks you have), **Coming up** (every scheduled shift and time off ahead, 60 days), **Worked this pay period** (each day with hours, overtime), and **Who's working today** (goes to the schedule).
- **Next shifts** cards at the bottom (one card per shift, with the hours total).
- A pop-up when a **manager clocked you out**, with a one-tap note to say it was a mistake.
- Open shifts and anything a manager tagged you on.
**Schedule**
- My shifts and the whole team, as a Day timeline or a Week (a card per day on a phone, a grid on a computer). Published shifts only.
- Shift swaps and cover: give a shift away, ask a person or the whole team to take it, swap with a coworker; managers approve.
**Hours**
- Own punches by day for the pay period (week 1 and 2), overtime, and a paycheck estimate (federal, Social Security, Medicare, NY state, NY disability and paid family leave) when pay rates are on.
**Time off**
- Ask for days off, withdraw a request, see approved and earlier ones. Staff only see their own time off (update 028 enforces it in the database).
**Tasks** (update 029)
- Today and Tomorrow; tasks during your shift first; **I'll take it** (first tap wins), **Done**, **Give back**; see who has what; tasks a manager hands you can't be given back.
**Notes to the manager**
- Punch notes ("forgot to clock in", "forgot to clock out", "working outside the shop", other) that appear on the manager's Today.
**Settings (Me)**
- Appearance, notifications, own phone and emergency contact, password, language, the location notice, help.

## 3. Managers
**Today (phone):** My clock strip, Needs your attention, working-now list, drafts to publish, notes and tasks, tiles.
**Today (computer):** stat cards with trends (hours this pay period vs last, overtime, to review, late clock-ins this week) and a **weekly hours chart** (scheduled vs worked, a toggle that starts closed).
**Needs your attention:** hasn't clocked in (with a Call button), time-off requests to approve or decline, cover requests, punches never clocked out, staff notes, punches to review.
**Working now:** who is clocked in, on time or late, with **Clock out** for anyone who forgot.
**Who's working today** pop-up (managers): everyone scheduled or clocked in, with On time / Late / Hasn't punched in / Hasn't punched out badges.
**Notes and tasks:** sticky notes and a to-do list with colors, due dates, and people tagged.

## 4. Schedule (managers)
- **Day timeline** (phone): an hour axis, a row per person, a bar per shift; coverage strip that flags thin or empty stretches; Copy yesterday; Publish.
- **Week:** a grid on a computer (people down the side, days across) and a card per day on a phone. With staff groups set up, both are **grouped by staff group**, and phone shifts are one short line each.
- **Add / change a shift** (a sheet): person, day, quick types (Open, Close, All Day), start and end, label, unpaid break, role, note, delete. Warns about overlapping shifts and time off.
- **Drag a shift** to a new time (Day timeline, 15-minute steps), another person, or another day (Week grid). A pop-up then asks **Move** or **Copy** (the copy is a draft); mouse drag, or press-and-hold on a phone.
- **Drafts and publishing:** next week starts as a draft (dashed). Publish makes it visible and tells people; a changed published shift is posted again. **Copy last week** and **Clear (n)** (removes the shown week's drafts only, with Undo).
- **Seen ticks:** whether each person has opened the app since the schedule was posted.
- **Schedule-only people** (no email, login, clock or pay) can still be on the schedule.
- Quick types and roles are set in Settings; shifts carry a role badge and color.

## 5. Time clock and hours (managers)
- **Hours review** (the page for approving punches): one short line per punch with a round ✓ to approve and a ⋯ for Details, **Approve all**, and per-group approve. **Undo** for a few seconds after any approval.
- **Filters:** a people picker (search by name, position or group; tick several people or whole groups), a period menu (Past 7 days, This pay period, Last pay period), status chips (Awaiting approval, In progress, Approved, All).
- **Group by:** staff group, role, date (earliest first, with each person's role on the line), or one list. Groups show as balanced columns on a computer and sections on a phone.
- **+ Add punch** (pick who, day, times, a reason). **Edit times** and **Delete** from Details.
- **Details:** the punch's map, street addresses, history (who changed what), the shift it belongs to, warnings (late in, early out, away from the shop, no shift, clocked out after the shift ended).
- **Timesheet** (everyone's hours by pay period, with regular and overtime): a table on a computer, a card per person on a phone, and a person's days and paycheck estimate (when pay rates are on) from their name or card. **Print**, and **Export hours** to CSV or PDF with filters (computer).
- **Punch safety:** no overlapping punches for one person (update 027), one open punch per person, and punches round to the hour within a chosen number of minutes (the real times stay saved).
- **Location on punches** (NY monitoring notice): location saved at clock-in and out, "away from the shop" flags, and a notice each person acknowledges (versioned).

## 6. People and business settings
- **Team:** add, edit and remove people; email login, position, **staff group** (update 030), start date, active, manager, schedule-only; phone and emergency contact; pay type and rate, W-4 and IT-2104 details for the paycheck estimate (when pay rates are on). How to give someone a login.
- **Settings → Business:** shop location (for "at the shop"), clocking-in rules (early window, allow unscheduled clock-in, rounding), shift types, roles, **groups**, positions, notification timing (shift reminder, still-clocked-in nudge, late alert, quiet hours), the location notice text, and the feature switches.
- **Notifications:** web push (send-push function, update 017) for reminders, shift changes, requests and decisions, with per-person choices.
- **Themes and sounds** per person (update 016).

## 7. Database updates (in `supabase/legacy/updates`)
013 team, 014 clock location, 015 punch approvals and history, 016 themes, 017 push, 018 business settings, 019 schedule seen, 020 schedule-only people, 025 kiosk clock-in (unfinished, not committed), 027 no overlapping punches, 028 own time off only, 029 team tasks, 030 staff groups. (Updates 021 to 026 for covers, notes and the like live in the Roosevelt Pups repo; the sync file explains the numbering.)

## 8. What is not finished or not verified
- **Kiosk clock-in:** the SQL exists locally and the feature switch is listed, but the kiosk page isn't built and neither is committed.
- **SQL not yet run** on dev or live: 028, 029, 030 (027 is on dev).
- Everything marked as built was checked in sample mode in the browser, not against a live Supabase project. Light mode and real touch devices weren't fully checked.
- **Long screens with 23+ people** still need grouping: the timesheet cards, the Team list, and Today's Working now.
- The old-layout leftovers (the schedule editor, timesheet, Team page) were redone, but the **desktop** timesheet and Team page keep their table and list layouts.
- Roosevelt Pups: all of this is tracked in `docs/rooseveltpups-sync.md` for porting (renumber the SQL; their Tasks come from the daycare sheet, and they lack the manager hand-out button).
