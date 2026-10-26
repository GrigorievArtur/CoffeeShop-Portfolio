/* =========================================
   ORDER — catalog cart and checkout demo
   ========================================= */

(function () {
    'use strict';

    const STORAGE_KEY = 'gooddays.order.v1';
    const money = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    });

    const cartItemsEl = document.getElementById('cart-items');
    const cartCountEl = document.getElementById('cart-count');
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');
    const checkoutForm = document.getElementById('checkout-form');
    const statusEl = document.getElementById('order-status');

    let cart = loadCart();

    /* ============ PERSISTENCE ============ */
    function loadCart() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (!Array.isArray(parsed)) return [];

            return parsed.filter((item) =>
                item &&
                typeof item.key === 'string' &&
                typeof item.name === 'string' &&
                typeof item.price === 'number' &&
                Number.isInteger(item.qty) &&
                item.qty > 0
            );
        } catch (error) {
            return [];
        }
    }

    function saveCart() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
        } catch (error) {
            // Storage can be unavailable in private mode — the cart still works in-memory.
        }
    }

    /* ============ CART HELPERS ============ */
    function subtotal() {
        return Math.round(
            cart.reduce((sum, item) => sum + item.price * item.qty, 0) * 100
        ) / 100;
    }

    function cartQuantity() {
        return cart.reduce((sum, item) => sum + item.qty, 0);
    }

    function clearStatus() {
        statusEl.textContent = '';
        statusEl.className = 'order-status';
    }

    function showStatus(message, type) {
        statusEl.textContent = message;
        statusEl.className = 'order-status' + (type ? ' is-' + type : '');
    }

    /* ============ PRODUCT PRICES ============ */
    function priceFor(card) {
        const sizeSelect = card.querySelector('.product-size');
        const option = sizeSelect.selectedOptions[0];
        const base = Number(card.dataset.price) || 0;
        const multiplier = Number(option.dataset.multiplier) || 1;
        return Math.round(base * multiplier * 100) / 100;
    }

    function refreshCardPrice(card) {
        card.querySelector('.product-price').textContent = money.format(priceFor(card));
    }

    /* ============ CART RENDERING ============ */
    function makeButton(label, action, key, className) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.key = key;
        if (className) button.className = className;
        return button;
    }

    function createCartItem(item) {
        const row = document.createElement('div');
        row.className = 'cart-item';
        row.dataset.key = item.key;

        const info = document.createElement('div');
        const name = document.createElement('p');
        name.className = 'cart-item-name';
        name.textContent = item.name;
        const meta = document.createElement('p');
        meta.className = 'cart-item-meta';
        meta.textContent = item.size + ', ' + item.grind;
        info.append(name, meta);

        const price = document.createElement('span');
        price.className = 'cart-item-price';
        price.textContent = money.format(item.price * item.qty);

        const qty = document.createElement('div');
        qty.className = 'cart-qty';
        qty.append(
            makeButton('−', 'dec', item.key),
            Object.assign(document.createElement('span'), { textContent: item.qty }),
            makeButton('+', 'inc', item.key)
        );

        const remove = makeButton('×', 'remove', item.key, 'cart-remove');
        remove.setAttribute('aria-label', 'Remove ' + item.name);

        row.append(info, price, qty, remove);
        return row;
    }

    function renderCart() {
        const qty = cartQuantity();

        cartCountEl.textContent = qty + (qty === 1 ? ' item' : ' items');
        cartItemsEl.innerHTML = '';

        if (cart.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'cart-empty';
            empty.textContent = 'Your bag is empty. Add a coffee to get started.';
            cartItemsEl.appendChild(empty);
        } else {
            const fragment = document.createDocumentFragment();
            cart.forEach((item) => fragment.appendChild(createCartItem(item)));
            cartItemsEl.appendChild(fragment);
        }

        const amount = subtotal();
        subtotalEl.textContent = money.format(amount);
        totalEl.textContent = money.format(amount);
    }

    function addToCart(card) {
        const sizeSelect = card.querySelector('.product-size');
        const grindSelect = card.querySelector('.product-grind');
        const size = sizeSelect.value;
        const grind = grindSelect.value;
        const key = [card.dataset.id, size, grind].join('|');
        const existing = cart.find((item) => item.key === key);

        if (existing) {
            existing.qty += 1;
        } else {
            cart.push({
                key: key,
                id: card.dataset.id,
                name: card.dataset.name,
                roast: card.dataset.roast,
                size: size,
                grind: grind,
                price: priceFor(card),
                qty: 1
            });
        }

        clearStatus();
        saveCart();
        renderCart();
    }

    /* ============ CART EVENTS ============ */
    cartItemsEl.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const item = cart.find((entry) => entry.key === button.dataset.key);
        if (!item) return;

        if (button.dataset.action === 'inc') {
            item.qty += 1;
        } else if (button.dataset.action === 'dec') {
            item.qty -= 1;
            if (item.qty < 1) {
                cart = cart.filter((entry) => entry.key !== item.key);
            }
        } else if (button.dataset.action === 'remove') {
            cart = cart.filter((entry) => entry.key !== item.key);
        }

        clearStatus();
        saveCart();
        renderCart();
    });

    /* ============ PRODUCT EVENTS ============ */
    document.querySelectorAll('.product-card').forEach((card) => {
        const addButton = card.querySelector('.add-to-order');
        const sizeSelect = card.querySelector('.product-size');

        refreshCardPrice(card);

        sizeSelect.addEventListener('change', () => refreshCardPrice(card));

        let resetTimer = null;
        addButton.addEventListener('click', () => {
            addToCart(card);

            addButton.textContent = 'Added';
            addButton.classList.add('is-added');
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
                addButton.textContent = 'Add to order';
                addButton.classList.remove('is-added');
            }, 1200);
        });
    });

    /* ============ CHECKOUT ============ */
    checkoutForm.addEventListener('submit', (event) => {
        event.preventDefault();

        if (cart.length === 0) {
            showStatus('Add at least one bag of coffee before placing an order.', 'error');
            return;
        }

        if (!checkoutForm.checkValidity()) {
            checkoutForm.reportValidity();
            return;
        }

        const qty = cartQuantity();
        const amount = subtotal();
        const email = document.getElementById('order-email').value.trim();
        const reference = 'GD' + Math.random().toString(36).slice(2, 7).toUpperCase();

        showStatus(
            'Order ' + reference + ' received: ' + qty +
            (qty === 1 ? ' bag' : ' bags') + ', ' + money.format(amount) +
            '. Confirmation sent to ' + email + '.',
            'success'
        );

        cart = [];
        saveCart();
        renderCart();
        checkoutForm.reset();
    });

    /* ============ LOCALE-AWARE TIMES ============ */
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
            el.textContent = formatTime(start) + ' to ' + formatTime(end);
        });

        document.querySelectorAll('[data-time]').forEach((el) => {
            el.textContent = formatTime(el.dataset.time);
        });
    }

    /* ============ INIT ============ */
    initTimes();
    renderCart();
})();
