"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import "./Navbar.css";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#solutions", label: "Solutions" },
  { href: "/howItWork", label: "How It Works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
];

function MicIcon() {
  return (
    <svg
      className="nav-mic"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 17.5V21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8.5 21h7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={`site-nav${open ? " is-open" : ""}`}>
      <div className="site-nav-inner">
        <Link href="/" className="site-logo" onClick={() => setOpen(false)}>
          <span className="site-logo-mark" aria-hidden="true">
            <MicIcon />
          </span>
          <span className="site-logo-text">CallAI</span>
        </Link>

        <nav className="site-nav-links" aria-label="Primary">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="site-nav-actions">
          <Link href="/login" className="site-nav-login">
            Login
          </Link>
          <Link href="/register" className="site-nav-cta">
            Get Started
          </Link>

          <button
            type="button"
            className="site-nav-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <div className="site-nav-mobile" hidden={!open}>
        <nav aria-label="Mobile">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="site-nav-mobile-actions">
          <Link href="/login" onClick={() => setOpen(false)}>
            Login
          </Link>
          <Link
            href="/register"
            className="site-nav-cta"
            onClick={() => setOpen(false)}
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
