"use client";

import { useEffect, useState } from "react";
import { CallStatusBadge } from "./CallStatusBadge";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { ViewCallButton } from "./ViewCallButton";
import type { RecentCallRow } from "./types";

type Props = {
  calls: RecentCallRow[];
  onView: (call: RecentCallRow) => void;
  loading?: boolean;
};

function useCompactCallsLayout(breakpoint = 720) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [breakpoint]);

  return compact;
}

export function RecentCalls({ calls, onView, loading = false }: Props) {
  const compact = useCompactCallsLayout();

  if (loading) {
    return (
      <section className="saas-recent" aria-busy="true" aria-live="polite">
        <div className="saas-recent__head">
          <h2>Recent Calls</h2>
        </div>
        <div className="saas-empty">Loading recent calls…</div>
      </section>
    );
  }

  return (
    <section className="saas-recent" aria-label="Recent calls">
      <div className="saas-recent__head">
        <div>
          <h2>Recent Calls</h2>
          <p>Latest outbound activity across your agents</p>
        </div>
      </div>

      {calls.length === 0 ? (
        <div className="saas-empty" role="status">
          No calls yet. Start your first outbound call from the Calls page.
        </div>
      ) : compact ? (
        <ul className="saas-call-cards">
          {calls.map((call) => (
            <li key={call.id} className="saas-call-card">
              <div className="saas-call-card__top">
                <div className="saas-customer">
                  <strong>{call.customer}</strong>
                  <span>{call.phone}</span>
                </div>
                <ViewCallButton
                  onClick={() => onView(call)}
                  label={`View details for ${call.customer}`}
                />
              </div>
              <div className="saas-call-card__badges">
                <CallStatusBadge status={call.callStatus} />
                <LeadStatusBadge status={call.leadStatus} />
              </div>
              <div className="saas-call-card__meta">
                <span>{call.duration}</span>
                <time dateTime={call.dateIso}>{call.date}</time>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="saas-table-scroll">
          <table className="saas-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Call Status</th>
                <th scope="col">Lead Status</th>
                <th scope="col">Duration</th>
                <th scope="col">Date</th>
                <th scope="col">View</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id}>
                  <td>
                    <div className="saas-customer">
                      <strong>{call.customer}</strong>
                      <span>{call.phone}</span>
                    </div>
                  </td>
                  <td>
                    <CallStatusBadge status={call.callStatus} />
                  </td>
                  <td>
                    <LeadStatusBadge status={call.leadStatus} />
                  </td>
                  <td>{call.duration}</td>
                  <td>
                    <time dateTime={call.dateIso}>{call.date}</time>
                  </td>
                  <td>
                    <ViewCallButton
                      onClick={() => onView(call)}
                      label={`View details for ${call.customer}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
