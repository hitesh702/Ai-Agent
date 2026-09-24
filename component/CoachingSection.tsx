import Link from "next/link";

export default function CoachingSection() {
  const flow = [
    {
      number: "01",
      title: "New enquiry",
      description: "Student submits an enquiry",
    },
    {
      number: "02",
      title: "AI calls",
      description: "Agent starts the conversation",
    },
    {
      number: "03",
      title: "Qualifies",
      description: "Understands course requirement",
    },
    {
      number: "04",
      title: "Follow-up",
      description: "Human team handles qualified leads",
    },
  ];

  return (
    <section className="coaching-section">
      <div className="section-shell coaching-shell">
        <div className="coaching-copy">
          <p className="section-eyebrow">
            START WITH COACHING INSTITUTES
          </p>

          <h2>
            Turn student enquiries into real conversations.
          </h2>

          <p>
            CallAI can help coaching institutes follow up with
            enquiries, understand what students are looking for
            and identify leads that need human attention.
          </p>

          <Link
            href="/register"
            className="btn-primary"
          >
            Build Your AI Agent
          </Link>
        </div>

        <div className="coaching-flow">
          {flow.map((item, index) => (
            <div
              className="coaching-flow-group"
              key={item.number}
            >
              <div className="flow-item">
                <span>{item.number}</span>

                <strong>
                  {item.title}
                </strong>

                <small>
                  {item.description}
                </small>
              </div>

              {index < flow.length - 1 && (
                <div className="flow-line" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
