import type {
  AiSummary,
  CallHistoryItem,
  CallHistoryStatus,
  LeadFormValues,
  LeadRecord,
  LeadStatusUi,
} from "./types";

/** Map UI status labels ↔ Prisma LeadStatus */
export const UI_TO_PRISMA_STATUS: Record<LeadStatusUi, string> = {
  New: "NEW",
  Interested: "INTERESTED",
  "Follow-up": "FOLLOW_UP",
  Converted: "CONVERTED",
  "Not Interested": "NOT_INTERESTED",
};

export const PRISMA_TO_UI_STATUS: Record<string, LeadStatusUi> = {
  NEW: "New",
  INTERESTED: "Interested",
  FOLLOW_UP: "Follow-up",
  CONVERTED: "Converted",
  NOT_INTERESTED: "Not Interested",
  CALLING: "Follow-up",
  COMPLETED: "Converted",
  NO_RESPONSE: "Not Interested",
};

type ApiCall = {
  id: string;
  status: string;
  duration: number | null;
  recordingUrl?: string | null;
  transcript?: string | null;
  summary?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
  agent?: { id: string; name: string } | null;
  result?: {
    interest?: string | null;
    requirement?: string | null;
    summary?: string | null;
    followUpRequired?: boolean;
    followUpDate?: string | null;
  } | null;
};

export type ApiLead = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status: string;
  source?: string | null;
  notes?: string | null;
  company?: string | null;
  assignedTo?: string | null;
  followUpAt?: string | null;
  followUpNote?: string | null;
  followUpReminder?: boolean;
  createdAt: string;
  updatedAt: string;
  calls?: ApiCall[];
};

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function mapCallStatus(status: string): CallHistoryStatus {
  switch (status) {
    case "ENDED":
      return "Completed";
    case "FAILED":
      return "Failed";
    case "IN_PROGRESS":
    case "RINGING":
      return "In Progress";
    case "QUEUED":
      return "Queued";
    default:
      return "Missed";
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function mapApiCallToHistory(call: ApiCall): CallHistoryItem {
  const created = new Date(call.createdAt);
  return {
    id: call.id,
    date: created.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: created.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
    dateIso: call.createdAt,
    status: mapCallStatus(call.status),
    duration: formatDuration(call.duration),
    callType: "Outbound AI",
    agent: call.agent?.name ?? "AI Agent",
    notes:
      call.result?.summary ||
      call.summary ||
      (call.status === "FAILED" ? "Call failed to connect." : "No notes"),
    recordingUrl: call.recordingUrl ?? null,
    isDemo: false,
  };
}

export function buildAiSummaryFromLead(lead: ApiLead): AiSummary | null {
  const latest = lead.calls?.[0];
  const result = latest?.result;
  const summaryText = result?.summary || latest?.summary;

  if (!summaryText && !result?.requirement && !result?.interest) {
    return null;
  }

  return {
    conversationSummary: summaryText || "Call completed with this lead.",
    requirements: result?.requirement
      ? [result.requirement]
      : ["No explicit requirements captured."],
    keyPoints: [
      result?.interest ? `Interest signal: ${result.interest}` : "Interest not classified yet.",
      latest?.status ? `Last call status: ${latest.status}` : "No call status.",
    ],
    objections: ["No objections recorded by the agent yet."],
    recommendedNextAction: result?.followUpRequired
      ? "Schedule a counselor follow-up as requested."
      : "Review transcript and decide next outreach step.",
    followUp: result?.followUpDate
      ? `Follow-up suggested for ${new Date(result.followUpDate).toLocaleString()}`
      : "No follow-up date on file.",
    isDemo: false,
  };
}

export function getDemoAiSummary(leadName: string): AiSummary {
  return {
    conversationSummary: `${leadName} asked about course fees, batch timings, and scholarship options. The conversation stayed polite and exploratory.`,
    requirements: [
      "Looking for evening / weekend batch options",
      "Needs fee structure and installment clarity",
    ],
    keyPoints: [
      "Compared with a competing institute nearby",
      "Parent involvement likely before decision",
      "Interested in a free demo class",
    ],
    objections: [
      "Fees feel slightly high vs competitors",
      "Travel time to campus is a concern",
    ],
    recommendedNextAction:
      "Send fee brochure on WhatsApp and book a counselor callback within 24 hours.",
    followUp: "Suggested follow-up tomorrow evening between 6–8 PM.",
    isDemo: true,
  };
}

export function getDemoCallHistory(leadName: string): CallHistoryItem[] {
  const now = Date.now();
  return [
    {
      id: `demo-call-1-${leadName}`,
      date: new Date(now - 86400000).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      time: "5:12 PM",
      dateIso: new Date(now - 86400000).toISOString(),
      status: "Completed",
      duration: "4m 18s",
      callType: "Outbound AI",
      agent: "Priya — Admissions",
      notes: "Discussed NEET foundation batch and demo class availability.",
      recordingUrl: null,
      isDemo: true,
    },
    {
      id: `demo-call-2-${leadName}`,
      date: new Date(now - 3 * 86400000).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      time: "11:40 AM",
      dateIso: new Date(now - 3 * 86400000).toISOString(),
      status: "Missed",
      duration: "—",
      callType: "Outbound AI",
      agent: "Asha — Outreach",
      notes: "No answer. Auto-retry queued for evening window.",
      recordingUrl: null,
      isDemo: true,
    },
  ];
}

export function mapApiLeadToRecord(lead: ApiLead): LeadRecord {
  const { firstName, lastName } = splitName(lead.name);
  const history =
    lead.calls && lead.calls.length > 0
      ? lead.calls.map(mapApiCallToHistory)
      : [];
  const last = history[0];
  const active = lead.calls?.find(
    (c) => c.status === "IN_PROGRESS" || c.status === "RINGING" || c.status === "QUEUED",
  );

  return {
    id: lead.id,
    firstName,
    lastName,
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? "",
    company: lead.company ?? "",
    source: lead.source ?? "",
    status: PRISMA_TO_UI_STATUS[lead.status] ?? "New",
    notes: lead.notes ?? "",
    assignedTo: lead.assignedTo || "Unassigned",
    followUpAt: lead.followUpAt ?? null,
    followUpNote: lead.followUpNote ?? "",
    followUpReminder: Boolean(lead.followUpReminder),
    lastCallLabel: last
      ? `${last.date} · ${last.status}`
      : "No calls yet",
    lastCallAt: last?.dateIso ?? null,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    callHistory: history,
    aiSummary: buildAiSummaryFromLead(lead),
    activeCallId: active?.id ?? null,
  };
}

export function formValuesToApiPayload(values: LeadFormValues) {
  const name = [values.firstName, values.lastName]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");

  return {
    name,
    phone: values.phone.trim(),
    email: values.email.trim() || null,
    company: values.company.trim() || null,
    source: values.source.trim() || null,
    notes: values.notes.trim() || null,
    status: UI_TO_PRISMA_STATUS[values.status],
    assignedTo:
      values.assignedTo.trim() && values.assignedTo !== "Unassigned"
        ? values.assignedTo.trim()
        : null,
  };
}

export function leadToFormValues(lead: LeadRecord): LeadFormValues {
  return {
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    email: lead.email,
    company: lead.company,
    source: lead.source || "Website",
    status: lead.status,
    notes: lead.notes,
    assignedTo: lead.assignedTo || "Unassigned",
  };
}

export function emptyLeadForm(): LeadFormValues {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    company: "",
    source: "Website",
    status: "New",
    notes: "",
    assignedTo: "Unassigned",
  };
}

export function formatFollowUp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isFollowUpOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}
