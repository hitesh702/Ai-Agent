import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  APPOINTMENT_TYPES,
  bookAppointment,
  describeSlot,
  findNextAvailableSlots,
  getAvailableSlots,
  type BookingSlot,
} from "./booking";

/**
 * Appointment tools for the voice agent (Vapi function calling).
 * The AI only chooses date/time/type; business, lead, call and agent always
 * come from the verified call, and every booking goes through bookAppointment().
 */

export const TOOL_TOKEN_HEADER = "x-callai-call-token";
/** Tool calls are only accepted for this long after the call was created. */
const TOOL_CALL_WINDOW_MS = 2 * 60 * 60_000;

export function appointmentToolToken(callId: string): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) return null;
  return createHmac("sha256", secret).update(`appointment-tools:${callId}`).digest("hex");
}

export function isValidToolToken(callId: string, token: string | null | undefined): boolean {
  const expected = appointmentToolToken(callId);
  if (!expected || !token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildAppointmentTools(input: { callId: string; serverUrl: string }) {
  const token = appointmentToolToken(input.callId);
  if (!token) return [];

  const server = {
    url: `${input.serverUrl.replace(/\/$/, "")}/api/webhooks/vapi/tools`,
    timeoutSeconds: 15,
    headers: { [TOOL_TOKEN_HEADER]: token },
  };

  return [
    {
      type: "function",
      function: {
        name: "get_available_slots",
        description:
          "Get the real free appointment slots for a date. Call this before offering any appointment time.",
        parameters: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "Date the customer wants, as YYYY-MM-DD in the business timezone",
            },
            preference: {
              type: "string",
              description:
                "Customer preference if given: morning, afternoon, evening, or a time as HH:MM (24-hour)",
            },
          },
          required: ["date"],
        },
      },
      server,
    },
    {
      type: "function",
      function: {
        name: "book_appointment",
        description:
          "Book one slot returned by get_available_slots, only after the customer clearly agreed to that exact date and time.",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD exactly as returned by get_available_slots" },
            time: { type: "string", description: "HH:MM exactly as returned by get_available_slots" },
            appointmentType: { type: "string", enum: [...APPOINTMENT_TYPES] },
            customerAgreed: {
              type: "boolean",
              description: "true only if the customer said yes to this exact slot",
            },
          },
          required: ["date", "time", "appointmentType", "customerAgreed"],
        },
      },
      server,
    },
  ];
}

export function appointmentAgentRules(today: string, timeZone: string): string {
  return `APPOINTMENT BOOKING (mandatory):
- Today is ${today}, timezone ${timeZone}. Work out dates like "kal" or "Friday" from this.
- Never suggest, guess or promise an appointment date or time yourself.
- First ask what suits them (e.g. "Morning ya afternoon?" / "Which day and time works for you?").
- Then call get_available_slots and offer at most 3 of the times it returns — nothing else.
- If their time is not in the result, say it is not available and offer the returned alternatives.
- Call book_appointment only after the customer clearly agrees to one exact offered slot, with customerAgreed true.
- Never say the appointment is booked or confirmed until book_appointment returns BOOKED. Then read back its confirmation sentence.
- If book_appointment returns NOT BOOKED, say so and offer the alternatives it gives.
- If a tool fails, apologise and say the team will call back to fix a time. Do not claim anything was booked.`;
}

export const NO_BOOKING_RULE = `APPOINTMENTS: You cannot book appointments on this call. Never promise a specific date or time; note what the customer prefers and say the team will confirm a time.`;

// ---------------------------------------------------------------------------
// Running a tool call
// ---------------------------------------------------------------------------

export type ToolCallContext = {
  businessId: string;
  leadId: string;
  callId: string;
  agentId: string;
};

export type ToolResult = { result: string } | { error: string };

const slotsArgs = z.object({
  date: z.string(),
  preference: z.string().optional().nullable(),
});

const bookArgs = z.object({
  date: z.string(),
  time: z.string(),
  appointmentType: z.string().optional(),
  customerAgreed: z.boolean().optional(),
});

function parseArgs(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function businessTimeZone(businessId: string): Promise<string> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  return business?.timezone || "Asia/Kolkata";
}

function listSlots(slots: BookingSlot[], timeZone: string): string {
  return slots.map((s) => `${describeSlot(s, timeZone)} (date ${s.date}, time ${s.time})`).join("; ");
}

