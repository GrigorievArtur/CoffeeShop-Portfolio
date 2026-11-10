import { useEffect, useState } from "react";
import Header from "./Header";
import ProductCard from "./ProductCard";
import Bag from "./Bag";

const storageKey = "gooddays.order.v1";

function readBag() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!Array.isArray(saved)) return [];
    return saved.filter(
      (item) =>
        item &&
        typeof item.key === "string" &&
        typeof item.name === "string" &&
        typeof item.size === "string" &&
        typeof item.grind === "string" &&
        Number.isFinite(item.price) &&
        item.price > 0 &&
        Number.isInteger(item.qty) &&
        item.qty > 0,
    );
  } catch {
    return [];
  }
}

export default function Shop() {
  const [filter, setFilter] = useState("All coffee");
  const [cart, setCart] = useState(readBag);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      // The bag still works if the browser cannot save it.
    }
  }, [cart]);

  function addToBag(coffee) {
    const nextCart = [...cart];
    const index = nextCart.findIndex((item) => item.key === coffee.key);
    if (index === -1) {
      nextCart.push(coffee);
    } else {
      nextCart[index] = { ...nextCart[index], qty: nextCart[index].qty + 1 };
    }
    setCart(nextCart);
  }

  return (
    <>
      <Header>
        <Bag cart={cart} setCart={setCart} />
      </Header>
      <main id="main">
        <section className="shop-intro" id="top">
          <div>
            <h1>
              Our <em>coffee.</em>
            </h1>
          </div>
        </section>
        <section
          className="section catalog-section"
          aria-label="Coffee catalog"
        >
          <div className="catalog-toolbar">
            <div className="filters" role="group" aria-label="Filter by roast">
              {["All coffee", "Light", "Medium", "Dark", "Decaf"].map(
                (roast) => (
                  <button
                    key={roast}
                    aria-pressed={filter === roast}
                    onClick={() => setFilter(roast)}
                  >
                    {roast}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="product-grid">
            {(filter === "All coffee" || filter === "Medium") && (
              <ProductCard
                id="house"
                name="Kestrel House Blend"
                roast="Medium roast"
                notes="Chocolate, hazelnut, brown sugar"
                price={18}
                image="/images/beans.jpg"
                addToBag={addToBag}
              />
            )}
            {(filter === "All coffee" || filter === "Light") && (
              <ProductCard
                id="morning-light"
                name="Morning Light"
                roast="Light roast"
                notes="Citrus, honey, toasted almond"
                price={19}
                image="/images/coffee.jpg"
                addToBag={addToBag}
              />
            )}
            {(filter === "All coffee" || filter === "Dark") && (
              <ProductCard
                id="midnight"
                name="Midnight Roast"
                roast="Dark roast"
                notes="Dark cocoa, molasses, cedar"
                price={20}
                image="/images/espresso.jpg"
                addToBag={addToBag}
              />
            )}
            {(filter === "All coffee" || filter === "Light") && (
              <ProductCard
                id="guji"
                name="Ethiopia Guji"
                roast="Light roast"
                notes="Blueberry, jasmine, lemon zest"
                price={24}
                image="/images/brewing.jpg"
                addToBag={addToBag}
              />
            )}
            {(filter === "All coffee" || filter === "Medium") && (
              <ProductCard
                id="huila"
                name="Colombia Huila"
                roast="Medium roast"
                notes="Caramel, red apple, cocoa nib"
                price={22}
                image="/images/iced.jpg"
                addToBag={addToBag}
              />
            )}
            {(filter === "All coffee" || filter === "Decaf") && (
              <ProductCard
                id="decaf"
                name="Decaf Nocturne"
                roast="Decaf roast"
                notes="Almond, cocoa, dried fig"
                price={21}
                image="/images/cup.jpg"
                addToBag={addToBag}
              />
            )}
          </div>
        </section>
        <section className="shop-note" aria-labelledby="coffee-help">
          <div>
            <h2 id="coffee-help">Not sure where to start?</h2>
            <p>Try our Kestrel House Blend, or stop by the cafe for a cup.</p>
          </div>
          <a className="button button-white" href="index.html#visit">
            Visit the cafe <span aria-hidden="true">↗</span>
          </a>
        </section>
      </main>
    </>
  );
}
