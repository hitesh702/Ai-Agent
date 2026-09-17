"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ASSIGNEE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  LEAD_STATUS_OPTIONS,
  type LeadFormValues,
} from "./types";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial: LeadFormValues;
  onClose: () => void;
  onSubmit: (values: LeadFormValues) => Promise<void>;
};

export function LeadFormModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: Props) {
  const titleId = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => firstRef.current?.focus(), 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  function update<K extends keyof LeadFormValues>(
    key: K,
    value: LeadFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (values.phone.trim().replace(/\D/g, "").length < 10) {
      setError("Enter a valid phone number (at least 10 digits)");
      return;
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setError("Enter a valid email address");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save lead");
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
        className="lm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="lm-modal__header">
          <h2 id={titleId}>{mode === "create" ? "Add lead" : "Edit lead"}</h2>
          <button
            type="button"
            className="lm-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="lm-form" onSubmit={handleSubmit}>
          {error ? (
            <p className="lm-alert lm-alert--error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="lm-form__row">
            <label>
              First name
              <input
                ref={firstRef}
                value={values.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                required
                autoComplete="given-name"
              />
            </label>
            <label>
              Last name
              <input
                value={values.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                autoComplete="family-name"
              />
            </label>
          </div>

          <div className="lm-form__row">
            <label>
              Phone number
              <input
                type="tel"
                value={values.phone}
                onChange={(e) => update("phone", e.target.value)}
                required
                placeholder="+91 98765 43210"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={values.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="name@email.com"
              />
            </label>
          </div>

          <label>
            Company
            <input
              value={values.company}
              onChange={(e) => update("company", e.target.value)}
              placeholder="Optional"
            />
          </label>

          <div className="lm-form__row">
            <label>
              Lead source
              <select
                value={values.source}
                onChange={(e) => update("source", e.target.value)}
              >
                {LEAD_SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lead status
              <select
                value={values.status}
                onChange={(e) =>
                  update("status", e.target.value as LeadFormValues["status"])
                }
              >
                {LEAD_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Assigned to
            <select
              value={values.assignedTo}
              onChange={(e) => update("assignedTo", e.target.value)}
            >
              {ASSIGNEE_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label>
            Notes
            <textarea
              rows={3}
              value={values.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Context for the next call…"
            />
          </label>

          <div className="lm-modal__footer">
            <button
              type="button"
              className="lm-btn lm-btn--ghost"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </button>
            <button type="submit" className="lm-btn lm-btn--primary" disabled={pending}>
              {pending ? "Saving…" : "Save lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
