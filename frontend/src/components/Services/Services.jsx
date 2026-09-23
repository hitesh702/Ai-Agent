import "./Services.css";

const SERVICES = [
  "AI outbound calling",
  "Lead qualification",
  "Call transcripts",
  "AI call summaries",
  "Follow-up scheduling",
];

function Services() {
  return (
    <section className="section services" id="services">
      <div className="container">
        <h2>Services</h2>
        <p>What CallAI helps your business do every day.</p>

        <ul className="services-list">
          {SERVICES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Services;
