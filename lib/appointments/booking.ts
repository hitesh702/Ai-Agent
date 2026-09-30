import { AppointmentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  localDateInTimeZone,
  zonedDateTimeToUtc,
} from "@/lib/followups/schedule";

/**
 * Appointment booking rules shared by the dashboard, the API and the AI agent tools.
 * Slots are fixed-length blocks inside the business calling window
 * (Settings → calling hours and days), in the business timezone.
 */

export const APPOINTMENT_SLOT_MINUTES = 30;
const SLOT_MS = APPOINTMENT_SLOT_MINUTES * 60_000;
const SEARCH_DAYS = 14;

export const APPOINTMENT_TYPES = [
  "counselling",
  "demo",
  "consultation",
  "follow-up",
  "meeting",
] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const APPOINTMENT_TABLE_COLUMNS = [
  "Customer",
  "Date",
  "Time",
  "Appointment Type",
  "Status",
] as const;

export type BookingSlot = { date: string; time: string };

type BookingBusiness = {
  id: string;
  timezone: string;
  callingWindowStart: string;
  callingWindowEnd: string;
  callingDays: string;
};

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

export const appointmentDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date as YYYY-MM-DD, e.g. 2026-10-02")
  .refine((value) => zonedDateTimeToUtc(value, "00:00", "UTC") !== null, "That date does not exist");

export const appointmentTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter the time as HH:MM (24-hour), e.g. 15:00");

export const appointmentTypeSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase().replace(/[\s_]+/g, "-"))
  .pipe(z.enum(APPOINTMENT_TYPES, { message: "Choose a valid appointment type" }));

export const bookAppointmentSchema = z.object({
  leadId: z.string().trim().min(1, "Choose a lead"),
  date: appointmentDateSchema,
  time: appointmentTimeSchema,
  type: appointmentTypeSchema.default("counselling"),
  notes: z.string().trim().max(1000).optional().nullable(),
  callId: z.string().trim().min(1).optional().nullable(),
  agentId: z.string().trim().min(1).optional().nullable(),
  customerAgreed: z.literal(true, {
    message: "Only book after the customer has agreed to this time",
  }),
});

export type BookAppointmentInput = z.input<typeof bookAppointmentSchema>;

// ---------------------------------------------------------------------------
// Slot grid
// ---------------------------------------------------------------------------

function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h <= 23 && m <= 59 ? h * 60 + m : null;
}

function toHm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Every slot start ("HH:MM") the business offers on a bookable day. */
export function slotTimesForDay(business: BookingBusiness): string[] {
  const start = toMinutes(business.callingWindowStart) ?? 9 * 60;
  let end = toMinutes(business.callingWindowEnd) ?? 20 * 60;
  if (end <= start) end = 24 * 60;

  const times: string[] = [];
  for (let t = start; t + APPOINTMENT_SLOT_MINUTES <= end; t += APPOINTMENT_SLOT_MINUTES) {
    times.push(toHm(t));
  }
  return times;
}

function isBookingDay(date: string, business: BookingBusiness): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const isoWeekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
  const days = business.callingDays
    .split(",")
    .map((day) => Number(day.trim()))
    .filter((day) => day >= 1 && day <= 7);
  return days.length === 0 || days.includes(isoWeekday);
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function slotKey(businessId: string, start: Date): string {
  return `${businessId}|${start.toISOString()}`;
}

/** Appointments that still occupy their time (everything except cancelled). */
const HOLDS_TIME: Prisma.AppointmentWhereInput = {
  status: { not: AppointmentStatus.CANCELLED },
};

function overlapping(start: Date, end: Date): Prisma.AppointmentWhereInput {
  return {
    date: { lt: end },
    OR: [
      { endAt: { gt: start } },
      { endAt: null, date: { gt: new Date(start.getTime() - SLOT_MS) } },
    ],
  };
}

type Db = Prisma.TransactionClient | typeof prisma;

async function loadBusiness(businessId: string, db: Db = prisma) {
  return db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      timezone: true,
      callingWindowStart: true,
      callingWindowEnd: true,
      callingDays: true,
    },
  });
}

