# Good Days Coffee — portfolio landing page

A single-page café demo with a coffee photo gallery and a static reservation UI. No build step,
no frameworks, no server: open `index.html`.

```
index.html    landing page (hero · coffee gallery · reservation UI · footer)
css/          base · canvas · waves · hero · collage · gallery · reservation · footer · responsive
js/           beans (Three.js) · parallax · main
```

The reservation form is UI only — there is no booking logic or staff console. There is no floor
plan or table picker: every request defaults to **any table**, and the house assigns the best
available one. Time uses the native `<input type="time">` control (15-minute steps, last seating
7:00 PM). Buttons are decorative.

Photos are loaded from Unsplash; fonts from Google Fonts.
