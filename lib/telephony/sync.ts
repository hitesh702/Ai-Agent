import { CallStatus, FollowUpStatus, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ProviderCallSnapshot } from "@/lib/telephony/types";
import { scheduleFollowUpFromCallResult } from "@/lib/followups/create";
import {
  completeFollowUpForCall,
  processDueFollowUps,
} from "@/lib/followups/process";

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
  const leadStatus = mapLeadStatusFromInterest(input.snapshot.interest);

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
            endedAt: new Date(),
            ...(input.snapshot.endedReason && status === CallStatus.FAILED
              ? { errorMessage: input.snapshot.endedReason }
              : {}),
          }
        : {}),
    },
  });

  if (
    input.snapshot.interest ||
    input.snapshot.summary ||
    input.snapshot.requirement ||
    input.snapshot.customerSentiment ||
    typeof input.snapshot.followUpRequired === "boolean"
  ) {
    await prisma.callResult.upsert({
      where: { callId: existing.id },
      create: {
        callId: existing.id,
        interest: input.snapshot.interest,
        requirement: input.snapshot.requirement,
        followUpRequired: input.snapshot.followUpRequired ?? false,
        followUpDate: input.snapshot.followUpDate
          ? new Date(input.snapshot.followUpDate)
          : null,
        customerSentiment: input.snapshot.customerSentiment,
        summary: input.snapshot.summary || existing.summary,
      },
      update: {
        ...(input.snapshot.interest ? { interest: input.snapshot.interest } : {}),
        ...(input.snapshot.requirement
          ? { requirement: input.snapshot.requirement }
          : {}),
        ...(typeof input.snapshot.followUpRequired === "boolean"
          ? { followUpRequired: input.snapshot.followUpRequired }
          : {}),
        ...(input.snapshot.followUpDate
          ? { followUpDate: new Date(input.snapshot.followUpDate) }
          : {}),
        ...(input.snapshot.customerSentiment
          ? { customerSentiment: input.snapshot.customerSentiment }
          : {}),
        ...(input.snapshot.summary ? { summary: input.snapshot.summary } : {}),
      },
    });
  }

  if (leadStatus) {
    await prisma.lead.update({
      where: { id: existing.leadId },
      data: { status: leadStatus },
    });

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
    await prisma.lead.update({
      where: { id: existing.leadId },
      data: { status: LeadStatus.COMPLETED },
    });
  } else if (status === CallStatus.RINGING || status === CallStatus.IN_PROGRESS) {
    await prisma.lead.update({
      where: { id: existing.leadId },
      data: { status: LeadStatus.CALLING },
    });
  }

  const terminal =
    status === CallStatus.ENDED
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

    // Create a new follow-up job only when analysis requested one (not for every failure)
    if (
      terminal === "completed" &&
      input.snapshot.followUpRequired === true
    ) {
      try {
        await scheduleFollowUpFromCallResult({
          businessId: existing.businessId,
          leadId: existing.leadId,
          agentId: existing.agentId,
          callId: existing.id,
          followUpRequired: true,
          followUpDate: input.snapshot.followUpDate
            ? new Date(input.snapshot.followUpDate)
            : null,
        });
      } catch (error) {
        console.error("[follow-up] failed to schedule from call result", {
          callId: existing.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Free concurrency slot → process other due follow-ups
    try {
      await processDueFollowUps();
    } catch (error) {
      console.error("[follow-up] processDue after call end failed", error);
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
    customerSentiment: asString(structured?.customerSentiment),
    raw: payload,
  };

  return applyProviderSnapshot({
    callaiCallId,
    providerCallId,
    providerName: "vapi",
    snapshot,
  });
}
