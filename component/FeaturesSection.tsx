const FEATURES = [
  {
    icon: "◉",
    title: "AI Voice Calls",
    description:
      "Your AI agent can call leads and have natural conversations instead of sending generic automated messages.",
  },
  {
    icon: "Aa",
    title: "Hindi + Hinglish + English",
    description:
      "Designed for the way Indian customers actually communicate.",
  },
  {
    icon: "✓",
    title: "Lead Qualification",
    description:
      "Identify interested, not interested and follow-up leads automatically.",
  },
  {
    icon: "≡",
    title: "Call Transcripts",
    description:
      "Review what happened during a conversation without relying on memory.",
  },
  {
    icon: "✦",
    title: "AI Summaries",
    description:
      "Get concise summaries and important customer requirements after every call.",
  },
  {
    icon: "↻",
    title: "Follow-ups",
    description:
      "Keep track of leads that need another conversation at a later time.",
  },
];

export default function FeaturesSection() {
  return (
    <section
      className="features"
      id="features"
    >
      <div className="section-shell">
        <div className="section-heading">
          <p className="section-eyebrow">
            BUILT FOR CONVERSATIONS
          </p>

          <h2>
            Everything you need to turn calls into useful lead data.
          </h2>

          <p>
            Start with the essentials and grow your calling
            workflow as your business grows.
          </p>
        </div>

        <div className="features-grid">
          {FEATURES.map((feature) => (
            <article
              className="feature-card"
              key={feature.title}
            >
              <div className="feature-icon">
                {feature.icon}
              </div>

              <h3>
                {feature.title}
              </h3>

              <p>
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
