import { CallStatus, CampaignLeadStatus, CampaignStatus, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { classifyCallOutcome, type CallOutcome } from "@/lib/calling/outcome";
import {
  ACTIVE_CALL_STATUSES,
  enqueueOutboundCall,
  STALE_ACTIVE_CALL_MS,
  type StartCallFn,
} from "@/lib/calling/safe-queue";
import { isWithinCallingWindow } from "@/lib/followups/schedule";
import { campaignWindow, decideAfterCall } from "./rules";

/** Wait this long for the end-of-call report before finalizing from the stored call. */
const REPORT_GRACE_MS = 2 * 60 * 1000;
const MAX_CAMPAIGNS_PER_RUN = 50;

type QueueOptions = { now?: Date; startCall?: StartCallFn };

export type CampaignTickResult = {
  campaignId: string;
  state:
    | "not_running"
    | "completed"
    | "failed"
    | "outside_schedule"
    | "calling_disabled"
    | "processed";
  started: number;
  skipped: number;
  reconciled: number;
};

export async function countActiveCampaignCalls(campaignId: string) {
  return prisma.call.count({
    where: {
      campaignLead: { campaignId },
      status: { in: ACTIVE_CALL_STATUSES },
      createdAt: { gte: new Date(Date.now() - STALE_ACTIVE_CALL_MS) },
    },
  });
}

async function failCampaign(campaignId: string, reason: string) {
  const res = await prisma.campaign.updateMany({
    where: { id: campaignId, status: CampaignStatus.RUNNING },
    data: { status: CampaignStatus.FAILED, failureReason: reason },
  });
  if (res.count) console.error("[campaign] failed", { campaignId, reason });
}

async function revertClaim(campaignLeadId: string) {
  await prisma.campaignLead.updateMany({
    where: { id: campaignLeadId, status: CampaignLeadStatus.CALLING },
    data: { status: CampaignLeadStatus.PENDING, attempts: { decrement: 1 } },
  });
}

/**
 * Apply a finished call's outcome to its campaign lead (retry, complete, or stop).
 * Idempotent: only the first terminal update for a CALLING lead changes state.
 */
export async function applyCampaignCallOutcome(
  callId: string,
  outcome: CallOutcome,
  now = new Date(),
) {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      campaignLead: {
        include: { campaign: { include: { business: { select: { timezone: true } } } } },
      },
    },
  });
  const cl = call?.campaignLead;
  if (!cl) return null;

  const campaign = cl.campaign;
  const decision = decideAfterCall({
    outcome,
    attempts: cl.attempts,
    rules: campaign,
    window: campaignWindow(campaign, campaign.business.timezone),
    now,
  });

  const res = await prisma.campaignLead.updateMany({
    where: { id: cl.id, status: CampaignLeadStatus.CALLING },
    data: decision,
  });

  if (res.count === 0) {
    // A later report can sharpen a plain CONNECTED into refusal/opt-out.
    if (
      (outcome === "REFUSED" || outcome === "OPTED_OUT") &&
      cl.status === CampaignLeadStatus.COMPLETED &&
      cl.lastOutcome === "CONNECTED"
    ) {
      await prisma.campaignLead.update({
        where: { id: cl.id },
        data: { lastOutcome: outcome },
      });
    }
    return { campaignId: campaign.id, businessId: campaign.businessId };
  }

  const log = {
    campaignId: campaign.id,
    campaignLeadId: cl.id,
    callId,
    outcome,
    attempts: cl.attempts,
  };
  if (outcome === "OPTED_OUT") console.info("[campaign] opt-out detected", log);
  if (decision.status === CampaignLeadStatus.PENDING) {
    console.info("[campaign] retry scheduled", {
      ...log,
      nextAttemptAt: decision.nextAttemptAt?.toISOString(),
    });
  } else {
    console.info("[campaign] call completed", { ...log, leadStatus: decision.status });
  }
  return { campaignId: campaign.id, businessId: campaign.businessId };
}

