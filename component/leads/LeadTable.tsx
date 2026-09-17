import { LeadStatusBadge } from "./LeadStatusBadge";
import { formatFollowUp, isFollowUpOverdue } from "./mappers";
import {
  LEAD_STATUS_OPTIONS,
  type LeadRecord,
  type LeadStatusUi,
} from "./types";

type Actions = {
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCall: () => void;
  onHistory: () => void;
  onAiSummary: () => void;
  onFollowUp: () => void;
  onStatusChange: (status: LeadStatusUi) => void;
};

export function LeadRow({
  lead,
  actions,
}: {
  lead: LeadRecord;
  actions: Actions;
}) {
  const overdue = isFollowUpOverdue(lead.followUpAt);

  return (
    <tr>
      <td>
        <button type="button" className="lm-customer-btn" onClick={actions.onOpen}>
          <strong>{lead.name}</strong>
          <span>{lead.company || "No company"}</span>
        </button>
      </td>
      <td>{lead.phone}</td>
      <td>{lead.email || "—"}</td>
      <td>
        <div className="lm-status-cell">
          <LeadStatusBadge status={lead.status} />
          <select
            className="lm-status-select"
            value={lead.status}
            aria-label={`Change status for ${lead.name}`}
            onChange={(e) =>
              actions.onStatusChange(e.target.value as LeadStatusUi)
            }
          >
            {LEAD_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td>
        <span className={lead.activeCallId ? "lm-live" : undefined}>
          {lead.activeCallId ? "In progress" : lead.lastCallLabel}
        </span>
      </td>
      <td>
        {lead.followUpAt ? (
          <span className={overdue ? "lm-followup is-overdue" : "lm-followup"}>
            {formatFollowUp(lead.followUpAt)}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td>{lead.assignedTo}</td>
      <td>
        <div className="lm-actions">
          <button type="button" className="lm-btn lm-btn--tiny" onClick={actions.onCall}>
            Call
          </button>
          <button type="button" className="lm-btn lm-btn--tiny" onClick={actions.onEdit}>
            Edit
          </button>
          <button type="button" className="lm-btn lm-btn--tiny" onClick={actions.onHistory}>
            History
          </button>
          <button type="button" className="lm-btn lm-btn--tiny" onClick={actions.onAiSummary}>
            AI
          </button>
          <button type="button" className="lm-btn lm-btn--tiny" onClick={actions.onFollowUp}>
            Follow-up
          </button>
          <button
            type="button"
            className="lm-btn lm-btn--tiny lm-btn--danger-ghost"
            onClick={actions.onDelete}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export function LeadCard({
  lead,
  actions,
}: {
  lead: LeadRecord;
  actions: Actions;
}) {
  const overdue = isFollowUpOverdue(lead.followUpAt);

  return (
    <article className="lm-card">
      <div className="lm-card__top">
        <button type="button" className="lm-customer-btn" onClick={actions.onOpen}>
          <strong>{lead.name}</strong>
          <span>{lead.phone}</span>
        </button>
        <LeadStatusBadge status={lead.status} />
      </div>
      <dl className="lm-card__meta">
        <div>
          <dt>Email</dt>
          <dd>{lead.email || "—"}</dd>
        </div>
        <div>
          <dt>Last call</dt>
          <dd>{lead.activeCallId ? "In progress" : lead.lastCallLabel}</dd>
        </div>
        <div>
          <dt>Follow-up</dt>
          <dd className={overdue ? "is-overdue" : undefined}>
            {formatFollowUp(lead.followUpAt)}
          </dd>
        </div>
        <div>
          <dt>Assigned</dt>
          <dd>{lead.assignedTo}</dd>
        </div>
      </dl>
      <label className="lm-inline-select">
        Status
        <select
          value={lead.status}
          onChange={(e) =>
            actions.onStatusChange(e.target.value as LeadStatusUi)
          }
        >
          {LEAD_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <div className="lm-card__actions">
        <button type="button" className="lm-btn lm-btn--primary" onClick={actions.onCall}>
          Call
        </button>
        <button type="button" className="lm-btn lm-btn--ghost" onClick={actions.onEdit}>
          Edit
        </button>
        <button type="button" className="lm-btn lm-btn--ghost" onClick={actions.onFollowUp}>
          Follow-up
        </button>
        <button type="button" className="lm-btn lm-btn--ghost" onClick={actions.onHistory}>
          History
        </button>
        <button type="button" className="lm-btn lm-btn--ghost" onClick={actions.onAiSummary}>
          AI Summary
        </button>
        <button
          type="button"
          className="lm-btn lm-btn--danger-ghost"
          onClick={actions.onDelete}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
