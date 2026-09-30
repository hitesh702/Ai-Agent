import {
  CallStatus,
  CallSummaryStatus,
  FollowUpStatus,
  LeadStatus,
  Prisma,
} from "@prisma/client";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { summarizeCompletedCall } from "@/lib/ai/summarize-call";
import type { ProviderCallSnapshot } from "@/lib/telephony/types";
import { scheduleFollowUpFromCallResult } from "@/lib/followups/create";
import { parseCallFollowUpTime } from "@/lib/followups/schedule";
import {
  completeFollowUpForCall,
  processDueFollowUps,
} from "@/lib/followups/process";
import { classifyCallOutcome, isConversationOutcome } from "@/lib/calling/outcome";
import {
  applyCampaignCallOutcome,
  processRunningCampaigns,
} from "@/lib/campaigns/queue";

function mapProviderStatus(status: string | undefined): CallStatus | null {
  switch (status) {
    case "queued":
      return CallStatus.QUEUED;
    case "ringing":
      return CallStatus.RINGING;
    case "in-progress":
    case "forwarding":
      return CallStatus.IN_PROGRESS;
    case "ended":
      return CallStatus.ENDED;
    case "failed":
    case "busy":
    case "no-answer":
    case "canceled":
      return CallStatus.FAILED;
    default:
      return null;
  }
}

