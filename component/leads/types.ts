export const LEAD_STATUS_OPTIONS = [
  "New",
  "Interested",
  "Follow-up",
  "Converted",
  "Not Interested",
] as const;

export type LeadStatusUi = (typeof LEAD_STATUS_OPTIONS)[number];

export const LEAD_SOURCE_OPTIONS = [
  "Website",
  "WhatsApp",
  "Referral",
  "Instagram",
  "Walk-in",
  "Campaign",
  "Other",
] as const;

export type LeadSourceUi = (typeof LEAD_SOURCE_OPTIONS)[number] | string;

export const ASSIGNEE_OPTIONS = [
  "Priya — Admissions",
  "Asha — Outreach",
  "Unassigned",
] as const;

export type SortField =
  | "customer"
  | "status"
  | "lastCall"
  | "followUp"
  | "createdAt";

export type SortDirection = "asc" | "desc";

export type CallHistoryStatus =
  | "Completed"
  | "Missed"
  | "Failed"
  | "In Progress"
  | "Queued";

export type CallHistoryItem = {
  id: string;
  date: string;
  time: string;
  dateIso: string;
  status: CallHistoryStatus;
  duration: string;
  callType: string;
  agent: string;
  notes: string;
  recordingUrl?: string | null;
  isDemo?: boolean;
};

export type AiSummary = {
  conversationSummary: string;
  requirements: string[];
  keyPoints: string[];
  objections: string[];
  recommendedNextAction: string;
  followUp: string;
  isDemo: boolean;
};

export type LeadRecord = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  source: string;
  status: LeadStatusUi;
  notes: string;
  assignedTo: string;
  followUpAt: string | null;
  followUpNote: string;
  followUpReminder: boolean;
  lastCallLabel: string;
  lastCallAt: string | null;
  createdAt: string;
  updatedAt: string;
  callHistory: CallHistoryItem[];
  aiSummary: AiSummary | null;
  activeCallId?: string | null;
};

export type LeadFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  source: string;
  status: LeadStatusUi;
  notes: string;
  assignedTo: string;
};

export type FollowUpFormValues = {
  date: string;
  time: string;
  reminder: boolean;
  note: string;
};

export type LeadFiltersState = {
  status: LeadStatusUi | "all";
  source: string;
  assignedTo: string;
  followUp: "all" | "scheduled" | "overdue" | "none";
  dateFrom: string;
  dateTo: string;
};

export type AgentOption = { id: string; name: string };
