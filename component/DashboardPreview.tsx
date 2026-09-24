export default function DashboardPreview() {
  return (
    <section className="dashboard-preview">
      <div className="section-shell">
        <div className="section-heading">
          <p className="section-eyebrow">
            ONE PLACE FOR YOUR CALLS
          </p>

          <h2>
            See what happened after every conversation.
          </h2>

          <p>
            Your dashboard brings calls, leads, summaries and
            follow-ups together.
          </p>
        </div>

        <div className="dashboard-mockup">
          <div className="mockup-topbar">
            <strong>
              CallAI Dashboard
            </strong>

            <span>
              Today
            </span>
          </div>

          <div className="mockup-stats">
            <div className="mockup-stat">
              <span>Total Leads</span>
              <strong>248</strong>
            </div>

            <div className="mockup-stat">
              <span>Calls Today</span>
              <strong>86</strong>
            </div>

            <div className="mockup-stat">
              <span>Interested</span>
              <strong>24</strong>
            </div>

            <div className="mockup-stat">
              <span>Follow-ups</span>
              <strong>17</strong>
            </div>
          </div>

          <div className="mockup-table">
            <div className="mockup-row mockup-heading">
              <span>Customer</span>
              <span>Call Status</span>
              <span>Lead Status</span>
              <span>Duration</span>
            </div>

            <div className="mockup-row">
              <span>Rahul Sharma</span>
              <span className="status-success">
                Completed
              </span>
              <span className="status-success">
                Interested
              </span>
              <span>04:32</span>
            </div>

            <div className="mockup-row">
              <span>Aman Gupta</span>
              <span className="status-success">
                Completed
              </span>
              <span className="status-warning">
                Follow-up
              </span>
              <span>03:18</span>
            </div>

            <div className="mockup-row">
              <span>Priya Singh</span>
              <span className="status-success">
                Completed
              </span>
              <span className="status-muted">
                Not Interested
              </span>
              <span>02:41</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
