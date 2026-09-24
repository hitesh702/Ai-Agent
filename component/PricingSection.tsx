import Link from "next/link";

const PLANS = [
  {
    name: "STARTER",
    title: "For small teams",
    description:
      "Start automating your first customer conversations.",
    button: "Get Started",
    featured: false,
  },
  {
    name: "GROWTH",
    title: "For growing businesses",
    description:
      "More conversations, leads and follow-up workflows.",
    button: "Get Started",
    featured: true,
  },
  {
    name: "BUSINESS",
    title: "For higher call volume",
    description:
      "Custom workflows and higher usage for established businesses.",
    button: "Talk to Us",
    featured: false,
  },
];

export default function PricingSection() {
  return (
    <section
      className="pricing"
      id="pricing"
    >
      <div className="section-shell">
        <div className="section-heading">
          <p className="section-eyebrow">
            SIMPLE PLANS
          </p>

          <h2>
            Start small. Scale your conversations.
          </h2>

          <p>
            Final pricing will be based on actual voice,
            telephony, AI and infrastructure costs.
          </p>
        </div>

        <div className="pricing-grid">
          {PLANS.map((plan) => (
            <article
              className={`pricing-card ${
                plan.featured
                  ? "pricing-featured"
                  : ""
              }`}
              key={plan.name}
            >
              {plan.featured && (
                <span className="pricing-badge">
                  GROWING TEAMS
                </span>
              )}

              <p className="pricing-label">
                {plan.name}
              </p>

              <h3>
                {plan.title}
              </h3>

              <p>
                {plan.description}
              </p>

              <Link
                href="/register"
                className="pricing-button"
              >
                {plan.button}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
