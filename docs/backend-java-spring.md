# Backend plan — Spring Boot port

**Status:** the booking section in `index.html` is a **reference prototype**. The intent is to
reprogram the reservation core as a **Java + Spring Boot** service and keep this page as the
front end. Everything below is written so the prototype can be lifted into that service without
re-thinking the domain.

The prototype deliberately keeps all booking logic in `js/reservation.js`
(`statusFor`, `conflictFor`, `turnMinutesFor`, `slotsFor`) so those functions become the
specification for the Java service.

---

## 1. Target stack

| Concern | Choice |
|---|---|
| Language / runtime | Java 21 (records, sealed types where useful) |
| Framework | Spring Boot 3.x (Web, Validation, Data JPA, Security) |
| Database | PostgreSQL 16 |
| Migrations | Flyway |
| Live updates to the floor UI | Server-Sent Events (one-way is enough) |
| Tests | JUnit 5 + Testcontainers (real Postgres), property tests for interval logic |
| Front end | this static page (`index.html` + `css/` + `js/`), fetch/SSE against the API |

No client-side availability decisions are trusted once the backend exists. The browser may
render optimistic state, but the server is authoritative.

---

## 2. Domain model (JPA entities)

```
Venue            id, name, timezone (String, IANA), openTime, closeTime,
                 slotMinutes, fallbackTurnMinutes, turnoverMinutes,
                 lastSeatingBefore, minLeadMinutes, maxAdvanceDays

OpeningHours     id, venue_id, dayOfWeek, opensAt, closesAt      (nullable = closed)

TurnRule         id, venue_id, minParty, maxParty, turnMinutes

DiningTable      id, venue_id, code ("T1"), seats, area, active

Reservation      id (UUID), table_id, venue_id,
                 startsAt (Instant), endsAt (Instant),      -- endsAt = start + turn + turnover
                 partySize, turnMinutes,
                 status (CONFIRMED | SEATED | COMPLETED | CANCELLED | NO_SHOW),
                 overridden (boolean), overrideReason,
                 guestName, guestPhone, guestEmail,
                 idempotencyKey (unique), createdAt, updatedAt

SlotHold         id, table_id, startsAt, endsAt, partySize,
                 expiresAt, sessionId

TableLiveState   table_id (PK), state (AVAILABLE | HELD | SEATED | DIRTY | BLOCKED),
                 reservationId (nullable), since

TableBlock       id, table_id, startsAt, endsAt, reason

AuditLog         id, actor, action, table_id, reservation_id, payload (jsonb), at
```

`startsAt`/`endsAt` are **`Instant` (UTC)**. The venue's `ZoneId` converts to local wall-clock
only at the edges (slot generation, rendering). Never store `"18:30"` as the source of truth.

---

## 3. API (v1) — mirrors the prototype's shapes

```http
GET    /api/venue                              -> hours, turn rules, pacing, constants

GET    /api/availability?date=2026-04-12&party=2
       -> { date, slots: ["08:00", ...],
            tables: [ { id:"T1", status:"available"|"reserved"|"too-small"|"blocked"|"past",
                        conflict: { start, end, partySize } | null } ] }

POST   /api/holds                              -> 201 { holdId, expiresAt }   (TTL ~2 min)
       { tableId, date, start, partySize }
       -> 409 { code:"TABLE_TAKEN" | "PACING_BLOCKED" | "TOO_SMALL" }

POST   /api/reservations                       -> 201 Reservation
       Idempotency-Key: <uuid>
       { holdId, name, phone, email }

DELETE /api/reservations/{id}                  -> 204   (guest or staff cancel)

PATCH  /api/reservations/{id}/status           -> { status: SEATED | COMPLETED | NO_SHOW | CANCELLED }

POST   /api/reservations/{id}/extend           -> flags later conflicts
       { minutes: 20 }

GET    /api/floor?date=2026-04-12              -> live states + upcoming turns + conflicts

PATCH  /api/floor/tables/{code}                -> staff override, always audited
       { state: "AVAILABLE" | "DIRTY" | "SEATED" | "BLOCKED", reason? }

GET    /api/conflicts                          -> [{ reservationId, reason, severity }]

GET    /api/stream/floor                       -> text/event-stream
```

`GET /api/availability` is the only thing the public page needs to render the floor plan.

---

## 4. Service layer — direct mapping from the prototype

