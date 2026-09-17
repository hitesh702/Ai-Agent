"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearFollowUp,
  createLead,
  deleteLead,
  fetchLeads,
  scheduleFollowUp,
  startLeadCall,
  updateLead,
  updateLeadStatus,
} from "./api";
import { AISummary } from "./AISummary";
import {
  AISummaryDrawer,
  CallHistoryDrawer,
  CallLeadModal,
} from "./CallModals";
import { DeleteLeadDialog } from "./DeleteLeadDialog";
import { FollowUpModal } from "./FollowUpModal";
import { LeadDetails } from "./LeadDetails";
import { LeadFilters } from "./LeadFilters";
import { LeadFormModal } from "./LeadFormModal";
import { LeadList } from "./LeadList";
import {
  emptyLeadForm,
  formatFollowUp,
  getDemoAiSummary,
  isFollowUpOverdue,
  leadToFormValues,
} from "./mappers";
import { SearchBar } from "./SearchBar";
import { SortControl } from "./SortControl";
import type {
  AgentOption,
  FollowUpFormValues,
  LeadFiltersState,
  LeadFormValues,
  LeadRecord,
  LeadStatusUi,
  SortDirection,
  SortField,
} from "./types";
import "./leads.css";

const DEFAULT_FILTERS: LeadFiltersState = {
  status: "all",
  source: "all",
  assignedTo: "all",
  followUp: "all",
  dateFrom: "",
  dateTo: "",
};

type Toast = { type: "success" | "error"; message: string } | null;

type Props = {
  initialLeads: LeadRecord[];
  agents: AgentOption[];
  telephonyConfigured: boolean;
};

