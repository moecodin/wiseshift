---
name: WiseShift
description: Scheduling and punch clock for small teams, set like a bank statement.
colors:
  ink-navy: "#14213d"
  ink-navy-hover: "#26375c"
  on-ink: "#ffffff"
  paper: "#ffffff"
  rail-grey: "#f3f5f8"
  text-muted: "#4a5670"
  text-faint: "#5d6a82"
  hairline: "#d5dae1"
  hairline-soft: "#e6e9ee"
  button-edge: "#c9d0db"
  focus-blue: "#1f4fb4"
  state-red: "#a4262c"
  approve-green: "#1f7a4d"
  approve-green-edge: "#186a40"
  approve-green-hover: "#1a6b43"
  ok-green: "#2d6a4f"
  shift-fill: "#e6ebf3"
  shift-edge: "#a9b4c8"
  dark-desk: "#131413"
  dark-card: "#181a19"
  dark-head: "#1e201f"
  dark-hairline: "#282a29"
  dark-ink: "#ededed"
  dark-muted: "#a0a0a0"
  dark-faint: "#858585"
  dark-button: "#1c1d1c"
  dark-button-edge: "#383938"
  dark-button-hover: "#242524"
  dark-red: "#f0868b"
  dark-approve: "#026439"
  dark-approve-edge: "#32815f"
  dark-approve-hover: "#037544"
  dark-shift-fill: "#262928"
  dark-shift-edge: "#4a4d4b"
  role-green: "#15803d"
  role-red: "#dc2626"
  role-amber: "#d99a1e"
  role-blue: "#3f6fc0"
  role-violet: "#7a4fc0"
  role-pink: "#c04f85"
  role-teal: "#2f8d9a"
  role-taupe: "#8a7d6e"
typography:
  display:
    fontFamily: "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0em"
    fontFeature: "'tnum' 1"
  headline:
    fontFamily: "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0em"
  title:
    fontFamily: "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.08em"
  status:
    fontFamily: "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 600
  button:
    fontFamily: "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "0em"
rounded:
  xs: "2px"
  sm: "3px"
  table: "4px"
  md: "6px"
  lg: "6px"
spacing:
  gutter: "32px"
  card-y: "14px"
  card-x: "16px"
  button-x: "14px"
  button-sm-x: "10px"
  figure-x: "22px"
  rail: "232px"
  rail-collapsed: "64px"
components:
  button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-hover:
    backgroundColor: "{colors.rail-grey}"
  button-small:
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "30px"
  button-primary:
    backgroundColor: "{colors.ink-navy}"
    textColor: "{colors.on-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.ink-navy-hover}"
  button-approve:
    backgroundColor: "{colors.approve-green}"
    textColor: "{colors.on-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-approve-hover:
    backgroundColor: "{colors.approve-green-hover}"
  button-clock-out:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.state-red}"
    rounded: "{rounded.md}"
    height: "36px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  shift-box:
    backgroundColor: "{colors.shift-fill}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.sm}"
  role-tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.xs}"
    padding: "1px 7px"
  rail-item-current:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.sm}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.sm}"
  segmented-control:
    backgroundColor: "{colors.rail-grey}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
  segmented-control-on:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.xs}"
---

# Design System: WiseShift

## Overview

**Creative North Star: "The Bank Statement"**

WiseShift reads like a private bank's or a bookkeeper's statement rather than an app. Light mode is navy ink on white paper with a pale grey-blue rail; dark mode, modelled on a Supabase-style dashboard, is near-white ink on a near-black page with cards one step lighter. Structure comes from 1px hairlines and 2px ink rules, never shadows, blur or gradients. Figures sit in strict tabular columns and totals sit under a ruled line, so a manager trusts the numbers because they line up.

Density follows the job. Manager screens on a computer (Today, Schedule, Hours review, Timesheet) are dense ruled tables and hairline cards. Staff screens on a phone stay simple and tap-friendly. Colour is spent sparingly and always for a reason: ink for everything ordinary, one green for Approve, one red for what is late, missing or wrong, and a small coloured dot per role.

Motion is quick and calm. It confirms that something changed (an approval, a status, a week turned) and never performs on load.

**Key Characteristics:**
- Navy ink on white (light) or #ededed on #131413 (dark); no tinted or colourful themes.
- Hairline structure: 1px rules for boxes and rows, 2px ink rule under page headers and totals.
- Small corners: 2px tags, 3px controls, 6px cards and buttons.
- Tabular figures everywhere; numbers right-aligned in columns.
- One status vocabulary, written as words, not boxed badges.
- Flat: no shadows except focus rings and one ink ripple on a moved shift.

