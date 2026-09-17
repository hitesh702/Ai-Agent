"use client";

import { useEffect, useId } from "react";
import type { LeadRecord } from "./types";

type Props = {
  open: boolean;
  lead: LeadRecord | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  pending?: boolean;
};

export function DeleteLeadDialog({
  open,
  lead,
  onClose,
  onConfirm,
  pending,
}: Props) {
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
    <div className="lm-modal-root" role="presentation">
      <button
        type="button"
        className="lm-modal-backdrop"
        aria-label="Cancel delete"
        onClick={onClose}
      />
      <div
        className="lm-modal lm-modal--sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="lm-modal__header">
          <h2 id={titleId}>Delete lead?</h2>
        </div>
        <div className="lm-modal__body">
          <p>
            This will permanently remove{" "}
            <strong>{lead.name}</strong> ({lead.phone}) and related call
            history for this lead.
          </p>
        </div>
        <div className="lm-modal__footer">
          <button
            type="button"
            className="lm-btn lm-btn--ghost"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="lm-btn lm-btn--danger"
            onClick={() => void onConfirm()}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
