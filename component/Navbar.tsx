import Link from "next/link";
import "./Navbar.css";

export default function Navbar() {
  return (
    <nav className="navbar">

      {/* Logo */}
      <Link href="/" className="navbar-logo">
        <div className="logo-box">
          C
        </div>

        <span>CallAI</span>
      </Link>

      {/* Navigation */}
      <div className="navbar-menu">

        <Link href="/" className="nav-link">
          Home
        </Link>

        <Link href="#features" className="nav-link">
          Features
        </Link>

        <Link href="#how-it-works" className="nav-link">
          How It Works
        </Link>

        <Link href="#pricing" className="nav-link">
          Pricing
        </Link>

      </div>

      {/* Right Side */}
      <div className="navbar-right">

        <Link href="/login" className="login-button">
          Login
        </Link>

        <Link href="/register" className="get-started">
          Get Started
          <span>→</span>
        </Link>

      </div>

    </nav>
  );
}