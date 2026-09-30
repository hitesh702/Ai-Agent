/**
 * Campaign queue tests against the local SQLite DB with a fake call starter.
 * Telephony env is blanked so no real call can ever be placed.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { CallStatus, CampaignStatus, LeadStatus } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../api/http";
import type { StartCallFn } from "../calling/safe-queue";
import { applyProviderSnapshot } from "../telephony/sync";
import {
  createCampaign,
  markCampaignReady,
  pauseCampaign,
  resumeCampaign,
  startCampaign,
  updateCampaign,
  type CampaignInput,
} from "./lifecycle";
import { applyCampaignCallOutcome, processCampaignQueue } from "./queue";

const suffix = `cq_${Date.now()}`;
const userIds: string[] = [];

const config = {
  callingDays: "1,2,3,4,5,6,7",
  callingWindowStart: "00:00",
  callingWindowEnd: "00:00",
  maxAttempts: 3,
  busyRetryMinutes: 30,
  retryDelayMinutes: 120,
  failedRetryMinutes: 45,
  retryOnVoicemail: true,
  createFollowUps: true,
};

function callingDaysExceptToday() {
  const todayIst = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" })
    .format(new Date());
  const today = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(todayIst) + 1;
  return [1, 2, 3, 4, 5, 6, 7].filter((d) => d !== today).join(",");
}

const fakeStart = (async (input: Parameters<StartCallFn>[0]) =>
  prisma.call.create({
    data: {
      businessId: input.businessId,
      agentId: input.agentId,
      leadId: input.leadId,
      status: CallStatus.RINGING,
      campaignLeadId: input.campaignLeadId ?? null,
    },
  })) as unknown as StartCallFn;

const tick = (campaignId: string) => processCampaignQueue(campaignId, { startCall: fakeStart });

async function setupBusiness(tag: string, leadCount: number) {
  const user = await prisma.user.create({
    data: { name: "CQ", email: `cq-${tag}-${suffix}@example.com`, passwordHash: "x" },
  });
  userIds.push(user.id);
  const business = await prisma.business.create({
    data: { ownerId: user.id, name: `CQ ${tag}`, timezone: "Asia/Kolkata" },
  });
  const agent = await prisma.agent.create({
    data: { businessId: business.id, name: "Agent", active: true },
  });
  const leadIds: string[] = [];
  for (let i = 0; i < leadCount; i++) {
    const lead = await prisma.lead.create({
      data: { businessId: business.id, name: `Lead ${i}`, phone: `98765${tag.length}${String(i).padStart(4, "0")}` },
    });
    leadIds.push(lead.id);
  }
  return { businessId: business.id, agentId: agent.id, leadIds };
}

function input(agentId: string, leadIds: string[], name = "Campaign"): CampaignInput {
  return { name, agentId, leadIds, ...config };
}

async function run(campaignId: string) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.RUNNING },
  });
}

const callingCount = (campaignId: string) =>
  prisma.campaignLead.count({ where: { campaignId, status: "CALLING" } });

const is = (status: number) => (e: unknown) => e instanceof ApiError && e.status === status;

before(() => {
  process.env.VAPI_API_KEY = "";
  process.env.VAPI_PHONE_NUMBER_ID = "";
  delete process.env.CALL_CONCURRENCY_LIMIT;
  process.env.CALLING_MAX_CONCURRENCY = "2";
});

after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("campaign lifecycle guards", () => {
  it("refuses READY without eligible leads, and isolates businesses", async () => {
    const a = await setupBusiness("guard", 2);
    const other = await setupBusiness("other", 0);
    await prisma.lead.update({ where: { id: a.leadIds[0] }, data: { doNotCall: true } });
    await prisma.lead.update({
      where: { id: a.leadIds[1] },
      data: { status: LeadStatus.NOT_INTERESTED },
    });
    const c = await createCampaign(a.businessId, input(a.agentId, a.leadIds));

    await assert.rejects(markCampaignReady(a.businessId, c.id), /No eligible leads/);
    await assert.rejects(markCampaignReady(other.businessId, c.id), is(404));
    await assert.rejects(startCampaign(other.businessId, c.id, true), is(404));
    await assert.rejects(pauseCampaign(other.businessId, c.id), is(404));
    await assert.rejects(resumeCampaign(other.businessId, c.id), is(404));
    await assert.rejects(
      updateCampaign(other.businessId, c.id, input(other.agentId, [])),
      is(404),
    );
    await assert.rejects(
      createCampaign(other.businessId, input(other.agentId, a.leadIds)),
      is(400),
      "Business A's leads cannot be used by business B",
    );
    await assert.rejects(
      createCampaign(other.businessId, input(a.agentId, [])),
      is(404),
      "Business A's agent cannot be used by business B",
    );
    await assert.rejects(
      updateCampaign(a.businessId, c.id, input(a.agentId, [...a.leadIds, "not-a-lead"])),
      is(400),
    );
  });

  it("will not mark READY with an inactive agent", async () => {
    const g = await setupBusiness("inactive", 1);
    const c = await createCampaign(g.businessId, input(g.agentId, g.leadIds));
    await prisma.agent.update({ where: { id: g.agentId }, data: { active: false } });
    await assert.rejects(markCampaignReady(g.businessId, c.id), /active agent/);
  });

  it("creating and marking READY never place calls; only an explicit Start runs the queue", async () => {
    const e = await setupBusiness("explicit", 2);
    const c = await createCampaign(e.businessId, {
      ...input(e.agentId, e.leadIds),
      callingDays: callingDaysExceptToday(),
    });
    assert.equal(c.status, CampaignStatus.DRAFT);
    assert.equal(await prisma.call.count({ where: { businessId: e.businessId } }), 0);

    const ready = await markCampaignReady(e.businessId, c.id);
    assert.equal(ready.status, CampaignStatus.READY);
    assert.equal(await prisma.call.count({ where: { businessId: e.businessId } }), 0);

    const started = await startCampaign(e.businessId, c.id, true);
    assert.equal(started.campaign.status, CampaignStatus.RUNNING);
    assert.equal(started.tick?.state, "outside_schedule", "no call outside the schedule");
    assert.equal(await prisma.call.count({ where: { businessId: e.businessId } }), 0);
  });

  it("pauses and resumes without resetting attempts", async () => {
    const p = await setupBusiness("resume", 2);
    const c = await createCampaign(p.businessId, {
      ...input(p.agentId, p.leadIds),
      callingDays: callingDaysExceptToday(),
    });
    await markCampaignReady(p.businessId, c.id);
    await assert.rejects(resumeCampaign(p.businessId, c.id), is(409), "READY cannot resume");
    await startCampaign(p.businessId, c.id, true);
    await assert.rejects(resumeCampaign(p.businessId, c.id), is(409), "RUNNING cannot resume");

    const paused = await pauseCampaign(p.businessId, c.id);
    assert.equal(paused.status, CampaignStatus.PAUSED);
    await assert.rejects(pauseCampaign(p.businessId, c.id), is(409));
    await assert.rejects(startCampaign(p.businessId, c.id, true), /Use Resume/);

    await prisma.campaignLead.updateMany({
      where: { campaignId: c.id, leadId: p.leadIds[0] },
      data: { attempts: 1, lastOutcome: "BUSY" },
    });
    const resumed = await resumeCampaign(p.businessId, c.id);
    assert.equal(resumed.campaign.status, CampaignStatus.RUNNING);
    const kept = await prisma.campaignLead.findFirstOrThrow({
      where: { campaignId: c.id, leadId: p.leadIds[0] },
    });
    assert.equal(kept.attempts, 1);
    assert.equal(await prisma.call.count({ where: { businessId: p.businessId } }), 0);
  });

  it("needs READY and explicit confirmation to start; config failure marks FAILED", async () => {
    const b = await setupBusiness("start", 1);
    const c = await createCampaign(b.businessId, input(b.agentId, b.leadIds));

    await assert.rejects(startCampaign(b.businessId, c.id, true), is(409));
    await markCampaignReady(b.businessId, c.id);
    await assert.rejects(startCampaign(b.businessId, c.id, false), is(400));

    await startCampaign(b.businessId, c.id, true);
    const after = await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } });
    assert.equal(after.status, CampaignStatus.FAILED);
    assert.match(after.failureReason ?? "", /not configured/i);
    const cl = await prisma.campaignLead.findFirstOrThrow({ where: { campaignId: c.id } });
    assert.equal(cl.status, "PENDING");
    assert.equal(cl.attempts, 0);
    assert.equal(await prisma.call.count({ where: { businessId: b.businessId } }), 0);
  });
});

describe("campaign queue", () => {
  it("respects concurrency, retries, pause, max attempts, schedule and completion", async () => {
    const m = await setupBusiness("main", 7);
    await prisma.lead.update({ where: { id: m.leadIds[5] }, data: { doNotCall: true } });
    await prisma.lead.update({
      where: { id: m.leadIds[6] },
      data: { status: LeadStatus.NOT_INTERESTED },
    });
    const c = await createCampaign(m.businessId, input(m.agentId, m.leadIds));
    await markCampaignReady(m.businessId, c.id);
    await run(c.id);

    const t1 = await tick(c.id);
    assert.equal(t1.started, 2);
    assert.equal(t1.skipped, 2);
    assert.equal(await callingCount(c.id), 2);

    assert.equal((await tick(c.id)).started, 0, "limit of 2 holds");

    const [call1, call2] = await prisma.call.findMany({
      where: { campaignLead: { campaignId: c.id } },
      orderBy: { createdAt: "asc" },
    });
    await prisma.call.update({
      where: { id: call1.id },
      data: { status: CallStatus.ENDED, endedAt: new Date() },
    });
    await applyCampaignCallOutcome(call1.id, "BUSY");
    await applyCampaignCallOutcome(call1.id, "BUSY");
    const busy = await prisma.campaignLead.findUniqueOrThrow({
      where: { id: call1.campaignLeadId! },
    });
    assert.equal(busy.status, "PENDING");
    assert.equal(busy.attempts, 1, "duplicate webhook does not double count");
    assert.equal(busy.lastOutcome, "BUSY");
    assert.ok(busy.nextAttemptAt && busy.nextAttemptAt > new Date());

    const t3 = await tick(c.id);
    assert.equal(t3.started, 1);
    const busyAgain = await prisma.campaignLead.findUniqueOrThrow({ where: { id: busy.id } });
    assert.equal(busyAgain.status, "PENDING", "busy lead waits for its retry time");

    await pauseCampaign(m.businessId, c.id);
    await prisma.call.update({
      where: { id: call2.id },
      data: { status: CallStatus.ENDED, endedAt: new Date() },
    });
    await applyCampaignCallOutcome(call2.id, "CONNECTED");
    const paused = await tick(c.id);
    assert.equal(paused.state, "not_running");
    assert.equal(paused.started, 0);

    await run(c.id);
    await prisma.campaign.update({
      where: { id: c.id },
      data: { callingDays: callingDaysExceptToday() },
    });
    const closed = await tick(c.id);
    assert.equal(closed.state, "outside_schedule");
    assert.equal(closed.started, 0);
    await prisma.campaign.update({
      where: { id: c.id },
      data: { callingDays: config.callingDays },
    });

    await prisma.campaignLead.update({
      where: { id: busy.id },
      data: { attempts: 3, nextAttemptAt: null },
    });

    for (let i = 0; i < 10; i++) {
      await tick(c.id);
      assert.ok((await callingCount(c.id)) <= 2);
      const active = await prisma.call.findMany({
        where: { campaignLead: { campaignId: c.id }, status: CallStatus.RINGING },
      });
      for (const call of active) {
        await prisma.call.update({
          where: { id: call.id },
          data: { status: CallStatus.ENDED, endedAt: new Date() },
        });
        await applyCampaignCallOutcome(call.id, "CONNECTED");
      }
      const status = (await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } })).status;
      if (status === CampaignStatus.COMPLETED) break;
    }

    const final = await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } });
    assert.equal(final.status, CampaignStatus.COMPLETED);
    const exhausted = await prisma.campaignLead.findUniqueOrThrow({ where: { id: busy.id } });
    assert.equal(exhausted.status, "SKIPPED");
    assert.equal(exhausted.lastOutcome, "MAX_ATTEMPTS");
    const blocked = await prisma.campaignLead.findMany({
      where: { campaignId: c.id, leadId: { in: [m.leadIds[5], m.leadIds[6]] } },
      orderBy: { lastOutcome: "asc" },
    });
    assert.deepEqual(
      blocked.map((b) => [b.status, b.attempts, b.lastOutcome]),
      [
        ["SKIPPED", 0, "OPTED_OUT"],
        ["SKIPPED", 0, "REFUSED"],
      ],
    );
  });

  it("never exceeds the business limit when two campaigns run at once", async () => {
    const r = await setupBusiness("race", 6);
    const c1 = await createCampaign(r.businessId, input(r.agentId, r.leadIds.slice(0, 3), "A"));
    const c2 = await createCampaign(r.businessId, input(r.agentId, r.leadIds.slice(3), "B"));
    await run(c1.id);
    await run(c2.id);

    const results = await Promise.all([tick(c1.id), tick(c2.id), tick(c1.id), tick(c2.id)]);
    const started = results.reduce((n, res) => n + res.started, 0);
    assert.equal(started, 2);
    const active = await prisma.call.count({
      where: { businessId: r.businessId, status: CallStatus.RINGING },
    });
    assert.equal(active, 2);
  });

  it("parallel queue passes never claim the same campaign lead twice", async () => {
    const one = await setupBusiness("single", 1);
    const c = await createCampaign(one.businessId, input(one.agentId, one.leadIds));
    await run(c.id);
    const results = await Promise.all([tick(c.id), tick(c.id), tick(c.id), tick(c.id)]);
    assert.equal(results.reduce((n, r) => n + r.started, 0), 1);
    assert.equal(await prisma.call.count({ where: { businessId: one.businessId } }), 1);
    const cl = await prisma.campaignLead.findFirstOrThrow({ where: { campaignId: c.id } });
    assert.equal(cl.attempts, 1);
  });

  it("does not call a lead that is already on a call from another campaign", async () => {
    const x = await setupBusiness("overlap", 1);
    const first = await createCampaign(x.businessId, input(x.agentId, x.leadIds, "First"));
    const second = await createCampaign(x.businessId, input(x.agentId, x.leadIds, "Second"));
    await run(first.id);
    await run(second.id);

    assert.equal((await tick(first.id)).started, 1);
    const blocked = await tick(second.id);
    assert.equal(blocked.started, 0);
    const waiting = await prisma.campaignLead.findFirstOrThrow({ where: { campaignId: second.id } });
    assert.equal(waiting.status, "PENDING");
    assert.equal(waiting.attempts, 0);
    assert.equal(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: second.id } })).status,
      CampaignStatus.RUNNING,
      "not completed while the lead is still waiting",
    );
  });

  it("busy, no answer, failed and voicemail each schedule a retry with their own delay", async () => {
    process.env.CALLING_MAX_CONCURRENCY = "4";
    try {
      const r = await setupBusiness("retries", 4);
      const c = await createCampaign(r.businessId, input(r.agentId, r.leadIds));
      await run(c.id);
      assert.equal((await tick(c.id)).started, 4);

      const calls = await prisma.call.findMany({
        where: { businessId: r.businessId },
        orderBy: { createdAt: "asc" },
      });
      const outcomes = ["BUSY", "NO_ANSWER", "FAILED", "VOICEMAIL"] as const;
      const expectedMinutes = [30, 120, 45, 120];
      const before = Date.now();
      for (const [i, call] of calls.entries()) {
        await prisma.call.update({
          where: { id: call.id },
          data: { status: CallStatus.ENDED, endedAt: new Date() },
        });
        await applyCampaignCallOutcome(call.id, outcomes[i]);
      }

      for (const [i, call] of calls.entries()) {
        const cl = await prisma.campaignLead.findUniqueOrThrow({ where: { id: call.campaignLeadId! } });
        assert.equal(cl.status, "PENDING", outcomes[i]);
        assert.equal(cl.lastOutcome, outcomes[i]);
        assert.equal(cl.attempts, 1);
        const waitMin = (cl.nextAttemptAt!.getTime() - before) / 60_000;
        assert.ok(
          Math.abs(waitMin - expectedMinutes[i]) < 1,
          `${outcomes[i]} waits ${expectedMinutes[i]} min (got ${waitMin.toFixed(1)})`,
        );
      }
      assert.equal((await tick(c.id)).started, 0, "no immediate retry loop");
    } finally {
      process.env.CALLING_MAX_CONCURRENCY = "2";
    }
  });

  it("a duplicate provider webhook does not add attempts or reschedule the retry", async () => {
    const w = await setupBusiness("dupe", 1);
    const c = await createCampaign(w.businessId, input(w.agentId, w.leadIds));
    await run(c.id);
    assert.equal((await tick(c.id)).started, 1);
    const call = await prisma.call.findFirstOrThrow({ where: { businessId: w.businessId } });

    const busyWebhook = {
      callaiCallId: call.id,
      snapshot: {
        providerCallId: `pc-dupe-${suffix}`,
        status: "ended",
        endedReason: "customer-busy",
        raw: {},
      },
    };
    await applyProviderSnapshot(busyWebhook);
    const first = await prisma.campaignLead.findFirstOrThrow({ where: { campaignId: c.id } });
    await applyProviderSnapshot(busyWebhook);
    const second = await prisma.campaignLead.findFirstOrThrow({ where: { campaignId: c.id } });

    assert.equal(first.lastOutcome, "BUSY");
    assert.equal(second.attempts, 1);
    assert.equal(second.nextAttemptAt?.getTime(), first.nextAttemptAt?.getTime());
    assert.equal(await prisma.call.count({ where: { businessId: w.businessId } }), 1);
  });

  it("recovers a call whose webhook never arrived and schedules a retry", async () => {
    const st = await setupBusiness("stale", 1);
    const c = await createCampaign(st.businessId, input(st.agentId, st.leadIds));
    await run(c.id);
    assert.equal((await tick(c.id)).started, 1);

    const call = await prisma.call.findFirstOrThrow({ where: { businessId: st.businessId } });
    await prisma.call.update({
      where: { id: call.id },
      data: { createdAt: new Date(Date.now() - 20 * 60 * 1000) },
    });

    const res = await tick(c.id);
    assert.equal(res.reconciled, 1);
    const recovered = await prisma.call.findUniqueOrThrow({ where: { id: call.id } });
    assert.equal(recovered.status, CallStatus.FAILED);
    const cl = await prisma.campaignLead.findFirstOrThrow({ where: { campaignId: c.id } });
    assert.equal(cl.status, "PENDING");
    assert.equal(cl.lastOutcome, "FAILED");
    assert.ok(cl.nextAttemptAt && cl.nextAttemptAt > new Date());
  });

  it("records opt-out and refusal from the webhook and never re-queues them", async () => {
    const s = await setupBusiness("sync", 2);
    const c = await createCampaign(s.businessId, input(s.agentId, s.leadIds));
    await run(c.id);
    assert.equal((await tick(c.id)).started, 2);

    const calls = await prisma.call.findMany({
      where: { businessId: s.businessId },
      orderBy: { createdAt: "asc" },
    });
    await applyProviderSnapshot({
      callaiCallId: calls[0].id,
      snapshot: {
        providerCallId: `pc-optout-${suffix}`,
        status: "ended",
        endedReason: "customer-ended-call",
        interest: "NOT_INTERESTED",
        optOut: true,
        raw: {},
      },
    });
    await applyProviderSnapshot({
      callaiCallId: calls[1].id,
      snapshot: {
        providerCallId: `pc-refuse-${suffix}`,
        status: "ended",
        endedReason: "customer-ended-call",
        interest: "NOT_INTERESTED",
        raw: {},
      },
    });

    const [optedLead, refusedLead] = await Promise.all(
      [calls[0].leadId, calls[1].leadId].map((id) =>
        prisma.lead.findUniqueOrThrow({ where: { id } }),
      ),
    );
    assert.equal(optedLead.doNotCall, true);
    assert.equal(optedLead.status, LeadStatus.NOT_INTERESTED);
    assert.equal(refusedLead.doNotCall, false);
    assert.equal(refusedLead.status, LeadStatus.NOT_INTERESTED);

    const rows = await prisma.campaignLead.findMany({ where: { campaignId: c.id } });
    const byLead = new Map(rows.map((r) => [r.leadId, r]));
    assert.equal(byLead.get(calls[0].leadId)?.lastOutcome, "OPTED_OUT");
    assert.equal(byLead.get(calls[1].leadId)?.lastOutcome, "REFUSED");
    assert.ok(rows.every((r) => r.status === "COMPLETED" && r.attempts === 1));

    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } });
    assert.equal(campaign.status, CampaignStatus.COMPLETED);

    const again = await createCampaign(s.businessId, input(s.agentId, s.leadIds, "Again"));
    await assert.rejects(markCampaignReady(s.businessId, again.id), /No eligible leads/);
  });
});
