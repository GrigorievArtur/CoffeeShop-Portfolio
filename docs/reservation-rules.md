# Reservation rules — Good Days Coffee

Implementation target: **Spring Boot + PostgreSQL** (`docs/backend-java-spring.md`).
The current `js/booking-core.js` is the **reference prototype** — same rules, smaller surface, and
one engine behind both the guest page and the floor console (`docs/admin-console.md`).

---

## 1. Core principle

A table is never "reserved". **A (table, date, time, party) booking window is reserved.**

`data-status` in the HTML is presentation only. Status is *derived* every time the guest's
date / time / party changes:

```
status(table, date, start, party) →
    available | selected | reserved | blocked | held | too-small | past
```

Same table, same day, different answers:

| Table | 12:00 | 18:30 |
|---|---|---|
| T3 | reserved (seeded party) | available |

## 2. Two layers — this is the important part

```
┌──────────────────────────────────────────────────────────────┐
│ LAYER 1 — BOOKING AVAILABILITY (forward-looking)             │
│ Writer: online booking, host booking form, waitlist convert  │
│ Reads:  confirmed reservations, turn rules, pacing, blocks   │
│ Answers: "May I SELL this slot to this party size?"          │
│ Authoritative for every future date. Never edited by         │
│ flipping a table to "available" on the floor.                │
└───────────────────────────┬──────────────────────────────────┘
                            │ informs, never overwrites
┌───────────────────────────▼──────────────────────────────────┐
│ LAYER 2 — LIVE FLOOR STATE (now)                              │
│ Writer: host (Seat, Dirty, Available, Block), POS, hold TTL  │
│ Answers: "What is physically happening at the table now?"    │
│ Affects: walk-ins, waitlist, host prompts, short-horizon     │
│ availability. Does NOT delete future reservations.           │
└──────────────────────────────────────────────────────────────┘
```

Why the prototype uses slots: the moment a guest can book a future time online, "staff mark it
free when they leave" cannot answer *"is T3 free next Saturday at 19:00?"* — that answer must come
from forward commitments + turn times.

Why the staff still matter: turn times are estimates. Overstays are real, so the live layer exists
to raise the conflict and let a human resolve it (extend / move / seat elsewhere). That is what
OpenTable, Resy, Toast and Tock all do — none of them silently move the later booking.

## 3. Data model

```js
const venue = {
  timezone: 'America/New_York',
  open: '08:00',
  close: '20:00',
  slotMinutes: 30,
  turnoverMinutes: 15,       // reset between parties
  lastSeatingBefore: 45,     // minutes before close
  minLeadMinutes: 30,        // no same-day booking sooner than this
  maxAdvanceDays: 60,
  fallbackTurnMinutes: 90,
  pacing: { onlineCoversPer30: 6, onlinePartiesPer30: 2, totalCoversPer30: 12 },
  overstayGraceMinutes: 0,   // alert as soon as the turn is passed
};

// Turn time is attached to the booking, by party size.
const turnRules = [
  { minParty: 1, maxParty: 2, minutes: 75 },
  { minParty: 3, maxParty: 4, minutes: 90 },
  { minParty: 5, maxParty: 6, minutes: 105 },
  { minParty: 7, maxParty: Infinity, minutes: 120, manualApproval: true },
];

const reservation = {
  id, tableId, date, start, partySize,
  turnMinutes,                     // frozen at booking time
  status,                          // confirmed | seated | completed | cancelled | no-show
  overridden: false,               // staff booked into an unavailable slot
  guest: { name, phone, email },
  live: { seatedAt, leftAt, runningLate, overstayMinutes },
};

const hold = { id, tableId, date, start, partySize, expiresAt };   // ~2–5 min TTL
```

## 4. Derived states

| State | When | Shown as |
|---|---|---|
| `available` | party fits, inside hours, no conflict, pacing ok | amber outline |
| `selected` | the table the guest picked | filled amber |
| `reserved` | a `confirmed`/`seated` booking or a block overlaps | dark dashed |
| `held` | an active hold overlaps (someone is checking out) | dark dashed |
| `too-small` | `table.seats < party` | dimmed |
| `past` | slot already started or inside `minLeadMinutes` | not offered |

The legend stays three entries — Available / Selected / Reserved.

## 5. Turn time by party size

Two-tops graze, four-tops eat. One global 90 minutes is what causes the double-booking problem
in the first place.

| Party | Turn | + turnover | Table blocked |
|---|---|---|---|
| 1–2 | 75 min | 15 min | 90 min |
| 3–4 | 90 min | 15 min | 105 min |
| 5–6 | 105 min | 15 min | 120 min |
| 7+ | 120 min | 15 min | phone only |

`turnMinutes` is copied onto the reservation when it is created. Changing the rule later must not
rewrite existing bookings (OpenTable behaves the same way).

## 6. Overlap + offer rules

A booking occupies `[start, start + turnMinutes + turnoverMinutes]`.

```
busyStart < S + turnMinutes      &&
S         < busyStart + busyEnd
```

Half-open intervals, so 18:00 + 90 min + 15 min turnover frees the table at 19:45: 19:45 is legal,
19:30 is not.

