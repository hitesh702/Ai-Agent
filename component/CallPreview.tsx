export function CallPreview() {
  return (
    <div className="call-preview" aria-label="CallAI live call preview">
      <div className="call-preview-top">
        <div className="call-preview-brand">
          <span className="call-preview-dot" aria-hidden="true" />
          CallAI
        </div>
        <div className="call-preview-live">
          <span className="pulse" aria-hidden="true" />
          Live Call
        </div>
      </div>

      <div className="call-preview-agent">
        <div>
          <p className="call-preview-label">AI Agent</p>
          <h3>Admissions Assistant</h3>
        </div>
        <div className="waveform" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="call-preview-meta">
        <div>
          <p className="call-preview-label">Lead</p>
          <strong>Rahul Sharma</strong>
          <span>+91 98XXXXXX21</span>
        </div>
        <div>
          <p className="call-preview-label">Language</p>
          <strong>Hinglish</strong>
        </div>
        <div>
          <p className="call-preview-label">Duration</p>
          <strong className="call-preview-timer">02:34</strong>
        </div>
      </div>

      <div className="call-preview-chat">
        <div className="bubble bubble-ai">
          <span>AI Agent</span>
          <p>Namaste Rahul, aapne NEET course ke liye enquiry ki thi.</p>
        </div>
        <div className="bubble bubble-lead">
          <span>Customer</span>
          <p>Haan, mujhe fees aur batch timing ke baare mein jaana tha.</p>
        </div>
        <div className="bubble bubble-ai">
          <span>AI Agent</span>
          <p>Bilkul. Main aapko available batch options bata sakti hoon.</p>
        </div>
      </div>

      <ul className="call-preview-status">
        <li>
          <span className="ok">✓</span> Question Answered
        </li>
        <li>
          <span className="ok">✓</span> Lead Qualified
        </li>
        <li>
          <span className="next">→</span> Follow-up Scheduled
        </li>
      </ul>
    </div>
  );
}
