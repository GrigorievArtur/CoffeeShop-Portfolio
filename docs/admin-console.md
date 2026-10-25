# Staff console (`admin.html`)

The floor console is a **second front-end over the same rules**, not a copy of them. Everything the
guest page knows about availability and everything the console knows about the floor lives in one
module, `js/booking-core.js`.

```
                    ┌──────────────────────────────┐
   index.html  ───► │  js/reservation.js           │
   (guest)          │  renders slots + floor plan  │
                    └──────────────┬───────────────┘
                                   │  window.GoodDays.core
                    ┌──────────────▼───────────────┐
                    │  js/booking-core.js          │
                    │  VENUE · TURN_RULES · TABLES │
                    │  slotsFor · conflictFor      │
                    │  tableState · book · seat …  │
                    │  store (localStorage)        │
                    └──────────────┬───────────────┘
                                   │  window.GoodDays.core
                    ┌──────────────▼───────────────┐
   admin.html  ───► │  js/admin.js                 │
   (staff)          │  floor cards · alerts ·      │
                    │  schedule · audit · booking  │
                    └──────────────────────────────┘
```

The console header shows the **venue clock** (`Sat 12:17 PM`, `America/Los_Angeles`), not the
visitor's — every time in this page (schedule, alerts, audit, table options) is venue-local, exactly
like the guest page.

Why it is built this way:

- **One source of truth.** A table cannot be "free" on one page and "booked" on the other; both ask
  the same `tableState()`.
- **The admin page is a real page**, not a mocked-up overlay — it is the thing that later points at
  `GET /api/floor` instead of `localStorage`.
- **No duplicated rules.** There is no `simulation/` copy of the booking logic to keep in sync.
- **Cross-tab sync.** `localStorage` + a `storage` listener means booking on the guest page updates
  the console (and vice versa) without a server, in the same browser.

---

## 1. Two layers, again

| Layer | Stored in | Who writes | What it means |
|---|---|---|---|
| **Booking** | `store.reservations[]` | `book()`, `cancel()`, `noShow()` | A future cover. Authoritative. Never edited by floor buttons. |
| **Live floor** | `store.floor[tableId] = { state, reservationId, since, reason? }` | `seat`, `seatWalkIn`, `markLeft`, `markClean`, `block`, `unblock` | What is happening in the room *right now*: `available · seated · dirty · blocked`. |

The console renders both: the card body comes from the live layer, the "Next 4:00 PM · Mara Okafor"
line comes from the booking layer. Freeing a table changes the first and never the second — which
is exactly why cleaning T3 does not release Ruth's 1:40 PM booking.

Guest availability (`tableState`) only reads the **booking** layer plus blocks. A dirty table is
therefore still bookable at 6 PM: it will be clean by then.

---

## 2. What staff can do

| Control | Core call | Result | Audit action |
|---|---|---|---|
| **Seat walk-in** (party select + button) | `seatWalkIn(tableId, party)` | Creates a `seated` reservation starting now with a party-size turn time, floor → `seated` | `seat walk-in` |
| **Mark left** | `markLeft(reservationId)` | Reservation → `completed`, floor → `dirty` | `left table` |
| **Mark clean** | `markClean(tableId)` | Floor → `available` | `table clean` |
| **+15 min** | `extend(reservationId, 15)` | Adds 15 to `turnMinutes`; later covers may now conflict and the alert banner says so | `extend turn` |
| **Block / Unblock** | `block(tableId, reason)` / `unblock(tableId)` | Floor → `blocked`; `tableState` reports `blocked` for today, so guests cannot pick it | `block table` |
| **Book for a guest** | `book({..., override})` | Normal booking. With *Allow override* ticked it may land on an already-booked table and is flagged `overridden` | `book` / `book (override)` |
| **No-show** | `noShow(id)` | Reservation → `no_show`, floor → `available` | `no-show` |
| **Cancel** (alert buttons) | `cancel(id)` | Reservation → `cancelled`; if it was the seated party, the table is released to `available` | `cancel` |

### Date context

The console has exactly **one** date, shown twice: the picker in the admin bar and the **Date** field
in the booking form. Changing either updates the other, re-lists the times, re-labels the table
options (`T3 · 4 seats · booked 11:40`) and re-scopes the schedule. A form date that disagreed with
the view date is the classic host-console bug — this design makes it impossible.

Form order mirrors the guest page: **Name · Phone · Date · Time · Table · Party**. **Any table** is
the first option *and* the default, so a phone booking is two keystrokes — name, phone, Book:
`book()` resolves the table with `pickTable()` and stores it with `autoAssigned: true`. Pick a table
only when the guest actually cares.

### What an override actually does

*Allow override* only bypasses one thing: `status === 'reserved'`. It is **not** a "force" switch.