export async function runAppointmentTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolCallContext,
  now = new Date(),
): Promise<ToolResult> {
  try {
    if (name === "get_available_slots") {
      const args = slotsArgs.safeParse(parseArgs(rawArgs));
      if (!args.success) return { error: "Missing date. Ask the customer which day suits them." };

      const timeZone = await businessTimeZone(ctx.businessId);
      const day = await getAvailableSlots(
        ctx.businessId,
        { date: args.data.date, preference: args.data.preference, limit: 3 },
        now,
      );
      if (!day.ok) {
        const next = await findNextAvailableSlots(ctx.businessId, { limit: 3 }, now);
        return {
          result: `${day.message} ${next.length ? `Next available: ${listSlots(next, timeZone)}. Offer only these.` : "No slots are available. Do not suggest any time."}`,
        };
      }

      const requested =
        day.requestedTime && !day.requestedAvailable
          ? `The requested time ${day.requestedTime} is NOT available. `
          : "";
      if (day.slots.length) {
        const slots = day.slots.map((time) => ({ date: day.date, time }));
        return {
          result: `${requested}AVAILABLE: ${listSlots(slots, timeZone)}. Offer only these times.`,
        };
      }

      const next = await findNextAvailableSlots(
        ctx.businessId,
        { fromDate: day.date, preference: args.data.preference, limit: 3 },
        now,
      );
      return {
        result: next.length
          ? `${requested}NO SLOTS on ${day.date}${args.data.preference ? ` for "${args.data.preference}"` : ""}. Next available: ${listSlots(next, timeZone)}. Offer only these times.`
          : "NO SLOTS available in the next two weeks. Tell the customer the team will call back to schedule. Do not suggest any time.",
      };
    }

    if (name === "book_appointment") {
      const args = bookArgs.safeParse(parseArgs(rawArgs));
      if (!args.success) {
        return { result: "NOT BOOKED: date and time are required. Offer the available slots again." };
      }
      if (args.data.customerAgreed !== true) {
        return {
          result: "NOT BOOKED: ask the customer to confirm one of the offered times first.",
        };
      }

      const timeZone = await businessTimeZone(ctx.businessId);
      const booking = await bookAppointment(
        ctx.businessId,
        {
          leadId: ctx.leadId,
          callId: ctx.callId,
          agentId: ctx.agentId,
          date: args.data.date,
          time: args.data.time,
          type: args.data.appointmentType || "counselling",
          customerAgreed: true,
        },
        now,
      );

      if (booking.ok) {
        return { result: `BOOKED. Tell the customer exactly: "${booking.confirmation}"` };
      }
      const alternatives = booking.alternatives.length
        ? ` Next available: ${listSlots(booking.alternatives, timeZone)}. Offer only these.`
        : " No other slots are free soon; say the team will call back to schedule.";
      return { result: `NOT BOOKED: ${booking.message}${alternatives}` };
    }

    return { error: `Unknown tool ${name}` };
  } catch (error) {
    console.error("[appointments] tool call failed", {
      tool: name,
      callId: ctx.callId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      error:
        "NOT BOOKED: the booking system had a problem. Do not say anything was booked; tell the customer the team will call back to confirm a time.",
    };
  }
}

// ---------------------------------------------------------------------------
// Vapi "tool-calls" webhook
// ---------------------------------------------------------------------------

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

async function findCallForToolRequest(message: Record<string, unknown>) {
  const call = record(message.call);
  const metadataIds = [
    record(call?.metadata)?.callaiCallId,
    record(record(call?.assistant)?.metadata)?.callaiCallId,
    record(record(message.assistant)?.metadata)?.callaiCallId,
  ]
    .map(str)
    .filter((id): id is string => Boolean(id));

  const select = {
    id: true,
    businessId: true,
    leadId: true,
    agentId: true,
    createdAt: true,
  } as const;

  if (metadataIds.length) {
    const found = await prisma.call.findUnique({ where: { id: metadataIds[0] }, select });
    if (found) return found;
  }
  const providerCallId = str(call?.id);
  return providerCallId
    ? prisma.call.findFirst({ where: { provider: "vapi", providerCallId }, select })
    : null;
}

export type ToolWebhookResponse =
  | { status: 200; body: { results: Array<{ toolCallId: string } & ToolResult> } }
  | { status: 400 | 401; body: { error: string } };

export async function handleAppointmentToolWebhook(
  payload: unknown,
  token: string | null,
  now = new Date(),
): Promise<ToolWebhookResponse> {
  const message = record(record(payload)?.message);
  if (!message || message.type !== "tool-calls") {
    return { status: 400, body: { error: "Expected a tool-calls message" } };
  }

  const call = await findCallForToolRequest(message);
  if (!call || !isValidToolToken(call.id, token)) {
    console.warn("[appointments] rejected unauthenticated tool call");
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const toolCalls = (Array.isArray(message.toolCallList) ? message.toolCallList : [])
    .map(record)
    .filter((tc): tc is Record<string, unknown> => Boolean(tc && str(tc.id)));

  const expired = now.getTime() - call.createdAt.getTime() > TOOL_CALL_WINDOW_MS;
  const results = [];
  for (const toolCall of toolCalls) {
    const fn = record(toolCall.function);
    const outcome: ToolResult = expired
      ? { error: "This call can no longer book appointments." }
      : await runAppointmentTool(
          str(fn?.name) ?? "",
          fn?.arguments,
          {
            businessId: call.businessId,
            leadId: call.leadId,
            callId: call.id,
            agentId: call.agentId,
          },
          now,
        );
    results.push({ toolCallId: str(toolCall.id)!, ...outcome });
  }

  return { status: 200, body: { results } };
}
