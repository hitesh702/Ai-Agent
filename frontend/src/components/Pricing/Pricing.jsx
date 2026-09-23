import "./Pricing.css";

const PLANS = [
  {
    name: "Starter",
    price: "₹999/mo",
    detail: "For small teams getting started with AI calls.",
  },
  {
    name: "Growth",
    price: "₹2,499/mo",
    detail: "For growing businesses with more leads and agents.",
  },
  {
    name: "Business",
    price: "Custom",
    detail: "For larger teams that need higher volume and support.",
  },
];

function Pricing() {
  return (
    <section className="section pricing" id="pricing">
      <div className="container">
        <h2>Pricing</h2>
        <p>Simple plans. Start small and scale when you are ready.</p>

        <div className="pricing-grid">
          {PLANS.map((plan) => (
            <article key={plan.name} className="pricing-card">
              <h3>{plan.name}</h3>
              <p className="price">{plan.price}</p>
              <p>{plan.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Pricing;