/** Free slot starts on one day, in grid order. Past and booked slots are removed. */
async function freeSlotsOnDay(
  business: BookingBusiness,
  date: string,
  now: Date,
  db: Db = prisma,
): Promise<string[]> {
  if (!isBookingDay(date, business)) return [];
  const timeZone = business.timezone || "Asia/Kolkata";

  const candidates = slotTimesForDay(business)
    .map((time) => ({ time, start: zonedDateTimeToUtc(date, time, timeZone) }))
    .filter((slot): slot is { time: string; start: Date } =>
      Boolean(slot.start && slot.start.getTime() > now.getTime()),
    );
  if (candidates.length === 0) return [];

  const first = candidates[0].start;
  const last = candidates[candidates.length - 1].start;
  const booked = await db.appointment.findMany({
    where: {
      businessId: business.id,
      ...HOLDS_TIME,
      ...overlapping(first, new Date(last.getTime() + SLOT_MS)),
    },
    select: { date: true, endAt: true },
  });

  return candidates
    .filter(({ start }) => {
      const end = start.getTime() + SLOT_MS;
      return !booked.some((a) => {
        const aStart = a.date.getTime();
        const aEnd = a.endAt ? a.endAt.getTime() : aStart + SLOT_MS;
        return aStart < end && aEnd > start.getTime();
      });
    })
    .map(({ time }) => time);
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/** "morning" | "afternoon" | "evening" | "HH:MM" — anything else is ignored. */
function applyPreference(slots: string[], preference?: string | null) {
  const value = preference?.trim().toLowerCase();
  if (!value) return { slots, requestedTime: undefined };

  const ranges: Record<string, [number, number]> = {
    morning: [0, 12 * 60],
    afternoon: [12 * 60, 17 * 60],
    evening: [17 * 60, 24 * 60],
  };
  if (ranges[value]) {
    const [from, to] = ranges[value];
    return {
      slots: slots.filter((t) => {
        const m = toMinutes(t)!;
        return m >= from && m < to;
      }),
      requestedTime: undefined,
    };
  }

  const wanted = toMinutes(value);
  if (wanted === null) return { slots, requestedTime: undefined };
  const sorted = [...slots].sort(
    (a, b) => Math.abs(toMinutes(a)! - wanted) - Math.abs(toMinutes(b)! - wanted),
  );
  return { slots: sorted, requestedTime: toHm(wanted) };
}

export type AvailabilityResult =
  | {
      ok: true;
      date: string;
      timeZone: string;
      slotMinutes: number;
      slots: string[];
      requestedTime?: string;
      requestedAvailable?: boolean;
    }
  | { ok: false; code: "invalid_date" | "past_date" | "business_not_found"; message: string };

/**
 * Real free slots for one date. With a preference, slots are filtered
 * (morning/afternoon/evening) or ordered nearest-first (a "HH:MM" time).
 */
export async function getAvailableSlots(
  businessId: string,
  input: { date: string; preference?: string | null; limit?: number },
  now = new Date(),
): Promise<AvailabilityResult> {
  const date = appointmentDateSchema.safeParse(input.date);
  if (!date.success) {
    return { ok: false, code: "invalid_date", message: date.error.issues[0].message };
  }

  const business = await loadBusiness(businessId);
  if (!business) {
    return { ok: false, code: "business_not_found", message: "Business not found" };
  }
  const timeZone = business.timezone || "Asia/Kolkata";

  if (date.data < localDateInTimeZone(now, timeZone)) {
    return {
      ok: false,
      code: "past_date",
      message: "That date has already passed. Please choose today or a later date.",
    };
  }

  const free = await freeSlotsOnDay(business, date.data, now);
  const { slots, requestedTime } = applyPreference(free, input.preference);

  return {
    ok: true,
    date: date.data,
    timeZone,
    slotMinutes: APPOINTMENT_SLOT_MINUTES,
    slots: input.limit ? slots.slice(0, input.limit) : slots,
    ...(requestedTime
      ? { requestedTime, requestedAvailable: free.includes(requestedTime) }
      : {}),
  };
}

/** The next free slots from `fromDate` onwards (up to two weeks ahead). */
export async function findNextAvailableSlots(
  businessId: string,
  input: { fromDate?: string; preference?: string | null; limit?: number },
  now = new Date(),
): Promise<BookingSlot[]> {
  const business = await loadBusiness(businessId);
  if (!business) return [];
  const timeZone = business.timezone || "Asia/Kolkata";
  const today = localDateInTimeZone(now, timeZone);
  const limit = input.limit ?? 3;

  let date = input.fromDate && input.fromDate > today ? input.fromDate : today;
  const found: BookingSlot[] = [];
  for (let i = 0; i < SEARCH_DAYS && found.length < limit; i++, date = addDays(date, 1)) {
    const { slots } = applyPreference(
      await freeSlotsOnDay(business, date, now),
      input.preference,
    );
    for (const time of slots) {
      if (found.length >= limit) break;
      found.push({ date, time });
    }
  }
  return found;
}

async function alternativesNear(
  businessId: string,
  date: string,
  time: string,
  now: Date,
): Promise<BookingSlot[]> {
  const sameDay = await getAvailableSlots(businessId, { date, preference: time, limit: 3 }, now);
  if (sameDay.ok && sameDay.slots.length) {
    return sameDay.slots.map((t) => ({ date, time: t }));
  }
  return findNextAvailableSlots(businessId, { fromDate: addDays(date, 1) }, now);
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

const appointmentInclude = {
  lead: { select: { id: true, name: true, phone: true, email: true } },
} satisfies Prisma.AppointmentInclude;

export type BookedAppointment = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

export type BookingFailureCode =
  | "invalid_input"
  | "invalid_lead"
  | "invalid_call"
  | "past_time"
  | "outside_hours"
  | "slot_taken";

export type BookingResult =
  | { ok: true; created: boolean; appointment: BookedAppointment; confirmation: string }
  | { ok: false; code: BookingFailureCode; message: string; alternatives: BookingSlot[] };

export const SLOT_TAKEN_MESSAGE =
  "That time is no longer available. Here are the next available slots.";

class SlotTakenError extends Error {}

function failure(
  code: BookingFailureCode,
  message: string,
  alternatives: BookingSlot[] = [],
): BookingResult {
  return { ok: false, code, message, alternatives };
}

/**
 * Book one slot for a lead of `businessId`. Re-checks availability inside a
 * transaction, and the unique slotKey stops two requests taking the same slot.
 * Repeating the same booking (same lead, same slot) returns the existing appointment.
 */
export async function bookAppointment(
  businessId: string,
  rawInput: unknown,
  now = new Date(),
): Promise<BookingResult> {
  const parsed = bookAppointmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return failure("invalid_input", parsed.error.issues[0]?.message ?? "Invalid appointment details");
  }
  const input = parsed.data;

  const business = await loadBusiness(businessId);
  if (!business) return failure("invalid_lead", "Business not found");
  const timeZone = business.timezone || "Asia/Kolkata";

  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, businessId },
    select: { id: true },
  });
  if (!lead) return failure("invalid_lead", "We couldn't find that lead in your business.");

  if (input.callId) {
    const call = await prisma.call.findFirst({
      where: { id: input.callId, businessId, leadId: lead.id },
      select: { id: true },
    });
    if (!call) return failure("invalid_call", "That call does not belong to this lead.");
  }
  if (input.agentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: input.agentId, businessId },
      select: { id: true },
    });
    if (!agent) return failure("invalid_call", "That agent does not belong to your business.");
  }

  const start = zonedDateTimeToUtc(input.date, input.time, timeZone);
  if (!start) return failure("invalid_input", "That date or time is not valid.");
  if (start.getTime() <= now.getTime()) {
    return failure(
      "past_time",
      "That time has already passed. Please choose a future time.",
      await findNextAvailableSlots(businessId, {}, now),
    );
  }
  if (!isBookingDay(input.date, business) || !slotTimesForDay(business).includes(input.time)) {
    return failure(
      "outside_hours",
      `Appointments can only be booked in ${APPOINTMENT_SLOT_MINUTES}-minute slots during business hours (${business.callingWindowStart}–${business.callingWindowEnd}).`,
      await alternativesNear(businessId, input.date, input.time, now),
    );
  }
  const end = new Date(start.getTime() + SLOT_MS);
  const key = slotKey(businessId, start);

  const sameBooking = (a: { leadId: string; date: Date }) =>
    a.leadId === lead.id && a.date.getTime() === start.getTime();

  try {
    const { appointment, created } = await prisma.$transaction(async (tx) => {
      const clash = await tx.appointment.findFirst({
        where: { businessId, ...HOLDS_TIME, ...overlapping(start, end) },
        include: appointmentInclude,
      });
      if (clash) {
        if (sameBooking(clash)) return { appointment: clash, created: false };
        throw new SlotTakenError();
      }

      const saved = await tx.appointment.create({
        data: {
          businessId,
          leadId: lead.id,
          callId: input.callId ?? null,
          agentId: input.agentId ?? null,
          date: start,
          time: input.time,
          endAt: end,
          type: input.type,
          notes: input.notes || null,
          status: AppointmentStatus.SCHEDULED,
          slotKey: key,
        },
        include: appointmentInclude,
      });
      return { appointment: saved, created: true };
    });

    if (created) {
      console.info("[appointments] booked", {
        appointmentId: appointment.id,
        businessId,
        viaCall: Boolean(input.callId),
      });
    }
    return {
      ok: true,
      created,
      appointment,
      confirmation: formatAppointmentConfirmation(appointment, timeZone),
    };
  } catch (error) {
    const lostRace =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    if (!(error instanceof SlotTakenError) && !lostRace) throw error;

    if (lostRace) {
      const winner = await prisma.appointment.findUnique({
        where: { slotKey: key },
        include: appointmentInclude,
      });
      if (winner && sameBooking(winner)) {
        return {
          ok: true,
          created: false,
          appointment: winner,
          confirmation: formatAppointmentConfirmation(winner, timeZone),
        };
      }
    }
    return failure(
      "slot_taken",
      SLOT_TAKEN_MESSAGE,
      await alternativesNear(businessId, input.date, input.time, now),
    );
  }
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

