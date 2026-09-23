import "./Hero.css";

function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <p className="hero-badge">AI VOICE AGENTS FOR BUSINESSES</p>
        <h1>
          Turn Your Leads Into <span>Conversations.</span>
        </h1>
        <p>
          CallAI uses AI voice agents to call, qualify and follow up with your
          leads — in Hindi, Hinglish and English.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#how-it-works">
            How It Works
          </a>
          <a className="btn btn-secondary" href="#pricing">
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

export default Hero;
