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
    <span className={`saas-badge saas-badge--lead ${CLASS_MAP[status]}`}>
      {status}
    </span>
  );
}
