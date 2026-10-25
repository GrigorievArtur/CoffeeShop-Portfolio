/* =========================================
   BOOKING CORE — single source of truth
   Used by index.html (guest) and admin.html (staff).
   Persists to localStorage so both pages share state.
   Reference implementation for docs/backend-java-spring.md
   Exposes: window.GoodDays.core
   ========================================= */

window.GoodDays = window.GoodDays || {};

window.GoodDays.core = (function () {
    'use strict';

    const STORAGE_KEY = 'gooddays.booking.v1';

    const VENUE = {
        name: 'Good Days Coffee',
        timezone: 'America/Los_Angeles',   // venue wall clock — never the visitor's
        open: '08:00',
        close: '20:00',
        slotMinutes: 30,
        fallbackTurnMinutes: 90,
        turnoverMinutes: 15,
        lastSeatingBefore: 45,
        minLeadMinutes: 30,
        maxAdvanceDays: 60,
    };

    /* Turn time by party size — frozen onto each booking. */
    const TURN_RULES = [
        { min: 1, max: 2, minutes: 75 },
        { min: 3, max: 4, minutes: 90 },
        { min: 5, max: 6, minutes: 105 },
        { min: 7, max: Infinity, minutes: 120 },
    ];

    const TABLES = [
        { id: 'T1', seats: 4, area: 'window' },
        { id: 'T2', seats: 4, area: 'window' },
        { id: 'T3', seats: 4, area: 'centre' },
        { id: 'T4', seats: 4, area: 'centre' },
        { id: 'T5', seats: 4, area: 'back' },
        { id: 'T6', seats: 4, area: 'back' },
    ];

    /* ---------------- helpers ---------------- */
    const pad = (n) => String(n).padStart(2, '0');

    /* --- venue clock ---------------------------------------------------
       Opening hours, "now", slots and "today" all follow the venue's zone,
       not the visitor's. Intl is the only part of a browser that knows the
       offsets (DST included), so we format an instant in that zone and read
       the parts back. Spring equivalent: ZonedDateTime.now(venue.zone()). */
    let zoneFormatter = null;

    function venueParts(date) {
        if (!zoneFormatter) {
            zoneFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: VENUE.timezone,
                hour12: false,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
        }

        const parts = {};
        zoneFormatter.formatToParts(date).forEach((part) => {
            if (part.type !== 'literal') parts[part.type] = part.value;
        });

        return {
            year: Number(parts.year),
            month: Number(parts.month),
            day: Number(parts.day),
            hour: Number(parts.hour) % 24,
            minute: Number(parts.minute),
            second: Number(parts.second),
        };
    }

    /* Minutes the venue zone is ahead of UTC at that instant (PDT → -420). */
    function zoneOffsetMinutes(date) {
        const p = venueParts(date);
        const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
        return (asUtc - date.getTime()) / 60000;
    }

    /* Venue wall clock (year, month, day, "HH:MM") → absolute instant.
       Two passes so a DST edge resolves to the offset that actually applies. */
    function venueInstant(year, month, day, hhmm) {
        const [hh, mm] = String(hhmm).split(':').map(Number);
        const guess = Date.UTC(year, month - 1, day, hh, mm, 0);
        let stamp = guess - zoneOffsetMinutes(new Date(guess)) * 60000;
        stamp = guess - zoneOffsetMinutes(new Date(stamp)) * 60000;
        return new Date(stamp);
    }

    function isoDate(date) {
        const p = venueParts(date);
        return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
    }

    function addDays(date, days) {
        const p = venueParts(date);
        // noon dodges the DST edges where midnight can vanish or repeat
        return venueInstant(p.year, p.month, p.day + days, '12:00');
    }

    function toMinutes(hhmm) {
        const [h, m] = String(hhmm).split(':').map(Number);
        return h * 60 + m;
    }

    function fromMinutes(minutes) {
        const m = Math.round(minutes);
        return `${pad(Math.floor(m / 60) % 24)}:${pad(((m % 60) + 60) % 60)}`;
    }

    function label12(minutes) {
        const m = Math.round(minutes);
        const h = Math.floor(m / 60) % 24;
        const suffix = h < 12 ? 'AM' : 'PM';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${h12}:${pad(m % 60)} ${suffix}`;
    }

    function prettyDate(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        return venueInstant(y, m, d, '12:00').toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone: VENUE.timezone,
        });
    }

    function dateTime(iso, hhmm) {
        const [y, m, d] = iso.split('-').map(Number);
        return venueInstant(y, m, d, hhmm);
    }

    function nowMinutes(date) {
        const p = venueParts(date || new Date());
        return p.hour * 60 + p.minute;
    }

    /* "Wed 1:20 PM" in the venue zone, for the console header. */
    function venueClock(date) {
        const at = date || new Date();
        const weekday = at.toLocaleDateString('en-US', {
            timeZone: VENUE.timezone,
            weekday: 'short',
        });
        return `${weekday} ${label12(nowMinutes(at))}`;
    }

    function upMinutes(minutes) {
        return Math.round(minutes * 10) / 10;
    }

    function turnMinutesFor(party) {
        const rule = TURN_RULES.find((r) => party >= r.min && party <= r.max);
        return rule ? rule.minutes : VENUE.fallbackTurnMinutes;
    }

    /* A booking occupies its turn time + turnover after it. */
    function occupancyEndMin(reservation) {
        return toMinutes(reservation.start) +
            (reservation.turnMinutes || VENUE.fallbackTurnMinutes) +
            VENUE.turnoverMinutes;
    }

    /* ---------------- store ---------------- */
    let store = null;
    const listeners = [];

    function blankFloor() {
        const floor = {};
        TABLES.forEach((t) => {
            floor[t.id] = { state: 'available', reservationId: null, since: new Date().toISOString() };
        });
        return floor;
    }

    function blankStore() {
        return { reservations: [], floor: blankFloor(), audit: [] };
    }

    function normalize(parsed) {
        const base = blankStore();
        return {
            reservations: Array.isArray(parsed.reservations) ? parsed.reservations : [],
            floor: { ...base.floor, ...(parsed.floor || {}) },
            audit: Array.isArray(parsed.audit) ? parsed.audit : [],
        };
    }

    function parse(raw) {
        try {
            return normalize(JSON.parse(raw));
        } catch (e) {
            return blankStore();
        }
    }

    function load() {
        if (store) return store;
        let raw = null;
        try {
            raw = localStorage.getItem(STORAGE_KEY);
        } catch (e) { /* private mode */ }

        if (raw) {
            store = parse(raw);
        } else {
            store = blankStore();
            seed(store);
            persist();
        }
        return store;
    }

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch (e) { /* storage full / blocked */ }
        listeners.forEach((fn) => fn());
    }

    function subscribe(fn) {
        load();
        listeners.push(fn);
        return () => {
            const i = listeners.indexOf(fn);
            if (i >= 0) listeners.splice(i, 1);
        };
    }

    function reload() {
        let raw = null;
        try {
            raw = localStorage.getItem(STORAGE_KEY);
        } catch (e) { /* ignore */ }
        store = raw ? parse(raw) : blankStore();
        listeners.forEach((fn) => fn());
    }

    function error(code, message) {
        const e = new Error(message || code);
        e.code = code;
        return e;
    }

    /* ---------------- availability ---------------- */
    function slotsFor(dateIso) {
        const close = toMinutes(VENUE.close);
        const lastStart = Math.min(
            close - VENUE.lastSeatingBefore,
            close - VENUE.fallbackTurnMinutes
        );

        const now = new Date();
        const isToday = dateIso === isoDate(now);
        const earliest = nowMinutes(now) + VENUE.minLeadMinutes;

        const slots = [];
        for (let m = toMinutes(VENUE.open); m <= lastStart; m += VENUE.slotMinutes) {
            if (isToday && m < earliest) continue;
            slots.push(m);
        }
        return slots;
    }

    /* Why a requested slot may not be sold (null = fine). */
    function slotProblem(dateIso, startMin, turnMinutes) {
        const now = new Date();
        const openMin = toMinutes(VENUE.open);
        const closeMin = toMinutes(VENUE.close);
        const lastStart = Math.min(closeMin - VENUE.lastSeatingBefore, closeMin - turnMinutes);

        if (!Number.isFinite(startMin)) return 'bad-time';
        if (dateIso < isoDate(now)) return 'past';
        if (dateIso > isoDate(addDays(now, VENUE.maxAdvanceDays))) return 'too-far';
        if (startMin < openMin || startMin > lastStart) return 'outside-hours';
        if ((startMin - openMin) % VENUE.slotMinutes !== 0) return 'off-grid';

        if (dateIso === isoDate(now)) {
            const earliest = nowMinutes(now) + VENUE.minLeadMinutes;
            if (startMin < earliest) return 'too-soon';
        }

        return null;
    }

    /* First day that can actually take a booking (today, or tomorrow if closed). */
    function defaultDate() {
        const today = isoDate(new Date());
        return slotsFor(today).length ? today : isoDate(addDays(new Date(), 1));
    }

    function conflictFor(tableId, date, startMin, party) {
        const data = load();
        const wantEnd = startMin + turnMinutesFor(party);

        for (const r of data.reservations) {
            if (r.tableId !== tableId || r.date !== date) continue;
            if (r.status === 'cancelled' || r.status === 'no-show') continue;

            const busyStart = toMinutes(r.start);
            // Half-open: back-to-back bookings are allowed.
            if (busyStart < wantEnd && startMin < occupancyEndMin(r)) return r;
        }
        return null;
    }

    function tableState(table, date, startMin, party) {
        const data = load();
        const floor = data.floor[table.id];

        if (party > table.seats) return { status: 'too-small', conflict: null };
        if (floor && floor.state === 'blocked' && date === isoDate(new Date())) {
            return { status: 'blocked', conflict: null };
        }

        const conflict = conflictFor(table.id, date, startMin, party);
        return conflict
            ? { status: 'reserved', conflict }
            : { status: 'available', conflict: null };
    }

    /* Best free table for a party: smallest that fits, then by table order. */
    function pickTable(date, startMin, party) {
        const free = TABLES
            .filter((t) => tableState(t, date, startMin, party).status === 'available')
            .sort((a, b) => (a.seats - b.seats) || a.id.localeCompare(b.id));
        return free.length ? free[0].id : null;
    }

    /* ---------------- reservations ---------------- */
    function find(id) {
        return load().reservations.find((r) => r.id === id) || null;
    }

    function makeReservation(input) {
        const party = Number(input.party) || 2;
        return {
            id: `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            tableId: input.tableId,
            date: input.date,
            start: input.start,
            turnMinutes: turnMinutesFor(party),
            party,
            status: input.status || 'confirmed',
            overridden: !!input.overridden,
            autoAssigned: !!input.autoAssigned,
            guest: { name: input.name || 'Walk-in', phone: input.phone || '' },
            live: { seatedAt: input.seatedAt || null, leftAt: null },
            createdAt: new Date().toISOString(),
        };
    }

    function log(action, reservation, note) {
        load().audit.unshift({
            at: new Date().toISOString(),
            action,
            tableId: reservation ? reservation.tableId : null,
            reservationId: reservation ? reservation.id : null,
            note: note || '',
        });
        store.audit = store.audit.slice(0, 60);
    }

    /* Book a slot. `override` lets staff bypass a taken table (audited);
       `tableId: 'any'` lets the house pick the best free table. */
    function book(input) {
        const data = load();
        const party = Number(input.party) || 2;
        const startMin = toMinutes(input.start);
        const problem = slotProblem(input.date, startMin, turnMinutesFor(party));
        if (problem) throw error('BAD_SLOT', `Cannot book ${input.start || 'that time'} (${problem})`);

        const autoAssigned = !input.tableId || input.tableId === 'any';
        const tableId = autoAssigned ? pickTable(input.date, startMin, party) : input.tableId;

        if (autoAssigned && !tableId) {
            throw error('NO_TABLE', `No table left for ${party} at ${input.start}`);
        }

        const table = TABLES.find((t) => t.id === tableId);
        if (!table) throw error('UNKNOWN_TABLE', 'Unknown table');

        const result = tableState(table, input.date, startMin, party);

        const overridable = result.status === 'reserved';
        if (result.status !== 'available' && !(input.override && overridable)) {
            throw error(
                result.status === 'reserved' ? 'TABLE_TAKEN' : 'NOT_AVAILABLE',
                result.status === 'reserved'
                    ? `${table.id} is already booked at ${input.start}`
                    : `${table.id} is not available (${result.status})`
            );
        }

        const reservation = makeReservation({
            ...input,
            tableId: table.id,
            party,
            autoAssigned,
            overridden: result.status !== 'available',
        });

        data.reservations.push(reservation);
        log(
            input.override ? 'book (override)' : 'book',
            reservation,
            `${reservation.guest.name} · party ${party}` + (autoAssigned ? ' · auto-assigned' : '')
        );
        persist();
        return reservation;
    }

    function seat(reservationId) {
        const r = find(reservationId);
        if (!r) throw error('NOT_FOUND', 'Reservation not found');
        if (r.status !== 'confirmed') throw error('BAD_STATE', 'Only confirmed bookings can be seated');

        r.status = 'seated';
        r.live.seatedAt = new Date().toISOString();
        store.floor[r.tableId] = {
            state: 'seated',
            reservationId: r.id,
            since: r.live.seatedAt,
        };
        log('seat', r, `${r.guest.name} · party ${r.party}`);
        persist();
        return r;
    }

    function seatWalkIn(tableId, party, name) {
        const data = load();
        const table = TABLES.find((t) => t.id === tableId);
        if (!table) throw error('UNKNOWN_TABLE', 'Unknown table');

        const floor = data.floor[tableId];
        if (floor && floor.state !== 'available') {
            throw error('NOT_AVAILABLE', `${tableId} is ${floor.state}`);
        }
        if (party > table.seats) throw error('TOO_SMALL', `${tableId} seats ${table.seats}`);

        const now = new Date();
        const nowMin = nowMinutes();
        if (nowMin < toMinutes(VENUE.open) || nowMin >= toMinutes(VENUE.close)) {
            throw error('CLOSED', 'Outside opening hours — no new covers right now');
        }

        const reservation = makeReservation({
            tableId,
            date: isoDate(now),
            start: fromMinutes(nowMin),
            party,
            name: name || 'Walk-in',
            status: 'seated',
            seatedAt: now.toISOString(),
        });

        data.reservations.push(reservation);
        store.floor[tableId] = { state: 'seated', reservationId: reservation.id, since: reservation.live.seatedAt };
        log('seat walk-in', reservation, `${reservation.guest.name} · party ${party}`);
        persist();
        return reservation;
    }

    function markLeft(reservationId) {
        const r = find(reservationId);
        if (!r) throw error('NOT_FOUND', 'Reservation not found');

        r.status = 'completed';
        r.live.leftAt = new Date().toISOString();
        store.floor[r.tableId] = {
            state: 'dirty',
            reservationId: null,
            since: r.live.leftAt,
        };
        log('left table', r, `${r.guest.name} · table needs reset`);
        persist();
        return r;
    }

    function markClean(tableId) {
        const data = load();
        if (!data.floor[tableId]) return;
        data.floor[tableId] = { state: 'available', reservationId: null, since: new Date().toISOString() };
        log('table clean', null, tableId);
        persist();
    }

    function block(tableId, reason) {
        const data = load();
        data.floor[tableId] = {
            state: 'blocked',
            reservationId: null,
            since: new Date().toISOString(),
            reason: reason || 'blocked',
        };
        log('block table', null, `${tableId}${reason ? ` · ${reason}` : ''}`);
        persist();
    }

    function unblock(tableId) {
        markClean(tableId);
    }

    function extend(reservationId, minutes) {
        const r = find(reservationId);
        if (!r) throw error('NOT_FOUND', 'Reservation not found');
        r.turnMinutes += minutes;
        log('extend turn', r, `+${minutes} min → ${r.turnMinutes} min`);
        persist();
        return r;
    }

    function noShow(reservationId) {
        const r = find(reservationId);
        if (!r) throw error('NOT_FOUND', 'Reservation not found');

        r.status = 'no-show';
        const floor = store.floor[r.tableId];
        if (floor && floor.reservationId === r.id) {
            store.floor[r.tableId] = { state: 'available', reservationId: null, since: new Date().toISOString() };
        }
        log('no-show', r, r.guest.name);
        persist();
        return r;
    }

    function cancel(reservationId) {
        const r = find(reservationId);
        if (!r) throw error('NOT_FOUND', 'Reservation not found');
        r.status = 'cancelled';

        // Cancelling the party that is sitting there hands the table back
        const live = store.floor[r.tableId];
        if (live && live.reservationId === r.id) {
            store.floor[r.tableId] = {
                state: 'available',
                reservationId: null,
                since: new Date().toISOString(),
            };
        }

        log('cancel', r, r.guest.name);
        persist();
        return r;
    }

    /* ---------------- read models ---------------- */
    function floorState(tableId) {
        return load().floor[tableId] || { state: 'available' };
    }

    function seatedReservation(tableId) {
        const floor = floorState(tableId);
        if (floor.state !== 'seated' || !floor.reservationId) return null;
        return find(floor.reservationId);
    }

    function reservationsFor(date) {
        return load().reservations
            .filter((r) => r.date === date && r.status !== 'cancelled')
            .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    }

    function nextFor(tableId, from) {
        const start = from || new Date();
        const today = isoDate(start);
        return load().reservations
            .filter((r) => r.tableId === tableId && r.date === today && r.status === 'confirmed')
            .filter((r) => dateTime(r.date, r.start) >= start)
            .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0] || null;
    }

    function turnEnd(reservation) {
        const start = dateTime(reservation.date, reservation.start);
        return new Date(start.getTime() + (reservation.turnMinutes || VENUE.fallbackTurnMinutes) * 60000);
    }

    /* Live floor health: overstays + the bookings they collide with. */
    function alerts() {
        const now = new Date();
        const out = [];

        TABLES.forEach((table) => {
            const seated = seatedReservation(table.id);
            if (!seated) return;

            const end = turnEnd(seated);
            if (now <= end) return;

            out.push({
                type: 'overstay',
                tableId: table.id,
                reservation: seated,
                minutesOver: Math.round((now - end) / 60000),
            });

            const next = nextFor(table.id, now);
            if (!next) return;

            // Next cover arrives inside the next 30 minutes while the table is still held
            const arrivesIn = Math.round((dateTime(next.date, next.start) - now) / 60000);
            if (arrivesIn <= 30) {
                out.push({
                    type: 'conflict',
                    tableId: table.id,
                    reservation: seated,
                    next,
                    arrivesIn,
                });
            }
        });

        // Overbooked tables: two live bookings whose windows overlap.
        // `book(..., override)` is the only way this can happen, so it must be visible.
        const byTable = {};
        load().reservations.forEach((r) => {
            if (r.status !== 'confirmed' && r.status !== 'seated') return;
            const key = `${r.date}|${r.tableId}`;
            (byTable[key] = byTable[key] || []).push(r);
        });

        Object.keys(byTable).forEach((key) => {
            const list = byTable[key].slice().sort((a, b) =>
                toMinutes(a.start) - toMinutes(b.start) ||
                String(a.createdAt).localeCompare(String(b.createdAt))
            );

            list.forEach((later, index) => {
                const earlier = list.slice(0, index).find((r) => toMinutes(later.start) < occupancyEndMin(r));
                if (!earlier) return;

                out.push({
                    type: 'double',
                    tableId: later.tableId,
                    date: later.date,
                    first: earlier,
                    second: later,
                    overridden: Boolean(later.overridden || earlier.overridden),
                });
            });
        });

        return out;
    }

    function reset() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) { /* ignore */ }
        store = blankStore();
        seed(store);
        persist();
    }

    /* ---------------- demo seed (first run only) ---------------- */
    function addSeed(data, input) {
        const reservation = makeReservation(input);
        data.reservations.push(reservation);
        return reservation;
    }

    function seed(data) {
        const now = new Date();
        const nowMin = nowMinutes(now);
        const openMin = toMinutes(VENUE.open);
        const closeMin = toMinutes(VENUE.close);
        const today = isoDate(now);

        const bookable = slotsFor(today);
        const base = bookable.length ? today : isoDate(addDays(now, 1));
        const baseSlots = slotsFor(base);
        const at = (i) => fromMinutes(baseSlots[Math.min(i, baseSlots.length - 1)]);

        // Scheduled covers
        addSeed(data, { tableId: 'T1', date: base, start: at(4), party: 2, name: 'Mara Okafor', phone: '+1 555 010 2100' });
        addSeed(data, { tableId: 'T2', date: base, start: at(8), party: 4, name: 'Jonas Reed', phone: '+1 555 010 8842' });
        addSeed(data, { tableId: 'T4', date: base, start: at(11), party: 3, name: 'Priya Shah', phone: '+1 555 010 5511' });

        const inService = nowMin > openMin + 20 && nowMin < closeMin - 20;

        if (inService) {
            // Overstaying party: seated 100 min ago on a 75 min turn
            const seatStartMin = Math.max(openMin, nowMin - 100);
            const ines = addSeed(data, {
                tableId: 'T3',
                date: today,
                start: fromMinutes(seatStartMin),
                party: 2,
                name: 'Ines Duarte',
                phone: '+1 555 010 7733',
                status: 'seated',
                seatedAt: new Date(now.getTime() - (nowMin - seatStartMin) * 60000).toISOString(),
            });
            data.floor.T3 = { state: 'seated', reservationId: ines.id, since: ines.live.seatedAt };

            // A booking the overstay collides with
            if (nowMin + 20 <= closeMin - VENUE.lastSeatingBefore) {
                addSeed(data, {
                    tableId: 'T3',
                    date: today,
                    start: fromMinutes(nowMin + 20),
                    party: 4,
                    name: 'Ruth Alvarez',
                    phone: '+1 555 010 9021',
                });
            }

            // Party seated inside their turn
            const ayo = addSeed(data, {
                tableId: 'T2',
                date: today,
                start: fromMinutes(Math.max(openMin, nowMin - 25)),
                party: 2,
                name: 'Ayo Bankole',
                phone: '+1 555 010 3310',
                status: 'seated',
                seatedAt: new Date(now.getTime() - 25 * 60000).toISOString(),
            });
            data.floor.T2 = { state: 'seated', reservationId: ayo.id, since: ayo.live.seatedAt };

            data.floor.T5 = {
                state: 'dirty',
                reservationId: null,
                since: new Date(now.getTime() - 10 * 60000).toISOString(),
            };
            data.floor.T6 = {
                state: 'blocked',
                reservationId: null,
                since: new Date(now.getTime() - 120 * 60000).toISOString(),
                reason: 'maintenance',
            };
        } else {
            data.floor.T6 = {
                state: 'blocked',
                reservationId: null,
                since: now.toISOString(),
                reason: 'maintenance',
            };
        }

        data.audit.unshift({
            at: now.toISOString(),
            action: 'demo seeded',
            note: `${base} · ${data.reservations.length} bookings`,
        });
    }

    /* Cross-tab sync (admin page ↔ guest page) */
    window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY || !event.newValue) return;
        store = parse(event.newValue);
        listeners.forEach((fn) => fn());
    });

    return {
        VENUE,
        TURN_RULES,
        TABLES,
        // helpers used by both UIs
        isoDate,
        addDays,
        venueParts,
        venueInstant,
        venueClock,
        toMinutes,
        fromMinutes,
        label12,
        prettyDate,
        dateTime,
        nowMinutes,
        upMinutes,
        turnMinutesFor,
        // availability
        slotsFor,
        slotProblem,
        defaultDate,
        conflictFor,
        tableState,
        pickTable,
        // store
        subscribe,
        reload,
        reset,
        book,
        seat,
        seatWalkIn,
        markLeft,
        markClean,
        block,
        unblock,
        extend,
        noShow,
        cancel,
        find,
        floorState,
        seatedReservation,
        reservationsFor,
        nextFor,
        turnEnd,
        alerts,
        auditLog: () => load().audit.slice(0, 12),
    };
})();
