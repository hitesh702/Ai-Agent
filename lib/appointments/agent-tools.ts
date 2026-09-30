import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  APPOINTMENT_TYPES,
  appointmentDateSchema,
  appointmentTimeSchema,
  appointmentTypeSchema,
  bookAppointment,
  describeSlot,
  findNextAvailableSlots,
  getAvailableSlots,
  toSafeAppointment,
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
        name: "getAvailableSlots",
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
        name: "createAppointment",
        description:
          "Book one slot returned by getAvailableSlots, only after the customer clearly agreed to that exact date and time.",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD exactly as returned by getAvailableSlots" },
            time: { type: "string", description: "HH:MM exactly as returned by getAvailableSlots" },
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
- First ask which day and time suits them, and the appointment type if it is not clear.
- Then call getAvailableSlots and offer at most 3 of the slots it returns — nothing else.
- If their time is not in the result, say it is not available and offer the returned slots.
- Call createAppointment only after the customer clearly agrees to one exact offered slot, with customerAgreed true.
- Never say the appointment is booked or confirmed unless createAppointment returns success: true. Then read back its "confirmation" sentence.
- If createAppointment returns success: false, say its "error" and offer its "alternatives".
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

/** Vapi expects `result` (any string) or `error`; results are JSON so the AI gets structured data. */
export type ToolResult = { result: string } | { error: string };

const slotsArgs = z.object({
  date: appointmentDateSchema,
  preference: z.string().trim().max(20).optional().nullable(),
});

const createArgs = z.object({
  date: appointmentDateSchema,
  time: appointmentTimeSchema,
  appointmentType: appointmentTypeSchema,
  customerAgreed: z.literal(true, {
    message: "Ask the customer to confirm one of the offered times first",
  }),
});

function parseArgs(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function reply(data: Record<string, unknown>): ToolResult {
  return { result: JSON.stringify(data) };
}

function invalidArgs(error: z.ZodError): ToolResult {
  return reply({ success: false, error: error.issues[0]?.message ?? "Invalid appointment details" });
}

async function businessTimeZone(businessId: string): Promise<string> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  return business?.timezone || "Asia/Kolkata";
}

function slotList(slots: BookingSlot[], timeZone: string) {
  return slots.map((slot) => ({ ...slot, label: describeSlot(slot, timeZone) }));
}

async function availableSlotsTool(rawArgs: unknown, ctx: ToolCallContext, now: Date) {
  const args = slotsArgs.safeParse(parseArgs(rawArgs));
  if (!args.success) return invalidArgs(args.error);

  const timeZone = await businessTimeZone(ctx.businessId);
  const day = await getAvailableSlots(
    ctx.businessId,
    { date: args.data.date, preference: args.data.preference, limit: 3 },
    now,
  );
  if (!day.ok) {
    const next = await findNextAvailableSlots(ctx.businessId, { limit: 3 }, now);
    return reply({ success: false, error: day.message, alternatives: slotList(next, timeZone) });
  }

  const slots = day.slots.map((time) => ({ date: day.date, time }));
  const nextAvailable = slots.length
    ? []
    : await findNextAvailableSlots(
        ctx.businessId,
        { fromDate: day.date, preference: args.data.preference, limit: 3 },
        now,
      );
  return reply({
    success: true,
    date: day.date,
    timeZone,
    ...(day.requestedTime ? { requestedTimeAvailable: day.requestedAvailable } : {}),
    slots: slotList(slots, timeZone),
    ...(slots.length ? {} : { nextAvailable: slotList(nextAvailable, timeZone) }),
  });
}

async function createAppointmentTool(rawArgs: unknown, ctx: ToolCallContext, now: Date) {
  const args = createArgs.safeParse(parseArgs(rawArgs));
  if (!args.success) return invalidArgs(args.error);

  const timeZone = await businessTimeZone(ctx.businessId);
  const booking = await bookAppointment(
    ctx.businessId,
    {
      leadId: ctx.leadId,
      callId: ctx.callId,
      agentId: ctx.agentId,
      date: args.data.date,
      time: args.data.time,
      appointmentType: args.data.appointmentType,
    },
    now,
  );

  if (!booking.ok) {
    return reply({
      success: false,
      error: booking.message,
      alternatives: slotList(booking.alternatives, timeZone),
    });
  }

  const saved = toSafeAppointment(booking.appointment, timeZone);
  return reply({
    success: true,
    appointmentId: saved.id,
    customerName: saved.customerName,
    date: saved.date,
    time: saved.time,
    appointmentType: saved.appointmentType,
    status: saved.status,
    confirmation: booking.confirmation,
  });
}

export async function runAppointmentTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolCallContext,
  now = new Date(),
): Promise<ToolResult> {
  try {
    if (name === "getAvailableSlots") return await availableSlotsTool(rawArgs, ctx, now);
    if (name === "createAppointment") return await createAppointmentTool(rawArgs, ctx, now);
    return { error: `Unknown tool ${name}` };
  } catch (error) {
    console.error("[appointments] tool call failed", {
      tool: name,
      callId: ctx.callId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      error:
        "The booking system had a problem and nothing was booked. Tell the customer the team will call back to confirm a time.",
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
