import type { SortDirection, SortField } from "./types";

const OPTIONS: { value: SortField; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "status", label: "Status" },
  { value: "lastCall", label: "Last call" },
  { value: "followUp", label: "Follow-up" },
  { value: "createdAt", label: "Created" },
];

type Props = {
  field: SortField;
  direction: SortDirection;
  onFieldChange: (field: SortField) => void;
  onToggleDirection: () => void;
};

export function SortControl({
  field,
  direction,
  onFieldChange,
  onToggleDirection,
}: Props) {
  return (
    <div className="lm-sort">
      <label className="lm-sort__label">
        Sort by
        <select
          value={field}
          onChange={(e) => onFieldChange(e.target.value as SortField)}
          aria-label="Sort field"
        >
          {OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="lm-btn lm-btn--ghost lm-sort__dir"
        onClick={onToggleDirection}
        aria-label={`Sort ${direction === "asc" ? "ascending" : "descending"}`}
        title={direction === "asc" ? "Ascending" : "Descending"}
      >
        {direction === "asc" ? "↑ Asc" : "↓ Desc"}
      </button>
    </div>
  );
}
