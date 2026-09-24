export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: "+",
      title: "Add Your Leads",
      description:
        "Add a lead manually or import your existing customer list.",
    },
    {
      number: "02",
      icon: "◉",
      title: "AI Makes the Call",
      description:
        "Your AI voice agent calls the lead and has a natural conversation.",
    },
    {
      number: "03",
      icon: "✓",
      title: "Get Qualified Leads",
      description:
        "See the conversation summary, lead status and follow-up requirements.",
    },
  ];

  return (
    <section
      className="how-it-works"
      id="how-it-works"
    >
      <div className="section-shell">
        <div className="section-heading">
          <p className="section-eyebrow">
            HOW IT WORKS
          </p>

          <h2>
            From enquiry to qualified lead in three simple steps.
          </h2>

          <p>
            CallAI handles the first conversation so your team
            can focus on the leads that actually need attention.
          </p>
        </div>

        <div className="steps-grid">
          {steps.map((step) => (
            <article
              className="step-card"
              key={step.number}
            >
              <span className="step-number">
                {step.number}
              </span>

              <div className="step-icon">
                {step.icon}
              </div>

              <h3>
                {step.title}
              </h3>

              <p>
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

