"use client";

import { useEffect, useId } from "react";
import { CallHistory } from "./CallHistory";
import { AISummary } from "./AISummary";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { formatFollowUp, getDemoAiSummary, getDemoCallHistory } from "./mappers";
import { LEAD_STATUS_OPTIONS, type LeadRecord, type LeadStatusUi } from "./types";

type Props = {
  open: boolean;
  lead: LeadRecord | null;
  onClose: () => void;
  onEdit: () => void;
  onCall: () => void;
  onFollowUp: () => void;
  onStatusChange: (status: LeadStatusUi) => void;
};

export function LeadDetails({
  open,
  lead,
  onClose,
  onEdit,
  onCall,
  onFollowUp,
  onStatusChange,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !lead) return null;

  const history =
    lead.callHistory.length > 0
      ? lead.callHistory
      : getDemoCallHistory(lead.name);
  const usingDemoHistory = lead.callHistory.length === 0;
  const summary = lead.aiSummary ?? getDemoAiSummary(lead.name);

  return (
    <div className="lm-drawer-root" role="presentation">
      <button
        type="button"
        className="lm-drawer-backdrop"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside
        className="lm-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="lm-drawer__header">
          <div>
            <p className="lm-eyebrow">Lead details</p>
            <h2 id={titleId}>{lead.name}</h2>
            <div className="lm-drawer__badges">
              <LeadStatusBadge status={lead.status} />
              {lead.activeCallId ? (
                <span className="lm-pill is-live">Call in progress</span>
              ) : null}
            </div>
          </div>
          <button type="button" className="lm-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="lm-drawer__actions">
          <button type="button" className="lm-btn lm-btn--primary" onClick={onCall}>
            Call
          </button>
          <button type="button" className="lm-btn lm-btn--ghost" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="lm-btn lm-btn--ghost" onClick={onFollowUp}>
            Schedule follow-up
          </button>
          <label className="lm-inline-select">
            Status
            <select
              value={lead.status}
              onChange={(e) => onStatusChange(e.target.value as LeadStatusUi)}
              aria-label="Change lead status"
            >
              {LEAD_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="lm-drawer__body">
          <section className="lm-section">
            <h3>Contact</h3>
            <dl className="lm-meta">
              <div>
                <dt>Phone</dt>
                <dd>{lead.phone}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{lead.email || "—"}</dd>
              </div>
              <div>
                <dt>Company</dt>
                <dd>{lead.company || "—"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{lead.source || "—"}</dd>
              </div>
              <div>
                <dt>Assigned to</dt>
                <dd>{lead.assignedTo}</dd>
              </div>
              <div>
                <dt>Follow-up</dt>
                <dd>{formatFollowUp(lead.followUpAt)}</dd>
              </div>
            </dl>
            {lead.notes ? (
              <p className="lm-notes">
                <strong>Notes:</strong> {lead.notes}
              </p>
            ) : null}
          </section>

          <section className="lm-section">
            <h3>Call history</h3>
            <CallHistory items={history} usingDemo={usingDemoHistory} />
          </section>

          <section className="lm-section">
            <h3>AI summary</h3>
            <AISummary summary={summary} />
          </section>

          <section className="lm-section">
            <h3>Activity timeline</h3>
            <ul className="lm-activity">
              <li>
                Lead created · {new Date(lead.createdAt).toLocaleString()}
              </li>
              <li>Last updated · {new Date(lead.updatedAt).toLocaleString()}</li>
              {lead.followUpAt ? (
                <li>Follow-up scheduled · {formatFollowUp(lead.followUpAt)}</li>
              ) : null}
              {lead.lastCallAt ? (
                <li>Last call · {lead.lastCallLabel}</li>
              ) : (
                <li>No outbound calls yet</li>
              )}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
