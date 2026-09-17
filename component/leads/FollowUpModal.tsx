"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import type { FollowUpFormValues, LeadRecord } from "./types";

type Props = {
  open: boolean;
  lead: LeadRecord | null;
  onClose: () => void;
  onSave: (values: FollowUpFormValues) => Promise<void>;
  onCancelFollowUp?: () => Promise<void>;
};

function toLocalParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "18:00" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "18:00" };
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date: `${yyyy}-${mm}-${dd}`, time };
}

function initialFollowUp(lead: LeadRecord): FollowUpFormValues {
  const parts = toLocalParts(lead.followUpAt);
  return {
    date: parts.date,
    time: parts.time,
    reminder: lead.followUpReminder,
    note: lead.followUpNote,
  };
}

export function FollowUpModal({
  open,
  lead,
  onClose,
  onSave,
  onCancelFollowUp,
}: Props) {
  const titleId = useId();
  const [values, setValues] = useState<FollowUpFormValues>(() =>
    lead ? initialFollowUp(lead) : { date: "", time: "18:00", reminder: true, note: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !lead) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.date) {
      setError("Choose a follow-up date");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save follow-up");
    } finally {
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
          <h2 id={titleId}>Schedule follow-up</h2>
          <button type="button" className="lm-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form className="lm-form" onSubmit={handleSubmit}>
          {error ? (
            <p className="lm-alert lm-alert--error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="lm-muted">For {lead.name}</p>
          <div className="lm-form__row">
            <label>
              Follow-up date
              <input
                type="date"
                required
                value={values.date}
                onChange={(e) =>
                  setValues((v) => ({ ...v, date: e.target.value }))
                }
              />
            </label>
            <label>
              Follow-up time
              <input
                type="time"
                value={values.time}
                onChange={(e) =>
                  setValues((v) => ({ ...v, time: e.target.value }))
                }
              />
            </label>
          </div>
          <label className="lm-check">
            <input
              type="checkbox"
              checked={values.reminder}
              onChange={(e) =>
                setValues((v) => ({ ...v, reminder: e.target.checked }))
              }
            />
            Send reminder before follow-up
          </label>
          <label>
            Follow-up note
            <textarea
              rows={3}
              value={values.note}
              onChange={(e) =>
                setValues((v) => ({ ...v, note: e.target.value }))
              }
              placeholder="What should we cover on the next call?"
            />
          </label>
          <div className="lm-modal__footer">
            {lead.followUpAt && onCancelFollowUp ? (
              <button
                type="button"
                className="lm-btn lm-btn--ghost"
                disabled={pending}
                onClick={() => void onCancelFollowUp()}
              >
                Cancel follow-up
              </button>
            ) : (
              <button
                type="button"
                className="lm-btn lm-btn--ghost"
                onClick={onClose}
                disabled={pending}
              >
                Close
              </button>
            )}
            <button type="submit" className="lm-btn lm-btn--primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
