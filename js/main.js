/* =========================================
   MAIN — app bootstrap
   ========================================= */

(function () {
    'use strict';

    const app = window.GoodDays || {};

    // Follow the browser's clock convention: 12-hour for US-style locales,
    // military time for everyone else.
    function formatTime(value) {
        const [hours, minutes] = value.split(':').map(Number);
        const date = new Date(2000, 0, 1, hours, minutes);
        const hourCycle = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
            .resolvedOptions().hourCycle;

        if (hourCycle === 'h12' || hourCycle === 'h11') {
            return new Intl.DateTimeFormat(undefined, {
                hour: 'numeric',
                minute: '2-digit'
            }).format(date);
        }

        return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    }

    function initTimes() {
        document.querySelectorAll('[data-time-range]').forEach((el) => {
            const [start, end] = el.dataset.timeRange.split('-');
            el.textContent = formatTime(start) + ' – ' + formatTime(end);
        });

        document.querySelectorAll('[data-time]').forEach((el) => {
            el.textContent = formatTime(el.dataset.time);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initTimes();
        if (app.beans) app.beans.init('#canvas-container');
        if (app.parallax) app.parallax.init();

        window.addEventListener('resize', () => {
            if (app.beans) app.beans.onResize();
        });
    });
})();
