const LABELS: Record<string, string> = {
  DRAFT: "Draft",
  READY: "Ready",
  RUNNING: "Running",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export function CampaignStatusBadge({ status }: { status: string }) {
  return (
    <span className={`agent-status campaign-status-${status.toLowerCase()}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
