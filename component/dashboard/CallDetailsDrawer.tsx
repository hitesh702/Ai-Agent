"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { CallStatusBadge } from "./CallStatusBadge";
import { LeadStatusBadge } from "./LeadStatusBadge";
import type { RecentCallRow } from "./types";

type Props = {
  call: RecentCallRow | null;
  open: boolean;
  onClose: () => void;
};

export function CallDetailsDrawer({ call, open, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open || !call) return null;

  return (
    <div className="saas-drawer-root" role="presentation">
      <button
        type="button"
        className="saas-drawer-backdrop"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside
        className="saas-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="saas-drawer__header">
          <div>
            <p className="saas-drawer__eyebrow">Call details</p>
            <h2 id={titleId}>{call.customer}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="saas-drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="saas-drawer__body">
          <dl className="saas-drawer__meta">
            <div>
              <dt>Phone</dt>
              <dd>{call.phone}</dd>
            </div>
            <div>
              <dt>Call status</dt>
              <dd>
                <CallStatusBadge status={call.callStatus} />
              </dd>
            </div>
            <div>
              <dt>Lead status</dt>
              <dd>
                <LeadStatusBadge status={call.leadStatus} />
              </dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{call.duration}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>
                <time dateTime={call.dateIso}>{call.date}</time>
              </dd>
            </div>
            {call.agentName ? (
              <div>
                <dt>Agent</dt>
                <dd>{call.agentName}</dd>
              </div>
            ) : null}
          </dl>

          {call.summary ? (
            <section className="saas-drawer__summary">
              <h3>Summary</h3>
              <p>{call.summary}</p>
            </section>
          ) : null}
        </div>

        <div className="saas-drawer__footer">
          <Link
            href={`/dashboard/calls/${call.callId}`}
            className="saas-drawer__link"
          >
            Open call
          </Link>
          <Link
            href={`/dashboard/leads/${call.leadId}`}
            className="saas-drawer__link saas-drawer__link--secondary"
          >
            Open lead
          </Link>
        </div>
      </aside>
    </div>
  );
}
