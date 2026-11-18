# The November 2026 redesign

A new look and a few behaviour changes for the whole app. Built on a branch and fast-forwarded into
`main` on 2026-11-18 (39 commits, then one design fix). This file says what it is, where the colours
live, what changed in behaviour, and what has and hasn't been checked.

## The look

**Light mode: liquid glass, yellow accent.**
- A fixed, soft warm wash sits behind the whole app so the glass has something to blur.
- Every surface is frosted white glass: a bright top edge, a thin light border, a soft shadow.
  List rows and table cells use a lighter fill with no blur (there are many of them).
- The accent is the **logo yellow `#f6d580`**. Fills use it with dark text (`#2b2100`). Text, links and
  outlines that used to be the accent are dark ink, because yellow text is unreadable on white.
- Hero cards (the "You're clocked in" bar, the hours summary, today's shift card) are dark
  **smoked glass** with gold numbers.

**Dark mode: Black & Gold (default) or Charcoal.**
- Near-black surfaces, a bronze-gold accent `#e0a44f`, gold hairlines, a faint warm glow, frosted panels.
- A person can switch to **Charcoal** (cool dark gray, sky-blue accent) in Settings, Me, Appearance.
  The choice is saved on the device as `wiseshift-dark-style` and put on the page as
  `data-dark-style="gold" | "charcoal"`. Light/dark itself is `data-bs-theme` and `wiseshift-theme`.

**Font:** Plus Jakarta Sans (loaded in `index.html`). Chosen because it has plain zeros; Atkinson
Hyperlegible, the first choice, has slashed zeros the owner did not like.

**Shapes and buttons**
- One corner scale: `--r-xs` 6px, `--r-sm` 10px, `--r-md` 14px, `--r-lg` 18px, `--r-table` 10px.
  Tables and dense lists use the small corners; cards and phone lists use the larger ones.
- Every action button is a rounded rectangle at least 44px tall. In light mode they are glossy glass:
  yellow for the main action (Approve, Clock in, Publish), frosted clear glass with a gold edge for the
  other choice. The round clock button is a glass sphere.
- The phone tab bar is a floating rounded dock; the current tab is glossy yellow in light mode and
  gold in dark mode. On a computer it is a sidebar with a filled current item.

**Glass fallbacks:** solid colours return when the browser can't blur (`@supports`) and when the
person turns on "reduce transparency" (`prefers-reduced-transparency`). Printing uses plain paper.

## Where the colours live

| What | Where |
|---|---|
| Light colour tokens (`--navy`, `--on-navy`, `--navy-edge`, `--focus`, `--yellow`, `--ink`, `--muted`, `--line`, `--desk`, `--paper`, …) | `src/index.css`, the `[data-bs-theme='light']` block |
| Dark (Charcoal) tokens | `src/index.css`, the `[data-bs-theme='dark']` block |
| Black & Gold tokens and its panel styling | `src/team/team.css`, blocks scoped `[data-bs-theme='dark'][data-dark-style='gold']` |
| Light glass: fills, edges, blur, background wash (`--g-fill`, `--g-edge`, `--g-blur`, `--amb-a/b/c`, `--amb-base`, `--accent-rgb`) | `src/team/team.css`, the "Light mode: liquid glass" block |
| Corner sizes (`--r-*`) | `src/team/team.css`, the redesign layer blocks |

`--navy` is the name of the accent colour in both themes (it started life as navy and kept the name).
To change the light accent, change `--navy`, `--navy-hover`, `--on-navy`, `--navy-edge`, `--focus`,
`--accent-rgb` and the `--amb-*` wash together, then check contrast. Text on the accent must be
4.5:1 or better; the yellow with `#2b2100` is about 11:1.

Note: `team.css` grew by adding override blocks at the end of the file, one per design round, so some
selectors are defined more than once and the later block wins. Consolidating it is a worthwhile cleanup.

## Behaviour that changed

- **Clock card** (`ClockCard.jsx`, shared by staff Today, a manager's "My clock" and manager Today on a
  phone): time, date and status on the left, a large press-and-hold round button on the right.
  The hold ring is the accent colour when clocking in and the site yellow when clocking out in dark mode.
- **Clock in outside a shift:** the real yellow button always shows. Outside the 30-minute window the
  punch still works and is flagged for review. If a manager turned "clock in anyway" off
  (`settings.allowAnyway === false`) the button is dimmed and does nothing. The window rule itself
  (`themes/facts.js`) is unchanged.
- **Phone Today** (`TodayTiles.jsx`): four tiles, Your day, Coming up, Worked this pay period and
  Who's working today. On a phone they replace the Your day card, the Coming up list, the weekly total,
  the My requests card and the Who's working list, which are hidden under 900px; a computer keeps the
  full cards. Request status is therefore not on the phone Today screen (it is under More, Time off).
- **Manager Today, phone order:** clock, Needs your attention, the tiles, then who is working.
  On a computer it is a dashboard with a row of four numbers across the top.
- **Hours, Review tab:** punches are cards in a grid. A status filter (Awaiting approval, In progress,
  Approved, All, with counts) and an employee filter. The buttons read "Approve 6 Hours" and "Details";
  "Approve all (n) · total hours" is in the toolbar on a computer and a frosted bar above the dock on a phone.
- **Hours, Employee tab and staff My hours:** each week is one panel with compact rows and inline buttons.
- **My shifts:** a Day / Week switch. Day shows the chosen day; Week shows the weekly total and every day.
  The choice is saved and shared with Whole team.
- **Accessibility:** pop-ups trap keyboard focus and return it to the opener; deleting a shift, punch or
  note asks first; every control has a visible focus ring; the first field is only auto-focused on
  devices with a mouse (`src/lib/focus.js`); numbers use tabular digits; taps skip the double-tap delay.
- **The tab is kept in the address** (`?tab=hours`), so a refresh returns to the same tab.
- **Notes under the clock** after clocking out are shorter (two lines for the next-shift panel and one
  line for the missing-location warning). The "Your location is saved…" line was removed.

New files: `ClockCard.jsx`, `TodayTiles.jsx`, `darkStyle.js`, `src/lib/focus.js`.

## What was checked, and what wasn't

Checked (sample data, mostly phone-size views in the browser pane): manager and staff Today, the clock
button in each state, Hours Review, the Employee tab, the schedule grid, People, Settings, pop-ups,
the Day / Week switch; contrast ratios for the main text and button colours in light and dark.

**Not checked:** anything against a real Supabase database (clock-in, Approve, update 024's cover
requests and notes); Spanish on most screens; printing the timesheet in the new look; the sign-in page;
how the glass performs when scrolling on an older phone.

## Cleanup still open

- Consolidate `team.css` (override blocks), and decide whether to keep the Charcoal option.
- Remove unused word-list entries and tile code left from the My requests tile.
- App icons, the favicon and the in-app logo are still the old green and terracotta artwork.
- The design checker flags Plus Jakarta Sans as "overused"; it is ignored on purpose
  (`.impeccable/config.json`, not committed), with the reason above.