function mapLeadStatusFromInterest(interest?: string): LeadStatus | null {
  const value = (interest || "").toUpperCase().replaceAll("-", "_");
  if (value === "INTERESTED") return LeadStatus.INTERESTED;
  if (value === "NOT_INTERESTED" || value === "NOTINTERESTED") {
    return LeadStatus.NOT_INTERESTED;
  }
  if (value === "FOLLOW_UP" || value === "FOLLOWUP") return LeadStatus.FOLLOW_UP;
  if (value === "NO_RESPONSE" || value === "NORESPONSE") {
    return LeadStatus.NO_RESPONSE;
  }
  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractCallaiId(payload: Record<string, unknown>): string | undefined {
  const call = (payload.call || payload) as Record<string, unknown>;
  const metadata = call.metadata as Record<string, unknown> | undefined;
  if (asString(metadata?.callaiCallId)) return asString(metadata?.callaiCallId);

  const message = payload.message as Record<string, unknown> | undefined;
  const messageCall = message?.call as Record<string, unknown> | undefined;
  const messageMeta = messageCall?.metadata as Record<string, unknown> | undefined;
  return asString(messageMeta?.callaiCallId);
}

/** Summarize after the webhook response is sent, so a slow AI never delays the provider. */
function scheduleCallSummary(callId: string) {
  try {
    after(() => summarizeCompletedCall(callId));
  } catch {
    // after() only works inside a request (webhook / refresh), not in scripts or tests.
  }
}

export async function applyProviderSnapshot(input: {
  callaiCallId?: string;
  providerCallId?: string;
  providerName?: string;
  snapshot: ProviderCallSnapshot;
}) {
  const where: Prisma.CallWhereInput = input.callaiCallId
    ? { id: input.callaiCallId }
    : input.providerCallId
      ? {
          provider: input.providerName || "vapi",
          providerCallId: input.providerCallId,
        }
      : {};

  if (!Object.keys(where).length) return null;

  const existing = await prisma.call.findFirst({ where });
  if (!existing) return null;

  const status = mapProviderStatus(input.snapshot.status);
  const optOut = input.snapshot.optOut === true;
  const leadStatus = optOut
    ? LeadStatus.NOT_INTERESTED
    : mapLeadStatusFromInterest(input.snapshot.interest);
  const outcome =
    status && (status === CallStatus.FAILED || input.snapshot.endedReason)
      ? classifyCallOutcome({
          status,
          providerStatus: input.snapshot.status,
          endedReason: input.snapshot.endedReason,
          interest: input.snapshot.interest,
          optOut,
        })
      : null;

  const updated = await prisma.call.update({
    where: { id: existing.id },
    data: {
      providerCallId: input.snapshot.providerCallId || existing.providerCallId,
      ...(status ? { status } : {}),
      ...(input.snapshot.transcript
        ? { transcript: input.snapshot.transcript }
        : {}),
      ...(input.snapshot.summary ? { summary: input.snapshot.summary } : {}),
      ...(input.snapshot.recordingUrl
        ? { recordingUrl: input.snapshot.recordingUrl }
        : {}),
      ...(typeof input.snapshot.durationSeconds === "number"
        ? { duration: Math.round(input.snapshot.durationSeconds) }
        : {}),
      ...(status === CallStatus.IN_PROGRESS && !existing.startedAt
        ? { startedAt: new Date() }
        : {}),
      ...(status === CallStatus.ENDED || status === CallStatus.FAILED
        ? {
            endedAt: existing.endedAt ?? new Date(),
            ...(input.snapshot.endedReason
              ? { endedReason: input.snapshot.endedReason }
              : {}),
            ...(input.snapshot.endedReason && status === CallStatus.FAILED
              ? { errorMessage: input.snapshot.endedReason }
              : {}),
          }
        : {}),
    },
  });

  let followUpAt: Date | null = null;
  if (input.snapshot.followUpDate) {
    const business = await prisma.business.findUnique({
      where: { id: existing.businessId },
      select: { timezone: true },
    });
    followUpAt = parseCallFollowUpTime({
      date: input.snapshot.followUpDate,
      time: input.snapshot.followUpTime,
      timeZone: business?.timezone || "Asia/Kolkata",
    });
    if (!followUpAt) {
      console.warn("[follow-up] ignoring unusable follow-up time from analysis", {
        callId: existing.id,
      });
    }
  }

  if (
    input.snapshot.interest ||
    input.snapshot.summary ||
    input.snapshot.requirement ||
    input.snapshot.customerSentiment ||
    typeof input.snapshot.followUpRequired === "boolean"
  ) {
    const current = await prisma.callResult.findUnique({
      where: { callId: existing.id },
      select: { summaryStatus: true },
    });
    const aiSummarySaved = current?.summaryStatus === CallSummaryStatus.COMPLETED;

    await prisma.callResult.upsert({
      where: { callId: existing.id },
      create: {
        callId: existing.id,
        interest: input.snapshot.interest,
        requirement: input.snapshot.requirement,
        followUpRequired: input.snapshot.followUpRequired ?? false,
        followUpDate: followUpAt,
        customerSentiment: input.snapshot.customerSentiment,
        summary: input.snapshot.summary || existing.summary,
      },
      update: {
        ...(aiSummarySaved
          ? {}
          : {
              ...(input.snapshot.interest
                ? { interest: input.snapshot.interest }
                : {}),
              ...(input.snapshot.requirement
                ? { requirement: input.snapshot.requirement }
                : {}),
              ...(typeof input.snapshot.followUpRequired === "boolean"
                ? { followUpRequired: input.snapshot.followUpRequired }
                : {}),
              ...(followUpAt ? { followUpDate: followUpAt } : {}),
              ...(input.snapshot.summary
                ? { summary: input.snapshot.summary }
                : {}),
            }),
        ...(input.snapshot.customerSentiment
          ? { customerSentiment: input.snapshot.customerSentiment }
          : {}),
      },
    });
  }

  if (leadStatus) {
    await prisma.lead.update({
      where: { id: existing.leadId },
      data: { status: leadStatus, ...(optOut ? { doNotCall: true } : {}) },
    });
    if (optOut) {
      console.info("[calls] opt-out recorded", {
        callId: existing.id,
        leadId: existing.leadId,
      });
    }

    // Opt-out / refusal cancels active follow-ups
    if (leadStatus === LeadStatus.NOT_INTERESTED) {
      await prisma.followUp.updateMany({
        where: {
          leadId: existing.leadId,
          status: {
            in: [
              FollowUpStatus.PENDING,
              FollowUpStatus.READY,
              FollowUpStatus.QUEUED,
            ],
          },
        },
        data: {
          status: FollowUpStatus.CANCELLED,
          skipReason: "Lead opted out / refused further calls",
        },
      });
      await prisma.lead.update({
        where: { id: existing.leadId },
        data: { followUpRequired: false },
      });
    }
  } else if (status === CallStatus.ENDED) {
    const reached = !outcome || isConversationOutcome(outcome);
    await prisma.lead.update({
      where: { id: existing.leadId },
      data: { status: reached ? LeadStatus.COMPLETED : LeadStatus.NO_RESPONSE },
    });
  } else if (status === CallStatus.RINGING || status === CallStatus.IN_PROGRESS) {
    await prisma.lead.update({
      where: { id: existing.leadId },
      data: { status: LeadStatus.CALLING },
    });
  }

  const terminal = outcome
    ? isConversationOutcome(outcome)
      ? "completed"
      : "failed"
    : status === CallStatus.ENDED
      ? "completed"
      : status === CallStatus.FAILED
        ? "failed"
        : null;

  if (terminal) {
    await completeFollowUpForCall({
      callId: existing.id,
      sourceFollowUpId: existing.sourceFollowUpId,
      terminal,
    });

    const campaignRules = existing.campaignLeadId
      ? await prisma.campaignLead.findUnique({
          where: { id: existing.campaignLeadId },
          select: { campaign: { select: { createFollowUps: true } } },
        })
      : null;

    if (existing.campaignLeadId && outcome) {
      try {
        await applyCampaignCallOutcome(existing.id, outcome);
      } catch (error) {
        console.error("[campaign] failed to apply call outcome", {
          callId: existing.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Create a new follow-up job only when analysis requested one (not for every failure)
    if (
      terminal === "completed" &&
      input.snapshot.followUpRequired === true &&
      !optOut &&
      campaignRules?.campaign.createFollowUps !== false
    ) {
      try {
        await scheduleFollowUpFromCallResult({
          businessId: existing.businessId,
          leadId: existing.leadId,
          agentId: existing.agentId,
          callId: existing.id,
          followUpRequired: true,
          followUpDate: followUpAt,
        });
      } catch (error) {
        console.error("[follow-up] failed to schedule from call result", {
          callId: existing.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (terminal === "completed") scheduleCallSummary(existing.id);

    // Free concurrency slot → process other due follow-ups and running campaigns
    try {
      await processDueFollowUps();
    } catch (error) {
      console.error("[follow-up] processDue after call end failed", error);
    }
    try {
      await processRunningCampaigns({ businessId: existing.businessId });
    } catch (error) {
      console.error("[campaign] queue pass after call end failed", error);
    }
  }

  return updated;
}

/** Map raw Vapi webhook payloads into a snapshot, then persist. */
export async function applyVapiWebhookPayload(payload: Record<string, unknown>) {
  const message = payload.message as Record<string, unknown> | undefined;
  const root = message ?? payload;
  const callObj = (root.call || payload.call || payload) as Record<string, unknown>;
  const artifact = (root.artifact || payload.artifact) as
    | Record<string, unknown>
    | undefined;
  const analysis = (root.analysis || payload.analysis) as
    | Record<string, unknown>
    | undefined;
  const structured = analysis?.structuredData as Record<string, unknown> | undefined;
  const recording = artifact?.recording as Record<string, unknown> | undefined;

  const providerCallId = asString(callObj.id) || asString(payload.id);
  const callaiCallId = extractCallaiId(payload) || extractCallaiId(root);

  const snapshot: ProviderCallSnapshot = {
    providerCallId: providerCallId || "unknown",
    status:
      asString(callObj.status) ||
      (message?.type === "end-of-call-report" ? "ended" : "unknown"),
    transcript: asString(artifact?.transcript),
    summary: asString(analysis?.summary),
    recordingUrl: asString(recording?.url) || asString(recording?.stereoUrl),
    endedReason: asString(root.endedReason) || asString(callObj.endedReason),
    interest: asString(structured?.interest),
    requirement: asString(structured?.requirement),
    followUpRequired:
      typeof structured?.followUpRequired === "boolean"
        ? structured.followUpRequired
        : undefined,
    followUpDate: asString(structured?.followUpDate),
    followUpTime: asString(structured?.followUpTime),
    customerSentiment: asString(structured?.customerSentiment),
    optOut: structured?.optOut === true ? true : undefined,
    raw: payload,
  };

  return applyProviderSnapshot({
    callaiCallId,
    providerCallId,
    providerName: "vapi",
    snapshot,
  });
}
