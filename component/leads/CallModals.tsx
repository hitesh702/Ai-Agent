"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import type { CallHistoryItem, LeadRecord } from "./types";
import { CallHistory } from "./CallHistory";
import { getDemoCallHistory } from "./mappers";

type Props = {
  open: boolean;
  lead: LeadRecord | null;
  onClose: () => void;
};

export function CallHistoryDrawer({ open, lead, onClose }: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !lead) return null;

  const items: CallHistoryItem[] =
    lead.callHistory.length > 0
      ? lead.callHistory
      : getDemoCallHistory(lead.name);

  return (
    <div className="lm-drawer-root" role="presentation">
      <button
        type="button"
        className="lm-drawer-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <aside
        className="lm-drawer lm-drawer--sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="lm-drawer__header">
          <div>
            <p className="lm-eyebrow">Call history</p>
            <h2 id={titleId}>{lead.name}</h2>
          </div>
          <button type="button" className="lm-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="lm-drawer__body">
          <CallHistory
            items={items}
            usingDemo={lead.callHistory.length === 0}
          />
        </div>
      </aside>
    </div>
  );
}

type AiProps = {
  open: boolean;
  lead: LeadRecord | null;
  onClose: () => void;
  summaryNode: ReactNode;
};

export function AISummaryDrawer({ open, lead, onClose, summaryNode }: AiProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !lead) return null;

  return (
    <div className="lm-drawer-root" role="presentation">
      <button
        type="button"
        className="lm-drawer-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <aside
        className="lm-drawer lm-drawer--sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="lm-drawer__header">
          <div>
            <p className="lm-eyebrow">AI summary</p>
            <h2 id={titleId}>{lead.name}</h2>
          </div>
          <button type="button" className="lm-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="lm-drawer__body">{summaryNode}</div>
      </aside>
    </div>
  );
}

type CallProps = {
  open: boolean;
  lead: LeadRecord | null;
  agents: { id: string; name: string }[];
  telephonyConfigured: boolean;
  onClose: () => void;
  onStart: (agentId: string) => Promise<void>;
};

export function CallLeadModal({
  open,
  lead,
  agents,
  telephonyConfigured,
  onClose,
  onStart,
}: CallProps) {
  const titleId = useId();
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !lead) return null;

  async function handleStart() {
    if (!agentId) {
      setError("Select an AI agent first");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onStart(agentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start call");
      setPending(false);
    }
  }

  return (
    <div className="lm-modal-root" role="presentation">
      <button
        type="button"
        className="lm-modal-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="lm-modal lm-modal--sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="lm-modal__header">
          <h2 id={titleId}>Start call</h2>
          <button type="button" className="lm-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="lm-modal__body">
          <p>
            Call <strong>{lead.name}</strong> at {lead.phone} via the configured
            telephony provider.
          </p>
          {!telephonyConfigured ? (
            <p className="lm-alert lm-alert--warn" role="status">
              Telephony is not configured. Add VAPI credentials in{" "}
              <code>.env</code>, then retry. This action will not fake a call.
            </p>
          ) : null}
          {agents.length === 0 ? (
            <p className="lm-alert lm-alert--error">
              Create an AI agent before starting a call.
            </p>
          ) : (
            <label>
              AI agent
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                disabled={!telephonyConfigured}
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error ? (
            <p className="lm-alert lm-alert--error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="lm-modal__footer">
          <button type="button" className="lm-btn lm-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="lm-btn lm-btn--primary"
            disabled={
              pending || !telephonyConfigured || agents.length === 0
            }
            onClick={() => void handleStart()}
          >
            {pending ? "Starting…" : "Start call"}
          </button>
        </div>
      </div>
    </div>
  );
}
