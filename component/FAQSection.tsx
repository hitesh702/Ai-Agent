const FAQS = [
  {
    question: "Can CallAI speak Hindi and Hinglish?",
    answer:
      "Yes. The initial product is designed around Hindi, Hinglish and English conversations.",
  },
  {
    question: "Can I provide my own business information?",
    answer:
      "Yes. Businesses will be able to provide approved information such as courses, fees, timings, FAQs and policies.",
  },
  {
    question: "Can I upload my existing leads?",
    answer:
      "Yes. CSV lead import will allow businesses to bring their existing leads into CallAI.",
  },
  {
    question: "Can I see what happened during a call?",
    answer:
      "Yes. Completed calls can include status, duration, transcript, AI summary and lead classification.",
  },
  {
    question: "Will the AI make up information?",
    answer:
      "The agent is designed to use approved business information and should escalate questions when the required information is unavailable.",
  },
  {
    question: "Can customers ask the AI to stop calling?",
    answer:
      "Yes. Customer refusal and opt-out requests should be respected by the calling system.",
  },
];

export default function FAQSection() {
  return (
    <section className="faq">
      <div className="section-shell faq-shell">
        <div className="section-heading">
          <p className="section-eyebrow">
            FAQ
          </p>

          <h2>
            Questions about CallAI?
          </h2>
        </div>

        <div className="faq-list">
          {FAQS.map((faq) => (
            <details
              className="faq-item"
              key={faq.question}
            >
              <summary>
                <span>
                  {faq.question}
                </span>

                <span className="faq-plus">
                  +
                </span>
              </summary>

              <p>
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
