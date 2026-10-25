# Good Days Coffee — portfolio site + reservation prototype

A café landing page with an in-page table reservation flow, a clickable top-down floor plan, and a
staff floor console. No build step, no frameworks, no server: open `index.html` and it runs.

```
index.html        guest site (hero · collage · floor plan · reservation form · footer)
admin.html        staff floor console (same rules, different front-end)
css/              base · canvas · waves · hero · collage · reservation · footer · admin · responsive
js/               booking-core (domain) · reservation (guest UI) · admin (console UI) · beans · parallax · main
docs/             reservation-rules.md · backend-java-spring.md · admin-console.md
iterations/       screenshots of each design pass — the visual history, never deleted
backups/          earlier copies of the page / reservation section
```

## Run it

Open `index.html` directly (`file://` works — there are no ES modules). Then open `admin.html`, or use
the *Staff console* link in the footer.

## How it is put together

**One rule engine, two front-ends.** `js/booking-core.js` owns the venue config, turn times, slot
grid, conflict detection, floor states, booking/floor actions, the audit trail, and persistence
(`localStorage`, synced across tabs). `js/reservation.js` and `js/admin.js` only render and call it.
Details: [`docs/admin-console.md`](docs/admin-console.md).

**Availability is derived, never stored.** A table has no "reserved" flag. For any
`(table, date, time, party)` the core computes `available · reserved · too-small · blocked · past`.
That is why changing the time re-checks the chosen table and why a dirty table is still bookable
two hours from now.

**Two layers.** Forward bookings (`confirmed → seated → completed`) are authoritative. The live floor
(`available · seated · dirty · blocked`) informs staff and never mutates a booking. This split is
what real systems (OpenTable, Resy, Tock, Toast, SevenRooms) implement, and it is documented with
sources in [`docs/reservation-rules.md`](docs/reservation-rules.md).

**Time is the venue's, not yours.** `VENUE.timezone` (`America/Los_Angeles`) drives "today",
opening hours, the slot grid and the lead time through `Intl`, so the demo behaves identically from
any machine or timezone. The console header shows that clock (`Sat 12:17 PM`); `dateTime()` reverses
the conversion with a two-pass offset lookup, which is the same correction the Spring port needs.

**Built to be ported.** The JS is a reference implementation: every function maps to a Spring Boot
service (`docs/backend-java-spring.md`), the store shape maps to Postgres tables, and the UI would
only swap `localStorage` for `GET /api/availability` / `GET /api/floor`.

## Reservation rules at a glance

- Open 08:00–20:00, 30-min slots, last seating 19:00 (45 min before close, and the turn must fit).
- Party-size turn times: 1–2 → 75 min, 3–4 → 90, 5–6 → 105, 7+ → 120, plus a 15 min turnover buffer.
- Half-open interval overlap, so back-to-back covers are allowed.
- 30 min minimum lead time, 60 days maximum advance.
- Staff can override a taken table; the booking is flagged `overridden`, audited, and raises a red
  double-booked alert naming both guests.
- **Any table is the default** — guests who don't care skip the plan entirely; the house assigns the
  best free table and the receipt names it. Staff get the same default in the console, so a phone
  booking is two fields.
- Guests are told up front that a table is only held briefly and that, if it is still occupied when
  they arrive, they may be seated at the next best table.

## Demo notes

`localStorage` key `gooddays.booking.v1`. The first load seeds a day of bookings plus live floor
states (an overstaying party, an at-risk next cover, a dirty table, a blocked table). Use **Reset
demo** in the console to rebuild it; use a different browser profile to start empty.
