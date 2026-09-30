import "./campaigns.css";

export default function CampaignsLoading() {
  return (
    <section className="dash-panel" aria-busy="true">
      <p className="campaign-muted">Loading campaigns…</p>
      <div className="campaign-skeleton" />
      <div className="campaign-skeleton" />
      <div className="campaign-skeleton" />
    </section>
  );
}
