# WiseShift: what it has so far

Written 2026-11-18 from the code in `src/team` and the SQL in `supabase/legacy/updates`. "Needs update NNN" means the screen is built and works in sample mode, but the database script must be run before it works against a real Supabase project. Nothing here has been pushed.

## 1. The basics
- **One app, two kinds of login.** Staff see their own schedule, clock and hours. Managers also see everyone's, approve things, and edit the schedule.
- **Tabs:** Today, Schedule, Tasks, Hours, More. On a phone they are a floating bottom dock; on a computer a left sidebar. Tabs for features a business has switched off disappear.
- **Phone first, computer aware.** The same screens re-lay out: cards and sheets on a phone, columns and grids on a computer.
- **English and Spanish** on most screens, chosen in Settings. Light and dark themes, plus a Black & Gold dark style and a yellow light style (the November 2026 redesign).
- **Sample mode** (no Supabase needed): made-up data to try everything, with a switch between a 6-person shop and a 23-person restaurant, and a View as picker to see any person's screens.
- **Feature switches** (Settings, Features), so a business only sees what it uses: Time clock, Timesheets and payroll export, Location on punches, Kiosk clock-in, Time-off requests, Shift swaps and cover, Shift roles, Coverage warnings, Tasks, Manager notes and tasks, Pay rates and paycheck estimates. Presets: Just scheduling, Scheduling + time clock, Everything.

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
- **Add shift to several people and days at once:** in the Add shift pop-up, pick one or more people and one or more days; Save creates one draft per person per day ("Add 6 shifts"). Combinations that overlap an existing shift are skipped and reported; time off is warned about. Changing an existing shift stays a single shift.
- **Onboarding (update 031):** a new business's owner sees a three-step wizard once (welcome, business name and logo, done with a button to Team); everyone else sees a short welcome once per device (notifications, add to home screen when the browser allows it, the location notice, ready). Every step can be skipped; the owner wizard reruns from Settings → Business → Run the setup wizard again. The name and logo replace \"WiseShift\" in the header, side menu and kiosk (the kiosk asks for them with `kiosk_brand`, 031). A business that already exists is marked setup-done by the update, so only new businesses see the owner wizard. The logo is shrunk in the browser to 192px and stored as a data URL (no file storage).
- **Pay period (update 033):** Settings → Business → Pay period (and a step in the setup wizard): every week or every 2 weeks, which day it starts, and for two weeks which week we are in now; a preview says it in words ("Friday to Thursday, every 2 weeks"). Hours, timesheets, Today's numbers, exports and the overtime weeks (40 hours, time and a half) follow it. Existing businesses keep every two weeks from Friday 9 Oct 2026.
- **Reports tab (managers, needs timesheets):** its own menu item after Hours. It holds the timesheet for a pay period (with its pay period arrows), Print and Export hours. The Hours tab is now only punches for managers (Review, Add punch, Details); staff still see their own hours there.
- **Site search:** a Search box at the top of the left menu (a magnifier in the header on a phone); Ctrl/⌘+K or `/` opens it from anywhere. Type what you want ("password", "store hours", "export") and Enter opens the page, switches Settings to Me or Business, and flashes the section or button. It only offers places the person may use (managers-only and switched-off features are left out) and works in English and Spanish. Managers can also type a person's name: Enter opens their punches (Hours review, this pay period, every status), and small buttons open their schedule row, their hours in Reports, or the edit pop-up; inactive people are included. The list of places is `src/team/searchIndex.js`: add an entry there when a screen or Settings section is added.
- **Drag a shift** to a new time (Day timeline, 15-minute steps), another person, or another day (Week grid). A pop-up then asks **Move** or **Copy** (the copy is a draft); mouse drag, or press-and-hold on a phone.
- **Drafts and publishing:** next week starts as a draft (dashed). Publish makes it visible and tells people; a changed published shift is posted again. **Copy last week** and **Clear (n)** (removes the shown week's drafts only, with Undo).
- **Seen ticks:** whether each person has opened the app since the schedule was posted.
- **Schedule-only people** (no email, login, clock or pay) can still be on the schedule.
- Quick types and roles are set in Settings; shifts carry a role badge and color.

## 5. Time clock and hours (managers)
- **Hours review** (the page for approving punches): one short line per punch with a round ✓ to approve and a ⋯ for Details, **Approve all**, and per-group approve. **Undo** for a few seconds after any approval.
- **Filters:** a people picker (search by name, position or group; tick several people or whole groups), a period menu (Past 7 days, This pay period, Last pay period), status chips (Pending, In progress, Approved, All).
- **Group by:** staff group, role, date (earliest first, with each person's role on the line), or one list. Groups show as balanced columns on a computer and sections on a phone.
- **+ Add punch** (pick who, day, times, a reason). **Edit times** and **Delete** from Details.
- **Details:** the punch's map, street addresses, history (who changed what), the shift it belongs to, warnings (late in, early out, away from the shop, no shift, clocked out after the shift ended).
- **Timesheet** (everyone's hours by pay period, with regular and overtime): a table on a computer, a card per person on a phone, and a person's days and paycheck estimate (when pay rates are on) from their name or card. **Print**, and **Export hours** to CSV or PDF with filters (computer).
- **Punch safety:** no overlapping punches for one person (update 027), one open punch per person, and punches round to the hour within a chosen number of minutes (the real times stay saved).
- **Location on punches** (NY monitoring notice): location saved at clock-in and out, "away from the shop" flags, and a notice each person acknowledges (versioned).

**Kiosk clock-in** (branch `kiosk-clock`; feature switch, off by default). A shared store computer or tablet: the split screen has a big clock on the left and a PIN keypad on the right. PIN, then "Hi Maria, clock in?" with Confirm, then a result that clears itself after 4 seconds. Same early window as the phone; too early shows **Clock in anyway** (managers see "Clocked in N min early" or "No shift scheduled" in Hours review). Clocking out is never blocked and shows nothing extra; managers see "Left N min early". Five wrong PINs lock the device for 5 minutes. Managers add the computer in Settings → Kiosk (a one-time link) and set PINs in Team. No location on kiosk punches; Details shows "Store kiosk".

## 6. People and business settings
- **Team:** add, edit and remove people; email login, position, **staff group** (update 030), start date, active, manager, schedule-only; phone and emergency contact; pay type and rate, W-4 and IT-2104 details for the paycheck estimate (when pay rates are on). How to give someone a login.
- **Settings → Business:** shop location (for "at the shop"), clocking-in rules (early window, allow unscheduled clock-in, rounding), shift types, roles, **groups**, positions, notification timing (shift reminder, still-clocked-in nudge, late alert, quiet hours), the location notice text, and the feature switches.
- **Notifications:** web push (send-push function, update 017) for reminders, shift changes, requests and decisions, with per-person choices.
- **Themes and sounds** per person (update 016).

## 7. Database updates (in `supabase/legacy/updates`)
013 team, 014 clock location, 015 punch approvals and history, 016 themes, 017 push, 018 business settings, 019 schedule seen, 020 schedule-only people, 025 kiosk clock-in (on the kiosk-clock branch, not run anywhere yet), 027 no overlapping punches, 028 own time off only, 029 team tasks, 030 staff groups. (Updates 021 to 026 for covers, notes and the like live in the Roosevelt Pups repo; the sync file explains the numbering.)

## 8. What is not finished or not verified
- **Kiosk clock-in** (branch `kiosk-clock`, not merged): built and tried in sample mode only. Update 025 is not run on dev or live.
- **SQL not yet run** on dev or live: 028, 029, 030 (027 is on dev).
- Everything marked as built was checked in sample mode in the browser, not against a live Supabase project. Light mode and real touch devices weren't fully checked.
- **Long screens with 23+ people** still need grouping: the timesheet cards, the Team list, and Today's Working now.
- The old-layout leftovers (the schedule editor, timesheet, Team page) were redone, but the **desktop** timesheet and Team page keep their table and list layouts.
- Roosevelt Pups: all of this is tracked in `docs/rooseveltpups-sync.md` for porting (renumber the SQL; their Tasks come from the daycare sheet, and they lack the manager hand-out button).
