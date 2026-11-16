# WiseShift

Simple, low-cost scheduling and punch clock for small teams (under 20 people).

Started from the team page of an app already in daily use at a small shop. This
repo holds only the team features; the shop-specific parts were left behind.

## What works today
- **Punch clock:** clock in/out with times taken from the database clock (nobody can edit their own), optional location capture with an acknowledgement notice, manager review and approval of punches
- **Schedule:** managers draft shifts, then publish; employees see published shifts only
- **Time off:** employees request, managers approve or decline
- **Hours:** per-person and team hours by pay period, CSV export
- **Notifications:** installable phone app with push notifications
- **Settings:** clock-in rules, rounding, shift presets, positions, reminders

## Known limits (work in progress)
- **One business per database.** Tables have no business ID yet, so two companies would see each other's data. Multi-business support is the first big job.
- **No self-signup or invites.** Logins are made by hand in Supabase.
- Paycheck estimates use US federal and New York tax rules (`src/team/taxRates.js`). They should become optional.
- The language setting (Spanish/English) needs a database function that lived in a daycare-only script, so it isn't in `supabase/legacy/` yet.
- The old database scripts are in `supabase/legacy/` for reference only. They will be replaced by a new multi-business schema.
- The push-notification function in `supabase/legacy/functions/send-push` still mentions features that were removed (tasks, chat) and needs trimming.
- App icons are not included yet: add `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `apple-touch-icon.png` to `public/app/`.

## Run it
Needs [Node.js](https://nodejs.org).

```bash
npm install
npm run dev     # http://localhost:5173
```

Without Supabase keys it runs on made-up sample data. To connect a database, copy `.env.example` to `.env.local` and fill in the two values. Never commit secret keys.

Other commands: `npm run build`, `npm run lint`.

## Where things are
| Path | What's in it |
|---|---|
| `src/team/` | The whole app: clock, schedule, hours, time off, people, settings |
| `src/team/useTeamData.js` | All the data and every way it changes (the only place that talks to Supabase) |
| `src/lib/`, `src/state/` | Dates, Supabase connection, sign-in state |
| `public/` | Service worker and app manifest |
| `supabase/legacy/` | Old single-business database scripts (reference only) |
