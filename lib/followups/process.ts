import { FollowUpStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueueOutboundCall } from "@/lib/calling/safe-queue";
import { validateFollowUpForCalling } from "./validate";

const BATCH_LIMIT = 20;

/**
 * Atomically claim due PENDING follow-ups → READY, then validate and enqueue.
 * Safe across multiple workers via conditional status updates.
 */
export async function processDueFollowUps(now = new Date()) {
  const due = await prisma.followUp.findMany({
    where: {
      status: FollowUpStatus.PENDING,
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
    take: BATCH_LIMIT,
  });

  const summary = {
    scanned: due.length,
    queued: 0,
    deferred: 0,
    rescheduled: 0,
    cancelled: 0,
    skipped: 0,
    failed: 0,
  };

  for (const item of due) {
    // Claim: only one worker wins
    const claimed = await prisma.followUp.updateMany({
      where: { id: item.id, status: FollowUpStatus.PENDING },
      data: { status: FollowUpStatus.READY },
    });
    if (claimed.count === 0) continue;

    const result = await processReadyFollowUp(item.id, now);
    summary[result]++;
  }

  // Also retry READY jobs that were deferred (concurrency) and are still due
  const readyDeferred = await prisma.followUp.findMany({
    where: {
      status: FollowUpStatus.READY,
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
    take: BATCH_LIMIT,
  });

  for (const item of readyDeferred) {
    const result = await processReadyFollowUp(item.id, now);
    if (result === "queued") summary.queued++;
    else if (result === "deferred") summary.deferred++;
    else if (result === "rescheduled") summary.rescheduled++;
    else if (result === "cancelled") summary.cancelled++;
    else if (result === "skipped") summary.skipped++;
    else if (result === "failed") summary.failed++;
  }

  console.info("[follow-up] processDueFollowUps", summary);
  return summary;
}

type ProcessOutcome =
  | "queued"
  | "deferred"
  | "rescheduled"
  | "cancelled"
  | "skipped"
  | "failed";

export async function processReadyFollowUp(
  followUpId: string,
  now = new Date(),
): Promise<ProcessOutcome> {
  const followUp = await prisma.followUp.findUnique({
    where: { id: followUpId },
  });
  if (!followUp) return "skipped";

  if (
    followUp.status !== FollowUpStatus.READY &&
    followUp.status !== FollowUpStatus.PENDING
  ) {
    // Only process READY (or just-claimed). PENDING should be claimed first.
    if (followUp.status === FollowUpStatus.QUEUED) return "deferred";
    return "skipped";
  }

  // Ensure READY
  if (followUp.status === FollowUpStatus.PENDING) {
    await prisma.followUp.updateMany({
      where: { id: followUpId, status: FollowUpStatus.PENDING },
      data: { status: FollowUpStatus.READY },
    });
  }

  const validation = await validateFollowUpForCalling(followUpId, now);

  if (!validation.ok) {
    if (validation.action === "cancel") {
      await prisma.followUp.update({
        where: { id: followUpId },
        data: {
          status: FollowUpStatus.CANCELLED,
          skipReason: validation.reason,
        },
      });
      await prisma.lead.update({
        where: { id: followUp.leadId },
        data: { followUpRequired: false },
      });
      console.info("[follow-up] cancelled", {
        followUpId,
        reason: validation.reason,
      });
      return "cancelled";
    }

    if (validation.action === "skip") {
      await prisma.followUp.update({
        where: { id: followUpId },
        data: {
          status: FollowUpStatus.SKIPPED,
          skipReason: validation.reason,
        },
      });
      console.info("[follow-up] skipped", {
        followUpId,
        reason: validation.reason,
      });
      return "skipped";
    }

    if (
      (validation.action === "reschedule" ||
        validation.action === "retry_later") &&
      validation.rescheduleAt
    ) {
      await prisma.followUp.update({
        where: { id: followUpId },
        data: {
          status: FollowUpStatus.PENDING,
          scheduledAt: validation.rescheduleAt,
          nextAttemptAt: validation.rescheduleAt,
          skipReason: validation.reason,
        },
      });
      console.info("[follow-up] rescheduled", {
        followUpId,
        reason: validation.reason,
        scheduledAt: validation.rescheduleAt.toISOString(),
      });
      return "rescheduled";
    }

    await prisma.followUp.update({
      where: { id: followUpId },
      data: {
        status: FollowUpStatus.FAILED,
        skipReason: validation.reason,
      },
    });
    return "failed";
  }

  // Mark QUEUED only if still READY (prevents double enqueue)
  const queued = await prisma.followUp.updateMany({
    where: { id: followUpId, status: FollowUpStatus.READY },
    data: {
      status: FollowUpStatus.QUEUED,
      lastAttemptAt: now,
      attempts: { increment: 1 },
      agentId: validation.agentId,
    },
  });
  if (queued.count === 0) return "deferred";

  const enqueue = await enqueueOutboundCall({
    businessId: followUp.businessId,
    agentId: validation.agentId,
    leadId: followUp.leadId,
    followUpId,
  });

  if (enqueue.ok && enqueue.deferred) {
    // Roll back to READY so another tick can retry when a slot frees
    await prisma.followUp.update({
      where: { id: followUpId },
      data: {
        status: FollowUpStatus.READY,
        attempts: { decrement: 1 },
        skipReason: "Waiting for concurrency slot",
      },
    });
    console.info("[follow-up] deferred — concurrency", { followUpId });
    return "deferred";
  }

  if (!enqueue.ok) {
    const max = (
      await prisma.business.findUnique({
        where: { id: followUp.businessId },
        select: { maxFollowUpAttempts: true },
      })
    )?.maxFollowUpAttempts;

    const current = await prisma.followUp.findUnique({
      where: { id: followUpId },
    });
    const attempts = current?.attempts ?? followUp.attempts + 1;
    const canRetry = attempts < (max ?? 3);

    await prisma.followUp.update({
      where: { id: followUpId },
      data: canRetry
        ? {
            status: FollowUpStatus.PENDING,
            scheduledAt: new Date(now.getTime() + 30 * 60 * 1000),
            nextAttemptAt: new Date(now.getTime() + 30 * 60 * 1000),
            skipReason: enqueue.error,
          }
        : {
            status: FollowUpStatus.FAILED,
            skipReason: enqueue.error,
          },
    });
    console.error("[follow-up] enqueue failed", {
      followUpId,
      error: enqueue.error,
    });
    return canRetry ? "rescheduled" : "failed";
  }

  console.info("[follow-up] queued into safe calling queue", {
    followUpId,
    callId: enqueue.callId,
  });
  return "queued";
}

/**
 * When an outbound follow-up call finishes, close the FollowUp job.
 */
export async function completeFollowUpForCall(input: {
  callId: string;
  sourceFollowUpId?: string | null;
  terminal: "completed" | "failed";
}) {
  const followUpId =
    input.sourceFollowUpId ||
    (
      await prisma.call.findUnique({
        where: { id: input.callId },
        select: { sourceFollowUpId: true },
      })
    )?.sourceFollowUpId;

  if (!followUpId) return null;

  const followUp = await prisma.followUp.findUnique({
    where: { id: followUpId },
  });
  if (!followUp) return null;

  if (
    followUp.status === FollowUpStatus.COMPLETED ||
    followUp.status === FollowUpStatus.CANCELLED ||
    followUp.status === FollowUpStatus.SKIPPED
  ) {
    return followUp;
  }

  if (input.terminal === "completed") {
    const updated = await prisma.followUp.update({
      where: { id: followUpId },
      data: {
        status: FollowUpStatus.COMPLETED,
        skipReason: null,
      },
    });
    await prisma.lead.update({
      where: { id: followUp.leadId },
      data: { followUpRequired: false },
    });
    console.info("[follow-up] completed", { followUpId, callId: input.callId });
    return updated;
  }

  // Failed call — retry if attempts remain
  const business = await prisma.business.findUnique({
    where: { id: followUp.businessId },
  });
  const max = business?.maxFollowUpAttempts ?? 3;
  if (followUp.attempts < max) {
    const retryAt = new Date(Date.now() + 60 * 60 * 1000);
    return prisma.followUp.update({
      where: { id: followUpId },
      data: {
        status: FollowUpStatus.PENDING,
        scheduledAt: retryAt,
        nextAttemptAt: retryAt,
        skipReason: "Outbound call failed — retry scheduled",
      },
    });
  }

  return prisma.followUp.update({
    where: { id: followUpId },
    data: {
      status: FollowUpStatus.FAILED,
      skipReason: "Outbound call failed — max attempts reached",
    },
  });
}
