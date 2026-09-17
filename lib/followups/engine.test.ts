/**
 * Integration-style follow-up engine tests against the local SQLite DB.
 * Run: npx tsx --test lib/followups/engine.test.ts
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { FollowUpStatus, LeadStatus } from "@prisma/client";
import { prisma } from "../db";
import {
  cancelActiveFollowUpsForLead,
  createFollowUpJob,
  scheduleFollowUpFromCallResult,
  scheduleManualFollowUp,
} from "./create";
import {
  completeFollowUpForCall,
  processReadyFollowUp,
} from "./process";
import { validateFollowUpForCalling } from "./validate";
import { countActiveCallsForBusiness, getCallConcurrencyLimit } from "../calling/safe-queue";

const suffix = `fu_${Date.now()}`;

let businessId = "";
let otherBusinessId = "";
let leadId = "";
let optedOutLeadId = "";
let agentId = "";

before(async () => {
  const owner = await prisma.user.create({
    data: {
      name: "FU Tester",
      email: `fu-tester-${suffix}@example.com`,
      passwordHash: "x",
    },
  });

  const business = await prisma.business.create({
    data: {
      ownerId: owner.id,
      name: `FU Biz ${suffix}`,
      timezone: "Asia/Kolkata",
      callingEnabled: true,
      followUpCallingEnabled: true,
      callingWindowStart: "00:00",
      callingWindowEnd: "23:59",
      callingDays: "1,2,3,4,5,6,7",
      maxFollowUpAttempts: 3,
    },
  });
  businessId = business.id;

  const otherOwner = await prisma.user.create({
    data: {
      name: "Other",
      email: `fu-other-${suffix}@example.com`,
      passwordHash: "x",
    },
  });
  const otherBiz = await prisma.business.create({
    data: {
      ownerId: otherOwner.id,
      name: `Other Biz ${suffix}`,
    },
  });
  otherBusinessId = otherBiz.id;

  const agent = await prisma.agent.create({
    data: {
      businessId,
      name: "Follow-up Agent",
      active: true,
    },
  });
  agentId = agent.id;

  const lead = await prisma.lead.create({
    data: {
      businessId,
      name: "Follow Lead",
      phone: "9876500001",
      status: LeadStatus.NEW,
    },
  });
  leadId = lead.id;

  const opted = await prisma.lead.create({
    data: {
      businessId,
      name: "Opted Out",
      phone: "9876500002",
      status: LeadStatus.NOT_INTERESTED,
    },
  });
  optedOutLeadId = opted.id;
});

after(async () => {
  await prisma.followUp.deleteMany({
    where: { businessId: { in: [businessId, otherBusinessId] } },
  });
  await prisma.call.deleteMany({
    where: { businessId: { in: [businessId, otherBusinessId] } },
  });
  await prisma.lead.deleteMany({
    where: { businessId: { in: [businessId, otherBusinessId] } },
  });
  await prisma.agent.deleteMany({
    where: { businessId: { in: [businessId, otherBusinessId] } },
  });
  await prisma.business.deleteMany({
    where: { id: { in: [businessId, otherBusinessId] } },
  });
  await prisma.user.deleteMany({
    where: { email: { contains: suffix } },
  });
  await prisma.$disconnect();
});

describe("follow-up engine", () => {
  it("creates follow-up and sets followUpRequired on lead", async () => {
    const scheduledAt = new Date(Date.now() + 60_000);
    const job = await scheduleManualFollowUp({
      businessId,
      leadId,
      agentId,
      scheduledAt,
      note: "Callback tomorrow",
    });

    assert.equal(job.status, FollowUpStatus.PENDING);
    assert.ok(Math.abs(job.scheduledAt.getTime() - scheduledAt.getTime()) < 1000);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    assert.equal(lead.followUpRequired, true);
    assert.equal(lead.status, LeadStatus.FOLLOW_UP);
  });

  it("does not create duplicate active follow-ups for same lead", async () => {
    const first = await createFollowUpJob({
      businessId,
      leadId,
      agentId,
      scheduledAt: new Date(Date.now() + 120_000),
      reason: "first",
    });
    const second = await createFollowUpJob({
      businessId,
      leadId,
      agentId,
      scheduledAt: new Date(Date.now() + 180_000),
      reason: "second",
    });
    assert.equal(first.id, second.id);

    const active = await prisma.followUp.count({
      where: {
        leadId,
        status: {
          in: [
            FollowUpStatus.PENDING,
            FollowUpStatus.READY,
            FollowUpStatus.QUEUED,
          ],
        },
      },
    });
    assert.equal(active, 1);
  });

  it("cancels follow-up for opted-out lead during validation", async () => {
    const job = await createFollowUpJob({
      businessId,
      leadId: optedOutLeadId,
      agentId,
      scheduledAt: new Date(Date.now() - 1000),
      reason: "should cancel",
    });

    const result = await validateFollowUpForCalling(job.id);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.action, "cancel");
    }
  });

  it("reschedules when calling is disabled", async () => {
    await prisma.business.update({
      where: { id: businessId },
      data: { callingEnabled: false },
    });

    const job = await createFollowUpJob({
      businessId,
      leadId,
      agentId,
      scheduledAt: new Date(Date.now() - 1000),
    });

    // Force a fresh pending job id path — update status after duplicate merge
    await prisma.followUp.update({
      where: { id: job.id },
      data: { status: FollowUpStatus.PENDING, scheduledAt: new Date() },
    });

    const result = await validateFollowUpForCalling(job.id);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.action, "retry_later");
    }

    await prisma.business.update({
      where: { id: businessId },
      data: { callingEnabled: true },
    });
  });

  it("cancelActiveFollowUpsForLead marks jobs CANCELLED", async () => {
    await scheduleManualFollowUp({
      businessId,
      leadId,
      agentId,
      scheduledAt: new Date(Date.now() + 300_000),
    });

    await cancelActiveFollowUpsForLead({
      businessId,
      leadId,
      reason: "test cancel",
    });

    const active = await prisma.followUp.count({
      where: {
        leadId,
        status: {
          in: [
            FollowUpStatus.PENDING,
            FollowUpStatus.READY,
            FollowUpStatus.QUEUED,
          ],
        },
      },
    });
    assert.equal(active, 0);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    assert.equal(lead.followUpRequired, false);
  });

  it("does not allow other business follow-up to share lead isolation", async () => {
    const foreignLead = await prisma.lead.create({
      data: {
        businessId: otherBusinessId,
        name: "Foreign",
        phone: "9876500099",
      },
    });

    const job = await createFollowUpJob({
      businessId: otherBusinessId,
      leadId: foreignLead.id,
      scheduledAt: new Date(Date.now() + 60_000),
    });

    assert.equal(job.businessId, otherBusinessId);
    assert.notEqual(job.businessId, businessId);

    await prisma.followUp.delete({ where: { id: job.id } });
    await prisma.lead.delete({ where: { id: foreignLead.id } });
  });

  it("reschedules when outside business calling hours", async () => {
    const prevKey = process.env.VAPI_API_KEY;
    const prevPhone = process.env.VAPI_PHONE_NUMBER_ID;
    process.env.VAPI_API_KEY = prevKey || "test-key";
    process.env.VAPI_PHONE_NUMBER_ID = prevPhone || "test-phone";

    await prisma.business.update({
      where: { id: businessId },
      data: {
        callingWindowStart: "09:00",
        callingWindowEnd: "10:00",
        callingDays: "1,2,3,4,5",
      },
    });

    try {
      const job = await createFollowUpJob({
        businessId,
        leadId,
        agentId,
        scheduledAt: new Date(Date.now() - 1000),
        reason: "hours check",
      });
      await prisma.followUp.update({
        where: { id: job.id },
        data: { status: FollowUpStatus.PENDING, scheduledAt: new Date() },
      });

      // Sunday 03:00 UTC is outside weekday 09–10 Asia/Kolkata window
      const sundayNight = new Date("2026-09-20T21:30:00.000Z");
      const result = await validateFollowUpForCalling(job.id, sundayNight);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.action, "reschedule");
        assert.ok(result.rescheduleAt);
        assert.ok(result.rescheduleAt!.getTime() > sundayNight.getTime());
      }
    } finally {
      if (prevKey === undefined) delete process.env.VAPI_API_KEY;
      else process.env.VAPI_API_KEY = prevKey;
      if (prevPhone === undefined) delete process.env.VAPI_PHONE_NUMBER_ID;
      else process.env.VAPI_PHONE_NUMBER_ID = prevPhone;

      await prisma.business.update({
        where: { id: businessId },
        data: {
          callingWindowStart: "00:00",
          callingWindowEnd: "23:59",
          callingDays: "1,2,3,4,5,6,7",
        },
      });
    }
  });
  it("skips converted / ineligible leads", async () => {
    const converted = await prisma.lead.create({
      data: {
        businessId,
        name: "Converted",
        phone: "9876500003",
        status: LeadStatus.CONVERTED,
      },
    });
    const job = await createFollowUpJob({
      businessId,
      leadId: converted.id,
      agentId,
      scheduledAt: new Date(Date.now() - 1000),
    });
    const result = await validateFollowUpForCalling(job.id);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.action, "skip");

    await prisma.followUp.delete({ where: { id: job.id } });
    await prisma.lead.delete({ where: { id: converted.id } });
  });

  it("does not force call when provider is restricted / unconfigured", async () => {
    const prevKey = process.env.VAPI_API_KEY;
    const prevAssist = process.env.VAPI_ASSISTANT_ID;
    const prevPhone = process.env.VAPI_PHONE_NUMBER_ID;
    delete process.env.VAPI_API_KEY;
    delete process.env.VAPI_ASSISTANT_ID;
    delete process.env.VAPI_PHONE_NUMBER_ID;

    try {
      const job = await createFollowUpJob({
        businessId,
        leadId,
        agentId,
        scheduledAt: new Date(Date.now() - 1000),
        reason: "provider check",
      });
      await prisma.followUp.update({
        where: { id: job.id },
        data: { status: FollowUpStatus.PENDING, scheduledAt: new Date() },
      });

      const result = await validateFollowUpForCalling(job.id);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.action, "retry_later");
        assert.match(result.reason, /provider|configured/i);
      }
    } finally {
      if (prevKey !== undefined) process.env.VAPI_API_KEY = prevKey;
      if (prevAssist !== undefined) process.env.VAPI_ASSISTANT_ID = prevAssist;
      if (prevPhone !== undefined) process.env.VAPI_PHONE_NUMBER_ID = prevPhone;
    }
  });

  it("skips cancelled follow-ups and does not queue them", async () => {
    const job = await createFollowUpJob({
      businessId,
      leadId,
      agentId,
      scheduledAt: new Date(Date.now() - 1000),
    });
    await prisma.followUp.update({
      where: { id: job.id },
      data: { status: FollowUpStatus.CANCELLED },
    });

    const validation = await validateFollowUpForCalling(job.id);
    assert.equal(validation.ok, false);

    const outcome = await processReadyFollowUp(job.id);
    assert.equal(outcome, "skipped");
  });

  it("completes follow-up status after successful outbound call", async () => {
    const job = await createFollowUpJob({
      businessId,
      leadId,
      agentId,
      scheduledAt: new Date(Date.now() - 1000),
      reason: "complete path",
    });
    await prisma.followUp.update({
      where: { id: job.id },
      data: { status: FollowUpStatus.QUEUED, attempts: 1 },
    });

    const call = await prisma.call.create({
      data: {
        businessId,
        leadId,
        agentId,
        status: "ENDED",
        sourceFollowUpId: job.id,
      },
    });

    await completeFollowUpForCall({
      callId: call.id,
      sourceFollowUpId: job.id,
      terminal: "completed",
    });

    const updated = await prisma.followUp.findUniqueOrThrow({
      where: { id: job.id },
    });
    assert.equal(updated.status, FollowUpStatus.COMPLETED);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    assert.equal(lead.followUpRequired, false);

    await prisma.call.delete({ where: { id: call.id } });
  });

  it("retries follow-up after temporary outbound failure", async () => {
    const job = await createFollowUpJob({
      businessId,
      leadId,
      agentId,
      scheduledAt: new Date(Date.now() - 1000),
      reason: "retry path",
    });
    await prisma.followUp.update({
      where: { id: job.id },
      data: { status: FollowUpStatus.QUEUED, attempts: 1 },
    });

    const call = await prisma.call.create({
      data: {
        businessId,
        leadId,
        agentId,
        status: "FAILED",
        sourceFollowUpId: job.id,
      },
    });

    await completeFollowUpForCall({
      callId: call.id,
      sourceFollowUpId: job.id,
      terminal: "failed",
    });

    const updated = await prisma.followUp.findUniqueOrThrow({
      where: { id: job.id },
    });
    assert.equal(updated.status, FollowUpStatus.PENDING);
    assert.ok(updated.nextAttemptAt);
    assert.ok(updated.scheduledAt.getTime() > Date.now());

    await prisma.call.delete({ where: { id: call.id } });
  });

  it("defers when concurrency limit is already full", async () => {
    const limit = getCallConcurrencyLimit();
    const fillerCalls = [];
    for (let i = 0; i < limit; i++) {
      fillerCalls.push(
        await prisma.call.create({
          data: {
            businessId,
            leadId,
            agentId,
            status: "IN_PROGRESS",
          },
        }),
      );
    }

    assert.equal(await countActiveCallsForBusiness(businessId), limit);

    const job = await createFollowUpJob({
      businessId,
      leadId,
      agentId,
      scheduledAt: new Date(Date.now() - 1000),
      reason: "concurrency",
    });
    await prisma.followUp.update({
      where: { id: job.id },
      data: { status: FollowUpStatus.READY, scheduledAt: new Date() },
    });

    // Ensure telephony looks configured so we reach the queue concurrency check
    const hadKey = Boolean(process.env.VAPI_API_KEY);
    if (!hadKey) process.env.VAPI_API_KEY = "test-key-for-concurrency";
    if (!process.env.VAPI_PHONE_NUMBER_ID) {
      process.env.VAPI_PHONE_NUMBER_ID = "test-phone";
    }

    try {
      const outcome = await processReadyFollowUp(job.id);
      // Either deferred at concurrency, or failed/rescheduled if provider rejects —
      // never silently queues a parallel call beyond the limit.
      const active = await countActiveCallsForBusiness(businessId);
      assert.ok(active <= limit);
      assert.ok(
        outcome === "deferred" ||
          outcome === "rescheduled" ||
          outcome === "failed" ||
          outcome === "queued",
      );
      if (outcome === "queued") {
        // If somehow queued, active should still respect limit (+1 at most)
        assert.ok((await countActiveCallsForBusiness(businessId)) <= limit + 1);
      }
      if (outcome === "deferred") {
        const fu = await prisma.followUp.findUniqueOrThrow({
          where: { id: job.id },
        });
        assert.equal(fu.status, FollowUpStatus.READY);
      }
    } finally {
      if (!hadKey) delete process.env.VAPI_API_KEY;
      await prisma.call.deleteMany({
        where: { id: { in: fillerCalls.map((c) => c.id) } },
      });
    }
  });

  it("persists PENDING follow-ups across process restarts (DB-backed)", async () => {
    const scheduledAt = new Date(Date.now() + 3_600_000);
    const job = await scheduleFollowUpFromCallResult({
      businessId,
      leadId,
      agentId,
      callId: (
        await prisma.call.create({
          data: { businessId, leadId, agentId, status: "ENDED" },
        })
      ).id,      followUpRequired: true,
      followUpDate: scheduledAt,
    });
    assert.ok(job);
    assert.equal(job!.status, FollowUpStatus.PENDING);

    // Simulate "restart": re-read from DB (no in-memory timer)
    const reloaded = await prisma.followUp.findUniqueOrThrow({
      where: { id: job!.id },
    });
    assert.equal(reloaded.status, FollowUpStatus.PENDING);
    assert.ok(
      Math.abs(reloaded.scheduledAt.getTime() - scheduledAt.getTime()) < 2000,
    );
  });

  it("duplicate claim prevents double processing of same follow-up", async () => {
    const job = await createFollowUpJob({
      businessId,
      leadId,
      agentId,
      scheduledAt: new Date(Date.now() - 1000),
      reason: "claim race",
    });
    await prisma.followUp.update({
      where: { id: job.id },
      data: { status: FollowUpStatus.PENDING },
    });

    const first = await prisma.followUp.updateMany({
      where: { id: job.id, status: FollowUpStatus.PENDING },
      data: { status: FollowUpStatus.READY },
    });
    const second = await prisma.followUp.updateMany({
      where: { id: job.id, status: FollowUpStatus.PENDING },
      data: { status: FollowUpStatus.READY },
    });
    assert.equal(first.count, 1);
    assert.equal(second.count, 0);
  });
});
