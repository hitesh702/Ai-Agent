/**
 * Shared safe outbound calling queue.
 * Used by follow-ups (Step 16) and intended for campaign dialing (Step 15).
 * Never starts unbounded concurrent calls.
 */

import { CallStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { startOutboundCallForBusiness } from "@/lib/calls/start-call";
import { ApiError } from "@/lib/api/http";

export function getCallConcurrencyLimit(): number {
  const raw = process.env.CALL_CONCURRENCY_LIMIT?.trim();
  const n = raw ? Number(raw) : 2;
  if (!Number.isFinite(n) || n < 1) return 2;
  return Math.min(Math.floor(n), 10);
}

export async function countActiveCallsForBusiness(businessId: string) {
  return prisma.call.count({
    where: {
      businessId,
      status: {
        in: [CallStatus.QUEUED, CallStatus.RINGING, CallStatus.IN_PROGRESS],
      },
    },
  });
}

export type EnqueueCallInput = {
  businessId: string;
  agentId: string;
  leadId: string;
  /** When set, Call.sourceFollowUpId is linked */
  followUpId?: string;
};

export type EnqueueCallResult =
  | { ok: true; deferred: false; callId: string; status: string }
  | { ok: true; deferred: true; activeCalls: number; limit: number }
  | { ok: false; error: string; code?: string };

/**
 * Starts at most CALL_CONCURRENCY_LIMIT active calls per business.
 * If at capacity, returns deferred=true without starting a call.
 */
export async function enqueueOutboundCall(
  input: EnqueueCallInput,
): Promise<EnqueueCallResult> {
  const limit = getCallConcurrencyLimit();

  const active = await countActiveCallsForBusiness(input.businessId);
  if (active >= limit) {
    console.info("[safe-queue] deferred — concurrency full", {
      businessId: input.businessId,
      active,
      limit,
      leadId: input.leadId,
      followUpId: input.followUpId,
    });
    return { ok: true, deferred: true, activeCalls: active, limit };
  }

  try {
    const call = await startOutboundCallForBusiness({
      businessId: input.businessId,
      agentId: input.agentId,
      leadId: input.leadId,
    });

    if (input.followUpId) {
      await prisma.call.update({
        where: { id: call.id },
        data: { sourceFollowUpId: input.followUpId },
      });
    }

    console.info("[safe-queue] call started", {
      businessId: input.businessId,
      callId: call.id,
      leadId: input.leadId,
      followUpId: input.followUpId,
    });

    return {
      ok: true,
      deferred: false,
      callId: call.id,
      status: call.status,
    };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to enqueue call";
    console.error("[safe-queue] start failed", {
      businessId: input.businessId,
      leadId: input.leadId,
      error: message,
    });
    return { ok: false, error: message };
  }
}
