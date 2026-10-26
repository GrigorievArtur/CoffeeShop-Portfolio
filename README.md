# Good Days Coffee — portfolio landing page

A café demo with a landing page, a coffee photo gallery, a static reservation UI and a bean
ordering page. No build step, no frameworks, no server: open `index.html` or `order.html`.

```
index.html    landing page (hero · coffee gallery · reservation UI · footer)
order.html    bean catalog, cart and demo checkout (no 3D / waves)
order-selfcontained.html   the same order page with all CSS, JS, fonts and photos embedded
css/          base · canvas · waves · hero · collage · gallery · reservation · order · footer · responsive
js/           beans (Three.js) · parallax · main · order
```

The reservation form is UI only — there is no booking logic or staff console. There is no floor
plan or table picker: every request defaults to **any table**, and the house assigns the best
available one. Time uses the native `<input type="time">` control (15-minute steps, last seating
7:00 PM). Buttons are decorative.

Photos are loaded from Unsplash; fonts from Google Fonts.

The order page keeps its cart in `localStorage` under `gooddays.order.v1`; checkout is a demo and
submits nothing. `order-selfcontained.html` is a single offline-ready file with no external requests.
