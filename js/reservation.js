/* =========================================
   RESERVATION — guest booking UI
   All booking rules live in js/booking-core.js
   Exposes: window.GoodDays.reservation
   ========================================= */

window.GoodDays = window.GoodDays || {};

window.GoodDays.reservation = (function () {
    'use strict';

    function init() {
        const section = document.getElementById('reserve');
        const core = window.GoodDays.core;
        if (!section || !core) return;

        const planTables = Array.from(section.querySelectorAll('.table'));
        const form = section.querySelector('#booking-form');
        const statusEl = section.querySelector('#booking-status');
        const nameInput = section.querySelector('#guest-name');
        const phoneInput = section.querySelector('#guest-phone');
        const dateInput = section.querySelector('#booking-date');
        const timeSelect = section.querySelector('#booking-time');
        const tableSelect = section.querySelector('#booking-table');
        const guestsSelect = section.querySelector('#booking-guests');
        const submitBtn = section.querySelector('.btn-submit');

        const today = core.isoDate(new Date());
        const state = {
            tableId: 'any',
            date: today,
            time: '',
            party: Number(guestsSelect.value) || 2,
        };

        const firstDay = core.defaultDate();

        dateInput.min = today;
        dateInput.max = core.isoDate(core.addDays(new Date(), core.VENUE.maxAdvanceDays));
        state.date = firstDay;
        dateInput.value = firstDay;

        fillTimes();
        render();
        core.subscribe(render);

        /* ---------------- rendering ---------------- */

        function setStatus(text, kind) {
            statusEl.hidden = !text;
            statusEl.textContent = text;
            statusEl.className = text ? `form-status is-${kind}` : 'form-status';
        }

        function fillTimes(keep) {
            const slots = core.slotsFor(state.date);

            if (!slots.length) {
                state.date = core.isoDate(core.addDays(new Date(), 1));
                dateInput.value = state.date;
                fillTimes();
                return;
            }

            timeSelect.innerHTML = slots
                .map((m) => `<option value="${core.fromMinutes(m)}">${core.label12(m)}</option>`)
                .join('');

            const keepValue = keep && slots.some((m) => core.fromMinutes(m) === keep) ? keep : null;
            timeSelect.value = keepValue || core.fromMinutes(slots[0]);
            state.time = timeSelect.value;
        }

        function selectedState() {
            if (!state.tableId || state.tableId === 'any') return null;
            const table = core.TABLES.find((t) => t.id === state.tableId);
            if (!table) return null;
            return {
                table,
                ...core.tableState(table, state.date, core.toMinutes(state.time), state.party),
            };
        }

        function render() {
            const startMin = core.toMinutes(state.time);

            planTables.forEach((el) => {
                const table = core.TABLES.find((t) => t.id === `T${el.dataset.id}`);
                const result = core.tableState(table, state.date, startMin, state.party);
                const isSelected = state.tableId === table.id && result.status === 'available';

                el.classList.toggle('available', result.status === 'available');
                el.classList.toggle('reserved', result.status === 'reserved' || result.status === 'blocked');
                el.classList.toggle('too-small', result.status === 'too-small');
                el.classList.toggle('selected', isSelected);

                el.dataset.status = result.status;
                el.setAttribute('aria-disabled', String(result.status !== 'available'));
                el.tabIndex = result.status === 'available' ? 0 : -1;

                if (result.status === 'reserved') {
                    const c = result.conflict;
                    const end = core.toMinutes(c.start) + (c.turnMinutes || core.VENUE.fallbackTurnMinutes);
                    el.title = `Booked ${c.start}–${core.fromMinutes(end)}`;
                } else {
                    el.removeAttribute('title');
                }
            });

            const autoPick = core.pickTable(state.date, startMin, state.party);

            Array.from(tableSelect.options).forEach((option) => {
                if (!option.value || option.value === 'any') return;

                const table = core.TABLES.find((t) => t.id === `T${option.value}`);
                const result = core.tableState(table, state.date, startMin, state.party);

                option.textContent = result.status === 'reserved'
                    ? `${table.id} · booked ${result.conflict.start}`
                    : `${table.id} · ${table.seats} seats`;
                option.disabled = result.status === 'too-small';
            });

            const selected = selectedState();

            if (state.tableId === 'any') {
                if (autoPick) {
                    setStatus("Any table works — we'll seat you at the best free one.", 'neutral');
                    submitBtn.disabled = false;
                } else {
                    setStatus(
                        `Every table is taken at ${core.label12(startMin)} on ${core.prettyDate(state.date)}. Try another time.`,
                        'error'
                    );
                    submitBtn.disabled = true;
                }
            } else if (!selected) {
                setStatus('Pick a table on the plan to begin.', 'neutral');
                submitBtn.disabled = false;
            } else if (selected.status === 'reserved') {
                setStatus(
                    `${selected.table.id} is already booked at ${selected.conflict.start} on ${core.prettyDate(state.date)}. ` +
                    'Pick another table or time.',
                    'error'
                );
                submitBtn.disabled = true;
            } else if (selected.status === 'blocked') {
                setStatus(`${selected.table.id} is closed for maintenance today.`, 'error');
                submitBtn.disabled = true;
            } else if (selected.status === 'too-small') {
                setStatus(
                    `${selected.table.id} seats ${selected.table.seats} — choose a bigger table for ${state.party} guests.`,
                    'error'
                );
                submitBtn.disabled = true;
            } else {
                setStatus('', 'neutral');
                submitBtn.disabled = false;
            }
        }

        /* ---------------- interaction ---------------- */

        function pickTable(el) {
            const table = core.TABLES.find((t) => t.id === `T${el.dataset.id}`);
            if (!table) return;

            const result = core.tableState(table, state.date, core.toMinutes(state.time), state.party);
            if (result.status !== 'available') return;

            state.tableId = table.id;
            tableSelect.value = table.id.slice(1);
            render();
        }

        planTables.forEach((el) => {
            el.addEventListener('click', () => pickTable(el));
            el.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    pickTable(el);
                }
            });
        });

        tableSelect.addEventListener('change', () => {
            const value = tableSelect.value;
            state.tableId = !value ? null : value === 'any' ? 'any' : `T${value}`;
            render();
        });

        timeSelect.addEventListener('change', () => {
            state.time = timeSelect.value;
            render();
        });

        dateInput.addEventListener('change', () => {
            state.date = dateInput.value || today;
            dateInput.value = state.date;
            fillTimes(state.time);
            render();
        });

        guestsSelect.addEventListener('change', () => {
            state.party = Number(guestsSelect.value) || 2;
            render();
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();

            if (!state.tableId) {
                setStatus('Pick a table on the plan first.', 'error');
                return;
            }

            const isAny = state.tableId === 'any';
            const selected = isAny ? null : selectedState();

            if (!isAny && (!selected || selected.status !== 'available')) {
                render();
                return;
            }

            const name = nameInput.value.trim();
            const phone = phoneInput.value.trim();

            if (!name) {
                setStatus('Please enter your full name.', 'error');
                nameInput.focus();
                return;
            }

            if (phone.replace(/\D/g, '').length < 7) {
                setStatus('Please enter a phone number we can reach you on.', 'error');
                phoneInput.focus();
                return;
            }

            let reservation;

            try {
                reservation = core.book({
                    tableId: isAny ? 'any' : selected.table.id,
                    date: state.date,
                    start: state.time,
                    party: state.party,
                    name,
                    phone,
                });
            } catch (err) {
                render();
                setStatus(
                    err.code === 'TABLE_TAKEN'
                        ? 'That table was just taken. Please pick another one.'
                        : err.code === 'NO_TABLE'
                            ? 'Every table is taken at that time. Please try another time.'
                            : err.message,
                    'error'
                );
                return;
            }

            state.tableId = 'any';
            tableSelect.value = 'any';
            nameInput.value = '';
            phoneInput.value = '';
            render();

            const summary =
                `Table ${reservation.tableId}${reservation.autoAssigned ? ' (we picked the best fit)' : ''} · ` +
                `${core.prettyDate(state.date)} · ${core.label12(core.toMinutes(state.time))}`;

            setStatus(`Booked. ${summary}. We'll call ${phone} if anything changes.`, 'success');
        });
    }

    return { init };
})();
