import { z } from "zod";
import { AgentLanguage, AppointmentStatus, LeadStatus } from "@prisma/client";

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

export const appointmentCreateSchema = z.object({
  leadId: z.string().min(1),
  callId: z.string().optional().nullable(),
  date: z.string().min(1),
  time: z.string().trim().optional().nullable(),
  type: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  status: z.nativeEnum(AppointmentStatus).optional(),
});

export const campaignCreateSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().trim().min(2),
  leadIds: z.array(z.string().min(1)).optional().default([]),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
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
