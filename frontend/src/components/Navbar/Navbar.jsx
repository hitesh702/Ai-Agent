import { Link } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo">
          CallAI
        </Link>

        <nav className="navbar-links">
          <a href="/#how-it-works">How It Works</a>
          <a href="/#services">Services</a>
          <a href="/#pricing">Pricing</a>
          <Link to="/contact">Contact</Link>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
