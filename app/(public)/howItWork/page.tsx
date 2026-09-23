import Link from "next/link";
import "./howItWork.css";

export default function HowItWorksPage() {
  return (
    <main className="how-page">

      {/* ================= HERO ================= */}
      <section className="how-hero">
        <div className="how-container">

          <div className="how-badge">
            HOW CALLAI WORKS
          </div>

          <h1>
            Turn Your Leads Into
            <span> Conversations.</span>
          </h1>

          <p>
            CallAI uses AI voice agents to call your leads, have natural
            conversations, answer questions, qualify customers and
            organize the results automatically.
          </p>

        </div>
      </section>


      {/* ================= INTRO ================= */}
      <section className="how-intro">
        <div className="how-container">

          <p className="section-label">
            SIMPLE. AUTOMATED. POWERFUL.
          </p>

          <h2>
            From your first lead to
            <span> qualified customer.</span>
          </h2>

          <p className="section-description">
            CallAI automates the complete customer conversation workflow,
            so your team can spend less time making repetitive calls and
            more time closing opportunities.
          </p>

        </div>
      </section>


      {/* ================= STEPS ================= */}
      <section className="steps-section">
        <div className="how-container">

          {/* STEP 01 */}
          <div className="how-step">

            <div className="step-content">

              <div className="step-number">
                01
              </div>

              <p className="step-label">
                ADD YOUR LEADS
              </p>

              <h3>
                Bring your leads
                <span> into CallAI.</span>
              </h3>

              <p>
                Add your customer leads with basic information such as
                name and phone number. Keep your leads organized in one
                place and make them ready for AI-powered conversations.
              </p>

              <div className="mini-lead-card">

                <div className="mini-avatar">
                  R
                </div>

                <div>
                  <strong>Rahul Sharma</strong>
                  <small>+91 98765 XXXXX</small>
                </div>

                <span className="lead-status">
                  New Lead
                </span>

              </div>

            </div>

            <div className="step-visual lead-visual">

              <div className="visual-title">
                <span>●</span>
                Leads
              </div>

              <div className="lead-row">
                <div className="avatar">R</div>

                <div>
                  <strong>Rahul Sharma</strong>
                  <small>NEET Course Enquiry</small>
                </div>

                <span className="blue-tag">
                  New
                </span>
              </div>

              <div className="lead-row">
                <div className="avatar">A</div>

                <div>
                  <strong>Amit Kumar</strong>
                  <small>Admission Enquiry</small>
                </div>

                <span className="blue-tag">
                  New
                </span>
              </div>

            </div>

          </div>


          {/* STEP 02 */}
          <div className="how-step reverse">

            <div className="step-content">

              <div className="step-number">
                02
              </div>

              <p className="step-label">
                CREATE YOUR AI AGENT
              </p>

              <h3>
                Build an AI agent
                <span> for your business.</span>
              </h3>

              <p>
                Configure your AI voice agent with your business
                information, conversation objective and preferred
                language.
              </p>

              <div className="agent-info">

                <div>
                  <small>AGENT</small>
                  <strong>Admissions Assistant</strong>
                </div>

                <div>
                  <small>LANGUAGE</small>
                  <strong>Hindi / Hinglish</strong>
                </div>

                <div>
                  <small>OBJECTIVE</small>
                  <strong>Qualify Leads</strong>
                </div>

              </div>

            </div>

            <div className="step-visual agent-visual">

              <div className="agent-header">
                <div className="agent-icon">
                  🎙️
                </div>

                <div>
                  <strong>Admissions Assistant</strong>
                  <small>AI Voice Agent</small>
                </div>

                <span className="online">
                  ● Active
                </span>
              </div>

              <div className="agent-line">
                <span>Language</span>
                <strong>Hindi / Hinglish</strong>
              </div>

              <div className="agent-line">
                <span>Goal</span>
                <strong>Lead Qualification</strong>
              </div>

            </div>

          </div>


          {/* STEP 03 */}
          <div className="how-step">

            <div className="step-content">

              <div className="step-number">
                03
              </div>

              <p className="step-label">
                AI VOICE CALL
              </p>

              <h3>
                Let AI have
                <span> the conversation.</span>
              </h3>

              <p>
                Your AI voice agent connects with leads and has natural
                conversations. It can answer questions, collect
                information and understand customer requirements.
              </p>

            </div>

            <div className="step-visual call-visual">

              <div className="call-header">

                <div className="call-agent">
                  <div className="call-icon">
                    🎙️
                  </div>

                  <div>
                    <strong>CallAI</strong>
                    <small>Admissions Assistant</small>
                  </div>
                </div>

                <span className="live">
                  ● Live Call
                </span>

              </div>


              <div className="conversation">

                <div className="message ai-message">
                  <small>AI AGENT</small>
                  <p>
                    Namaste Rahul, aapne NEET course ke liye enquiry ki thi.
                  </p>
                </div>

                <div className="message customer-message">
                  <small>CUSTOMER</small>
                  <p>
                    Haan, mujhe fees aur batch timing ke baare mein jaana tha.
                  </p>
                </div>

                <div className="message ai-message">
                  <small>AI AGENT</small>
                  <p>
                    Bilkul. Main aapko available batch options ke baare
                    mein bata sakti hoon.
                  </p>
                </div>

              </div>

            </div>

          </div>


          {/* STEP 04 */}
          <div className="how-step reverse">

            <div className="step-content">

              <div className="step-number">
                04
              </div>

              <p className="step-label">
                TRANSCRIPT
              </p>

              <h3>
                Every conversation
                <span> becomes a transcript.</span>
              </h3>

              <p>
                After the call, the complete conversation is available
                as a transcript, allowing your team to review exactly
                what was discussed.
              </p>

            </div>

            <div className="step-visual transcript-visual">

              <div className="transcript-header">
                <strong>Call Transcript</strong>

                <span>
                  02:34
                </span>
              </div>

              <div className="transcript-line">
                <b>AI:</b>
                <p>
                  Aapko kis batch ke baare mein information chahiye?
                </p>
              </div>

              <div className="transcript-line">
                <b>Rahul:</b>
                <p>
                  Mujhe weekend batch ke baare mein jaana hai.
                </p>
              </div>

              <div className="transcript-line">
                <b>AI:</b>
                <p>
                  Weekend batch Saturday aur Sunday available hai.
                </p>
              </div>

            </div>

          </div>


          {/* STEP 05 */}
          <div className="how-step">

            <div className="step-content">

              <div className="step-number">
                05
              </div>

              <p className="step-label">
                AI SUMMARY
              </p>

              <h3>
                Get an instant
                <span> AI summary.</span>
              </h3>

              <p>
                Instead of reading the complete conversation, CallAI
                creates a concise summary containing the important
                information from the call.
              </p>

            </div>

            <div className="step-visual summary-visual">

              <div className="summary-top">
                <div>
                  <small>AI CALL SUMMARY</small>
                  <h4>Rahul Sharma</h4>
                  <p>NEET 2027 Enquiry</p>
                </div>

                <span className="interested">
                  ● INTERESTED
                </span>
              </div>

              <div className="summary-grid">

                <div>
                  <small>Requirement</small>
                  <strong>Weekend Batch</strong>
                </div>

                <div>
                  <small>Follow-up</small>
                  <strong>Saturday 5 PM</strong>
                </div>

                <div>
                  <small>Duration</small>
                  <strong>02:34</strong>
                </div>

              </div>

            </div>

          </div>


          {/* STEP 06 */}
          <div className="how-step reverse">

            <div className="step-content">

              <div className="step-number">
                06
              </div>

              <p className="step-label">
                LEAD CLASSIFICATION
              </p>

              <h3>
                Know which leads
                <span> need attention.</span>
              </h3>

              <p>
                Organize leads based on the conversation, such as
                interested, not interested or requiring a follow-up.
              </p>

            </div>

            <div className="step-visual status-visual">

              <div className="status-card">

                <div className="status-icon green">
                  ✓
                </div>

                <div>
                  <strong>Interested</strong>
                  <small>Rahul Sharma</small>
                </div>

                <span>Lead</span>

              </div>


              <div className="status-card">

                <div className="status-icon yellow">
                  →
                </div>

                <div>
                  <strong>Follow-up</strong>
                  <small>Amit Kumar</small>
                </div>

                <span>Lead</span>

              </div>


              <div className="status-card">

                <div className="status-icon gray">
                  —
                </div>

                <div>
                  <strong>Not Interested</strong>
                  <small>Priya Singh</small>
                </div>

                <span>Lead</span>

              </div>

            </div>

          </div>

        </div>
      </section>


      {/* ================= COMPLETE FLOW ================= */}
      <section className="complete-flow">
        <div className="how-container">

          <p className="section-label">
            THE COMPLETE WORKFLOW
          </p>

          <h2>
            One conversation.
            <span> Complete workflow.</span>
          </h2>

          <p className="section-description">
            Everything your team needs to turn customer conversations
            into actionable information.
          </p>


          <div className="flow-box">

            <div className="flow-item">
              <div>👥</div>
              <strong>Lead</strong>
            </div>

            <span className="flow-arrow">→</span>

            <div className="flow-item">
              <div>🤖</div>
              <strong>AI Agent</strong>
            </div>

            <span className="flow-arrow">→</span>

            <div className="flow-item">
              <div>📞</div>
              <strong>Voice Call</strong>
            </div>

            <span className="flow-arrow">→</span>

            <div className="flow-item">
              <div>📝</div>
              <strong>Transcript</strong>
            </div>

            <span className="flow-arrow">→</span>

            <div className="flow-item">
              <div>✨</div>
              <strong>AI Summary</strong>
            </div>

            <span className="flow-arrow">→</span>

            <div className="flow-item">
              <div>🎯</div>
              <strong>Lead Status</strong>
            </div>

          </div>

        </div>
      </section>


      {/* ================= CTA ================= */}
      <section className="how-cta">

        <div className="how-container">

          <div className="cta-box">

            <p className="section-label">
              GET STARTED
            </p>

            <h2>
              Ready to automate
              <span> your conversations?</span>
            </h2>

            <p>
              Build your AI voice agent and start turning leads into
              meaningful conversations.
            </p>

            <div className="cta-buttons">

              <Link href="/register" className="primary-btn">
                Get Started
              </Link>

              <Link href="/" className="secondary-btn">
                Back to Home
              </Link>

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}