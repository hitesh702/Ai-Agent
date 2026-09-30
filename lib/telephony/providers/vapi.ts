import {
  buildAgentFirstMessage,
  buildAgentSystemPrompt,
  LEAD_INTEREST_OUTCOMES,
} from "@/lib/agents/prompt";
import type {
  ProviderCallSnapshot,
  StartOutboundCallInput,
  TelephonyProvider,
} from "@/lib/telephony/types";
import { localDateInTimeZone } from "@/lib/followups/schedule";
import {
  appointmentAgentRules,
  buildAppointmentTools,
  NO_BOOKING_RULE,
} from "@/lib/appointments/agent-tools";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export class VapiTelephonyProvider implements TelephonyProvider {
  readonly name = "vapi";

  isConfigured(): boolean {
    return Boolean(
      process.env.VAPI_API_KEY?.trim() &&
        process.env.VAPI_PHONE_NUMBER_ID?.trim(),
    );
  }

  private getConfig() {
    const apiKey = process.env.VAPI_API_KEY?.trim();
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
    if (!apiKey || !phoneNumberId) {
      throw new Error(
        "Voice calling is not configured. Set VAPI_API_KEY and VAPI_PHONE_NUMBER_ID.",
      );
    }
    return {
      apiKey,
      phoneNumberId,
      serverUrl:
        process.env.VAPI_SERVER_URL?.trim() || process.env.APP_URL?.trim(),
    };
  }

  async startOutboundCall(
    input: StartOutboundCallInput,
  ): Promise<{ providerCallId: string }> {
    const config = this.getConfig();
    const serverUrl = input.serverUrl || config.serverUrl;
    const timeZone = input.business.timezone || "Asia/Kolkata";
    const now = new Date();
    const today = `${localDateInTimeZone(now, timeZone)} (${new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(now)})`;
    const appointmentTools = serverUrl
      ? buildAppointmentTools({ callId: input.callId, serverUrl })
      : [];

    const assistant = {
      name: input.agent.name,
      firstMessage: buildAgentFirstMessage(input),
      model: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content: [
              buildAgentSystemPrompt(input),
              appointmentTools.length
                ? appointmentAgentRules(today, timeZone)
                : NO_BOOKING_RULE,
            ].join("\n\n"),
          },
        ],
        ...(appointmentTools.length ? { tools: appointmentTools } : {}),
      },
      voice: {
        provider: "11labs",
        voiceId: input.agent.voice || "sarah",
      },
      firstMessageMode: "assistant-speaks-first",
      // Allow the customer to interrupt; assistant should stop and listen.
      interruptionsEnabled: true,
      maxDurationSeconds: 600,
      backgroundSound: "off",
      metadata: {
        callaiCallId: input.callId,
        businessId: input.business.id,
        agentId: input.agent.id,
        leadId: input.lead.id,
      },
      analysisPlan: {
        summaryPrompt:
          "Summarize this coaching-institute enquiry call in 2-4 short sentences. Mention course interest, demo/counselling request, preferred time if any, and final outcome.",
        structuredDataSchema: {
          type: "object",
          properties: {
            interest: {
              type: "string",
              enum: [...LEAD_INTEREST_OUTCOMES],
              description:
                "Exactly one of: INTERESTED, NOT_INTERESTED, FOLLOW_UP, NO_RESPONSE",
            },
            requirement: {
              type: "string",
              description:
                "Course named by the student (e.g. JEE) and any demo/counselling preference",
            },
            followUpRequired: { type: "boolean" },
            followUpDate: {
              type: "string",
              description:
                "Callback/demo date the customer asked for, as YYYY-MM-DD. Omit if no day was given.",
            },
            followUpTime: {
              type: "string",
              description:
                "Callback/demo time the customer asked for, as HH:MM 24-hour (e.g. kal shaam 5pm -> 17:00). Omit if no time was given.",
            },
            customerSentiment: { type: "string" },
            optOut: {
              type: "boolean",
              description:
                "True only if the customer explicitly asked not to be called again (do-not-call / remove my number / mujhe dobara call mat karna)",
            },
          },
          required: ["interest", "followUpRequired", "optOut"],
        },
        structuredDataPrompt: [
          "Classify using ONLY these outcomes: INTERESTED, NOT_INTERESTED, FOLLOW_UP, NO_RESPONSE.",
          "INTERESTED = wants demo/counselling now or clear admission intent (include preferred time in followUpDate when given).",
          "NOT_INTERESTED = refuses, not interested, or opt-out/do-not-call.",
          "FOLLOW_UP = asked to call later without confirming demo/admission now (e.g. mujhe kal call karna).",
          "NO_RESPONSE = no meaningful engagement.",
          "Set followUpRequired true when a later call or scheduled demo time was requested.",
          `Today is ${today} in timezone ${timeZone}; resolve relative days (aaj, kal, parso, next Monday) against it and give followUpDate/followUpTime in that timezone.`,
          "Set optOut true only when the customer explicitly asks never to be called again; a plain 'not interested' is NOT an opt-out.",
        ].join(" "),
      },
      ...(serverUrl
        ? {
            server: {
              url: `${serverUrl.replace(/\/$/, "")}/api/webhooks/vapi`,
              timeoutSeconds: 20,
            },
          }
        : {}),
    };

    const response = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumberId: config.phoneNumberId,
        customer: {
          number: input.customerNumber,
          name: input.customerName,
        },
        assistant,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: string;
    };

    if (!response.ok || !data.id) {
      throw new Error(
        data.message || data.error || `Vapi call failed (${response.status})`,
      );
    }

    return { providerCallId: data.id };
  }

  async fetchCall(providerCallId: string): Promise<ProviderCallSnapshot> {
    const config = this.getConfig();
    const response = await fetch(`https://api.vapi.ai/call/${providerCallId}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    const raw = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      throw new Error(
        asString(raw.message) || `Failed to fetch call (${response.status})`,
      );
    }

    const artifact = raw.artifact as Record<string, unknown> | undefined;
    const analysis = raw.analysis as Record<string, unknown> | undefined;
    const structured = analysis?.structuredData as
      | Record<string, unknown>
      | undefined;
    const recording = artifact?.recording as Record<string, unknown> | undefined;

    return {
      providerCallId,
      status: asString(raw.status) || "unknown",
      transcript: asString(artifact?.transcript) || asString(raw.transcript),
      summary: asString(analysis?.summary),
      recordingUrl:
        asString(recording?.url) ||
        asString(recording?.stereoUrl) ||
        asString(raw.recordingUrl),
      durationSeconds:
        asNumber(raw.duration) ??
        asNumber(
          raw.costBreakdown &&
            (raw.costBreakdown as Record<string, unknown>).duration,
        ),
      endedReason: asString(raw.endedReason),
      interest: asString(structured?.interest),
      requirement: asString(structured?.requirement),
      followUpRequired:
        typeof structured?.followUpRequired === "boolean"
          ? structured.followUpRequired
          : undefined,
      followUpDate: asString(structured?.followUpDate),
      followUpTime: asString(structured?.followUpTime),
      customerSentiment: asString(structured?.customerSentiment),
      optOut: structured?.optOut === true ? true : undefined,
      raw,
    };
  }
}