export function LeadManagement({
  initialLeads,
  agents,
  telephonyConfigured,
}: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadRecord[]>(initialLeads);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<LeadFiltersState>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [toast, setToast] = useState<Toast>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formInitial, setFormInitial] = useState(emptyLeadForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<LeadRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [detailsLead, setDetailsLead] = useState<LeadRecord | null>(null);
  const [historyLead, setHistoryLead] = useState<LeadRecord | null>(null);
  const [aiLead, setAiLead] = useState<LeadRecord | null>(null);
  const [followUpLead, setFollowUpLead] = useState<LeadRecord | null>(null);
  const [callLead, setCallLead] = useState<LeadRecord | null>(null);

  const notify = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchLeads();
      setLeads(next);
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Failed to refresh leads",
      );
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = [...leads];

    if (q) {
      rows = rows.filter((l) =>
        [l.name, l.phone, l.email, l.company]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    if (filters.status !== "all") {
      rows = rows.filter((l) => l.status === filters.status);
    }
    if (filters.source !== "all") {
      rows = rows.filter((l) => l.source === filters.source);
    }
    if (filters.assignedTo !== "all") {
      rows = rows.filter((l) => l.assignedTo === filters.assignedTo);
    }
    if (filters.followUp === "scheduled") {
      rows = rows.filter((l) => l.followUpAt && !isFollowUpOverdue(l.followUpAt));
    } else if (filters.followUp === "overdue") {
      rows = rows.filter((l) => isFollowUpOverdue(l.followUpAt));
    } else if (filters.followUp === "none") {
      rows = rows.filter((l) => !l.followUpAt);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      rows = rows.filter((l) => new Date(l.createdAt).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86400000 - 1;
      rows = rows.filter((l) => new Date(l.createdAt).getTime() <= to);
    }

    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "customer":
          cmp = a.name.localeCompare(b.name);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "lastCall":
          cmp = (a.lastCallAt ?? "").localeCompare(b.lastCallAt ?? "");
          break;
        case "followUp":
          cmp = (a.followUpAt ?? "").localeCompare(b.followUpAt ?? "");
          break;
        default:
          cmp = a.createdAt.localeCompare(b.createdAt);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [leads, query, filters, sortField, sortDir]);

  function openCreate() {
    setFormMode("create");
    setEditingId(null);
    setFormInitial(emptyLeadForm());
    setFormOpen(true);
  }

  function openEdit(lead: LeadRecord) {
    setFormMode("edit");
    setEditingId(lead.id);
    setFormInitial(leadToFormValues(lead));
    setFormOpen(true);
  }

  async function handleSave(values: LeadFormValues) {
    if (formMode === "create") {
      const created = await createLead(values);
      setLeads((prev) => [created, ...prev]);
      notify("success", `${created.name} added`);
    } else if (editingId) {
      const updated = await updateLead(editingId, values);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated, callHistory: l.callHistory, aiSummary: l.aiSummary } : l)));
      notify("success", "Lead updated");
    }
    setFormOpen(false);
    void refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLead(deleteTarget.id);
      setLeads((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      notify("success", `${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      setDetailsLead(null);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handleStatusChange(lead: LeadRecord, status: LeadStatusUi) {
    try {
      const updated = await updateLeadStatus(lead.id, status);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                ...updated,
                callHistory: l.callHistory,
                aiSummary: l.aiSummary,
              }
            : l,
        ),
      );
      setDetailsLead((curr) =>
        curr?.id === lead.id ? { ...curr, status } : curr,
      );
      notify("success", `Status set to ${status}`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Status update failed");
    }
  }

  async function handleFollowUpSave(values: FollowUpFormValues) {
    if (!followUpLead) return;
    const updated = await scheduleFollowUp(followUpLead.id, values);
    setLeads((prev) =>
      prev.map((l) =>
        l.id === updated.id
          ? {
              ...l,
              ...updated,
              callHistory: l.callHistory,
              aiSummary: l.aiSummary,
            }
          : l,
      ),
    );
    notify("success", `Follow-up set for ${formatFollowUp(updated.followUpAt)}`);
    setFollowUpLead(null);
  }

  async function handleCancelFollowUp() {
    if (!followUpLead) return;
    const updated = await clearFollowUp(followUpLead.id);
    setLeads((prev) =>
      prev.map((l) =>
        l.id === updated.id
          ? {
              ...l,
              ...updated,
              callHistory: l.callHistory,
              aiSummary: l.aiSummary,
            }
          : l,
      ),
    );
    notify("success", "Follow-up cancelled");
    setFollowUpLead(null);
  }

  async function handleStartCall(agentId: string) {
    if (!callLead) return;
    const result = await startLeadCall({
      leadId: callLead.id,
      agentId,
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    setLeads((prev) =>
      prev.map((l) =>
        l.id === callLead.id
          ? {
              ...l,
              activeCallId: result.callId,
              lastCallLabel: "In progress",
              status: l.status === "New" ? "Follow-up" : l.status,
            }
          : l,
      ),
    );
    notify("success", "Call queued with telephony provider");
    setCallLead(null);
    router.push(`/dashboard/calls/${result.callId}`);
  }

  const actionsFor = (lead: LeadRecord) => ({
    onOpen: () => setDetailsLead(lead),
    onEdit: () => openEdit(lead),
    onDelete: () => setDeleteTarget(lead),
    onCall: () => setCallLead(lead),
    onHistory: () => setHistoryLead(lead),
    onAiSummary: () => setAiLead(lead),
    onFollowUp: () => setFollowUpLead(lead),
    onStatusChange: (status: LeadStatusUi) => {
      void handleStatusChange(lead, status);
    },
  });

  const searchOrFilterActive =
    Boolean(query.trim()) ||
    filters.status !== "all" ||
    filters.source !== "all" ||
    filters.assignedTo !== "all" ||
    filters.followUp !== "all" ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  return (
    <div className="lm">
      <header className="lm-header">
        <div>
          <h1>Lead Management</h1>
          <p>Manage leads, calls, follow-ups, and customer activity</p>
        </div>
        <button type="button" className="lm-btn lm-btn--primary" onClick={openCreate}>
          + Add Lead
        </button>
      </header>

      <div className="lm-toolbar">
        <SearchBar value={query} onChange={setQuery} />
        <div className="lm-toolbar__right">
          <LeadFilters
            filters={filters}
            onChange={setFilters}
            onClear={() => setFilters(DEFAULT_FILTERS)}
            open={filtersOpen}
            onToggle={() => setFiltersOpen((v) => !v)}
          />
          <SortControl
            field={sortField}
            direction={sortDir}
            onFieldChange={setSortField}
            onToggleDirection={() =>
              setSortDir((d) => (d === "asc" ? "desc" : "asc"))
            }
          />
        </div>
      </div>

      <LeadList
        leads={filtered}
        loading={loading}
        searchEmpty={searchOrFilterActive}
        actionsFor={actionsFor}
      />

      <LeadFormModal
        key={`${formMode}-${editingId ?? "new"}-${formOpen ? "open" : "closed"}`}
        open={formOpen}
        mode={formMode}
        initial={formInitial}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSave}
      />

      <DeleteLeadDialog
        open={Boolean(deleteTarget)}
        lead={deleteTarget}
        pending={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <FollowUpModal
        key={followUpLead ? `fu-${followUpLead.id}` : "fu-closed"}
        open={Boolean(followUpLead)}
        lead={followUpLead}
        onClose={() => setFollowUpLead(null)}
        onSave={handleFollowUpSave}
        onCancelFollowUp={handleCancelFollowUp}
      />

      <CallLeadModal
        key={callLead ? `call-${callLead.id}` : "call-closed"}
        open={Boolean(callLead)}
        lead={callLead}
        agents={agents}
        telephonyConfigured={telephonyConfigured}
        onClose={() => setCallLead(null)}
        onStart={handleStartCall}
      />

      <CallHistoryDrawer
        open={Boolean(historyLead)}
        lead={historyLead}
        onClose={() => setHistoryLead(null)}
      />

      <AISummaryDrawer
        open={Boolean(aiLead)}
        lead={aiLead}
        onClose={() => setAiLead(null)}
        summaryNode={
          aiLead ? (
            <AISummary
              summary={aiLead.aiSummary ?? getDemoAiSummary(aiLead.name)}
            />
          ) : null
        }
      />

      <LeadDetails
        open={Boolean(detailsLead)}
        lead={detailsLead}
        onClose={() => setDetailsLead(null)}
        onEdit={() => {
          if (detailsLead) openEdit(detailsLead);
        }}
        onCall={() => {
          if (detailsLead) setCallLead(detailsLead);
        }}
        onFollowUp={() => {
          if (detailsLead) setFollowUpLead(detailsLead);
        }}
        onStatusChange={(status) => {
          if (detailsLead) void handleStatusChange(detailsLead, status);
        }}
      />

      {toast ? (
        <div
          className={`lm-toast lm-toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
