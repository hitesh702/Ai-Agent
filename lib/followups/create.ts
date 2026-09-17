import { FollowUpStatus, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseFollowUpScheduleInput } from "./schedule";

const ACTIVE_FOLLOW_UP: FollowUpStatus[] = [
  FollowUpStatus.PENDING,
  FollowUpStatus.READY,
  FollowUpStatus.QUEUED,
];

export type CreateFollowUpInput = {
  businessId: string;
  leadId: string;
  agentId?: string | null;
  callId?: string | null;
  scheduledAt: Date;
  reason?: string | null;
};

export async function createFollowUpJob(
  input: CreateFollowUpInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (Number.isNaN(input.scheduledAt.getTime())) {
    throw new Error("Invalid follow-up scheduledAt");
  }

  // Duplicate protection: one active follow-up per lead (or same source call)
  if (input.callId) {
    const existingForCall = await tx.followUp.findFirst({
      where: {
        callId: input.callId,
        status: { in: ACTIVE_FOLLOW_UP },
      },
    });
    if (existingForCall) {
      console.info("[follow-up] skip duplicate for call", {
        callId: input.callId,
        followUpId: existingForCall.id,
      });
      return existingForCall;
    }
  }

  const existingForLead = await tx.followUp.findFirst({
    where: {
      leadId: input.leadId,
      businessId: input.businessId,
      status: { in: ACTIVE_FOLLOW_UP },
    },
  });
  if (existingForLead) {
    // Reschedule existing pending job instead of creating a second one
    return tx.followUp.update({
      where: { id: existingForLead.id },
      data: {
        scheduledAt: input.scheduledAt,
        nextAttemptAt: input.scheduledAt,
        agentId: input.agentId ?? existingForLead.agentId,
        callId: input.callId ?? existingForLead.callId,
        reason: input.reason ?? existingForLead.reason,
        status: FollowUpStatus.PENDING,
        skipReason: null,
      },
    });
  }

  const created = await tx.followUp.create({
    data: {
      businessId: input.businessId,
      leadId: input.leadId,
      agentId: input.agentId ?? null,
      callId: input.callId ?? null,
      scheduledAt: input.scheduledAt,
      nextAttemptAt: input.scheduledAt,
      status: FollowUpStatus.PENDING,
      reason: input.reason ?? null,
    },
  });

  console.info("[follow-up] created", {
    followUpId: created.id,
    businessId: input.businessId,
    leadId: input.leadId,
    scheduledAt: created.scheduledAt.toISOString(),
  });

  return created;
}

/**
 * After a call completes with followUpRequired from analysis, persist lead + job.
 */
export async function scheduleFollowUpFromCallResult(input: {
  businessId: string;
  leadId: string;
  agentId: string;
  callId: string;
  followUpRequired: boolean;
  followUpDate?: Date | string | null;
}) {
  if (!input.followUpRequired) return null;

  const scheduledAt =
    parseFollowUpScheduleInput({ scheduledAt: input.followUpDate }) ??
    new Date(Date.now() + 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: input.leadId },
      data: {
        followUpRequired: true,
        followUpAt: scheduledAt,
        status: LeadStatus.FOLLOW_UP,
      },
    });

    return createFollowUpJob(
      {
        businessId: input.businessId,
        leadId: input.leadId,
        agentId: input.agentId,
        callId: input.callId,
        scheduledAt,
        reason: "Customer requested follow-up on call",
      },
      tx,
    );
  });
}

export async function scheduleManualFollowUp(input: {
  businessId: string;
  leadId: string;
  agentId?: string | null;
  scheduledAt: Date;
  note?: string | null;
  reminder?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: input.leadId },
      data: {
        followUpRequired: true,
        followUpAt: input.scheduledAt,
        followUpNote: input.note ?? null,
        followUpReminder: input.reminder ?? true,
        status: LeadStatus.FOLLOW_UP,
      },
    });

    return createFollowUpJob(
      {
        businessId: input.businessId,
        leadId: input.leadId,
        agentId: input.agentId ?? null,
        scheduledAt: input.scheduledAt,
        reason: input.note || "Manually scheduled follow-up",
      },
      tx,
    );
  });
}

export async function cancelActiveFollowUpsForLead(input: {
  businessId: string;
  leadId: string;
  reason?: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: input.leadId },
      data: {
        followUpRequired: false,
        followUpAt: null,
        followUpNote: null,
        followUpReminder: false,
      },
    });

    await tx.followUp.updateMany({
      where: {
        businessId: input.businessId,
        leadId: input.leadId,
        status: { in: ACTIVE_FOLLOW_UP },
      },
      data: {
        status: FollowUpStatus.CANCELLED,
        skipReason: input.reason || "Cancelled by user",
      },
    });
  });
}
