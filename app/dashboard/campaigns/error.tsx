"use client";

import { useEffect } from "react";
import "./campaigns.css";

export default function CampaignsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[campaigns] page failed to load", error.digest ?? error.message);
  }, [error]);

  return (
    <section className="dash-panel">
      <h2>Could not load campaigns</h2>
      <p className="campaign-muted">
        Something went wrong while loading this page. No calls were started or changed.
      </p>
      <div className="dash-panel-actions">
        <button type="button" className="primary-btn" onClick={() => retry()}>
          Try again
        </button>
      </div>
    </section>
  );
}