async function reconcileCallingLeads(campaignId: string, now: Date) {
  const calling = await prisma.campaignLead.findMany({
    where: { campaignId, status: CampaignLeadStatus.CALLING },
    include: {
      lead: { select: { doNotCall: true } },
      calls: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { result: { select: { interest: true } } },
      },
    },
  });

  let reconciled = 0;
  for (const cl of calling) {
    const call = cl.calls[0];
    if (!call) {
      if (!cl.lastAttemptAt || now.getTime() - cl.lastAttemptAt.getTime() > REPORT_GRACE_MS) {
        await revertClaim(cl.id);
        reconciled++;
      }
      continue;
    }

    const terminal = call.status === CallStatus.ENDED || call.status === CallStatus.FAILED;
    if (terminal) {
      const endedAt = call.endedAt ?? call.createdAt;
      if (now.getTime() - endedAt.getTime() < REPORT_GRACE_MS) continue;
      const outcome = classifyCallOutcome({
        status: call.status,
        endedReason: call.endedReason ?? call.errorMessage,
        interest: call.result?.interest,
        optOut: cl.lead.doNotCall,
      });
      if (outcome) {
        await applyCampaignCallOutcome(call.id, outcome, now);
        reconciled++;
      }
      continue;
    }

    if (now.getTime() - call.createdAt.getTime() > STALE_ACTIVE_CALL_MS) {
      await prisma.call.update({
        where: { id: call.id },
        data: {
          status: CallStatus.FAILED,
          errorMessage: "No final status received from provider",
          endedAt: now,
        },
      });
      await applyCampaignCallOutcome(call.id, "FAILED", now);
      reconciled++;
    }
  }
  return reconciled;
}

async function skipBlockedLeads(campaignId: string, maxAttempts: number) {
  const pending = { campaignId, status: CampaignLeadStatus.PENDING };
  const skip = (lastOutcome: string) => ({
    status: CampaignLeadStatus.SKIPPED,
    lastOutcome,
    nextAttemptAt: null,
  });

  const optedOut = await prisma.campaignLead.updateMany({
    where: { ...pending, lead: { doNotCall: true } },
    data: skip("OPTED_OUT"),
  });
  const refused = await prisma.campaignLead.updateMany({
    where: { ...pending, lead: { status: LeadStatus.NOT_INTERESTED } },
    data: skip("REFUSED"),
  });
  const exhausted = await prisma.campaignLead.updateMany({
    where: { ...pending, attempts: { gte: maxAttempts } },
    data: skip("MAX_ATTEMPTS"),
  });

  const total = optedOut.count + refused.count + exhausted.count;
  if (total > 0) {
    console.info("[campaign] leads skipped", {
      campaignId,
      optedOut: optedOut.count,
      refused: refused.count,
      maxAttempts: exhausted.count,
    });
  }
  return total;
}

async function completeIfDone(campaignId: string) {
  const open = await prisma.campaignLead.count({
    where: {
      campaignId,
      status: { in: [CampaignLeadStatus.PENDING, CampaignLeadStatus.CALLING] },
    },
  });
  if (open > 0) return false;
  const res = await prisma.campaign.updateMany({
    where: { id: campaignId, status: CampaignStatus.RUNNING },
    data: { status: CampaignStatus.COMPLETED, endTime: new Date() },
  });
  if (res.count) console.info("[campaign] completed", { campaignId });
  return true;
}

/**
 * One queue pass for a RUNNING campaign: reconcile finished calls, skip blocked leads,
 * then start calls one at a time through the shared safe queue until no slot is free.
 */
