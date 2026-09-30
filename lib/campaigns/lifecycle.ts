import { CampaignLeadStatus, CampaignStatus, LeadStatus } from "@prisma/client";
import type { z } from "zod";
import { ApiError } from "@/lib/api/http";
import { campaignConfigSchema, type campaignCreateSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";
import { processCampaignQueue } from "./queue";

export type CampaignInput = z.output<typeof campaignCreateSchema>;

const EDITABLE: CampaignStatus[] = [CampaignStatus.DRAFT, CampaignStatus.READY];
/** FAILED can be started again once the problem (e.g. telephony setup) is fixed. */
const STARTABLE: CampaignStatus[] = [CampaignStatus.READY, CampaignStatus.FAILED];

export const NO_ELIGIBLE_LEADS =
  "No eligible leads. Opted-out, refused and fully attempted leads are never called.";

async function getOwnedCampaign(businessId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, businessId },
    include: { agent: true },
  });
  if (!campaign) throw new ApiError(404, "Campaign not found");
  return campaign;
}

async function assertOwnedAgentAndLeads(
  businessId: string,
  agentId: string,
  leadIds: string[],
) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, businessId } });
  if (!agent) throw new ApiError(404, "Agent not found");
  if (leadIds.length) {
    const count = await prisma.lead.count({
      where: { businessId, id: { in: leadIds } },
    });
    if (count !== leadIds.length) {
      throw new ApiError(400, "One or more leads are invalid");
    }
  }
}

function configData(input: CampaignInput) {
  return {
    name: input.name,
    agentId: input.agentId,
    callingDays: input.callingDays,
    callingWindowStart: input.callingWindowStart,
    callingWindowEnd: input.callingWindowEnd,
    maxAttempts: input.maxAttempts,
    busyRetryMinutes: input.busyRetryMinutes,
    retryDelayMinutes: input.retryDelayMinutes,
    failedRetryMinutes: input.failedRetryMinutes,
    retryOnVoicemail: input.retryOnVoicemail,
    createFollowUps: input.createFollowUps,
  };
}

export async function createCampaign(businessId: string, input: CampaignInput) {
  const leadIds = [...new Set(input.leadIds)];
  await assertOwnedAgentAndLeads(businessId, input.agentId, leadIds);
  return prisma.campaign.create({
    data: {
      businessId,
      status: CampaignStatus.DRAFT,
      ...configData(input),
      leads: { create: leadIds.map((leadId) => ({ leadId })) },
    },
  });
}

/** Edit a campaign that has not started dialing. Any edit returns it to DRAFT. */
export async function updateCampaign(
  businessId: string,
  campaignId: string,
  input: CampaignInput,
) {
  const campaign = await getOwnedCampaign(businessId, campaignId);
  if (!EDITABLE.includes(campaign.status)) {
    throw new ApiError(409, "Only draft or ready campaigns can be edited");
  }
  const attempted = await prisma.campaignLead.count({
    where: { campaignId, attempts: { gt: 0 } },
  });
  if (attempted > 0) {
    throw new ApiError(409, "This campaign has already placed calls and cannot be edited");
  }

  const leadIds = [...new Set(input.leadIds)];
  await assertOwnedAgentAndLeads(businessId, input.agentId, leadIds);

  return prisma.$transaction(async (tx) => {
    await tx.campaignLead.deleteMany({
      where: { campaignId, leadId: { notIn: leadIds } },
    });
    const existing = await tx.campaignLead.findMany({
      where: { campaignId },
      select: { leadId: true },
    });
    const have = new Set(existing.map((r) => r.leadId));
    const missing = leadIds.filter((id) => !have.has(id));
    if (missing.length) {
      await tx.campaignLead.createMany({
        data: missing.map((leadId) => ({ campaignId, leadId })),
      });
    }
    return tx.campaign.update({
      where: { id: campaignId },
      data: { ...configData(input), status: CampaignStatus.DRAFT, failureReason: null },
    });
  });
}

