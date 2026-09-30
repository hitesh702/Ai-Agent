import "../campaigns/campaigns.css";

export default function AppointmentsLoading() {
  return (
    <section className="dash-panel" aria-busy="true">
      <p className="campaign-muted">Loading appointments…</p>
      <div className="campaign-skeleton" />
      <div className="campaign-skeleton" />
      <div className="campaign-skeleton" />
    </section>
  );
}
