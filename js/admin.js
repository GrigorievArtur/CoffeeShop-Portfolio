/* =========================================
   ADMIN — staff floor console UI
   All booking rules live in js/booking-core.js
   ========================================= */

window.GoodDays = window.GoodDays || {};

window.GoodDays.admin = (function () {
    'use strict';

    const esc = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const BADGE = {
        available: ['Free', 'badge-available'],
        seated: ['Seated', 'badge-seated'],
        dirty: ['Dirty', 'badge-dirty'],
        blocked: ['Blocked', 'badge-blocked'],
    };

    function init() {
        const core = window.GoodDays.core;
        if (!core) return;

        const els = {
            alerts: document.getElementById('alerts'),
            floor: document.getElementById('floor'),
            schedule: document.getElementById('schedule'),
            audit: document.getElementById('audit'),
            scheduleMeta: document.getElementById('schedule-meta'),
            clock: document.getElementById('admin-clock'),
            date: document.getElementById('admin-date'),
            meta: document.getElementById('floor-meta'),
            form: document.getElementById('staff-form'),
            name: document.getElementById('staff-name'),
            phone: document.getElementById('staff-phone'),
            party: document.getElementById('staff-party'),
            time: document.getElementById('staff-time'),
            formDate: document.getElementById('staff-date'),
            table: document.getElementById('staff-table'),
            override: document.getElementById('staff-override'),
            submit: document.querySelector('.staff-submit'),
            msg: document.getElementById('staff-msg'),
            reset: document.getElementById('reset-demo'),
        };

        const today = core.isoDate(new Date());
        let date = core.defaultDate();
        els.date.min = today;
        els.formDate.min = today;
        els.date.value = date;
        els.formDate.value = date;

        fillTimes();
        fillStaffTables();
        render();
        core.subscribe(render);

        // Keep meters / overstay counters honest while the page sits open
        setInterval(render, 60000);

        /* ---------------- render ---------------- */

        function render() {
            if (els.clock) els.clock.textContent = core.venueClock();
            renderAlerts();
            renderFloor();
            renderSchedule();
            renderAudit();
        }

        function renderAlerts() {
            const alerts = core.alerts();
            els.alerts.innerHTML = alerts.map((a) => {
                if (a.type === 'double') {
                    const time = core.label12(core.toMinutes(a.second.start));
                    const when = a.date === date ? time : `${core.prettyDate(a.date)} · ${time}`;

                    return `<div class="alert is-danger">
                        <div>
                            <strong>${a.tableId} · double-booked at ${when}</strong>
                            <p>${esc(a.first.guest.name)} (party ${a.first.party}) and
                               ${esc(a.second.guest.name)} (party ${a.second.party}) both hold this table${
                                   a.overridden ? ' — an override was used' : ''
                               }. Cancel one, or seat the second party elsewhere.</p>
                        </div>
                        <div class="alert-actions">
                            <button class="chip-btn" data-act="cancel" data-id="${a.second.id}" type="button">Cancel ${esc(a.second.guest.name)}</button>
                            <button class="chip-btn" data-act="cancel" data-id="${a.first.id}" type="button">Cancel ${esc(a.first.guest.name)}</button>
                        </div>
                    </div>`;
                }

                if (a.type === 'overstay') {
                    return `<div class="alert">
                        <div>
                            <strong>${a.tableId} · ${a.minutesOver} min over turn</strong>
                            <p>${esc(a.reservation.guest.name)} (party ${a.reservation.party}) seated at
                               ${core.label12(core.toMinutes(a.reservation.start))} on a ${a.reservation.turnMinutes} min turn.</p>
                        </div>
                        <div class="alert-actions">
                            <button class="chip-btn" data-act="extend" data-id="${a.reservation.id}" type="button">+15 min</button>
                            <button class="chip-btn" data-act="left" data-id="${a.reservation.id}" type="button">Mark left</button>
                        </div>
                    </div>`;
                }

                return `<div class="alert">
                    <div>
                        <strong>${a.tableId} · next booking at risk</strong>
                        <p>${esc(a.next.guest.name)} · party ${a.next.party} arrives in ${a.arrivesIn} min —
                           table still held by ${esc(a.reservation.guest.name)}.</p>
                    </div>
                    <div class="alert-actions">
                        <button class="chip-btn" data-act="extend" data-id="${a.reservation.id}" type="button">Extend current</button>
                        <button class="chip-btn" data-act="left" data-id="${a.reservation.id}" type="button">Free table</button>
                    </div>
                </div>`;
            }).join('');
        }

        function renderFloor() {
            const now = new Date();
            const counts = { available: 0, seated: 0, dirty: 0, blocked: 0 };

            els.floor.innerHTML = core.TABLES.map((table) => {
                const floor = core.floorState(table.id);
                const seated = core.seatedReservation(table.id);
                const next = core.nextFor(table.id, now);
                const state = floor.state || 'available';
                counts[state] = (counts[state] || 0) + 1;

                let body = '';
                let actions = '';

                if (state === 'seated' && seated) {
                    const start = core.dateTime(seated.date, seated.start);
                    const end = core.turnEnd(seated);
                    const elapsed = Math.max(0, (now - start) / 60000);
                    const pct = Math.min(100, Math.round((elapsed / seated.turnMinutes) * 100));
                    const over = Math.max(0, Math.round((now - end) / 60000));
                    const outBy = core.label12(core.toMinutes(seated.start) + seated.turnMinutes);

                    body = `
                        <p class="guest-line">${esc(seated.guest.name)} <small>· party ${seated.party}</small></p>
                        <p class="window-line">Seated ${core.label12(core.toMinutes(seated.start))} · ${seated.turnMinutes} min turn · out by ${outBy}</p>
                        <div class="meter ${over ? 'is-over' : ''}"><span style="width:${pct}%"></span></div>
                        ${over ? `<p class="overstay-line">${over} min over</p>` : ''}
                    `;
                    actions = `
                        <button data-act="left" data-id="${seated.id}" class="is-primary">Mark left</button>
                        <button data-act="extend" data-id="${seated.id}">+15 min</button>
                    `;
                } else if (state === 'dirty') {
                    body = '<p class="window-line">Needs resetting before the next cover.</p>';
                    actions = `<button data-act="clean" data-table="${table.id}" class="is-primary">Mark clean</button>`;
                } else if (state === 'blocked') {
                    body = `<p class="window-line">${esc(floor.reason || 'Blocked')} — not sellable today.</p>`;
                    actions = `<button data-act="unblock" data-table="${table.id}" class="is-primary">Unblock</button>`;
                } else {
                    body = '<p class="window-line">Free now.</p>';
                    actions = `
                        <select data-role="party" aria-label="Walk-in party size">
                            <option value="1">1</option>
                            <option value="2" selected>2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                        </select>
                        <button data-act="seat" data-table="${table.id}" class="is-primary">Seat walk-in</button>
                        <button data-act="block" data-table="${table.id}" class="is-danger">Block</button>
                    `;
                }

                let nextLine = '';
                if (next) {
                    const arrivesIn = (core.dateTime(next.date, next.start) - now) / 60000;
                    const conflict = Boolean(seated) && now > core.turnEnd(seated) && arrivesIn <= 30;
                    nextLine = `<p class="next-line${conflict ? ' is-conflict' : ''}">
                        Next ${core.label12(core.toMinutes(next.start))} · ${esc(next.guest.name)} · ${next.party}p
                        ${conflict ? ' · at risk' : ''}
                    </p>`;
                }

                const [label, cls] = BADGE[state] || BADGE.available;

                return `<article class="table-card state-${state}" data-card="${table.id}">
                    <header class="card-head">
                        <h3>${table.id}</h3>
                        <span class="badge ${cls}">${label}</span>
                    </header>
                    <p class="card-sub">${table.seats} seats · ${table.area}</p>
                    ${body}
                    ${nextLine}
                    <div class="card-actions">${actions}</div>
                </article>`;
            }).join('');

            els.meta.textContent =
                `live now · ${counts.available} free · ${counts.seated} seated · ${counts.dirty} dirty · ${counts.blocked} blocked`;
        }

        function renderSchedule() {
            const rows = core.reservationsFor(date);
            if (els.scheduleMeta) els.scheduleMeta.textContent = core.prettyDate(date);

            if (!rows.length) {
                els.schedule.innerHTML = '<li class="empty-note">Nothing booked for this date.</li>';
                return;
            }

            const now = new Date();
            els.schedule.innerHTML = rows.map((r) => {
                const overdue = r.status === 'confirmed' &&
                    (now - core.dateTime(r.date, r.start)) > 15 * 60000;

                return `<li class="is-${r.status}">
                    <span class="s-time">${core.label12(core.toMinutes(r.start))}</span>
                    <span class="s-table">${r.tableId}</span>
                    <span class="s-name">${esc(r.guest.name)}
                        <small>· ${r.party}p${r.overridden ? ' · override' : ''}</small>
                    </span>
                    <span class="s-actions">
                        ${overdue ? `<button data-act="noshow" data-id="${r.id}" type="button">No-show</button>` : ''}
                        ${r.status === 'seated' ? `<button data-act="left" data-id="${r.id}" type="button">Left</button>` : ''}
                    </span>
                </li>`;
            }).join('');
        }

        function renderAudit() {
            const entries = core.auditLog();
            if (!entries.length) {
                els.audit.innerHTML = '<li class="empty-note">No staff actions yet.</li>';
                return;
            }

            els.audit.innerHTML = entries.map((entry) => {
                const at = core.venueParts(new Date(entry.at));
                const time = `${String(at.hour).padStart(2, '0')}:${String(at.minute).padStart(2, '0')}`;
                return `<li>
                    <span class="a-action">${esc(entry.action)}</span>
                    <span class="a-note">${time} · ${esc(entry.tableId || '')} ${esc(entry.note || '')}</span>
                </li>`;
            }).join('');
        }

        /* ---------------- staff form ---------------- */

        function fillTimes() {
            const previous = els.time.value;
            const slots = core.slotsFor(date);

            if (!slots.length) {
                els.time.innerHTML = '<option value="">Closed</option>';
                els.time.disabled = true;
                els.submit.disabled = true;
                return;
            }

            els.time.disabled = false;
            els.submit.disabled = false;
            els.time.innerHTML = slots
                .map((m) => `<option value="${core.fromMinutes(m)}">${core.label12(m)}</option>`)
                .join('');

            if (previous && slots.some((m) => core.fromMinutes(m) === previous)) {
                els.time.value = previous;
            }
        }

        function fillStaffTables() {
            const current = els.table.value;
            const start = els.time.value;
            const party = Number(els.party.value) || 2;
            const startMin = start ? core.toMinutes(start) : core.toMinutes(core.VENUE.open);

            els.table.innerHTML = '<option value="any">Any table</option>' + core.TABLES.map((table) => {
                const result = core.tableState(table, date, startMin, party);
                const suffix = result.status === 'reserved'
                    ? ` · booked ${result.conflict.start}`
                    : result.status === 'blocked' ? ' · closed' : '';

                return `<option value="${table.id}">${table.id} · ${table.seats} seats${suffix}</option>`;
            }).join('');

            if (current) {
                const target = Array.from(els.table.options).find((o) => o.value === current && !o.disabled);
                if (target) els.table.value = current;
            }
        }

        function setMsg(text, ok) {
            els.msg.hidden = !text;
            els.msg.textContent = text || '';
            els.msg.className = ok ? 'staff-msg is-ok' : 'staff-msg';
        }

        els.form.addEventListener('submit', (event) => {
            event.preventDefault();

            const name = els.name.value.trim();
            if (!name) {
                setMsg('Enter a guest name first.', false);
                els.name.focus();
                return;
            }

            const start = els.time.value;
            if (!start) {
                setMsg('No bookable times left for this date.', false);
                return;
            }

            try {
                const reservation = core.book({
                    tableId: els.table.value,
                    date,
                    start,
                    party: Number(els.party.value) || 2,
                    name,
                    phone: els.phone.value.trim(),
                    override: els.override.checked,
                });

                setMsg(
                    `Booked ${reservation.tableId} · ${core.label12(core.toMinutes(start))} for ${name}` +
                    (reservation.autoAssigned ? ' (auto-assigned).' : reservation.overridden ? ' (override logged).' : '.'),
                    true
                );
                els.name.value = '';
                els.phone.value = '';
                els.override.checked = false;
                fillStaffTables();
                render();
            } catch (err) {
                setMsg(
                    err.code === 'TABLE_TAKEN'
                        ? `${err.message}. Tick “Allow override” to seat them anyway.`
                        : err.message,
                    false
                );
            }
        });

        els.time.addEventListener('change', fillStaffTables);
        els.party.addEventListener('change', fillStaffTables);

        /* One date context: the header picker and the booking form stay in sync,
           and both re-drive the time list, the table list and the schedule. */
        function applyDate(value) {
            date = value || core.defaultDate();
            els.date.value = date;
            els.formDate.value = date;
            fillTimes();
            fillStaffTables();
            render();
        }

        els.date.addEventListener('change', () => applyDate(els.date.value));
        els.formDate.addEventListener('change', () => applyDate(els.formDate.value));

        els.reset.addEventListener('click', () => {
            if (!window.confirm('Reset the demo data? This clears every reservation and staff action.')) return;
            core.reset();
            applyDate(core.defaultDate());
            setMsg('', true);
        });

        /* ---------------- delegated actions ---------------- */

        function handleAction(event) {
            const button = event.target.closest('button[data-act]');
            if (!button) return;

            const act = button.dataset.act;
            const id = button.dataset.id;
            const tableId = button.dataset.table;

            try {
                if (act === 'seat') {
                    const card = button.closest('[data-card]');
                    const partySelect = card ? card.querySelector('[data-role="party"]') : null;
                    const party = partySelect ? Number(partySelect.value) : 2;
                    core.seatWalkIn(tableId, party);
                } else if (act === 'left') {
                    core.markLeft(id);
                } else if (act === 'extend') {
                    core.extend(id, 15);
                } else if (act === 'noshow') {
                    core.noShow(id);
                } else if (act === 'clean') {
                    core.markClean(tableId);
                } else if (act === 'block') {
                    core.block(tableId, 'staff block');
                } else if (act === 'unblock') {
                    core.unblock(tableId);
                } else if (act === 'cancel') {
                    core.cancel(id);
                }
            } catch (err) {
                setMsg(err.message, false);
            }

            fillStaffTables();
            render();
        }

        els.floor.addEventListener('click', handleAction);
        els.alerts.addEventListener('click', handleAction);
        els.schedule.addEventListener('click', handleAction);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
    if (window.GoodDays.admin) window.GoodDays.admin.init();
});
