import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="final-cta">
      <div className="section-shell">
        <div className="final-cta-card">
          <p className="section-eyebrow">
            START WITH YOUR FIRST AI AGENT
          </p>

          <h2>
            Ready to turn your leads into conversations?
          </h2>

          <p>
            Build your first AI voice agent and start
            experimenting with real customer conversations.
          </p>

          <div className="final-cta-actions">
            <Link
              href="/register"
              className="btn-primary"
            >
              Start Building
            </Link>

            <Link
              href="/login"
              className="btn-secondary"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
