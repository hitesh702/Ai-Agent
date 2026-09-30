"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markCampaignReadyAction,
  pauseCampaignAction,
  resumeCampaignAction,
  startCampaignAction,
  type FormState,
} from "@/lib/campaigns/actions";

export type CampaignSummary = {
  name: string;
  agentName: string;
  leadCount: number;
  schedule: string;
  maxAttempts: number;
};

type Dialog = "start" | "pause" | "resume" | null;

const DIALOG_TEXT: Record<Exclude<Dialog, null>, { title: string; body: string; confirm: string }> = {
  start: {
    title: "Are you sure you want to start this campaign?",
    body: "Calls are placed a few at a time, only inside the calling schedule.",
    confirm: "Start Campaign",
  },
  pause: {
    title: "Pause this campaign?",
    body: "Calls already in progress will finish normally. No new calls will start until you resume.",
    confirm: "Pause",
  },
  resume: {
    title: "Resume this campaign?",
    body: "Opt-outs, attempts and the schedule are checked again. Attempts already made are kept.",
    confirm: "Resume",
  },
};

export function CampaignControls({
  campaignId,
  status,
  eligibleCount,
  readinessErrors,
  summary,
}: {
  campaignId: string;
  status: string;
  eligibleCount: number;
  readinessErrors: string[];
  summary: CampaignSummary;
}) {
  const router = useRouter();
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (status !== "RUNNING") return;
    const t = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(t);
  }, [status, router]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setDialog(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog, pending]);

  const run = (fn: () => Promise<FormState>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      setDialog(null);
      if (res.error) setError(res.error);
      else if (res.message) setToast(res.message);
    });
  };

  const confirmDialog = () => {
    if (dialog === "start") run(() => startCampaignAction(campaignId, true));
    if (dialog === "pause") run(() => pauseCampaignAction(campaignId));
    if (dialog === "resume") run(() => resumeCampaignAction(campaignId));
  };

  const blocked = readinessErrors.length > 0;
  const canStart = status === "READY" || status === "FAILED";

  return (
    <div>
      {blocked && (status === "DRAFT" || canStart) ? (
        <ul className="form-error campaign-errors">
          {readinessErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      <div className="dash-panel-actions">
        {status === "DRAFT" ? (
          <button
            type="button"
            className="primary-btn"
            disabled={pending || blocked}
            onClick={() => run(() => markCampaignReadyAction(campaignId))}
          >
            {pending ? "Checking…" : "Mark ready"}
          </button>
        ) : null}
        {canStart ? (
          <button
            type="button"
            className="primary-btn"
            disabled={pending || blocked}
            onClick={() => setDialog("start")}
          >
            {status === "FAILED" ? "Start Campaign again" : "Start Campaign"}
          </button>
        ) : null}
        {status === "RUNNING" ? (
          <button
            type="button"
            className="primary-btn campaign-btn-secondary"
            disabled={pending}
            onClick={() => setDialog("pause")}
          >
            Pause
          </button>
        ) : null}
        {status === "PAUSED" ? (
          <button
            type="button"
            className="primary-btn"
            disabled={pending}
            onClick={() => setDialog("resume")}
          >
            Resume
          </button>
        ) : null}
      </div>
      {status === "DRAFT" && !blocked ? (
        <p className="agent-form-note">Marking ready does not start any calls.</p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}

      {dialog ? (
        <div className="campaign-dialog-root">
          <button
            type="button"
            className="campaign-dialog-backdrop"
            aria-label="Close"
            onClick={() => {
              if (!pending) setDialog(null);
            }}
          />
          <div className="campaign-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <h3 id={titleId}>{DIALOG_TEXT[dialog].title}</h3>
            {dialog !== "pause" ? (
              <dl className="campaign-dialog-facts">
                <dt>Campaign</dt>
                <dd>{summary.name}</dd>
                <dt>Leads</dt>
                <dd>
                  {summary.leadCount} ({eligibleCount} eligible to call)
                </dd>
                <dt>Agent</dt>
                <dd>{summary.agentName}</dd>
                <dt>Schedule</dt>
                <dd>{summary.schedule}</dd>
                <dt>Maximum attempts</dt>
                <dd>{summary.maxAttempts} per lead</dd>
              </dl>
            ) : null}
            <p>{DIALOG_TEXT[dialog].body}</p>
            <div className="campaign-dialog-actions">
              <button
                type="button"
                className="agent-cancel"
                disabled={pending}
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={pending}
                autoFocus
                onClick={confirmDialog}
              >
                {pending ? "Working…" : DIALOG_TEXT[dialog].confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="campaign-toast" role="status">
          {toast}
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
