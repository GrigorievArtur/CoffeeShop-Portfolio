import { test, expect } from "@playwright/test";

test("production build uses the project path for GitHub Pages", async () => {
  const home = await (
    await fetch("http://127.0.0.1:4173/CoffeeShop-Portfolio/")
  ).text();
  const shop = await (
    await fetch("http://127.0.0.1:4173/CoffeeShop-Portfolio/order.html")
  ).text();
  expect(home).toContain('src="/CoffeeShop-Portfolio/assets/');
  expect(home).toContain('href="/CoffeeShop-Portfolio/assets/');
  expect(shop).toContain('src="/CoffeeShop-Portfolio/assets/');
});

test("home displays local photos and fonts without page errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Better coffee.Better days.",
  );
  await page.evaluate(() => document.fonts.ready);
  for (const image of await page.getByRole("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty("complete", true);
    await expect(image).not.toHaveJSProperty("naturalWidth", 0);
  }
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() =>
      document.fonts.check('700 24px "Bricolage Grotesque"'),
    ),
  ).toBe(true);
});

test("navigation reaches the shop and mobile menu works", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Close", exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
  }
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Our coffee" })
    .click();
  await expect(page).toHaveURL(/order.html$/);
  await expect(page.getByRole("article")).toHaveCount(6);
});

test("all roast filters show the right coffees", async ({ page }) => {
  await page.goto("order.html");
  for (const [filter, count] of [
    ["Light", 2],
    ["Medium", 2],
    ["Dark", 1],
    ["Decaf", 1],
    ["All coffee", 6],
  ]) {
    const button = page.getByRole("button", { name: filter, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("article")).toHaveCount(count);
  }
});

test("bag remembers coffee choices, merges matching bags, and changes quantities", async ({
  page,
}) => {
  await page.goto("order.html");
  const coffee = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Kestrel House Blend" }),
  });
  await coffee.getByLabel("Size").selectOption("500 g");
  await coffee.getByLabel("Grind").selectOption("Filter");
  await expect(coffee.getByText("$34.20", { exact: true })).toBeVisible();
  await coffee
    .getByRole("button", { name: "Add Kestrel House Blend to bag" })
    .click();
  await coffee
    .getByRole("button", { name: "Add Kestrel House Blend to bag" })
    .click();
  await page.reload();
  const bagButton = page.getByRole("button", { name: "Your bag" });
  await expect(bagButton).toContainText("2");
  await bagButton.click();
  const bag = page.getByRole("dialog");
  await expect(bag.getByText("500 g · Filter")).toBeVisible();
  await expect(bag.locator(".bag-item")).toHaveCount(1);
  await expect(bag.locator(".bag-total")).toContainText("$68.40");
  await bag
    .getByRole("button", { name: "Increase Kestrel House Blend" })
    .click();
  await expect(bag.locator(".bag-total")).toContainText("$102.60");
  await bag
    .getByRole("button", { name: "Decrease Kestrel House Blend" })
    .click();
  await bag.getByRole("button", { name: "Remove Kestrel House Blend" }).click();
  await expect(
    bag.getByText("Your bag is empty. Find your next favorite coffee."),
  ).toBeVisible();
  await expect(
    bag.getByRole("button", { name: "Complete demo order" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(bag).not.toBeVisible();
  await expect(bagButton).toBeFocused();
});

test("checkout validates fields and clearly reports a demo", async ({
  page,
}) => {
  await page.goto("order.html");
  await page.getByRole("button", { name: "Add Morning Light to bag" }).click();
  await page.getByRole("button", { name: "Your bag" }).click();
  const bag = page.getByRole("dialog");
  await bag.getByRole("button", { name: "Complete demo order" }).click();
  await expect(bag.getByLabel("Name", { exact: true })).toBeFocused();
  await bag.getByLabel("Name", { exact: true }).fill("Alex Coffee");
  await bag.getByLabel("Phone", { exact: true }).fill("5550123456");
  await bag.getByLabel("Email", { exact: true }).fill("alex@example.com");
  await bag.getByRole("button", { name: "Complete demo order" }).click();
  await expect(bag.getByRole("status")).toContainText(
    "No payment was taken, no order was placed, and no email was sent.",
  );
  await expect(bag.locator(".bag-total")).toContainText("$0.00");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("gooddays.order.v1")),
    ),
  ).toEqual([]);
});

test("reservation validates dates and confirms only a demo", async ({
  page,
}) => {
  await page.goto("/#reserve");
  const form = page.locator(".reservation");
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const day =
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0");
  await form.getByLabel("Full name").fill("Alex Coffee");
  await form.getByLabel("Phone number").fill("5550123456");
  await form.getByLabel("Date", { exact: true }).fill("2000-01-01");
  await form.getByLabel("Time", { exact: true }).fill("10:00");
  await form.getByRole("button", { name: "Reserve a table" }).click();
  await expect(form.getByRole("status")).toBeEmpty();
  await form.getByLabel("Date", { exact: true }).fill(day);
  await form.getByRole("button", { name: "Reserve a table" }).click();
  await expect(form.getByRole("status")).toContainText(
    "No table has been booked and no details have been sent.",
  );
});

