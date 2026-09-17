import type { ApiLead } from "./mappers";
import { mapApiLeadToRecord } from "./mappers";
import type { FollowUpFormValues, LeadFormValues, LeadRecord } from "./types";
import { formValuesToApiPayload } from "./mappers";

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function parseEnvelope<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !json.ok) {
    const message =
      !json.ok && "error" in json
        ? json.error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json.data;
}

export async function fetchLeads(): Promise<LeadRecord[]> {
  const res = await fetch("/api/leads", { cache: "no-store" });
  const data = await parseEnvelope<ApiLead[]>(res);
  return data.map(mapApiLeadToRecord);
}

export async function createLead(values: LeadFormValues): Promise<LeadRecord> {
  const res = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formValuesToApiPayload(values)),
  });
  const data = await parseEnvelope<ApiLead>(res);
  return mapApiLeadToRecord(data);
}

export async function updateLead(
  id: string,
  values: LeadFormValues,
): Promise<LeadRecord> {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formValuesToApiPayload(values)),
  });
  const data = await parseEnvelope<ApiLead>(res);
  return mapApiLeadToRecord(data);
}

export async function updateLeadStatus(
  id: string,
  status: LeadFormValues["status"],
): Promise<LeadRecord> {
  const { UI_TO_PRISMA_STATUS } = await import("./mappers");
  const res = await fetch(`/api/leads/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: UI_TO_PRISMA_STATUS[status] }),
  });
  const data = await parseEnvelope<ApiLead>(res);
  return mapApiLeadToRecord(data);
}

export async function deleteLead(id: string): Promise<void> {
  const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
  await parseEnvelope<{ deleted: boolean }>(res);
}

export async function scheduleFollowUp(
  id: string,
  values: FollowUpFormValues,
): Promise<LeadRecord> {
  const followUpAt =
    values.date && values.time
      ? new Date(`${values.date}T${values.time}:00`).toISOString()
      : values.date
        ? new Date(`${values.date}T09:00:00`).toISOString()
        : null;

  const res = await fetch(`/api/leads/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      followUpAt,
      followUpNote: values.note.trim() || null,
      followUpReminder: values.reminder,
      status: followUpAt ? "FOLLOW_UP" : undefined,
    }),
  });
  const data = await parseEnvelope<ApiLead>(res);
  return mapApiLeadToRecord(data);
}

export async function clearFollowUp(id: string): Promise<LeadRecord> {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      followUpAt: null,
      followUpNote: null,
      followUpReminder: false,
    }),
  });
  const data = await parseEnvelope<ApiLead>(res);
  return mapApiLeadToRecord(data);
}

/**
 * Calling provider abstraction.
 * Uses the existing /api/calls/start endpoint (TelephonyProvider → Vapi).
 * Does not fake a completed phone call.
 */
export type StartLeadCallResult =
  | { ok: true; callId: string; status: string }
  | { ok: false; error: string; configured: boolean };

export async function startLeadCall(input: {
  leadId: string;
  agentId: string;
}): Promise<StartLeadCallResult> {
  try {
    const res = await fetch("/api/calls/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await res.json()) as ApiEnvelope<{
      id: string;
      status: string;
    }>;

    if (!res.ok || !json.ok) {
      const message =
        !json.ok && "error" in json
          ? json.error
          : `Unable to start call (${res.status})`;
      const configured = res.status !== 503;
      return {
        ok: false,
        error: message,
        configured,
      };
    }

    return {
      ok: true,
      callId: json.data.id,
      status: json.data.status,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Calling service is unavailable",
      configured: false,
    };
  }
}
