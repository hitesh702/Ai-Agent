import type { CallHistoryItem } from "./types";

type Props = {
  items: CallHistoryItem[];
  usingDemo: boolean;
};

export function CallHistory({ items, usingDemo }: Props) {
  if (items.length === 0) {
    return (
      <div className="lm-empty lm-empty--inset">
        No call history for this lead yet.
      </div>
    );
  }

  return (
    <div className="lm-timeline">
      {usingDemo ? (
        <p className="lm-demo-banner" role="note">
          Demo call history — replace with live telephony events when available.
        </p>
      ) : null}
      <ol className="lm-timeline__list">
        {items.map((item) => (
          <li key={item.id} className="lm-timeline__item">
            <div className="lm-timeline__marker" aria-hidden="true" />
            <div className="lm-timeline__content">
              <div className="lm-timeline__top">
                <strong>
                  {item.date} · {item.time}
                </strong>
                <span className={`lm-call-badge is-${item.status.toLowerCase().replace(/\s+/g, "-")}`}>
                  {item.status}
                </span>
              </div>
              <p className="lm-muted">
                {item.callType} · {item.agent} · {item.duration}
              </p>
              <p>{item.notes}</p>
              {item.recordingUrl ? (
                <a
                  href={item.recordingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="lm-link"
                >
                  Open recording
                </a>
              ) : (
                <span className="lm-muted">No recording available</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
