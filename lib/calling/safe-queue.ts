/**
 * Shared safe outbound calling queue.
 * Used by follow-ups (Step 16) and campaign dialing (Step 15).
 * Never starts unbounded concurrent calls.
 */

import { CallStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { startOutboundCallForBusiness } from "@/lib/calls/start-call";
import { ApiError } from "@/lib/api/http";

/** Calls are capped at 10 minutes by the provider; older "active" calls lost their webhook. */
export const STALE_ACTIVE_CALL_MS = 15 * 60 * 1000;

export const ACTIVE_CALL_STATUSES = [
  CallStatus.QUEUED,
  CallStatus.RINGING,
  CallStatus.IN_PROGRESS,
];

const DEFAULT_CONCURRENCY = 3;

/** Max simultaneous calls per business. CALL_CONCURRENCY_LIMIT is the older name. */
export function getCallConcurrencyLimit(): number {
  const raw = (
    process.env.CALLING_MAX_CONCURRENCY ?? process.env.CALL_CONCURRENCY_LIMIT
  )?.trim();
  const n = raw ? Number(raw) : DEFAULT_CONCURRENCY;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_CONCURRENCY;
  return Math.min(Math.floor(n), 10);
}

export async function countActiveCallsForBusiness(businessId: string) {
  return prisma.call.count({
    where: {
      businessId,
      status: { in: ACTIVE_CALL_STATUSES },
      createdAt: { gte: new Date(Date.now() - STALE_ACTIVE_CALL_MS) },
    },
  });
}

export type EnqueueCallInput = {
  businessId: string;
  agentId: string;
  leadId: string;
  /** When set, Call.sourceFollowUpId is linked */
  followUpId?: string;
  /** When set, Call.campaignLeadId is linked */
  campaignLeadId?: string;
};

export type EnqueueCallResult =
  | { ok: true; deferred: false; callId: string; status: string }
  | { ok: true; deferred: true; activeCalls: number; limit: number }
  | { ok: false; error: string; httpStatus?: number };

export type StartCallFn = typeof startOutboundCallForBusiness;

const LEASE_MS = 60_000;
const LEASE_WAIT_MS = 250;
const LEASE_TRIES = 12;

async function acquireBusinessLease(businessId: string): Promise<boolean> {
  for (let i = 0; i < LEASE_TRIES; i++) {
    const now = new Date();
    const res = await prisma.business.updateMany({
      where: {
        id: businessId,
        OR: [
          { callQueueLockedUntil: null },
          { callQueueLockedUntil: { lt: now } },
        ],
      },
      data: { callQueueLockedUntil: new Date(now.getTime() + LEASE_MS) },
    });
    if (res.count === 1) return true;
    await new Promise((r) => setTimeout(r, LEASE_WAIT_MS));
  }
  return false;
}

async function releaseBusinessLease(businessId: string) {
  await prisma.business.update({
    where: { id: businessId },
    data: { callQueueLockedUntil: null },
  });
}

/**
 * Starts at most CALLING_MAX_CONCURRENCY active calls per business.
 * Count + start run under a per-business DB lease so parallel workers cannot exceed the limit.
 * If at capacity (or the lease is busy), returns deferred=true without starting a call.
 */
export async function enqueueOutboundCall(
  input: EnqueueCallInput,
  startCall: StartCallFn = startOutboundCallForBusiness,
): Promise<EnqueueCallResult> {
  const limit = getCallConcurrencyLimit();

  if (!(await acquireBusinessLease(input.businessId))) {
    console.info("[safe-queue] deferred — queue busy", {
      businessId: input.businessId,
      leadId: input.leadId,
    });
    return { ok: true, deferred: true, activeCalls: limit, limit };
  }

  try {
    return await startWithinLimit(input, limit, startCall);
  } finally {
    await releaseBusinessLease(input.businessId).catch((error) => {
      console.error("[safe-queue] lease release failed", {
        businessId: input.businessId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}

async function startWithinLimit(
  input: EnqueueCallInput,
  limit: number,
  startCall: StartCallFn,
): Promise<EnqueueCallResult> {
  const active = await countActiveCallsForBusiness(input.businessId);
  if (active >= limit) {
    console.info("[safe-queue] deferred — concurrency full", {
      businessId: input.businessId,
      active,
      limit,
      leadId: input.leadId,
      followUpId: input.followUpId,
      campaignLeadId: input.campaignLeadId,
    });
    return { ok: true, deferred: true, activeCalls: active, limit };
  }

  try {
    const call = await startCall({
      businessId: input.businessId,
      agentId: input.agentId,
      leadId: input.leadId,
      sourceFollowUpId: input.followUpId,
      campaignLeadId: input.campaignLeadId,
    });

    console.info("[safe-queue] call started", {
      businessId: input.businessId,
      callId: call.id,
      leadId: input.leadId,
      followUpId: input.followUpId,
      campaignLeadId: input.campaignLeadId,
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
    return {
      ok: false,
      error: message,
      httpStatus: error instanceof ApiError ? error.status : undefined,
    };
  }
}
