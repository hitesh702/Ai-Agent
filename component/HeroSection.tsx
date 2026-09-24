import Link from "next/link";
import { CallPreview } from "@/component/CallPreview";

export default function HeroSection() {
  return (
    <section className="hero" id="product">
      <div className="hero-shell">
        <div className="hero-copy">
          <p className="hero-badge">
            AI VOICE AGENTS FOR BUSINESSES
          </p>

          <h1>
            Turn Your Leads Into{" "}
            <span className="hero-accent">
              Conversations.
            </span>
          </h1>

          <p className="hero-lead">
            CallAI uses AI voice agents to call, qualify and
            follow up with your leads — in Hindi, Hinglish and
            English.
          </p>

          <div className="hero-actions">
            <Link
              href="/register"
              className="btn-primary"
            >
              Start Building
            </Link>

            <a
              href="#how-it-works"
              className="btn-secondary"
            >
              See How It Works
            </a>
          </div>

          <div className="hero-trust ">
            <span>✓ Hindi</span>
            <span>✓ Hinglish</span>
            <span>✓ English</span>
            <span>✓ AI Qualification</span>
          </div>

          <p className="hero-footnote">
            Built for coaching institutes, clinics, real estate,
            dealerships and modern businesses.
          </p>
        </div>

        <div className="hero-visual">
          <CallPreview />
        </div>
      </div>
    </section>
  );
}
