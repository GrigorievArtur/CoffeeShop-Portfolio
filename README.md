# Good Days Coffee

A coffee shop portfolio rebuilt with React and plain CSS. The design uses white, charcoal, and deep green with Bricolage Grotesque, Instrument Serif, and Manrope.

## Start the site

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the local address printed in the terminal.

## Build and preview

```sh
npm run build
npm run preview
```

The build creates a `dist` folder. Deploy that folder to a static website host. Both `index.html` and `order.html` are included, so the original page addresses still work.

## How the code is organized

The code uses small React components, regular functions, basic state, and one CSS file. There is no routing library, styling framework, global state library, or backend.

- `src/App.jsx` chooses the home page or the shop page.
- `src/components/Home.jsx` contains the main page sections.
- `src/components/Header.jsx` contains the navigation and mobile menu.
- `src/components/Reservation.jsx` contains the reservation form.
- `src/components/Shop.jsx` contains the catalog, roast filters, and saved bag.
- `src/components/ProductCard.jsx` contains a coffee card with size and grind choices.
- `src/components/Bag.jsx` contains the shopping bag and demo checkout.
- `src/components/Footer.jsx` contains the shared footer.
- `src/style.css` contains the design and responsive styles.
- `public` contains local images, fonts, and the site icon.

The six coffees are written directly in the shop component instead of being hidden in a large data setup. Each saved bag item is a simple record containing its name, size, grind, price, quantity, and a key.

## Demo behavior

The shop includes five roast filters, three bag sizes, five grind options, quantity controls, item removal, and a saved bag. Existing bags stored under `gooddays.order.v1` remain compatible.

The bag uses the browser's local storage. If storage is unavailable, it still works until the page reloads.

Checkout and reservations validate required fields and show a demo confirmation. They do not send personal details, charge money, send emails, or create real orders or bookings. Contact information and the Portland address are demonstration content.

The bag uses the browser's built in dialog for keyboard focus and Escape handling. The site includes mobile navigation, visible keyboard focus, form labels, and reduced motion support.

## Check the site

```sh
npx playwright install chromium
npm test
npm run format:check
```

The browser checks cover desktop and mobile layouts, navigation, local images and fonts, filters, bag choices and totals, saved bag compatibility, broken storage data, demo checkout, and reservation validation.

The test server builds and serves the production site.

To format the new code:

```sh
npm run format
```

## Assets

Photography comes from Unsplash and is stored locally. The original photo identifiers are listed in `public/images/CREDITS.txt`.

Fonts come from Google Fonts and are stored locally with their license files. The new site does not make external requests to display images or fonts.
