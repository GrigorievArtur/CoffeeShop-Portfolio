export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <a className="brand footer-brand" href="index.html">
            <span className="brand-mark" aria-hidden="true">
              ✳
            </span>
            <span>good days</span>
          </a>
        </div>
        <div className="footer-links">
          <h3>Explore</h3>
          <a href="order.html">Shop coffee</a>
          <a href="index.html#story">Our story</a>
          <a href="index.html#reserve">Book a table</a>
        </div>
        <div className="footer-links">
          <h3>Contact</h3>
          <a href="mailto:reservations@example.com">reservations@example.com</a>
          <a href="tel:+15550123456">+1 (555) 012 3456</a>
          <span>Portland, Oregon</span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Good Days Coffee</span>
        <a href="#top">Back to top ↑</a>
      </div>
    </footer>
  );
}
