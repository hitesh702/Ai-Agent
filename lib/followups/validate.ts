import { FollowUpStatus, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isTelephonyConfigured } from "@/lib/telephony";
import {
  isWithinCallingWindow,
  nextAllowedCallingTime,
  type CallingWindowConfig,
} from "./schedule";

export type FollowUpValidationResult =
  | { ok: true; agentId: string }
  | {
      ok: false;
      action: "cancel" | "skip" | "reschedule" | "retry_later";
      reason: string;
      rescheduleAt?: Date;
    };

export async function validateFollowUpForCalling(
  followUpId: string,
  now = new Date(),
): Promise<FollowUpValidationResult> {
  const followUp = await prisma.followUp.findUnique({
    where: { id: followUpId },
    include: {
      business: true,
      lead: true,
      agent: true,
    },
  });

  if (!followUp) {
    return { ok: false, action: "skip", reason: "Follow-up not found" };
  }

  if (
    followUp.status === FollowUpStatus.CANCELLED ||
    followUp.status === FollowUpStatus.COMPLETED ||
    followUp.status === FollowUpStatus.SKIPPED
  ) {
    return {
      ok: false,
      action: "skip",
      reason: `Follow-up already ${followUp.status}`,
    };
  }

  const business = followUp.business;
  const lead = followUp.lead;

  if (!lead) {
    return { ok: false, action: "skip", reason: "Lead missing" };
  }

  // Opt-out / explicit refusal
  if (lead.status === LeadStatus.NOT_INTERESTED) {
    return {
      ok: false,
      action: "cancel",
      reason: "Lead opted out or refused further calls",
    };
  }

  if (lead.status === LeadStatus.CONVERTED) {
    return {
      ok: false,
      action: "skip",
      reason: "Lead already converted",
    };
  }

  if (!business.callingEnabled) {
    return {
      ok: false,
      action: "retry_later",
      reason: "Business calling is disabled",
      rescheduleAt: new Date(now.getTime() + 60 * 60 * 1000),
    };
  }

  if (!business.followUpCallingEnabled) {
    return {
      ok: false,
      action: "cancel",
      reason: "Follow-up calling is disabled for this business",
    };
  }

  if (!isTelephonyConfigured()) {
    return {
      ok: false,
      action: "retry_later",
      reason: "Telephony provider is not configured",
      rescheduleAt: new Date(now.getTime() + 30 * 60 * 1000),
    };
  }

  const windowConfig: CallingWindowConfig = {
    timezone: business.timezone || "Asia/Kolkata",
    callingWindowStart: business.callingWindowStart || "09:00",
    callingWindowEnd: business.callingWindowEnd || "20:00",
    callingDays: business.callingDays || "1,2,3,4,5,6",
  };

  if (!isWithinCallingWindow(now, windowConfig)) {
    const next = nextAllowedCallingTime(now, windowConfig);
    return {
      ok: false,
      action: "reschedule",
      reason: "Outside business calling hours",
      rescheduleAt: next,
    };
  }

  const maxAttempts = business.maxFollowUpAttempts ?? 3;
  if (followUp.attempts >= maxAttempts) {
    return {
      ok: false,
      action: "skip",
      reason: `Maximum follow-up attempts reached (${maxAttempts})`,
    };
  }

  // Resolve agent: prefer follow-up agent, else any active agent for business
  let agentId = followUp.agentId;
  if (agentId) {
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        businessId: business.id,
        active: true,
      },
    });
    if (!agent) agentId = null;
  }

  if (!agentId) {
    const fallback = await prisma.agent.findFirst({
      where: { businessId: business.id, active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!fallback) {
      return {
        ok: false,
        action: "retry_later",
        reason: "No active AI agent configured",
        rescheduleAt: new Date(now.getTime() + 60 * 60 * 1000),
      };
    }
    agentId = fallback.id;
  }

  return { ok: true, agentId };
}
