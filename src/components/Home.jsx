import Reservation from "./Reservation";

export default function Home({ basePath }) {
  return (
    <>
      <section className="hero" id="top">
        <div className="hero-copy">
          <h1>
            Better coffee.
            <br />
            Better <em>days.</em>
          </h1>
          <p className="hero-description">
            Coffee roasted in Portland, served here or brewed at home.
          </p>
          <div className="hero-buttons">
            <a className="button" href={basePath + "order.html"}>
              Shop coffee <span aria-hidden="true">↗</span>
            </a>
            <a className="text-link" href="#visit">
              Visit us <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div className="hero-photo">
          <img
            src={basePath + "images/brewing.jpg"}
            alt="Fresh coffee being carefully brewed into a glass carafe"
            fetchPriority="high"
          />
        </div>
      </section>

      <section className="values-strip" aria-label="Our approach">
        <div className="values-track">
          {[0, 1].map((copy) => (
            <div
              className="values-group"
              key={copy}
              aria-hidden={copy === 1 ? true : undefined}
            >
              <p>Roasted with intention</p>
              <p>Fresh every week</p>
              <p>Always good company</p>
              <p>Brewed with care</p>
              <p>Made for your mornings</p>
              <p>Good coffee, every day</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="section coffee-section"
        aria-labelledby="coffee-heading"
      >
        <div className="section-heading">
          <h2 id="coffee-heading">Our coffee</h2>
          <a className="text-link" href={basePath + "order.html"}>
            View all coffee <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="featured-grid">
          <a className="featured-coffee" href={basePath + "order.html#house"}>
            <div className="featured-image">
              <img
                src={basePath + "images/beans.jpg"}
                alt="Freshly roasted coffee beans"
                loading="lazy"
              />
            </div>
            <div className="coffee-name">
              <h3>Kestrel House Blend</h3>
              <span>$18</span>
            </div>
            <p>Chocolate, hazelnut, brown sugar</p>
          </a>
          <a
            className="featured-coffee"
            href={basePath + "order.html#morning-light"}
          >
            <div className="featured-image">
              <img
                src={basePath + "images/coffee.jpg"}
                alt="Freshly brewed coffee ready to enjoy"
                loading="lazy"
              />
            </div>
            <div className="coffee-name">
              <h3>Morning Light</h3>
              <span>$19</span>
            </div>
            <p>Citrus, honey, toasted almond</p>
          </a>
          <a
            className="featured-coffee"
            href={basePath + "order.html#midnight"}
          >
            <div className="featured-image">
              <img
                src={basePath + "images/espresso.jpg"}
                alt="Coffee in ceramic cups"
                loading="lazy"
              />
            </div>
            <div className="coffee-name">
              <h3>Midnight Roast</h3>
              <span>$20</span>
            </div>
            <p>Dark cocoa, molasses, cedar</p>
          </a>
        </div>
      </section>

      <section
        className="story-section"
        id="story"
        aria-labelledby="story-heading"
      >
        <div className="story-image">
          <img
            src={basePath + "images/cafe.jpg"}
            alt="Our cafe with plants, natural light, and space to sit"
            loading="lazy"
          />
        </div>
        <div className="story-copy">
          <h2 id="story-heading">
            Our place
            <br />
            <em>in Portland.</em>
          </h2>
          <p>
            We roast in small batches and serve coffee every day at our Kestrel
            Lane cafe. Come in for a cup, meet a friend, or pick up beans to
            take home.
          </p>
          <a className="button button-white" href="#visit">
            Find us <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <section
        className="section visit-section"
        id="visit"
        aria-labelledby="visit-heading"
      >
        <div className="visit-intro">
          <h2 id="visit-heading">Visit us.</h2>
          <div className="visit-details">
            <div>
              <h3>Address</h3>
              <address>
                14 Kestrel Lane
                <br />
                Portland, OR 97209
              </address>
              <a
                className="button directions-button"
                href="https://www.google.com/maps/search/?api=1&query=14+Kestrel+Lane+Portland+OR+97209"
                target="_blank"
                rel="noreferrer"
              >
                Get directions ↗
              </a>
            </div>
            <div>
              <h3>Opening hours</h3>
              <p>
                Every day
                <br />
                8:00 AM to 8:00 PM
              </p>
              <span className="muted">Last seating at 7:00 PM</span>
            </div>
          </div>
        </div>
        <Reservation />
      </section>
    </>
  );
}