const NEXT_STATUSES: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"],
  CONFIRMED: ["CANCELLED", "COMPLETED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function allowedNextStatuses(status: AppointmentStatus): AppointmentStatus[] {
  return NEXT_STATUSES[status];
}

export type StatusChangeResult =
  | { ok: true; appointment: BookedAppointment }
  | { ok: false; code: "not_found" | "invalid_transition" | "not_started"; message: string };

/** Cancelling keeps the appointment for history and frees its slot. */
export async function updateAppointmentStatus(
  businessId: string,
  appointmentId: string,
  status: AppointmentStatus,
  now = new Date(),
): Promise<StatusChangeResult> {
  const current = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    select: { status: true, date: true },
  });
  if (!current) return { ok: false, code: "not_found", message: "Appointment not found" };

  if (!NEXT_STATUSES[current.status].includes(status)) {
    return {
      ok: false,
      code: "invalid_transition",
      message: `A ${statusLabel(current.status).toLowerCase()} appointment cannot be marked ${statusLabel(status).toLowerCase()}.`,
    };
  }
  if (
    (status === AppointmentStatus.COMPLETED || status === AppointmentStatus.NO_SHOW) &&
    current.date.getTime() > now.getTime()
  ) {
    return {
      ok: false,
      code: "not_started",
      message: "You can mark it completed or no-show once the appointment time has started.",
    };
  }

  const updated = await prisma.appointment.updateMany({
    where: { id: appointmentId, businessId, status: current.status },
    data: {
      status,
      ...(status === AppointmentStatus.CANCELLED ? { slotKey: null } : {}),
    },
  });
  if (updated.count === 0) {
    return {
      ok: false,
      code: "invalid_transition",
      message: "This appointment was just changed by someone else. Refresh and try again.",
    };
  }

  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: appointmentInclude,
  });
  return { ok: true, appointment };
}

