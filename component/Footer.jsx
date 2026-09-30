import Link from "next/link";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer-container">

      {/* CTA */}
      <div className="footer-cta">
        <span className="footer-badge">Unlock Power</span>

        <h1>
          Ready to Turn Complexity
          <br />
          into <span>Clarity?</span>
        </h1>

        <div className="footer-buttons">
          <Link href="/signup" className="btn-primary">
            Start Now
          </Link>

          <Link href="/contact" className="btn-secondary">
            Book a Demo
          </Link>
        </div>
      </div>

      {/* Footer Links */}
      <div className="footer-row">

        {/* Brand */}
        <div className="col-4 footer-brand">
          <Link href="/" className="footer-logo">
            <span className="logo-icon">C</span>
            <span>CallAI</span>
          </Link>

          <p>
            AI voice calling agents that help businesses
            connect with leads, qualify enquiries and
            manage follow-ups.
          </p>

          <div className="footer-contact">
            <span>Jaipur, India</span>
            <span>support@callai.com</span>
          </div>
        </div>

        {/* Product */}
        <div className="col-2 footer-column">
          <h3>Product</h3>

          <Link href="/#pricing">Pricing</Link>
          <Link href="/#features">Features</Link>
          <Link href="/#how-it-works">How It Works</Link>
          <Link href="/#faq">FAQ</Link>
        </div>

        {/* Resources */}
        <div className="col-2 footer-column">
          <h3>Resources</h3>

          <Link href="/contact">Support</Link>
          <Link href="/contact">Contact Us</Link>
          <Link href="/#industries">Use Cases</Link>
        </div>

        {/* Features */}
        <div className="col-2 footer-column">
          <h3>Solutions</h3>

          <Link href="/#industries">Coaching</Link>
          <Link href="/#industries">Real Estate</Link>
          <Link href="/#industries">Clinics</Link>
          <Link href="/#industries">Automobile</Link>
        </div>

        {/* Company */}
        <div className="col-2 footer-column">
          <h3>Company</h3>

          <Link href="/contact">About Us</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup">Get Started</Link>
        </div>

      </div>

      {/* Bottom */}
      <div className="footer-bottom">

        <p>
          © {new Date().getFullYear()} CallAI. All rights reserved.
        </p>

        <div className="footer-legal">
          <Link href="/terms">Terms of Service</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </div>

      </div>

    </footer>
  );
}