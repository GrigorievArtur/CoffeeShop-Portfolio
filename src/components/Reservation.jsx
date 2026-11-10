import { useState } from "react";

export default function Reservation() {
  const [message, setMessage] = useState("");
  const today = new Date();
  const firstDate =
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(today.getDate()).padStart(2, "0");

  function reserve(event) {
    event.preventDefault();
    const form = event.target;
    if (form.elements.date.value < firstDate) {
      setMessage("Please choose today or a future date.");
      return;
    }
    setMessage(
      "Your demo reservation is ready. No table has been booked and no details have been sent.",
    );
    form.reset();
  }

  return (
    <div className="reservation" id="reserve">
      <h3>Book a table</h3>
      <form onSubmit={reserve}>
        <div className="form-row">
          <label>
            Full name
            <input
              name="name"
              autoComplete="name"
              placeholder="Your name"
              required
            />
          </label>
          <label>
            Phone number
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="Your phone number"
              required
            />
          </label>
        </div>
        <div className="booking-schedule">
          <div className="form-row">
            <label>
              Date
              <input name="date" type="date" min={firstDate} required />
            </label>
            <label>
              Time
              <input
                name="time"
                aria-describedby="booking-time-hint"
                type="time"
                min="08:00"
                max="19:00"
                step="900"
                required
              />
            </label>
          </div>
          <p className="field-hint" id="booking-time-hint">
            Choose a time every 15 minutes from 8:00 AM to 7:00 PM.
          </p>
        </div>
        <label>
          Party size
          <select name="guests" defaultValue="2">
            <option value="1">1 person</option>
            <option value="2">2 people</option>
            <option value="3">3 people</option>
            <option value="4">4 people</option>
          </select>
        </label>
        <div className="booking-actions">
          <button className="button" type="submit">
            Reserve a table <span aria-hidden="true">↗</span>
          </button>
          <p className="demo-note">
            Portfolio demo. No real reservation is made.
          </p>
          <p className="form-message" role="status">
            {message}
          </p>
        </div>
      </form>
    </div>
  );
}
