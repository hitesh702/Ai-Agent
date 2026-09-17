import {
  ASSIGNEE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  LEAD_STATUS_OPTIONS,
  type LeadFiltersState,
} from "./types";

type Props = {
  filters: LeadFiltersState;
  onChange: (next: LeadFiltersState) => void;
  onClear: () => void;
  open: boolean;
  onToggle: () => void;
};

export function LeadFilters({
  filters,
  onChange,
  onClear,
  open,
  onToggle,
}: Props) {
  const activeCount = [
    filters.status !== "all",
    filters.source !== "all",
    filters.assignedTo !== "all",
    filters.followUp !== "all",
    Boolean(filters.dateFrom),
    Boolean(filters.dateTo),
  ].filter(Boolean).length;

  return (
    <div className="lm-filters">
      <button
        type="button"
        className={`lm-btn lm-btn--ghost ${activeCount ? "is-active" : ""}`}
        onClick={onToggle}
        aria-expanded={open}
      >
        Filters{activeCount ? ` (${activeCount})` : ""}
      </button>

      {open ? (
        <div className="lm-filters__panel" role="region" aria-label="Lead filters">
          <label>
            Lead status
            <select
              value={filters.status}
              onChange={(e) =>
                onChange({
                  ...filters,
                  status: e.target.value as LeadFiltersState["status"],
                })
              }
            >
              <option value="all">All statuses</option>
              {LEAD_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label>
            Lead source
            <select
              value={filters.source}
              onChange={(e) =>
                onChange({ ...filters, source: e.target.value })
              }
            >
              <option value="all">All sources</option>
              {LEAD_SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label>
            Assigned to
            <select
              value={filters.assignedTo}
              onChange={(e) =>
                onChange({ ...filters, assignedTo: e.target.value })
              }
            >
              <option value="all">Anyone</option>
              {ASSIGNEE_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label>
            Follow-up
            <select
              value={filters.followUp}
              onChange={(e) =>
                onChange({
                  ...filters,
                  followUp: e.target.value as LeadFiltersState["followUp"],
                })
              }
            >
              <option value="all">Any</option>
              <option value="scheduled">Scheduled</option>
              <option value="overdue">Overdue</option>
              <option value="none">None</option>
            </select>
          </label>

          <label>
            Created from
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                onChange({ ...filters, dateFrom: e.target.value })
              }
            />
          </label>

          <label>
            Created to
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                onChange({ ...filters, dateTo: e.target.value })
              }
            />
          </label>

          <div className="lm-filters__actions">
            <button type="button" className="lm-btn lm-btn--ghost" onClick={onClear}>
              Clear filters
            </button>
          </div>
        </div>
      ) : null}

      {activeCount > 0 && !open ? (
        <div className="lm-filter-chips">
          {filters.status !== "all" ? (
            <span className="lm-chip">Status: {filters.status}</span>
          ) : null}
          {filters.source !== "all" ? (
            <span className="lm-chip">Source: {filters.source}</span>
          ) : null}
          {filters.assignedTo !== "all" ? (
            <span className="lm-chip">Assignee: {filters.assignedTo}</span>
          ) : null}
          {filters.followUp !== "all" ? (
            <span className="lm-chip">Follow-up: {filters.followUp}</span>
          ) : null}
          {(filters.dateFrom || filters.dateTo) && (
            <span className="lm-chip">
              Date: {filters.dateFrom || "…"} → {filters.dateTo || "…"}
            </span>
          )}
          <button type="button" className="lm-chip-clear" onClick={onClear}>
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}