A slot is offered only if:

```
S >= now + minLeadMinutes              (same day)
S on the slot grid
S + turnMinutes <= close
S <= close - lastSeatingBefore
partySize <= table.seats
no confirmed / seated / held / blocked overlap
pacing caps not exceeded
```

## 7. Booking rules

1. One table, one party per window. No double-booking.
2. Turn time is chosen from the party size at booking time and frozen.
3. Cancellations free the window immediately; no-shows free it after staff mark them.
4. Holds block the table for their TTL (2–5 min) and expire automatically.
5. Blocks (maintenance, private event) override everything, including holds.
6. Online pacing protects the room: stop online sales at the online cap, leave the difference for
   walk-ins up to the total cap.
7. Dates are venue-local calendar dates; timestamps are stored in UTC (Spring: `Instant` + `ZoneId`).

## 8. Live floor, overstay, manual overrides

- `Seat` → live state `seated`, links the reservation.
- `Left` → live state `dirty`, then `available` after reset. **Never** touches future bookings.
- Party stays 40 minutes past their turn and a 20:30 booking exists:
  - system raises `OVERSTAY` on the table and `CONFLICT` on the 20:30 booking,
  - the host resolves: extend the current turn, move the 20:30 booking, or seat the 20:30 party
    elsewhere,
  - the 20:30 reservation is never silently deleted.
- A staff member may book into an unavailable slot. That reservation is stored with
  `overridden: true`, the reason, and an audit entry — a visible signal that the model was bypassed.
- An override never deletes, moves or shortens the existing booking. Both covers stay `confirmed`,
  and the console raises a red **double-booked** alert (all dates, not just today) that names both
  guests and offers a cancel for each. The host resolves it; the system does not invent capacity.

### As built

`js/booking-core.js` implements this layer directly: `seat`, `seatWalkIn`, `markLeft`, `markClean`,
`block`, `unblock`, `extend`, `noShow`, `cancel`. `alerts()` re-derives `OVERSTAY` and
`CONFLICT-next` for every seated table on demand (the console also re-renders every 60 s), and each
action appends to an audit trail. Live states and bookings are stored separately, so no floor
button can rewrite a future cover.

## 9. Concurrency (backend)

Client-side availability is advisory. Confirmation must be transactional:

- `Idempotency-Key` on `POST /reservations`,
- `SELECT … FOR UPDATE` on the table row, or a Postgres exclusion constraint on
  `(table_id, tstzrange(starts_at, ends_at))`,
- `409 TABLE_TAKEN` → the UI re-renders the plan and tells the guest the table just went.

## 10. UI consequences (as built)

Column 3 order: **Full Name · Phone · Date · Time · Table · Guests**, always visible.

- Date / time / guests drive the plan; clicking a pane fills **Table**.
- **Any table** is the default option: the guest skips the plan, `pickTable()` chooses the smallest
  free table that fits, and the receipt names it ("Table T4 (we picked the best fit)"). If nothing is
  free the option is disabled and confirm is blocked with `NO_TABLE` — never a silent waitlist.
- Under the form: a short note that a reserved table is held only briefly and that, if it is still
  occupied on arrival, the guest may be seated at the next best table — with a call to the number on
  file if anything changes. The same policy applies to staff reseating an overstayed table.
- Changing date or time re-checks the chosen table. If it is now busy: the pane turns dashed,
  the select shows `T2 · booked 10:30`, an amber message explains it, and Confirm is disabled.
- Confirm re-validates, appends the reservation, resets the table, and the pane becomes reserved.
- On stacked layouts the plan comes first, then legend/contact, then the form; Confirm stays pinned
  while the fields scroll.

The staff console (`admin.html`) adds the other side: six live table cards, an alert strip, a staff
booking form with an audited override, the day's schedule, and the activity log. The guest page and
the console share `js/booking-core.js`, so a booking made at the counter shows up on the guest plan
immediately (and vice versa) via `localStorage` + a `storage` listener.

## 11. Edge cases

- **No-shows:** grace period, then staff mark `no-show`. Do not auto-release at start time.
- **Cancellation:** free the window at once; live state unchanged.
- **Combining tables (8+):** model `T1+T2` as a bookable resource, not an ad-hoc merge. Until then
  return `too-large` and route to the phone number.
- **Party > seats:** `too-small`; never split silently.
- **DST:** generate slots with `ZonedDateTime.plusMinutes(30)`, store `Instant`. Test both
  transitions. The prototype already reads the venue clock (`VENUE.timezone` + `Intl`) instead of the
  browser's, so "today", opening hours and lead time follow Portland, and `addDays()` steps at noon
  so a 23/25-hour day cannot move the date.
- **Crossing close:** reject if `start + turnMinutes > close` (so a 19:00 booking at a 20:00 close
  is refused for a 90-minute turn).

## 12. Still open

| Question | Default |
|---|---|
| Protect 4-tops at peak? | Not yet — all seats are 4 |
| Overbooking cap | 0 online, staff override only |
| Hold TTL | 2 min backend / 5 min demo |
| Waitlist | After the Spring port |
| POS integration (Paid → Dirty → Available) | Later phase |
