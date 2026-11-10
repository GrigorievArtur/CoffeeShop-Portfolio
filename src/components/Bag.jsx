import { useRef, useState } from "react";

export default function Bag({ cart, setCart }) {
  const dialog = useRef(null);
  const [message, setMessage] = useState("");
  let count = 0;
  let total = 0;
  for (const item of cart) {
    count += item.qty;
    total += item.price * item.qty;
  }

  function changeQuantity(key, change) {
    const nextCart = [];
    for (const item of cart) {
      if (item.key === key) {
        if (item.qty + change > 0) {
          nextCart.push({ ...item, qty: item.qty + change });
        }
      } else {
        nextCart.push(item);
      }
    }
    setCart(nextCart);
    setMessage("");
  }

  function checkout(event) {
    event.preventDefault();
    if (cart.length === 0) return;
    setMessage(
      "Demo order complete. No payment was taken, no order was placed, and no email was sent.",
    );
    setCart([]);
    event.target.reset();
  }

  return (
    <>
      <button
        className="button button-small"
        onClick={() => {
          setMessage("");
          dialog.current.showModal();
        }}
        aria-haspopup="dialog"
      >
        Your bag{" "}
        <span className="bag-count" aria-live="polite">
          {count}
        </span>
      </button>
      <dialog
        className="bag-dialog"
        ref={dialog}
        aria-labelledby="bag-title"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="bag-content">
          <div className="bag-heading">
            <div>
              <h2 id="bag-title">Your bag.</h2>
            </div>
            <button
              className="close-bag"
              onClick={() => dialog.current.close()}
              aria-label="Close bag"
            >
              Close ×
            </button>
          </div>
          {cart.length === 0 && (
            <p className="empty-bag">
              Your bag is empty. Find your next favorite coffee.
            </p>
          )}
          <div className="bag-items">
            {cart.map((item) => (
              <div className="bag-item" key={item.key}>
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    {item.size} · {item.grind}
                  </p>
                  <div className="quantity">
                    <button
                      onClick={() => changeQuantity(item.key, -1)}
                      aria-label={"Decrease " + item.name}
                    >
                      −
                    </button>
                    <span>{item.qty}</span>
                    <button
                      onClick={() => changeQuantity(item.key, 1)}
                      aria-label={"Increase " + item.name}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="bag-item-price">
                  <strong>${(item.price * item.qty).toFixed(2)}</strong>
                  <button
                    onClick={() => {
                      setCart(cart.filter((coffee) => coffee.key !== item.key));
                      setMessage("");
                    }}
                    aria-label={"Remove " + item.name}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="bag-total">
            <span>
              Total <small>Free pickup</small>
            </span>
            <strong>${total.toFixed(2)}</strong>
          </div>
          <p className="demo-note">
            This is a portfolio demo. No purchase or payment will be made.
          </p>
          <form className="checkout-form" onSubmit={checkout}>
            <div className="form-row">
              <label>
                Name
                <input name="name" autoComplete="name" required />
              </label>
              <label>
                Phone
                <input name="phone" type="tel" autoComplete="tel" required />
              </label>
            </div>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Collection
              <select name="collection">
                <option>Pick up at the bar, free</option>
                <option>Shipping, postage calculated later</option>
              </select>
            </label>
            <label>
              Notes <span className="muted">(optional)</span>
              <textarea name="notes" rows="2" />
            </label>
            <button className="button" disabled={cart.length === 0}>
              Complete demo order <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="form-message" role="status">
            {message}
          </p>
        </div>
      </dialog>
    </>
  );
}