export async function processCampaignQueue(
  campaignId: string,
  options: QueueOptions = {},
): Promise<CampaignTickResult> {
  const now = options.now ?? new Date();
  const result: CampaignTickResult = {
    campaignId,
    state: "processed",
    started: 0,
    skipped: 0,
    reconciled: 0,
  };

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { business: true, agent: true },
  });
  if (!campaign || campaign.status !== CampaignStatus.RUNNING) {
    return { ...result, state: "not_running" };
  }

  result.reconciled = await reconcileCallingLeads(campaign.id, now);
  result.skipped = await skipBlockedLeads(campaign.id, campaign.maxAttempts);

  if (await completeIfDone(campaign.id)) return { ...result, state: "completed" };

  if (!campaign.agent.active || campaign.agent.businessId !== campaign.businessId) {
    await failCampaign(campaign.id, "Campaign agent is inactive or missing");
    return { ...result, state: "failed" };
  }
  if (!campaign.business.callingEnabled) {
    return { ...result, state: "calling_disabled" };
  }
  if (!isWithinCallingWindow(now, campaignWindow(campaign, campaign.business.timezone))) {
    return { ...result, state: "outside_schedule" };
  }

  const candidates = await prisma.campaignLead.findMany({
    where: {
      campaignId: campaign.id,
      status: CampaignLeadStatus.PENDING,
      attempts: { lt: campaign.maxAttempts },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      lead: {
        businessId: campaign.businessId,
        doNotCall: false,
        status: { not: LeadStatus.NOT_INTERESTED },
        // Skip leads already on a call (e.g. from another campaign or a manual call).
        calls: {
          none: {
            status: { in: ACTIVE_CALL_STATUSES },
            createdAt: { gte: new Date(now.getTime() - STALE_ACTIVE_CALL_MS) },
          },
        },
      },
    },
    orderBy: [{ attempts: "asc" }, { id: "asc" }],
    take: 20,
  });

  for (const candidate of candidates) {
    const current = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      select: { status: true },
    });
    if (current?.status !== CampaignStatus.RUNNING) break;

    const claimed = await prisma.campaignLead.updateMany({
      where: { id: candidate.id, status: CampaignLeadStatus.PENDING },
      data: {
        status: CampaignLeadStatus.CALLING,
        attempts: { increment: 1 },
        lastAttemptAt: now,
        nextAttemptAt: null,
      },
    });
    if (claimed.count === 0) continue;

    console.info("[campaign] queue selected lead", {
      campaignId: campaign.id,
      campaignLeadId: candidate.id,
      attempt: candidate.attempts + 1,
    });

    const claimedAt = new Date();
    const res = await enqueueOutboundCall(
      {
        businessId: campaign.businessId,
        agentId: campaign.agentId,
        leadId: candidate.leadId,
        campaignLeadId: candidate.id,
      },
      options.startCall,
    );

    if (res.ok && !res.deferred) {
      result.started++;
      continue;
    }
    if (res.ok && res.deferred) {
      await revertClaim(candidate.id);
      break;
    }

    if (res.httpStatus === 409) {
      await revertClaim(candidate.id);
      continue;
    }
    if (res.httpStatus === 403) {
      await revertClaim(candidate.id);
      await prisma.campaignLead.update({
        where: { id: candidate.id },
        data: { status: CampaignLeadStatus.SKIPPED, lastOutcome: "OPTED_OUT" },
      });
      result.skipped++;
      continue;
    }
    if (res.httpStatus === 503 || res.httpStatus === 400) {
      await revertClaim(candidate.id);
      await failCampaign(campaign.id, res.error);
      return { ...result, state: "failed" };
    }

    const failedCall = await prisma.call.findFirst({
      where: { campaignLeadId: candidate.id, createdAt: { gte: claimedAt } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (failedCall) {
      await applyCampaignCallOutcome(failedCall.id, "FAILED", now);
      continue;
    }
    // No call was created: transient error. Release the lead and let the next pass retry.
    await revertClaim(candidate.id);
    break;
  }

  await completeIfDone(campaign.id);
  return result;
}

/** Advance every RUNNING campaign (optionally for one business), one campaign at a time. */
export async function processRunningCampaigns(
  filter: { businessId?: string } = {},
  options: QueueOptions = {},
) {
  const campaigns = await prisma.campaign.findMany({
    where: { status: CampaignStatus.RUNNING, ...(filter.businessId ? { businessId: filter.businessId } : {}) },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: MAX_CAMPAIGNS_PER_RUN,
  });

  const results: CampaignTickResult[] = [];
  for (const c of campaigns) {
    try {
      results.push(await processCampaignQueue(c.id, options));
    } catch (error) {
      console.error("[campaign] queue pass failed", {
        campaignId: c.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