test("damaged saved bag data does not break the shop", async ({ page }) => {
  await page.goto("order.html");
  await page.evaluate(() =>
    localStorage.setItem("gooddays.order.v1", "not json"),
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Your bag" })).toContainText(
    "0",
  );
  await page.evaluate(() =>
    localStorage.setItem(
      "gooddays.order.v1",
      JSON.stringify([
        null,
        {
          key: "bad",
          name: "Bad coffee",
          size: "250 g",
          grind: "Filter",
          price: -10,
          qty: 1,
        },
      ]),
    ),
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Your bag" })).toContainText(
    "0",
  );
});

test("old saved bags remain usable", async ({ page }) => {
  await page.goto("order.html");
  await page.evaluate(() =>
    localStorage.setItem(
      "gooddays.order.v1",
      JSON.stringify([
        {
          key: "house|250 g|Whole bean",
          id: "house",
          name: "Kestrel House Blend",
          roast: "Medium roast",
          size: "250 g",
          grind: "Whole bean",
          price: 18,
          qty: 2,
        },
      ]),
    ),
  );
  await page.reload();
  await page.getByRole("button", { name: "Your bag" }).click();
  await expect(page.getByRole("dialog").locator(".bag-total")).toContainText(
    "$36.00",
  );
});

test("both pages fit narrow and wide screens", async ({ page }) => {
  for (const width of [320, 390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["", "order.html"]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test("pages have no decorative labels or tiny text", async ({ page }) => {
  for (const path of ["", "order.html"]) {
    await page.goto(path);
    await expect(
      page.locator(
        ".eyebrow, .image-tag, .roast-label, .round-stamp, .shop-stamp, .photo-label, .image-caption, .brand-small",
      ),
    ).toHaveCount(0);
    const tinyText = await page.locator("body").evaluate((body) => {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const found = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!node.textContent.trim() || !parent.checkVisibility()) continue;
        if (["SCRIPT", "STYLE"].includes(parent.tagName)) continue;
        if (parseFloat(getComputedStyle(parent).fontSize) < 14) {
          found.push(node.textContent.trim());
        }
      }
      return found;
    });
    expect(tinyText).toEqual([]);
  }
});

test("green strip rolls left seamlessly and respects reduced motion", async ({
  page,
}) => {
  await page.goto("/");
  const strip = page.locator(".values-strip");
  const track = page.locator(".values-track");
  const groups = page.locator(".values-group");
  await expect(groups).toHaveCount(2);
  expect(await groups.first().innerText()).toBe(
    await groups.last().innerText(),
  );
  await expect(groups.last()).toHaveAttribute("aria-hidden", "true");
  await expect(groups.first().locator("p")).toHaveCount(6);
  const widths = await groups.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().width),
  );
  expect(widths[0]).toBeCloseTo(widths[1], 2);
  await page.mouse.move(0, 0);
  const start = await track.evaluate(
    (element) => element.getBoundingClientRect().x,
  );
  await expect
    .poll(() => track.evaluate((element) => element.getBoundingClientRect().x))
    .toBeLessThan(start - 1);
  await strip.hover();
  await expect(track).toHaveCSS("animation-play-state", "paused");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(track).toHaveCSS("animation-name", "none");
  await expect(groups.last()).not.toBeVisible();
});

test("shop navigation stays visible while scrolling", async ({
  page,
  isMobile,
}) => {
  await page.goto("order.html");
  await page.evaluate(() => document.fonts.ready);
  const header = page.locator(".site-header");
  await expect(header).toHaveCSS("position", "sticky");
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect
    .poll(() =>
      header.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBe(0);
  await expect(page.getByRole("button", { name: "Your bag" })).toBeInViewport();
  await page.getByRole("button", { name: "Your bag" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close bag" }).click();
  if (isMobile) {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInViewport();
  }
  await page.goto("order.html#guji");
  await expect
    .poll(() =>
      page
        .locator("#guji")
        .evaluate(
          (card) =>
            card.getBoundingClientRect().top >=
            document.querySelector(".site-header").getBoundingClientRect()
              .bottom,
        ),
    )
    .toBe(true);
  await page.goto("/");
  await expect(page.locator(".site-header")).not.toHaveCSS(
    "position",
    "sticky",
  );
});

test("booking spacing is consistent and small screens stack fields", async ({
  page,
}) => {
  await page.goto("/#reserve");
  await page.evaluate(() => document.fonts.ready);
  const panel = page.locator(".reservation");
  await expect(panel.locator("form")).toHaveCSS("row-gap", "24px");
  await expect(panel.locator(".booking-schedule")).toHaveCSS("row-gap", "12px");
  await expect(panel.locator(".booking-actions")).toHaveCSS("row-gap", "16px");
  await expect(panel.locator("h3")).toHaveCSS("margin-top", "0px");
  for (const label of await panel.locator("label").all()) {
    await expect(label).toHaveCSS("margin-bottom", "0px");
    await expect(label).toHaveCSS("row-gap", "8px");
  }
  for (const control of await panel.locator("input, select").all()) {
    await expect(control).toHaveCSS("min-height", "48px");
  }
  await expect(panel.getByLabel("Time", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "booking-time-hint",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const name = await panel.getByLabel("Full name").boundingBox();
  const phone = await panel.getByLabel("Phone number").boundingBox();
  expect(phone.y).toBeGreaterThan(name.y + name.height);
});

test("visible copy avoids slash and dash separators", async ({ page }) => {
  for (const path of ["", "order.html"]) {
    await page.goto(path);
    expect(await page.locator("body").innerText()).not.toMatch(/[\/—–]/);
  }
});