// ---------------------------------------------------------------------------
// Reading + display
// ---------------------------------------------------------------------------

export function listAppointments(businessId: string) {
  return prisma.appointment.findMany({
    where: { businessId },
    include: appointmentInclude,
    orderBy: { date: "asc" },
  });
}

export function getAppointment(businessId: string, appointmentId: string) {
  return prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    include: {
      ...appointmentInclude,
      call: { select: { id: true, status: true, createdAt: true } },
      agent: { select: { id: true, name: true } },
    },
  });
}

export function statusLabel(status: AppointmentStatus): string {
  return status === "NO_SHOW" ? "No-show" : status.charAt(0) + status.slice(1).toLowerCase();
}

export function typeLabel(type: string | null): string {
  if (!type) return "Appointment";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** "Oct 2, 2026" and "3:00 PM" in the business timezone. */
export function formatAppointmentWhen(
  appointment: { date: Date; time: string | null; endAt: Date | null },
  timeZone: string,
): { date: string; time: string } {
  // Rows from before slot booking store only the day (UTC midnight) plus a free-text time.
  if (!appointment.endAt) {
    return {
      date: appointment.date.toLocaleDateString("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: appointment.time || "—",
    };
  }
  return {
    date: appointment.date.toLocaleDateString("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: appointment.date.toLocaleTimeString("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function toAppointmentRow(
  appointment: BookedAppointment,
  timeZone: string,
) {
  const when = formatAppointmentWhen(appointment, timeZone);
  return {
    id: appointment.id,
    customer: appointment.lead.name,
    date: when.date,
    time: when.time,
    type: typeLabel(appointment.type),
    status: statusLabel(appointment.status),
    statusValue: appointment.status,
  };
}

/** Spoken/displayed confirmation, built only from the saved appointment. */
export function formatAppointmentConfirmation(
  appointment: { date: Date; type: string | null; lead: { name: string } },
  timeZone: string,
): string {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(appointment.date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(appointment.date);
  return `${appointment.lead.name}, your ${typeLabel(appointment.type).toLowerCase()} appointment is confirmed for ${day} at ${time}.`;
}

/** "Friday, October 2 at 3:00 PM" for a date + slot time. */
export function describeSlot(slot: BookingSlot, timeZone: string): string {
  const start = zonedDateTimeToUtc(slot.date, slot.time, timeZone);
  if (!start) return `${slot.date} ${slot.time}`;
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
  return `${day} at ${time}`;
}
