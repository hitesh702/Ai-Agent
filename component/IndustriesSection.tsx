const INDUSTRIES = [
  {
    icon: "🎓",
    name: "Coaching Institutes",
    description:
      "Follow up with student enquiries and qualify admissions.",
  },
  {
    icon: "🏥",
    name: "Clinics",
    description:
      "Handle appointment enquiries and customer follow-ups.",
  },
  {
    icon: "🏠",
    name: "Real Estate",
    description:
      "Connect with property enquiries and qualify buyers.",
  },
  {
    icon: "🚗",
    name: "Automobile",
    description:
      "Follow up with vehicle enquiries and test-drive leads.",
  },
  {
    icon: "✂️",
    name: "Salons",
    description:
      "Handle appointment enquiries and customer callbacks.",
  },
  {
    icon: "🏫",
    name: "Education",
    description:
      "Engage students and parents with timely follow-ups.",
  },
];

export default function IndustriesSection() {
  return (
    <section
      className="industries"
      id="solutions"
    >
      <div className="section-shell">
        <div className="section-heading">
          <p className="section-eyebrow">
            INDUSTRIES
          </p>

          <h2>
            Built for businesses that run on conversations.
          </h2>

          <p>
            Start with coaching institutes and expand into
            other conversation-driven businesses.
          </p>
        </div>

        <div className="industry-grid">
          {INDUSTRIES.map((industry) => (
            <article
              className="industry-card"
              key={industry.name}
            >
              <div className="industry-icon">
                {industry.icon}
              </div>

              <h3>
                {industry.name}
              </h3>

              <p>
                {industry.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
