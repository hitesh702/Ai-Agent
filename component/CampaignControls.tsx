"use client";

import { useState, useTransition } from "react";
import {
  pauseCampaignAction,
  startCampaignAction,
} from "@/lib/campaigns/actions";

export function CampaignControls({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="dash-panel-actions">
      {status !== "ACTIVE" ? (
        <button
          type="button"
          className="primary-btn"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await startCampaignAction(campaignId);
              if (res.error) setError(res.error);
            });
          }}
        >
          {pending ? "Updating…" : "Start campaign"}
        </button>
      ) : null}
      {status === "ACTIVE" ? (
        <button
          type="button"
          className="primary-btn"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await pauseCampaignAction(campaignId);
              if (res.error) setError(res.error);
            });
          }}
        >
          {pending ? "Updating…" : "Pause campaign"}
        </button>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