## Colors

A near-monochrome ink palette with two functional colours (approve green, state red) and eight small role dots.

### Primary
- **Ink Navy** (light `ink-navy`; dark `dark-ink`): all text and the fill of the single main action on a screen (Publish, Install, Review all, Ask for time off). In dark mode the main action flips to near-white with dark text (`--on-navy` #131413).

### Secondary
- **Approve Green** (`approve-green`, edge `approve-green-edge`; dark `dark-approve` with `dark-approve-edge`): the fill of every Approve button, and only those. The approve-leave animation borrows its edge colour.
- **State Red** (`state-red`; dark `dark-red`): Late, Missing, errors, the Decline/destructive outline, notification badges, and the "Clock out" text in Working now. Nothing else.

### Tertiary
- **Role Dots** (`role-green` through `role-taupe`, eight swatches): a manager picks one per role in Settings. The colour appears only as a 9px dot inside a hairline role tag, in grid group headers and pickers; never as a fill on a shift.

### Neutral
- **Paper** (`paper`; dark `dark-card`): cards, pop-ups, the current rail item, inputs, ordinary buttons in light.
- **Rail Grey** (`rail-grey`; dark `dark-head`): the light side rail, table heads, segmented-control tracks, hover fills, quiet notes. In dark the rail matches the page (`dark-desk`) with a hairline.
- **Desk** (`paper` in light; `dark-desk` in dark): page background.
- **Muted Slate** (`text-muted`; dark `dark-muted`): secondary text, column heads, section labels, unselected tabs.
- **Faint Slate** (`text-faint`; dark `dark-faint`): tertiary text, add-shift marks, neutral history dots, hover edge on ordinary buttons.
- **Hairline** (`hairline`, `hairline-soft`; dark `dark-hairline`): every box edge and row rule; the soft one separates rows inside a table.
- **Button Edge** (`button-edge`; dark `dark-button-edge`): the thin grey edge of ordinary buttons, toasts and scrollbar thumbs.
- **Shift Fill** (`shift-fill`, edge `shift-edge`; dark `dark-shift-fill`, `dark-shift-edge`): a scheduled shift box, a neutral blue-grey that stands off the page.
- **Focus Blue** (`focus-blue`; dark #8fb0ff): keyboard focus ring and input caret only.

### Named Rules
**The Two Colours Rule.** Green means Approve and red means something is wrong. Publish, Save and every other main action are ink, not green; nothing decorative is ever red.

**The Dot, Not the Fill Rule.** A role's colour lives in a 9px dot inside a hairline tag. Shift boxes are always the neutral shift fill, whatever the role.

## Typography

**Display Font:** Source Sans 3 (with system-ui, -apple-system, Segoe UI)
**Body Font:** Source Sans 3
**Label/Mono Font:** Source Sans 3; no mono face. Weights loaded: 400, 500, 600, 700.

**Character:** A humanist sans set plainly, like a printed statement: no negative tracking on titles, weight does the work, and tabular numerals (`font-variant-numeric: tabular-nums`) are on for the whole app, pop-ups and the kiosk.

### Hierarchy
- **Display** (600, 32px, 1.1): the four figures in Today's summary strip (36px at full height, tightened to 32px for 1366x768). Kiosk clock scales 56 to 120px at 600.
- **Headline** (600, 30px, 1.1): the page title in the desktop header ("Hi Maria"), sitting on a 2px ink rule. Phones use 21 to 24px.
- **Title** (700, about 17px): card titles (Today's shifts, Working now, Payroll readiness).
- **Body** (400, 15px, 1.5): rows, notes, descriptions. Root size scales up on big screens (17.5px at 1600px wide, 19px at 1850px, 22px at 2400px) so the whole sheet grows together.
- **Label** (600, 13px, 0.08em, uppercase): names a figure in the summary strip or heads a group of cards ("NEEDS YOUR ATTENTION"). Column heads in tables are 13px/600 sentence case in muted.
- **Status** (600, 13px): status words, sub-lines are 13px/400 muted.

### Named Rules
**The Steady Digits Rule.** Every number is tabular and right-aligned in its column; a figure that changes eases to its new value in 250ms and never counts up on first show.

**The Word Status Rule.** A status is a word set in weight and colour: On time, Late, Missing, Approved, Pending, Done. Ink for normal, red only for Late and Missing, muted for not-yet. No pill, no box, no icon.

## Layout

On a computer (900px and up) a fixed left rail (232px; 64px with labels hidden, easing over 0.2s) holds the wordmark, the tabs (Today, Schedule, Tasks, Hours, More) and, at the foot, theme, notifications and settings icon buttons above the signed-in person. The content column has a 32px side gutter. The header carries the 30px title and role line on the left, the clock chip (status plus My clock) on the right, and a 2px ink rule beneath.

Manager Today is a ruled figure strip of four columns divided by hairlines, then two columns: the left holds Today's shifts and the Needs your attention cards; the right is led by Working now, then Payroll readiness, Overtime watch and Schedule status (desktop-only cards), then Tasks and notes. Cards stack with about 10px between them.

On phones (below 900px) the tab bar is a plain bar fixed to the bottom edge with a 1px top rule and 50px targets, respecting the safe area; it is not a floating dock. The kiosk is a full-screen two-column layout (clock and date left, keypad or card right) that collapses to one column below 760px.

## Elevation & Depth

The system is flat. Depth is tonal and ruled: page, then paper card with a 1px hairline, then a rail-grey head or note. A stylesheet-level reset removes every box-shadow, backdrop blur and background gradient inside the app and pop-ups; only focus rings survive.

### Shadow Vocabulary
- **Focus ring** (`box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 30%, transparent)` on fields; 2px outline elsewhere): keyboard focus only.
- **Shift ripple** (`0 0 0 0 → 0 0 0 8px` in ink at 35% to 0%, 0.7s): one soft ring when a shift is moved or saved. Not a resting style.

### Named Rules
**The Hairline Only Rule.** Structure is 1px rules; emphasis is a 2px ink rule. If something needs to stand forward, give it paper against grey or a firmer edge, never a shadow.

## Shapes

Corners are small and nearly uniform: 2px on tags, role badges and inner segment buttons; 3px on tabs, inputs, icon buttons, segmented tracks and shift boxes; 4px on tables and kiosk keys; 6px on cards, pop-ups, banners, toasts and every button. Avatars are the one circle: initials on rail grey with a hairline, one tone for everyone. The logo is three rounded bars in ink, muted and faint. Icons are drawn 24-unit SVG strokes (2px, round caps and joins) at 16px that take the surrounding text colour: arrows, check, close, backspace.

## Components

### Buttons
Quiet filled boxes, after the dashboard reference.
- **Shape:** 6px corner, 36px high, 14px side padding, 14px/600 type; small buttons 30px high, 10px padding, 13px.
- **Ordinary:** paper fill (dark `dark-button`) with a thin `button-edge` line and ink text. Hover moves to the rail-grey fill and a faint edge.
- **Main action:** one per area, a plain ink-navy fill with white text (dark: #ededed with #131413 text). Publish is a main action, not green.
- **Approve:** the one green button, `approve-green` with its darker edge; hover darkens.
- **Destructive / Decline:** ordinary box with red text. "Clock out" in Working now is the same: red text on the ordinary button.
- **States:** colour, border and background fade over 120ms; disabled is 50% opacity; focus shows the focus ring.

### Chips
- **Role tag:** hairline box, 2px corner, 1px 7px padding, muted 600 text, preceded by the role's 9px colour dot. On a shift box the tag sits on paper with the shift edge.
- **Clock chip (header):** a 3px-cornered ink outline holding a live dot, "In since 8:00 AM" and a small My clock button.
- **Status:** never a chip; see the Word Status Rule.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** paper on desk (dark: #181a19 on #131413).
- **Shadow Strategy:** none; see Elevation.
- **Border:** 1px hairline.
- **Internal Padding:** 14px 16px on desktop.
- No cards inside cards: Settings sections inside a pop-up are separated by one hairline each, not boxed.

### Tables (signature)
The statement table. Column heads are 13px/600 muted with a 1px ink rule beneath; rows are separated by soft hairlines; numbers right-aligned and tabular; the totals row sits under a 2px ink rule in 700, never in a grey band. The Payroll readiness foot rule is short and faint until everything is clear, then draws across in ink (0.45s).

### Schedule shift box (signature)
A neutral blue-grey box (`shift-fill`, 1px `shift-edge`, 3px corner) with times in 700 ink and meta in ink at 80%. A draft is paper with a dashed shift edge; your own shift takes an ink edge; hover firms the edge to ink without movement. Today's column and head take the rail-grey fill. The dashed add boxes appear on hover or focus on pointer screens and stay visible on touch.

### Inputs / Fields
- **Style:** paper fill, 1px hairline, 3px corner, ink text.
- **Focus:** edge turns focus blue with a 2px 30% focus halo; caret is focus blue.
- **Selection:** ink-navy background with white text.

### Navigation
- **Rail:** rail grey in light, page colour in dark, 1px hairline on its right. Items are 600 muted with a drawn icon; the current item is a paper box with a 1px hairline outline and 700 ink text. It is deliberately not a coloured side stripe. Count badges are small red boxes with a 3px corner.
- **Segmented controls:** a rail-grey track with a hairline; the pressed segment is paper with a hairline outline.
- **Phone:** bottom bar as described in Layout, same current-item treatment.

### Motion
- Tab change on a computer: the whole screen rises 24px and fades in over 0.38s, `cubic-bezier(0.16, 1, 0.3, 1)`, with no card stagger. Phones keep their slide.
- Approve: the card or row takes a green edge and fades out in 200ms, 20ms apart, at most 6.
- A status that changes in Today's shifts fades its colour (0.25s) and holds a soft rail-grey highlight (1.4s).
- Week change: the grid slides 12px in from the side you moved towards (0.2s).
- Hours this week bars grow from the baseline (0.3s).
- Undo toast rises 8px and fades in (0.2s); it is a paper box with a button edge and an underlined action.
- Reduced motion turns every movement off and keeps colour and state changes.

## Do's and Don'ts

### Do:
- **Do** use ink-navy for all text and the single main action; keep other buttons as quiet paper boxes with the 1px button edge and 6px corner.
- **Do** reserve green for Approve buttons and red for Late, Missing, errors, destructive actions and Clock out.
- **Do** build structure from 1px hairlines and put headers and totals on a 2px ink rule.
- **Do** keep every number tabular and right-aligned; ease a changed figure over 250ms and show it instantly on load.
- **Do** write statuses as words (On time, Late, Missing, Approved, Pending, Done) in weight and colour.
- **Do** show a role's colour only as the 9px dot inside a hairline tag; keep shift boxes on the neutral shift fill.
- **Do** use the drawn Icon set (2px stroke, round ends, 16px) for arrows, checks and close marks.
- **Do** give every animation a reduced-motion path that removes movement but keeps colour.

### Don't:
- **Don't** use shadows, backdrop blur, glass or gradients; the only shadows are focus rings and the shift ripple.
- **Don't** make Publish, Save or any non-approve action green, or use red decoratively.
- **Don't** fill shift boxes with the role colour or bring back colourful themes, yellow light or Black & Gold dark.
- **Don't** mark the current rail item with a coloured side stripe; use the paper box with a hairline.
- **Don't** put statuses in boxed pills or badges that look like buttons.
- **Don't** nest cards inside cards, including inside pop-ups.
- **Don't** use text glyphs (‹ › ✓ ✕) as icons.
- **Don't** put tracked-caps kickers or eyebrows above a title; tracked caps only name a figure or head a group.
- **Don't** count numbers up on load or stagger cards on a tab change.

## Known gaps

Not rules; recorded so later work does not copy them.
- App icons, favicon and the install-banner icon still use the old yellow/green artwork.
- Hours review on a small team still defaults to a grid of cards rather than a ledger; a Compact one-line ledger mode exists.
- Staff views, phone layouts, printing and Spanish copy were not fully checked in the new look.
- One staff checkmark text glyph remains in YourDay.jsx.
- The independent motion capture could not run, so motion timings are verified from code only.
- Older glass, gold and linear layers still sit in src/team/team.css and are overridden by src/team/statement.css; the kiosk still uses 4px keys and fallback reds outside the token set.

## Owner decisions (2026-11-19)

These are deliberate exceptions to the strict contract. A review should not flag them.

- **Approve is green.** Approve buttons (Hours review cards, "Approve all", Today time-off card, Punch details) stay filled green. It is the one colour allowed besides state red, and it only ever means "approve".
- **Header says "Hi {name}".** Manager screens keep the greeting as the title; no separate screen title.
- **Hours review opens as the card grid.** The compact ruled list stays one tap away.
- **Current nav item** is a 3px ink bar on the left of a white row (computer rail).
- **Status word is "Pending"** everywhere a punch is waiting for approval.
