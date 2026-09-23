import "./HowItWork.css";

const STEPS = [
  {
    title: "Add Your Leads",
    text: "Upload or enter leads with name and phone number.",
  },
  {
    title: "Create Your AI Agent",
    text: "Set language, goal, and business details for your agent.",
  },
  {
    title: "AI Voice Call",
    text: "The agent calls leads and has natural conversations.",
  },
  {
    title: "Transcript & Summary",
    text: "Get a full transcript plus a short AI summary after each call.",
  },
];

function HowItWork() {
  return (
    <section className="section how-it-work" id="how-it-works">
      <div className="container">
        <h2>How It Works</h2>
        <p>A simple flow from lead to qualified conversation.</p>

        <div className="how-grid">
          {STEPS.map((step, index) => (
            <article key={step.title} className="how-card">
              <span>0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWork;
