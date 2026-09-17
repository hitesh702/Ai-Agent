export type CallStatusUi =
  | "Completed"
  | "Missed"
  | "Scheduled"
  | "In Progress";

export type LeadStatusUi =
  | "Interested"
  | "New"
  | "Follow-up"
  | "Converted"
  | "Not Interested";

export type DashboardStat = {
  id: string;
  label: string;
  value: string | number;
  hint?: string;
  icon: "leads" | "calls" | "completed" | "interested" | "followups" | "appointments" | "conversion";
};

export type RecentCallRow = {
  id: string;
  callId: string;
  leadId: string;
  customer: string;
  phone: string;
  callStatus: CallStatusUi;
  leadStatus: LeadStatusUi;
  duration: string;
  date: string;
  dateIso: string;
  summary?: string;
  agentName?: string;
};

export type DashboardData = {
  stats: DashboardStat[];
  recentCalls: RecentCallRow[];
};
