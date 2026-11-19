# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Small shops and restaurants (teams under 20). Staff use it on their phones to clock in and out, see their shifts, request time off and check hours. Managers use it on both phone and computer to build and publish the schedule, review and approve punches, handle time-off and cover requests, and manage the team. An optional shared store computer runs the kiosk clock-in.

## Product Purpose
Simple, low-cost scheduling and punch clock for small teams. Success: a staff member clocks in or finds their next shift in seconds, and a manager can publish a schedule and approve the pay period's hours without a spreadsheet.

## Positioning
Scheduling plus a tamper-resistant time clock (times come from the database clock, nobody edits their own) in one small, cheap app, with feature switches so a business only sees what it uses.

## Operating Context
Used during a working shift, often one-handed on a phone; by managers at a desk reviewing the week and the pay period. Languages: English and Spanish. Shops with and without a time clock. Runs on made-up sample data when no Supabase keys are set (the public preview uses this).

## Capabilities and Constraints
- React + Vite + Supabase app (existing codebase, Bootstrap base). Stack stays.
- Tabs: Today, Schedule, Tasks, Hours, More. Tabs for features a business has switched off disappear.
- Staff and manager logins; managers see everything staff see plus approvals and editing.
- Features: punch clock (optional location), schedule drafts and publishing, shift swaps and cover, time off, timesheets and CSV/PDF export, paycheck estimates, tasks and manager notes, push notifications, kiosk clock-in.
- Light and dark mode both stay.
- All features and behaviour stay the same: this is a visual and layout redesign only.
- Reduce-transparency and print must keep working.

## Brand Commitments
Binding direction from the owner for the redesign: start fresh from the current look; calmer and cleaner; a business-type feel rather than a chunky-buttoned, colourful app. The glass look, the yellow light theme and the Black & Gold dark theme are dropped. Light and dark mode are kept as a calm neutral pair.

## Evidence on Hand
Sample-data mode with a 6-person shop and a 23-person restaurant (use for screenshots). Feature inventory in `docs/wiseshift-features.md`. No real customer testimonials, pricing or benchmarks exist; none may be invented.

## Product Principles
- Speed for the common task: clocking in and checking the next shift come first.
- Calm and trustworthy: payroll-adjacent data should read as dependable, never playful.
- Dense where managers need it (schedule, hours review), simple where staff need it.
- One coherent system across phone, computer and kiosk.

## Accessibility & Inclusion
Readable at a glance during a shift; touch targets stay comfortably large on phones; both languages must fit without breaking layouts. Zero glyphs should be plain (not slashed), per the owner's earlier font feedback.
