import type { CallStatusUi } from "./types";

const CLASS_MAP: Record<CallStatusUi, string> = {
  Completed: "is-completed",
  Missed: "is-missed",
  Scheduled: "is-scheduled",
  "In Progress": "is-progress",
};

type Props = {
  status: CallStatusUi;
};

export function CallStatusBadge({ status }: Props) {
  return (
    <span className={`saas-badge saas-badge--call ${CLASS_MAP[status]}`}>
      <span className="saas-badge__dot" aria-hidden="true" />
      {status}
    </span>
  );
}
