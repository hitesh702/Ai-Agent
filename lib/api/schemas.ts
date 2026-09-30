import { z } from "zod";
import { AgentLanguage, AppointmentStatus, LeadStatus } from "@prisma/client";
import { CAMPAIGN_DEFAULTS } from "@/lib/campaigns/rules";

export const registerBodySchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
  businessName: z.string().trim().min(2),
});

export const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const businessUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
});

export const knowledgeCreateSchema = z.object({
  category: z.string().trim().min(1),
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  active: z.boolean().optional().default(true),
});

export const knowledgeUpdateSchema = z.object({
  category: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
});

export const agentCreateSchema = z.object({
  name: z.string().trim().min(2),
  language: z.nativeEnum(AgentLanguage).optional().default("HINGLISH"),
  voice: z.string().trim().optional().nullable(),
  systemPrompt: z.string().trim().optional().nullable(),
  objective: z.string().trim().optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const agentUpdateSchema = agentCreateSchema.partial();

export const leadCreateSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().min(10).max(20),
  email: z.string().trim().email().optional().nullable(),
  source: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  status: z.nativeEnum(LeadStatus).optional(),
  company: z.string().trim().optional().nullable(),
  assignedTo: z.string().trim().optional().nullable(),
  followUpAt: z.string().optional().nullable(),
  followUpNote: z.string().trim().optional().nullable(),
  followUpReminder: z.boolean().optional(),
});

export const leadUpdateSchema = leadCreateSchema.partial();

export const startCallSchema = z.object({
  agentId: z.string().min(1),
  leadId: z.string().min(1),
});

/** Booking goes through the slot rules in lib/appointments/booking.ts. */
export { bookAppointmentSchema as appointmentCreateSchema } from "@/lib/appointments/booking";

export const appointmentStatusUpdateSchema = z.object({
  status: z.nativeEnum(AppointmentStatus, { message: "Choose a valid appointment status" }),
});

export const appointmentAvailabilityQuerySchema = z.object({
  date: z.string().trim().min(1, "date is required (YYYY-MM-DD)"),
  preference: z.string().trim().max(20).optional(),
  appointmentType: z.string().trim().max(40).optional(),
});

const hhmm = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour) time");

const retryMinutes = (label: string) =>
  z.coerce
    .number()
    .int()
    .min(15, `${label} must be at least 15 minutes`)
    .max(10080, `${label} cannot exceed 7 days`);

export const campaignConfigSchema = z.object({
  name: z.string().trim().min(2, "Campaign name is required").max(120),
  agentId: z.string().min(1, "Select an agent"),
  callingDays: z
    .array(z.coerce.number().int().min(1).max(7))
    .min(1, "Select at least one calling day")
    .transform((days) => [...new Set(days)].sort().join(",")),
  callingWindowStart: hhmm,
  callingWindowEnd: hhmm,
  maxAttempts: z.coerce
    .number()
    .int()
    .min(1, "Maximum attempts must be at least 1")
    .max(10, "Maximum attempts cannot exceed 10"),
  busyRetryMinutes: retryMinutes("Busy retry delay"),
  retryDelayMinutes: retryMinutes("No-answer retry delay"),
  failedRetryMinutes: retryMinutes("Failed-call retry delay"),
  retryOnVoicemail: z.boolean(),
  createFollowUps: z.boolean(),
});

const d = CAMPAIGN_DEFAULTS;
const shape = campaignConfigSchema.shape;

export const campaignCreateSchema = campaignConfigSchema.extend({
  leadIds: z.array(z.string().min(1)).optional().default([]),
  callingDays: shape.callingDays.prefault([...d.callingDays]),
  callingWindowStart: hhmm.default(d.callingWindowStart),
  callingWindowEnd: hhmm.default(d.callingWindowEnd),
  maxAttempts: shape.maxAttempts.default(d.maxAttempts),
  busyRetryMinutes: shape.busyRetryMinutes.default(d.busyRetryMinutes),
  retryDelayMinutes: shape.retryDelayMinutes.default(d.retryDelayMinutes),
  failedRetryMinutes: shape.failedRetryMinutes.default(d.failedRetryMinutes),
  retryOnVoicemail: z.boolean().default(d.retryOnVoicemail),
  createFollowUps: z.boolean().default(d.createFollowUps),
});

export const campaignStartSchema = z.object({
  confirm: z.literal(true, { message: "Confirm before starting the campaign" }),
});

export const webhookEnvelopeSchema = z
  .object({
    message: z
      .object({
        type: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
