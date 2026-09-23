import Link from "next/link";
import { CallPreview } from "@/component/CallPreview";
import "../landing.css";

const INDUSTRIES = [
  "Coaching Institutes",
  "Clinics",
  "Real Estate",
  "Automobile",
  "Salons",
  "Education",
];

export default function Home() {
  return (
    <>
      <main className="landing">
        <section className="hero" id="product">
          <div className="hero-shell">
            <div className="hero-copy">
              <p className="hero-badge">AI VOICE AGENTS FOR BUSINESSES</p>

              <h1>
                Turn Your Leads Into{" "}
                <span className="hero-accent">Conversations.</span>
              </h1>

              <p className="hero-lead">
                CallAI uses AI voice agents to call, qualify and follow up with
                your leads — in Hindi, Hinglish and English.
              </p>

              <div className="hero-actions">
                <Link href="/register" className="btn-primary">
                  Start Building
                </Link>
                <a href="#how-it-works" className="btn-secondary">
                  Book a Demo
                </a>
              </div>

              <p className="hero-footnote">
                Built for coaching institutes, clinics, real estate, dealerships
                and modern businesses.
              </p>
            </div>

            <div className="hero-visual">
              <CallPreview />
            </div>
          </div>
        </section>

        <section className="industries" id="solutions">
          <div className="section-shell">
            <h2>Built for businesses that run on conversations.</h2>
            <ul className="industry-list">
              {INDUSTRIES.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Later landing sections (Problem, Features, Pricing, etc.)
            will be added when the remaining brief is provided. */}
        <div id="how-it-works" className="landing-anchor" aria-hidden="true" />
        <div id="features" className="landing-anchor" aria-hidden="true" />
        <div id="pricing" className="landing-anchor" aria-hidden="true" />

        <footer className="landing-footer">
          <div className="section-shell footer-row">
            <div className="footer-brand">
              <strong>CallAI</strong>
              <span>AI Voice Calling Agent for Businesses</span>
            </div>
            <p>© 2026 CallAI. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </>
  );
}
