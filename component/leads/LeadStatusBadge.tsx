import type { LeadStatusUi } from "./types";

const CLASS_MAP: Record<LeadStatusUi, string> = {
  Interested: "is-interested",
  New: "is-new",
  "Follow-up": "is-followup",
  Converted: "is-converted",
  "Not Interested": "is-not-interested",
};

type Props = {
  status: LeadStatusUi;
};

export function LeadStatusBadge({ status }: Props) {
  return (
    <span className={`lm-badge ${CLASS_MAP[status]}`}>
      <span className="lm-badge__dot" aria-hidden="true" />
      {status}
    </span>
  );
}
