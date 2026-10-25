/* =========================================
   PARALLAX — scroll-driven wave layers
   Exposes: window.GoodDays.parallax
   ========================================= */

window.GoodDays = window.GoodDays || {};

window.GoodDays.parallax = (function () {
    'use strict';

    let wrapper = null;
    let waveBack = null;
    let waveFront = null;
    let ticking = false;

    function update() {
        const scrollY = window.scrollY;

        if (waveBack) {
            waveBack.style.transform = `translateY(${scrollY * 0.15}px)`;
        }
        if (waveFront) {
            waveFront.style.transform = `translateY(${scrollY * 0.3}px)`;
        }

        // Clear the bands away as the reservation section takes over,
        // leaving only the beans behind the glass.
        if (wrapper) {
            const fade = Math.max(0, 1 - scrollY / (window.innerHeight * 0.75));
            wrapper.style.opacity = fade.toFixed(3);
        }

        ticking = false;
    }

    function onScroll() {
        // Batch DOM writes into one animation frame
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }

    function init() {
        wrapper = document.querySelector('.wave-wrapper');
        waveBack = document.getElementById('wave-back');
        waveFront = document.getElementById('wave-front');

        window.addEventListener('scroll', onScroll, { passive: true });
        update();
    }

    return { init };
})();