export async function getCampaignReadiness(businessId: string, campaignId: string) {
  const campaign = await getOwnedCampaign(businessId, campaignId);
  const errors: string[] = [];

  const config = campaignConfigSchema.safeParse({
    name: campaign.name,
    agentId: campaign.agentId,
    callingDays: campaign.callingDays.split(",").filter(Boolean),
    callingWindowStart: campaign.callingWindowStart,
    callingWindowEnd: campaign.callingWindowEnd,
    maxAttempts: campaign.maxAttempts,
    busyRetryMinutes: campaign.busyRetryMinutes,
    retryDelayMinutes: campaign.retryDelayMinutes,
    failedRetryMinutes: campaign.failedRetryMinutes,
    retryOnVoicemail: campaign.retryOnVoicemail,
    createFollowUps: campaign.createFollowUps,
  });
  if (!config.success) {
    errors.push(...config.error.issues.map((i) => i.message));
  }
  if (campaign.agent.businessId !== businessId || !campaign.agent.active) {
    errors.push("Select an active agent");
  }

  const [eligible, calling] = await Promise.all([
    prisma.campaignLead.count({
      where: {
        campaignId,
        status: CampaignLeadStatus.PENDING,
        attempts: { lt: campaign.maxAttempts },
        lead: { businessId, doNotCall: false, status: { not: LeadStatus.NOT_INTERESTED } },
      },
    }),
    prisma.campaignLead.count({
      where: { campaignId, status: CampaignLeadStatus.CALLING },
    }),
  ]);
  if (eligible + calling === 0) errors.push(NO_ELIGIBLE_LEADS);

  return { campaign, errors, eligible, calling };
}

export async function markCampaignReady(businessId: string, campaignId: string) {
  const { campaign, errors } = await getCampaignReadiness(businessId, campaignId);
  if (campaign.status === CampaignStatus.READY) return campaign;
  if (campaign.status !== CampaignStatus.DRAFT) {
    throw new ApiError(409, "Only draft campaigns can be marked ready");
  }
  if (errors.length) throw new ApiError(400, errors.join(" "));

  const res = await prisma.campaign.updateMany({
    where: { id: campaignId, status: CampaignStatus.DRAFT },
    data: { status: CampaignStatus.READY, failureReason: null },
  });
  if (res.count === 0) throw new ApiError(409, "Campaign changed; reload and try again");
  console.info("[campaign] marked ready", { campaignId });
  return getOwnedCampaign(businessId, campaignId);
}

/**
 * Moves an owned campaign from one of `from` to RUNNING after re-checking the
 * agent, leads and schedule, then runs one queue pass (which respects the
 * concurrency limit and calling window).
 */
async function activateCampaign(
  businessId: string,
  campaignId: string,
  from: CampaignStatus[],
  label: "started" | "resumed",
) {
  const { campaign, errors } = await getCampaignReadiness(businessId, campaignId);
  if (!from.includes(campaign.status)) {
    if (campaign.status === CampaignStatus.DRAFT) {
      throw new ApiError(409, "Mark the campaign ready before starting it");
    }
    if (campaign.status === CampaignStatus.PAUSED) {
      throw new ApiError(409, "This campaign is paused. Use Resume instead.");
    }
    throw new ApiError(
      409,
      `Campaign is ${campaign.status.toLowerCase()} and cannot be ${label}`,
    );
  }
  // A paused campaign with nothing left to call is completed by the queue pass.
  const blocking =
    label === "resumed" ? errors.filter((e) => e !== NO_ELIGIBLE_LEADS) : errors;
  if (blocking.length) throw new ApiError(400, blocking.join(" "));

  const res = await prisma.campaign.updateMany({
    where: { id: campaignId, businessId, status: { in: from } },
    data: {
      status: CampaignStatus.RUNNING,
      failureReason: null,
      startTime: campaign.startTime ?? new Date(),
    },
  });
  if (res.count === 0) throw new ApiError(409, "Campaign changed; reload and try again");
  console.info(`[campaign] ${label}`, { campaignId });

  let tick = null;
  try {
    tick = await processCampaignQueue(campaignId);
  } catch (error) {
    console.error("[campaign] first queue pass failed", {
      campaignId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return { campaign: await getOwnedCampaign(businessId, campaignId), tick };
}

/** READY (or FAILED) → RUNNING. Requires explicit confirmation from the user. */
export async function startCampaign(
  businessId: string,
  campaignId: string,
  confirmed: boolean,
) {
  if (confirmed !== true) {
    throw new ApiError(400, "Confirm before starting the campaign");
  }
  return activateCampaign(businessId, campaignId, STARTABLE, "started");
}

/** PAUSED → RUNNING. Attempts are kept; leads already called are not called again early. */
export async function resumeCampaign(businessId: string, campaignId: string) {
  return activateCampaign(businessId, campaignId, [CampaignStatus.PAUSED], "resumed");
}

export async function pauseCampaign(businessId: string, campaignId: string) {
  await getOwnedCampaign(businessId, campaignId);
  const res = await prisma.campaign.updateMany({
    where: { id: campaignId, businessId, status: CampaignStatus.RUNNING },
    data: { status: CampaignStatus.PAUSED },
  });
  if (res.count === 0) throw new ApiError(409, "Only running campaigns can be paused");
  console.info("[campaign] paused", { campaignId });
  return getOwnedCampaign(businessId, campaignId);
}
