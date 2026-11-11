import { useState } from "react";

export default function ProductCard({
  basePath,
  id,
  name,
  roast,
  notes,
  price,
  image,
  addToBag,
}) {
  const [size, setSize] = useState("250 g");
  const [grind, setGrind] = useState("Whole bean");
  const [added, setAdded] = useState(false);
  let bagPrice = price;
  if (size === "500 g") bagPrice = price * 1.9;
  if (size === "1 kg") bagPrice = price * 3.6;
  bagPrice = Math.round(bagPrice * 100) / 100;

  function addCoffee() {
    // A bag only needs these details to remember the selected coffee.
    addToBag({
      key: id + "|" + size + "|" + grind,
      name: name,
      size: size,
      grind: grind,
      price: bagPrice,
      qty: 1,
    });
    setAdded(true);
  }

  return (
    <article className="product-card" id={id}>
      <div className="product-image">
        <img src={basePath + image} alt={name + " coffee"} loading="lazy" />
      </div>
      <div className="coffee-name">
        <h2>{name}</h2>
        <span>${bagPrice.toFixed(2)}</span>
      </div>
      <p className="tasting-notes">
        {roast}. {notes}.
      </p>
      <div className="product-options">
        <label>
          Size
          <select
            value={size}
            onChange={(event) => {
              setSize(event.target.value);
              setAdded(false);
            }}
          >
            <option>250 g</option>
            <option>500 g</option>
            <option>1 kg</option>
          </select>
        </label>
        <label>
          Grind
          <select
            value={grind}
            onChange={(event) => {
              setGrind(event.target.value);
              setAdded(false);
            }}
          >
            <option>Whole bean</option>
            <option>Espresso</option>
            <option>Filter</option>
            <option>French press</option>
            <option>Moka pot</option>
          </select>
        </label>
      </div>
      <button
        className="button product-add"
        onClick={addCoffee}
        aria-label={"Add " + name + " to bag"}
      >
        Add to bag <span aria-hidden="true">+</span>
      </button>
      <p className="added-message" role="status">
        {added ? "Added to your bag." : ""}
      </p>
    </article>
  );
}
