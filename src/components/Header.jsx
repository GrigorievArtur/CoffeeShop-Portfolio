import { useState } from "react";

export default function Header({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isShop = window.location.pathname.endsWith("order.html");

  return (
    <header className="site-header">
      <a className="brand" href="index.html" aria-label="Good Days Coffee home">
        <span className="brand-mark" aria-hidden="true">
          ✳
        </span>
        <span>good days</span>
      </a>
      <button
        className="menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="main-nav"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? "Close" : "Menu"}
      </button>
      <nav
        id="main-nav"
        className={menuOpen ? "main-nav is-open" : "main-nav"}
        aria-label="Main navigation"
      >
        <a href="order.html" aria-current={isShop ? "page" : undefined}>
          Our coffee
        </a>
        <a href="index.html#story" onClick={() => setMenuOpen(false)}>
          Our story
        </a>
        <a href="index.html#visit" onClick={() => setMenuOpen(false)}>
          Visit us
        </a>
      </nav>
      <div className="header-action">
        {children || (
          <a className="button button-small" href="#reserve">
            Book a table <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </header>
  );
}
