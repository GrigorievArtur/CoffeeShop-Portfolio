import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./components/Home";
import Shop from "./components/Shop";

export default function App() {
  const isShop = window.location.pathname.endsWith("order.html");
  const basePath = import.meta.env.BASE_URL;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {isShop ? (
        <Shop />
      ) : (
        <>
          <Header />
          <main id="main">
            <Home basePath={basePath} />
          </main>
        </>
      )}
      <Footer />
    </>
  );
}
