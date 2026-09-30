import { CallStatus, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getTelephonyProvider,
  isTelephonyConfigured,
  toE164Phone,
} from "@/lib/telephony";
import { ApiError } from "@/lib/api/http";

const ACTIVE_CALL_GUARD_MS = 15 * 60 * 1000;

export async function startOutboundCallForBusiness(input: {
  businessId: string;
  agentId: string;
  leadId: string;
  sourceFollowUpId?: string;
  campaignLeadId?: string;
}) {
  if (!isTelephonyConfigured()) {
    throw new ApiError(
      503,
      "Telephony is not configured. Set VAPI_API_KEY and VAPI_PHONE_NUMBER_ID.",
    );
  }

  const [agent, lead, knowledge, business] = await Promise.all([
    prisma.agent.findFirst({
      where: { id: input.agentId, businessId: input.businessId },
    }),
    prisma.lead.findFirst({
      where: { id: input.leadId, businessId: input.businessId },
    }),
    prisma.businessKnowledge.findMany({
      where: { businessId: input.businessId, active: true },
    }),
    prisma.business.findUnique({ where: { id: input.businessId } }),
  ]);

  if (!business) throw new ApiError(404, "Business not found");
  if (!agent) throw new ApiError(404, "Agent not found");
  if (!lead) throw new ApiError(404, "Lead not found");
  if (!agent.active) throw new ApiError(400, "Agent is inactive");
  if (lead.doNotCall) {
    throw new ApiError(403, "This lead has opted out of calls");
  }

  const activeCall = await prisma.call.findFirst({
    where: {
      leadId: lead.id,
      status: {
        in: [CallStatus.QUEUED, CallStatus.RINGING, CallStatus.IN_PROGRESS],
      },
      createdAt: { gte: new Date(Date.now() - ACTIVE_CALL_GUARD_MS) },
    },
    select: { id: true },
  });
  if (activeCall) {
    throw new ApiError(409, "This lead already has a call in progress");
  }

  const provider = getTelephonyProvider();

  const call = await prisma.call.create({
    data: {
      businessId: business.id,
      agentId: agent.id,
      leadId: lead.id,
      status: CallStatus.QUEUED,
      provider: provider.name,
      sourceFollowUpId: input.sourceFollowUpId ?? null,
      campaignLeadId: input.campaignLeadId ?? null,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: LeadStatus.CALLING },
  });

  const serverUrl =
    process.env.VAPI_SERVER_URL?.trim() || process.env.APP_URL?.trim();

  try {
    const result = await provider.startOutboundCall({
      callId: call.id,
      customerNumber: toE164Phone(lead.phone),
      customerName: lead.name,
      agent,
      business,
      lead,
      knowledge,
      serverUrl,
    });

    return prisma.call.update({
      where: { id: call.id },
      data: {
        providerCallId: result.providerCallId,
        status: CallStatus.RINGING,
        startedAt: new Date(),
      },
      include: { agent: true, lead: true, result: true },
    });
  } catch (error) {
    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: CallStatus.FAILED,
        errorMessage:
          error instanceof Error ? error.message : "Failed to start call",
        endedAt: new Date(),
      },
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: LeadStatus.NO_RESPONSE },
    });
    throw new ApiError(
      502,
      error instanceof Error ? error.message : "Failed to start call",
    );
  }
}
