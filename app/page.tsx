import Link from "next/link";
import Navbar from "@/component/Navbar";
export default function Home() {
  return (
    <>
      <Navbar />

      <main className="callai-home">

        {/* Hero Section */}
        <section className="hero">

          <div className="hero-content">

            <div className="badge">
              🤖 AI Voice Calling for Businesses
            </div>

            <h1>
              Your AI Agent.
              <br />
              <span>Making Calls For You.</span>
            </h1>

            <p>
              CallAI automatically calls your leads, talks naturally,
              answers questions, qualifies customers and schedules
              follow-ups — 24/7.
            </p>

            <div className="hero-buttons">

              <Link href="/register" className="primary-btn">
                Start Free
              </Link>

              <Link href="/dashboard" className="secondary-btn">
                View Dashboard →
              </Link>

            </div>

            <div className="trust">
              <span>✓ No coding required</span>
              <span>✓ AI-powered conversations</span>
              <span>✓ Hindi + English + Hinglish</span>
            </div>

          </div>


          {/* Hero Dashboard Preview */}
          <div className="hero-card">

            <div className="card-header">

              <div>
                <small>AI AGENT</small>
                <h3>Admissions Assistant</h3>
              </div>

              <div className="online">
                ● Online
              </div>

            </div>


            <div className="call-box">

              <div className="call-avatar">
                AI
              </div>

              <div>
                <strong>Calling Lead...</strong>
                <p>+91 98765 43210</p>
              </div>

            </div>


            <div className="conversation">

              <div className="message ai-message">
                Hello! I'm calling from ABC Institute.
                Are you interested in our courses?
              </div>

              <div className="message user-message">
                Yes, I want to know about the fees.
              </div>

              <div className="message ai-message">
                Sure! I can help you with that.
              </div>

            </div>


            <div className="call-status">
              <span>●</span>
              Call in progress
              <strong>02:34</strong>
            </div>

          </div>

        </section>


        {/* Stats */}
        <section className="stats">

          <div>
            <h2>10K+</h2>
            <p>Calls Automated</p>
          </div>

          <div>
            <h2>24/7</h2>
            <p>AI Availability</p>
          </div>

          <div>
            <h2>3+</h2>
            <p>Languages</p>
          </div>

          <div>
            <h2>80%</h2>
            <p>Less Manual Work</p>
          </div>

        </section>


        {/* Features */}
        <section id="features" className="features">

          <div className="section-heading">

            <span>FEATURES</span>

            <h2>
              Everything you need to
              <br />
              automate your calls.
            </h2>

            <p>
              Let AI handle repetitive conversations while your team
              focuses on customers who are ready to buy.
            </p>

          </div>


          <div className="feature-grid">

            <div className="feature-card">
              <div className="feature-icon">📞</div>

              <h3>AI Voice Calls</h3>

              <p>
                Automatically call your leads and have natural
                conversations with them.
              </p>
            </div>


            <div className="feature-card">
              <div className="feature-icon">🧠</div>

              <h3>Business Knowledge</h3>

              <p>
                Train your AI agent using your business information,
                FAQs and documents.
              </p>
            </div>


            <div className="feature-card">
              <div className="feature-icon">🎯</div>

              <h3>Lead Qualification</h3>

              <p>
                Automatically identify interested, follow-up and
                not-interested leads.
              </p>
            </div>


            <div className="feature-card">
              <div className="feature-icon">📊</div>

              <h3>Analytics</h3>

              <p>
                Track calls, conversations, leads and AI performance
                from one dashboard.
              </p>
            </div>

          </div>

        </section>


        {/* How It Works */}
        <section id="how-it-works" className="how-section">

          <div className="section-heading">

            <span>HOW IT WORKS</span>

            <h2>
              From lead to conversation
              <br />
              in three simple steps.
            </h2>

          </div>


          <div className="steps">

            <div className="step">

              <div className="step-number">
                01
              </div>

              <h3>Upload Leads</h3>

              <p>
                Upload your leads using CSV or add them manually.
              </p>

            </div>


            <div className="step">

              <div className="step-number">
                02
              </div>

              <h3>AI Makes Calls</h3>

              <p>
                Your AI agent calls leads and talks naturally.
              </p>

            </div>


            <div className="step">

              <div className="step-number">
                03
              </div>

              <h3>Get Results</h3>

              <p>
                See transcripts, summaries, lead status and follow-ups.
              </p>

            </div>

          </div>

        </section>


        {/* CTA */}
        <section className="cta">

          <h2>
            Start automating your
            <br />
            business calls today.
          </h2>

          <p>
            Let CallAI handle your repetitive calls while you focus
            on growing your business.
          </p>

          <Link href="/register" className="primary-btn">
            Create Your Account →
          </Link>

        </section>


        {/* Footer */}
        <footer>

          <div className="footer-logo">

            <div className="logo-icon">
              C
            </div>

            <strong>CallAI</strong>

          </div>

          <p>
            AI-powered voice calling for modern businesses.
          </p>

          <span>
            © 2026 CallAI. All rights reserved.
          </span>

        </footer>

      </main>
    </>
  );
}