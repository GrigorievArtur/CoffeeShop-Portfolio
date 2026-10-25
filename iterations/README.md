# Iterations

Screens from each design pass — **never delete these**, they are the visual history of the site.

| File | What it shows |
|---|---|
| `04-*.png` | Reservation merged into `index.html`: 3 columns, glass panels over the bean canvas, contact block |
| `05-*.png` | Form always visible: Name · Phone · Date · Time · Table · Guests, time-driven conflicts |
| `06-*.png` | Party-size turn times + Confirm pinned while the field list scrolls |
| `07-*.png` | Staff floor console: alerts, live table cards, seat/left/extend, schedule, audit, footer |
| `08-*.png` | Date field added to the staff booking form, synced with the console date |
| `09-*.png` | Override booking → red "double-booked" alert with a cancel per guest |
| `10-*.png` | Guest "Any table" option + the reseat disclaimer under the form |
| `11-*.png` | Venue clock in the console header — live states on real system time |
| `12-*.png` | "Any table" simplified to a plain label and made the default in both pages |

## 06 — turn times + pinned confirm
- `06-form-default.png` — 1600×1000, default state, T3 already booked at the first slot
- `06-form-laptop.png` — 1280×800, all six fields + Confirm visible
- `06-form-conflict.png` — T2 picked, then time moved to 10:30 → T2 booked, message + disabled Confirm

## 07 — staff console (`admin.html`)
- `07-admin.png` — 1600×1000, the console at 13:20: T3 over its 75 min turn + Ruth arriving in
  20 min (two alerts), T2 seated, T1/T4 free with later covers, T5 dirty, T6 blocked, schedule + audit
- `07-admin-laptop.png` — 1280×860
- `07-admin-mobile.png` — 520×1500, single column, alerts and cards stack, 44px tap targets
- `07-guest-plan.png` — same moment on the guest page: T2/T3/T6 read as reserved for the 2:00 PM
  slot while the dirty T5 stays bookable (booking layer vs live layer)
- `07-footer.png` — the new closing band with the discreet *Staff console* link
- `07-hero.png` — regression check that the shared CSS additions left the hero untouched

## 08 — date in the booking form
- `08-admin-date.png` — 1600×1000, form order now Name · Phone · **Date** · Time · Table · Party;
  the form date and the header date are one value (change either, both move, times + schedule follow)

## 09 — override → double-booking alert
- `09-admin-doublebook.png` — 1600×1000, a *Walk-in Party* booked over Jonas Reed's 6:00 PM on T2
  with *Allow override*: the red banner names both parties, the schedule lists both 6:00 PM rows,
  and the audit shows `book (override)`

## 10 — any table + reseat note
- `10-any-table.png` — 1600×1100, Table = *Any table · fastest (→ T1)*, nothing highlighted on the
  plan, status explains that the best free table will be assigned
- `10-any-table-booked.png` — the same flow after Confirm: "Table T1 (we picked the best fit)", the
  pane turns reserved, and the reseat note sits above the pinned button

## 11 — venue clock
- `11-venue-clock.png` — 1600×1000, captured with **no fake clock**: the machine was at 22:17 local
  while the venue clock read `Sat 12:17 PM`, and the console still showed live seats, overstays and a
  bookable day. That is the proof the demo follows Portland, not the visitor's system time.

## 12 — any table as the default
- `12-any-default.png` — 1600×1100, the guest form opens on *Any table*: nothing highlighted on the
  plan, "Any table works — we'll seat you at the best free one.", Confirm ready
- `12-admin-any-default.png` — same default in the console's *Book for a guest*, next to the venue
  clock (`Sat 12:19 PM`)

The `10-*` shots keep the earlier label (`Any table · fastest (→ T1)`); the current UI just says
**Any table**.

## How these are captured
Headless Edge (`--headless=new --screenshot`). The `*-reserve*` / `*-form*` shots hide the hero and
the wave bands, because headless screenshots don't reliably capture a scrolled position — this
matches what you see after pressing *Reserve Table* (hero scrolled away, waves faded out).

Conflict shots are produced by dispatching `change` events on the time + table selects before the
screenshot.

The `07-*` shots pin the clock to 13:20 (a `Date` subclass injected in a temporary copy of the page,
before `booking-core.js` loads) because the live demo states — overstay, at-risk next cover, dirty
table — only exist during opening hours. The temporary copies are deleted afterwards; the site
itself always uses the real clock.