| Situation | With override ticked |
|---|---|
| Table already booked at that time | Allowed → a second `confirmed` reservation is created, flagged `overridden: true`, audit `book (override)` |
| Off-grid time (`12:55`, `03:15`) | Still rejected — `BAD_SLOT` |
| Outside opening hours / past last seating / inside the lead time | Still rejected — `BAD_SLOT` |
| Table blocked (today) | Still rejected — `NOT_AVAILABLE` |
| Party larger than the table | Still rejected — `NOT_AVAILABLE` (`too-small`) |

What it does **not** do: it does not touch the existing booking (no move, no cancel, no shorten), it
does not merge the two covers, and it does not mark the table as occupied. Both reservations stay
`confirmed` on the same table, and the console raises a red **double-booked** alert naming both
guests, with a cancel button for each. Guests see the table as `reserved` for that slot, exactly as
if only one booking existed.

So the flow is: staff takes the booking because the party is standing there → the alert appears →
the host decides who to move or cancel. That is deliberate: an override records a human decision,
it does not silently invent capacity. The Spring equivalent keeps the same contract — an override
row plus a `CONFLICT` event, never a deleted booking.

`core.seat(reservationId)` also exists (seat a specific confirmed booking) — the schedule list uses
it in the Spring mapping, the console currently exposes the walk-in path.

---

## 3. Alerts

`core.alerts()` is a pure read model, recomputed on every render (and every 60 s):

- **overstay** — a table is `seated` and `now > start + turnMinutes` → `{ tableId, minutesOver }`.
- **conflict** — that same table has a later `confirmed` booking arriving within 30 minutes
  → `{ tableId, reservation, next, arrivesIn }`.

- **double** — two live bookings (`confirmed` / `seated`) on the same table whose windows overlap,
  i.e. someone used *Allow override* → `{ tableId, date, first, second, overridden }`. Scanned across
  **all** dates, not just the console date, because a future overbooking still has to be fixed.

All three open with resolution buttons (`+15 min`, `Mark left`, `Cancel <name>`); resolving changes
state and the banner disappears on the next render. This is the client-side stand-in for `ConflictService.detectOverstay()` running on a
scheduler and pushing over SSE.

---

## 4. Store shape (`gooddays.booking.v1`)

```json
{
  "reservations": [{
    "id": "r_…", "tableId": "T3", "date": "2026-10-24", "start": "11:40",
    "party": 2, "turnMinutes": 75, "status": "seated",
    "overridden": false,
    "guest": { "name": "Ines Duarte", "phone": "+1 555 010 2233" },
    "live": { "seatedAt": "…", "leftAt": null },
    "createdAt": "…"
  }],
  "floor": {
    "T1": { "state": "available", "reservationId": null, "since": "…" },
    "T5": { "state": "dirty",     "reservationId": null, "since": "…" },
    "T6": { "state": "blocked",   "reservationId": null, "since": "…", "reason": "maintenance" }
  },
  "audit": [{ "at": "…", "action": "extend turn", "tableId": "T3", "note": "+15 min → 90 min" }]
}
```

Statuses: `confirmed · seated · completed · no_show · cancelled`.
Floor states: `available · seated · dirty · blocked`.

`turnMinutes` is **frozen onto the reservation** at booking time, so changing the turn rules later
cannot retroactively move an existing cover's end time.

---

## 5. Demo seed

On first load (or **Reset demo**) the console seeds a day that demonstrates every state. It is
time-of-day aware, so the live states only appear while the venue is open:

| Table | Live | Why |
|---|---|---|
| T2 | seated | Ayo Bankole, party 2, inside a normal 75 min turn |
| T3 | seated | Ines Duarte, party 2, **25 min over** a 75 min turn |
| T3 | — | Ruth Alvarez, party 4 at +20 min → the at-risk banner |
| T5 | dirty | Needs resetting before the next cover |
| T6 | blocked | Maintenance |
| T1, T4 | available | Free, each with a later booking |

Outside opening hours only the forward bookings are seeded (all tables free, T6 blocked), because
there is nothing to be seated at 2 AM.

---

## 6. Files

| File | Role |
|---|---|
| `admin.html` | Page shell: admin bar, alerts region, floor grid, staff form, schedule, activity |
| `css/admin.css` | Espresso/amber console theme, reusing the site's tokens and 4px radius |
| `js/booking-core.js` | **All** domain logic + store (shared with the guest page) |
| `js/admin.js` | Console rendering + event delegation → core |
| `js/reservation.js` | Guest rendering + validation → core |

Headless checks used during development: `node --check` on every JS file, `--dump-dom` runs that
assert booking → conflict → override → slot validation, and click-driven runs that assert
`markLeft` clears the alert, `seatWalkIn` flips the card, and the staff form books + logs.
