const LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export function AppointmentStatusBadge({ status }: { status: string }) {
  return (
    <span className={`agent-status appointment-status-${status.toLowerCase()}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
