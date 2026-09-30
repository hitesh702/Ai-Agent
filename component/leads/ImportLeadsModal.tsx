"use client";

import { useEffect, useId, useState } from "react";
import { importLeadsCsv, type CsvImportSummary } from "./api";

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

const MAX_PREVIEW_LEADS = 50;

export function ImportLeadsModal({ open, onClose, onImported }: Props) {
  const titleId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CsvImportSummary | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  const run = async (confirm: boolean) => {
    if (!file) {
      setError("Choose a CSV file first");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await importLeadsCsv(file, confirm);
      setSummary(result);
      if (result.imported > 0) onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import CSV. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const reset = () => {
    setFile(null);
    setSummary(null);
    setError(null);
  };

  const isPreview = summary !== null && !summary.confirmed;
  const isDone = summary !== null && summary.confirmed;

  return (
    <div className="lm-modal-root" role="presentation">
      <button
        type="button"
        className="lm-modal-backdrop"
        aria-label="Close import"
        onClick={() => {
          if (!pending) onClose();
        }}
      />
      <div
        className="lm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="lm-modal__header">
          <h2 id={titleId}>
            {isPreview ? "Review import" : isDone ? "Import complete" : "Import leads from CSV"}
          </h2>
        </div>

        <div className="lm-modal__body lm-import">
          <p className="lm-alert lm-alert--warn">
            CSV upload only imports leads. No calls will start automatically.
          </p>

          {summary ? (
            <>
              <div className="lm-import__stats">
                <div>
                  <strong>{isDone ? summary.imported : summary.readyToImport}</strong>
                  <span>{isDone ? "Imported" : "Ready to import"}</span>
                </div>
                <div>
                  <strong>{summary.skipped}</strong>
                  <span>Skipped (blank rows)</span>
                </div>
                <div>
                  <strong>{summary.invalid}</strong>
                  <span>Invalid</span>
                </div>
                <div>
                  <strong>{summary.duplicates}</strong>
                  <span>Duplicates</span>
                </div>
              </div>

              {summary.issues.length > 0 ? (
                <div className="lm-import__issues">
                  <p className="lm-eyebrow">Rows that will not be imported</p>
                  <ul>
                    {summary.issues.map((issue) => (
                      <li key={`${issue.row}-${issue.kind}`}>
                        Row {issue.row} — {issue.reason}
                      </li>
                    ))}
                  </ul>
                  {summary.invalid + summary.duplicates > summary.issues.length ? (
                    <p className="lm-muted">
                      Showing the first {summary.issues.length} problems.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isPreview && summary.validLeads.length > 0 ? (
                <div className="lm-import__issues">
                  <p className="lm-eyebrow">Leads ready to import</p>
                  <ul>
                    {summary.validLeads.slice(0, MAX_PREVIEW_LEADS).map((lead) => (
                      <li key={lead.row}>
                        {lead.name}{" "}
                        <span className="lm-muted">
                          · {lead.phone} · {lead.email}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {summary.validLeads.length > MAX_PREVIEW_LEADS ? (
                    <p className="lm-muted">
                      and {summary.validLeads.length - MAX_PREVIEW_LEADS} more.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isPreview ? (
                <p className="lm-muted">
                  Nothing has been saved yet. Click <strong>Confirm Import</strong> to
                  save the {summary.readyToImport} valid lead
                  {summary.readyToImport === 1 ? "" : "s"}.
                </p>
              ) : null}
              {isDone ? (
                <p className="lm-muted">
                  Imported leads are saved with status New. No calls were started.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="lm-muted">
                Upload a .csv file with the header row <code>name,phone,email</code>.
                All three fields are required. Phone must be a 10-digit Indian
                mobile number (+91 is optional). Leads whose phone number already
                exists are skipped as duplicates. Limit: 1 MB / 5,000 rows.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={pending}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
            </>
          )}
          {error ? <p className="lm-alert lm-alert--error">{error}</p> : null}
        </div>

        <div className="lm-modal__footer">
          {isDone ? (
            <button type="button" className="lm-btn lm-btn--primary" onClick={onClose}>
              Done
            </button>
          ) : isPreview ? (
            <>
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
                className="lm-btn lm-btn--ghost"
                onClick={reset}
                disabled={pending}
              >
                Choose another file
              </button>
              <button
                type="button"
                className="lm-btn lm-btn--primary"
                onClick={() => void run(true)}
                disabled={pending || summary.readyToImport === 0}
              >
                {pending ? "Importing…" : "Confirm Import"}
              </button>
            </>
          ) : (
            <>
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
                className="lm-btn lm-btn--primary"
                onClick={() => void run(false)}
                disabled={pending || !file}
              >
                {pending ? "Checking…" : "Upload & check"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
