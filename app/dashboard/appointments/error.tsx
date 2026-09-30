"use client";

import { useEffect } from "react";
import "../campaigns/campaigns.css";

export default function AppointmentsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[appointments] page failed to load", error.digest ?? error.message);
  }, [error]);

  return (
    <section className="dash-panel">
      <h2>Could not load appointments</h2>
      <p className="campaign-muted">
        Something went wrong while loading this page. No appointments were changed.
      </p>
      <div className="dash-panel-actions">
        <button type="button" className="primary-btn" onClick={() => retry()}>
          Try again
        </button>
      </div>
    </section>
  );
}