The prototype keeps **all** domain rules in one module, `js/booking-core.js`. Both the guest page
(`js/reservation.js`) and the staff console (`js/admin.js`) are thin renderers on top of it, so the
table below maps 1:1 to the service layer.

| Prototype (`js/booking-core.js`) | Spring service |
|---|---|
| `VENUE`, `TURN_RULES`, `TABLES` | `VenueService.venue()` → `/api/venue` |
| `slotsFor(date)` | `SlotService.slotsFor(venue, date)` (ZoneId + opening hours) |
| `slotProblem(date, start, turn)` | opening hours / lead time / last seating / grid checks |
| `conflictFor(tableId, date, start, party)` | `AvailabilityService.findConflict(...)` |
| `tableState(table, date, start, party)` | `AvailabilityService.statusFor(...)` |
| `book({...})` (with `override`) | `BookingService.confirm(holdId, guest, override)` |
| `seat / seatWalkIn / markLeft / markClean` | `FloorService.markSeated / markLeft / markAvailable` |
| `block / unblock` | `FloorService.markBlocked / markAvailable` |
| `extend(id, minutes)` | `POST /api/reservations/{id}/extend` |
| `noShow(id)` / `cancel(id)` | `PATCH /api/reservations/{id}/status` |
| `alerts()` (overstay + at-risk next cover) | `ConflictService.detectOverstay()` (scheduled every minute) |
| `floorState(id)` | `GET /api/floor` (live layer only) |
| `auditLog()` | `AuditLog` rows, actor from the security context |
| `localStorage` persistence | Postgres + transactions |
| `storage` event (cross-tab) | `GET /api/stream/floor` (SSE) |

### Overlap predicate (must match the prototype exactly)

```java
boolean overlaps(Instant aStart, Instant aEnd, Instant bStart, Instant bEnd) {
    return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);   // half-open
}
```

---

## 5. Concurrency — the part the prototype cannot do

Two guests can pass the client-side check at the same time. The server must make confirmation
atomic. Pick **one** of these (exclusion constraint is the strongest):

**A. Postgres exclusion constraint**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservation
  ADD CONSTRAINT no_overlap_per_table
  EXCLUDE USING gist (
    table_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('CONFIRMED', 'SEATED'));
```

**B. Row lock**

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
Optional<DiningTable> findWithLockByCode(String code);
```

**C. Serializable transaction**

```java
@Transactional(isolation = Isolation.SERIALIZABLE)
public Reservation confirm(...) { ... }
```

Then:

```java
@Transactional
public Reservation confirm(UUID holdId, Guest guest) {
    SlotHold hold = holds.requireActive(holdId);          // 409 if expired
    if (availability.hasConflict(hold)) throw new ConflictException("TABLE_TAKEN");
    Reservation saved = reservations.save(hold.toReservation(guest));
    holds.delete(hold);
    events.publish(new ReservationConfirmed(saved));
    return saved;
}
```

`Idempotency-Key` is stored on `reservation` so a retried POST returns the same reservation
instead of creating a second one.

---

## 6. Pacing

`PacingService` counts confirmed covers and parties per 30-minute interval:

```java
record Pacing(int onlineCoversPer30, int onlinePartiesPer30, int totalCoversPer30) {}
```

- Online bookings stop when the **online** cap is reached; walk-ins/host bookings may still use
  the remaining headroom up to `totalCoversPer30`.
- Counts are per interval, not per table, so one busy wave cannot starve the next.
- Cancellation decrements immediately.

---

## 7. Live floor + overstay (the layer that answers "staff free the table")

- `PATCH /api/floor/tables/T3 {state:"AVAILABLE"}` **never** mutates reservations.
- `FloorService` only writes `table_live_state` and emits `TableStatusChanged`.
- `ConflictService` runs every minute:
  - for every `SEATED` table past `endsAt` → emit `OVERSTAY` with minutes over,
  - for every later `CONFIRMED` reservation on that table → emit `CONFLICT` (severity high inside
    the turnover buffer),
  - the host resolves via `extend`, `move`, or `seat elsewhere`; every choice is audited.
- `NoShowPolicy`: after the grace period, staff mark `NO_SHOW`; only then is the table released
  in the live layer. The reservation is not deleted — it stays for reporting.

This is the exact split validated by the research: manual status is the **live** layer, never the
**booking** layer.

---

## 8. Validation (Bean Validation + service checks)

