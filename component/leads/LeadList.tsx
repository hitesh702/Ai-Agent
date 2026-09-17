"use client";

import { useEffect, useState } from "react";
import { LeadCard, LeadRow } from "./LeadTable";
import type { LeadRecord, LeadStatusUi } from "./types";

type ActionsFactory = (lead: LeadRecord) => {
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCall: () => void;
  onHistory: () => void;
  onAiSummary: () => void;
  onFollowUp: () => void;
  onStatusChange: (status: LeadStatusUi) => void;
};

type Props = {
  leads: LeadRecord[];
  loading: boolean;
  searchEmpty: boolean;
  actionsFor: ActionsFactory;
};

function useCompact(breakpoint = 900) {
  const [compact, setCompact] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return compact;
}

export function LeadList({
  leads,
  loading,
  searchEmpty,
  actionsFor,
}: Props) {
  const compact = useCompact();

  if (loading || compact === null) {
    return (
      <div className="lm-empty" aria-busy="true">
        Loading leads…
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="lm-empty" role="status">
        {searchEmpty
          ? "No leads match your search or filters."
          : 'No leads yet. Click "Add Lead" to create your first customer.'}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="lm-card-list">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} actions={actionsFor(lead)} />
        ))}
      </div>
    );
  }

  return (
    <div className="lm-table-wrap">
      <table className="lm-table">
        <thead>
          <tr>
            <th scope="col">Customer</th>
            <th scope="col">Phone</th>
            <th scope="col">Email</th>
            <th scope="col">Lead Status</th>
            <th scope="col">Last Call</th>
            <th scope="col">Follow-up</th>
            <th scope="col">Assigned To</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <LeadRow key={lead.id} lead={lead} actions={actionsFor(lead)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
