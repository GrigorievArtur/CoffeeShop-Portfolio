/* =========================================
   MAIN — app bootstrap
   ========================================= */

(function () {
    'use strict';

    const app = window.GoodDays || {};

    document.addEventListener('DOMContentLoaded', () => {
        if (app.beans) app.beans.init('#canvas-container');
        if (app.parallax) app.parallax.init();
        if (app.reservation) app.reservation.init();

        window.addEventListener('resize', () => {
            if (app.beans) app.beans.onResize();
        });
    });
})();