```java
@FutureOrPresent          Instant startsAt
@Min(1) @Max(6)           int partySize
@Pattern(regexp="^[+0-9 ()-]{7,20}$") String guestPhone
```

Service checks (return `409`/`422` with a typed code):

- slot inside `OpeningHours` for that weekday
- `start >= now + minLeadMinutes` (same day)
- `start + turnMinutes <= close` (and `start <= close - lastSeatingBefore`)
- `start` on the slot grid
- `partySize <= table.seats`
- no confirmed/seated overlap, no active hold, no block
- pacing caps not exceeded

---

## 9. Time / DST

- `Venue.timezone` is an IANA id (`America/Los_Angeles` in the prototype). **The prototype already
  runs on the venue clock**: `VENUE.timezone` + `Intl.DateTimeFormat` produce the venue's wall clock
  for "now", "today", opening hours and slots, so a visitor in UTC+2 sees Portland's day, not their
  own. `venueInstant()` converts venue wall time back to an `Instant` with a two-pass offset lookup,
  which is the same correction Spring needs.
- Slot generation:
  ```java
  LocalDate date = ...;
  ZonedDateTime open  = date.atTime(openTime).atZone(venue.zone());
  ZonedDateTime close = date.atTime(closeTime).atZone(venue.zone());
  ```
- Walk `ZonedDateTime` with `plusMinutes(30)` so DST gaps/overlaps are handled by the JDK.
- Store `Instant`; convert for display in the browser using the same zone from `/api/venue`.
- Tests: spring-forward and fall-back days, plus a booking that would cross midnight (rejected).

---

## 10. Security & audit

- `STAFF` and `MANAGER` roles; public endpoints are read-only (`/api/venue`,
  `/api/availability`) plus hold/confirm.
- Every `PATCH /api/floor/tables/*` and `POST /api/reservations/*/extend` writes an `AuditLog`
  row with actor, before/after, and reason.
- `overridden = true` is set whenever a staff member books into an unavailable slot, so reporting
  can show how often the system is being bypassed.

---

## 11. Migration path from the prototype

1. Move `VENUE`, `TURN_RULES` and the six tables into `venue` / `turn_rule` / `dining_table`
   (seed via Flyway).
2. Implement `GET /api/venue` and `GET /api/availability`; keep the prototype's JSON shape so
   `js/booking-core.js` only swaps its `slotsFor` / `tableState` internals for `fetch` — the two
   UIs (`reservation.js`, `admin.js`) stay untouched.
3. Add holds + transactional confirm; `core.book()` becomes `POST /api/holds` then
   `POST /api/reservations`.
4. Swap the `floor` object for `GET /api/floor` + `PATCH /api/floor/tables/{code}`; replace the
   `storage` event with SSE (`GET /api/stream/floor`).
5. Move `alerts()` into `ConflictService` (scheduled) and push alerts over the same SSE channel.
6. Add pacing counters, then POS integration (Paid → DIRTY → AVAILABLE), guest notifications,
   waitlist.

**Do not** port the current `setStatus` strings into the backend — return typed error codes and let
the UI own the copy.

---

## 12. What the prototype already proves

- Derived availability per `(table, date, time, party)` — not a stored "reserved" flag.
- Party-size turn times (75 / 90 / 105).
- Half-open overlap with turnover buffer.
- Re-checking the chosen table when the guest changes date/time and blocking confirm.
- Slot grid, lead time, last seating.
- The two-layer split in a working console: live floor states (`seated / dirty / blocked`) never
  mutate forward bookings — cleaning T3 does **not** free its 1:40 PM cover.
- Overstay + at-risk-next-cover detection with resolution actions (`extend`, `mark left`), each
  written to an audit trail.
- Staff override bookings that are flagged `overridden` for later reporting.
- One shared rule engine (`js/booking-core.js`) driving two different front-ends — the same shape
  the Spring services will expose.
- **Venue-local time** end to end: `isoDate`, `nowMinutes`, `slotsFor`, `slotProblem`, seating and the
  seed all read the Portland clock, so opening hours mean the venue's hours from any machine.
  DST transitions are handled by `Intl`; `addDays()` steps at noon so a 23/25-hour day cannot shift
  the date.

Not in the prototype and owned by the server: holds with TTL, atomic confirm against double
booking, pacing caps, SSE fan-out, auth/roles, DST-safe `Instant` storage. They are specified in
`docs/reservation-rules.md` and `docs/backend-java-spring.md`.
