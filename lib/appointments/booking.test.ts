/**
 * Appointment booking tests. AI and telephony are mocked — no real provider calls.
 * Run: npx tsx --test lib/appointments/booking.test.ts
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { AppointmentStatus, CallStatus } from "@prisma/client";
import { prisma } from "../db";
import { VapiTelephonyProvider } from "../telephony/providers/vapi";
import {
  appointmentAgentRules,
  appointmentToolToken,
  handleAppointmentToolWebhook,
  NO_BOOKING_RULE,
  TOOL_TOKEN_HEADER,
} from "./agent-tools";
import {
  allowedNextStatuses,
  APPOINTMENT_TABLE_COLUMNS,
  bookAppointment,
  formatAppointmentConfirmation,
  getAppointment,
  getAvailableSlots,
  listAppointments,
  SLOT_TAKEN_MESSAGE,
  statusLabel,
  toAppointmentRow,
  toSafeAppointment,
  updateAppointmentStatus,
} from "./booking";

/** Tuesday 29 Sep 2026, 10:00 in India. */
const NOW = new Date("2026-09-29T04:30:00.000Z");
const ALL_SLOTS = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"];
const suffix = `appt-${Date.now()}`;

let businessId = "";
let otherBusinessId = "";
let nyBusinessId = "";
let agentId = "";
let leadA = "";
let leadB = "";
let otherLead = "";
let nyLead = "";
let savedAuthSecret: string | undefined;

function book(overrides: Record<string, unknown> = {}, now = NOW, business = businessId) {
  return bookAppointment(
    business,
    { leadId: leadA, appointmentType: "counselling", ...overrides },
    now,
  );
}

async function createCall(leadId: string, createdAt = new Date(NOW.getTime() - 60_000)) {
  return prisma.call.create({
    data: {
      businessId,
      leadId,
      agentId,
      provider: "vapi",
      providerCallId: `prov-${suffix}-${Math.random().toString(36).slice(2)}`,
      status: CallStatus.IN_PROGRESS,
      createdAt,
    },
  });
}

function toolPayload(
  call: { id: string; providerCallId: string | null },
  name: string,
  args: unknown,
  toolCallId = "tc-1",
) {
  return {
    message: {
      type: "tool-calls",
      call: { id: call.providerCallId, assistant: { metadata: { callaiCallId: call.id } } },
      toolCallList: [{ id: toolCallId, type: "function", function: { name, arguments: args } }],
    },
  };
}

async function runTool(
  call: { id: string; providerCallId: string | null },
  name: string,
  args: unknown,
) {
  const response = await handleAppointmentToolWebhook(
    toolPayload(call, name, args),
    appointmentToolToken(call.id),
    NOW,
  );
  assert.equal(response.status, 200);
  if (response.status !== 200) throw new Error("unreachable");
  return response.body.results[0];
}

type ToolData = {
  success: boolean;
  error?: string;
  slots?: Array<{ date: string; time: string; label: string }>;
  alternatives?: Array<{ date: string; time: string }>;
  [key: string]: unknown;
};

/** Parsed JSON `result` of a tool call (fails the test if the tool returned `error`). */
function toolData(outcome: { result: string } | { error: string }): ToolData {
  assert.ok("result" in outcome, "error" in outcome ? outcome.error : "");
  return JSON.parse((outcome as { result: string }).result);
}

function countAt(business: string, iso: string) {
  return prisma.appointment.count({
    where: { businessId: business, date: new Date(iso), status: { not: "CANCELLED" } },
  });
}

describe("appointment booking", () => {
  before(async () => {
    savedAuthSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET ||= "test-secret-for-appointment-tools";

    const owner = await prisma.user.create({
      data: { name: "Appt", email: `owner-${suffix}@example.com`, passwordHash: "x" },
    });
    const window = {
      timezone: "Asia/Kolkata",
      callingWindowStart: "10:00",
      callingWindowEnd: "13:00",
      callingDays: "1,2,3,4,5,6",
    };
    businessId = (
      await prisma.business.create({ data: { ownerId: owner.id, name: `Appt ${suffix}`, ...window } })
    ).id;

    const otherOwner = await prisma.user.create({
      data: { name: "Other", email: `other-${suffix}@example.com`, passwordHash: "x" },
    });
    otherBusinessId = (
      await prisma.business.create({
        data: { ownerId: otherOwner.id, name: `Other ${suffix}`, ...window },
      })
    ).id;

    const nyOwner = await prisma.user.create({
      data: { name: "NY", email: `ny-${suffix}@example.com`, passwordHash: "x" },
    });
    nyBusinessId = (
      await prisma.business.create({
        data: {
          ownerId: nyOwner.id,
          name: `NY ${suffix}`,
          ...window,
          timezone: "America/New_York",
          callingDays: "1,2,3,4,5,6,7",
        },
      })
    ).id;

    agentId = (await prisma.agent.create({ data: { businessId, name: "Priya" } })).id;
    leadA = (await prisma.lead.create({ data: { businessId, name: "Rahul", phone: "9876500001" } })).id;
    leadB = (await prisma.lead.create({ data: { businessId, name: "Anita", phone: "9876500002" } })).id;
    otherLead = (
      await prisma.lead.create({
        data: { businessId: otherBusinessId, name: "Other", phone: "9876500003" },
      })
    ).id;
    nyLead = (
      await prisma.lead.create({
        data: { businessId: nyBusinessId, name: "Sam", phone: "2125550100" },
      })
    ).id;
  });

  after(async () => {
    await prisma.business.deleteMany({
      where: { id: { in: [businessId, otherBusinessId, nyBusinessId] } },
    });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    if (savedAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = savedAuthSecret;
    await prisma.$disconnect();
  });

  it("1. returns the real free slots inside business hours", async () => {
    const day = await getAvailableSlots(businessId, { date: "2026-10-01" }, NOW);
    assert.equal(day.ok, true);
    if (!day.ok) return;
    assert.deepEqual(day.slots, ALL_SLOTS);
    assert.equal(day.timeZone, "Asia/Kolkata");
    assert.equal(day.slotMinutes, 30);
  });

  it("2. booked slots and closed days are excluded", async () => {
    assert.equal((await book({ date: "2026-10-02", time: "11:00" })).ok, true);
    const day = await getAvailableSlots(businessId, { date: "2026-10-02" }, NOW);
    assert.ok(day.ok);
    if (!day.ok) return;
    assert.deepEqual(day.slots, ALL_SLOTS.filter((t) => t !== "11:00"));

    const sunday = await getAvailableSlots(businessId, { date: "2026-10-04" }, NOW);
    assert.ok(sunday.ok);
    if (sunday.ok) assert.deepEqual(sunday.slots, []);
  });

  it("3. customer preference filters or orders the slots", async () => {
    const morning = await getAvailableSlots(businessId, { date: "2026-10-03", preference: "morning" }, NOW);
    const afternoon = await getAvailableSlots(businessId, { date: "2026-10-03", preference: "Afternoon" }, NOW);
    const near = await getAvailableSlots(businessId, { date: "2026-10-03", preference: "11:10" }, NOW);
    const exact = await getAvailableSlots(businessId, { date: "2026-10-03", preference: "12:30" }, NOW);
    assert.ok(morning.ok && afternoon.ok && near.ok && exact.ok);
    if (!morning.ok || !afternoon.ok || !near.ok || !exact.ok) return;

    assert.deepEqual(morning.slots, ["10:00", "10:30", "11:00", "11:30"]);
    assert.deepEqual(afternoon.slots, ["12:00", "12:30"]);
    assert.equal(near.requestedAvailable, false);
    assert.equal(near.slots[0], "11:00");
    assert.equal(exact.requestedAvailable, true);
  });

  let firstBooking: Awaited<ReturnType<typeof book>> | null = null;

  it("4. books an available slot", async () => {
    firstBooking = await book({ date: "2026-10-05", time: "12:00", notes: "Wants JEE batch" });
    assert.equal(firstBooking.ok, true);
    if (firstBooking.ok) assert.equal(firstBooking.created, true);
  });

  it("5. the appointment is saved with the business, lead, time and slot", async () => {
    assert.ok(firstBooking?.ok);
    if (!firstBooking?.ok) return;
    const saved = await prisma.appointment.findUniqueOrThrow({
      where: { id: firstBooking.appointment.id },
    });
    assert.equal(saved.businessId, businessId);
    assert.equal(saved.leadId, leadA);
    assert.equal(saved.date.toISOString(), "2026-10-05T06:30:00.000Z");
    assert.equal(saved.endAt?.toISOString(), "2026-10-05T07:00:00.000Z");
    assert.equal(saved.time, "12:00");
    assert.equal(saved.type, "counselling");
    assert.equal(saved.status, AppointmentStatus.SCHEDULED);
    assert.equal(saved.notes, "Wants JEE batch");
    assert.equal(saved.slotKey, `${businessId}|2026-10-05T06:30:00.000Z`);
  });

  it("6. the confirmation is built from the saved appointment", async () => {
    const result = await book({ date: "2026-10-06", time: "12:30", appointmentType: "Demo" });
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(
      result.confirmation,
      "Rahul, your demo appointment is confirmed for Tuesday, October 6 at 12:30 PM.",
    );
    const reloaded = await getAppointment(businessId, result.appointment.id);
    assert.ok(reloaded);
    assert.equal(formatAppointmentConfirmation(reloaded, "Asia/Kolkata"), result.confirmation);
  });

  it("7. prevents double booking the same slot", async () => {
    assert.equal((await book({ date: "2026-10-07", time: "10:30" })).ok, true);
    const second = await book({ leadId: leadB, date: "2026-10-07", time: "10:30" });
    assert.equal(second.ok, false);
    if (second.ok) return;
    assert.equal(second.code, "slot_taken");
    assert.equal(second.message, SLOT_TAKEN_MESSAGE);
    assert.ok(second.alternatives.length > 0);
    assert.ok(!second.alternatives.some((s) => s.date === "2026-10-07" && s.time === "10:30"));
    assert.equal(await countAt(businessId, "2026-10-07T05:00:00.000Z"), 1);
  });

  it("8. prevents overlapping appointments (including older rows without an end time)", async () => {
    await prisma.appointment.create({
      data: {
        businessId,
        leadId: leadB,
        date: new Date("2026-10-08T04:45:00.000Z"),
        endAt: new Date("2026-10-08T05:15:00.000Z"),
        status: AppointmentStatus.CONFIRMED,
      },
    });
    await prisma.appointment.create({
      data: { businessId, leadId: leadB, date: new Date("2026-10-08T05:45:00.000Z") },
    });

    const day = await getAvailableSlots(businessId, { date: "2026-10-08" }, NOW);
    assert.ok(day.ok);
    if (day.ok) assert.deepEqual(day.slots, ["12:00", "12:30"]);

    for (const time of ["10:00", "10:30", "11:00", "11:30"]) {
      const result = await book({ date: "2026-10-08", time });
      assert.equal(result.ok, false, time);
      if (!result.ok) assert.equal(result.code, "slot_taken");
    }
  });

  it("9. past dates and times are rejected", async () => {
    const now = await book({ date: "2026-09-29", time: "10:00" });
    assert.equal(now.ok, false);
    if (!now.ok) assert.equal(now.code, "past_time");

    const yesterday = await getAvailableSlots(businessId, { date: "2026-09-28" }, NOW);
    assert.equal(yesterday.ok, false);
    if (!yesterday.ok) assert.equal(yesterday.code, "past_date");

    const today = await getAvailableSlots(businessId, { date: "2026-09-29" }, NOW);
    assert.ok(today.ok);
    if (today.ok) assert.deepEqual(today.slots, ALL_SLOTS.slice(1));
  });

  it("10. cancelling keeps history and frees the slot", async () => {
    const booked = await book({ date: "2026-10-09", time: "11:30" });
    assert.ok(booked.ok);
    if (!booked.ok) return;

    const cancelled = await updateAppointmentStatus(businessId, booked.appointment.id, "CANCELLED", NOW);
    assert.ok(cancelled.ok);
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.appointment.id } });
    assert.equal(row.status, AppointmentStatus.CANCELLED);
    assert.equal(row.slotKey, null);

    const day = await getAvailableSlots(businessId, { date: "2026-10-09" }, NOW);
    assert.ok(day.ok && day.slots.includes("11:30"));
    const rebooked = await book({ leadId: leadB, date: "2026-10-09", time: "11:30" });
    assert.ok(rebooked.ok && rebooked.created);
  });

  it("11. unavailable slots cannot be booked (outside hours, off the grid, closed day)", async () => {
    for (const [date, time] of [
      ["2026-10-01", "15:00"],
      ["2026-10-01", "10:15"],
      ["2026-10-04", "10:00"],
    ]) {
      const result = await book({ date, time });
      assert.equal(result.ok, false, `${date} ${time}`);
      if (!result.ok) {
        assert.equal(result.code, "outside_hours");
        assert.ok(result.alternatives.length > 0);
      }
    }
    const day = await getAvailableSlots(businessId, { date: "2026-10-01" }, NOW);
    assert.ok(day.ok);
    if (day.ok) assert.deepEqual(day.slots, ALL_SLOTS);
  });

  it("12. invalid lead, call or missing agreement is rejected", async () => {
    const missing = await book({ leadId: "does-not-exist", date: "2026-10-01", time: "10:00" });
    assert.ok(!missing.ok && missing.code === "invalid_lead");

    const foreign = await book({ leadId: otherLead, date: "2026-10-01", time: "10:00" });
    assert.ok(!foreign.ok && foreign.code === "invalid_lead");

    const callForB = await createCall(leadB);
    const wrongCall = await book({ callId: callForB.id, date: "2026-10-01", time: "10:00" });
    assert.ok(!wrongCall.ok && wrongCall.code === "invalid_call");

    for (const appointmentType of [undefined, "", "   "]) {
      const noType = await book({ appointmentType, date: "2026-10-01", time: "10:00" });
      assert.ok(!noType.ok && noType.code === "invalid_input");
    }

    for (const date of ["2026-02-31", "tomorrow", "02/10/2026", ""]) {
      const badDate = await book({ date, time: "10:00" });
      assert.ok(!badDate.ok && badDate.code === "invalid_input", `date ${date}`);
    }

    for (const time of ["3pm", "25:00", "10:60", "1000", ""]) {
      const badTime = await book({ date: "2026-10-01", time });
      assert.ok(!badTime.ok && badTime.code === "invalid_input", `time ${time}`);
    }

    const day = await getAvailableSlots(businessId, { date: "2026-10-01" }, NOW);
    assert.ok(day.ok);
    if (day.ok) assert.deepEqual(day.slots, ALL_SLOTS);
  });

  it("13. unauthorized tool calls are rejected", async () => {
    const call = await createCall(leadA);
    const payload = toolPayload(call, "createAppointment", {
      date: "2026-10-01",
      time: "10:00",
      appointmentType: "counselling",
      customerAgreed: true,
    });
    const otherCall = await createCall(leadA);

    for (const token of [null, "forged", appointmentToolToken(otherCall.id)]) {
      const response = await handleAppointmentToolWebhook(payload, token, NOW);
      assert.equal(response.status, 401);
    }
    assert.equal((await handleAppointmentToolWebhook({ message: { type: "status-update" } }, null, NOW)).status, 400);

    const stale = await createCall(leadA, new Date(NOW.getTime() - 3 * 60 * 60_000));
    const late = await handleAppointmentToolWebhook(
      toolPayload(stale, "createAppointment", { date: "2026-10-01", time: "10:00", customerAgreed: true }),
      appointmentToolToken(stale.id),
      NOW,
    );
    assert.equal(late.status, 200);
    if (late.status === 200) assert.ok("error" in late.body.results[0]);

    assert.equal(await countAt(businessId, "2026-10-01T04:30:00.000Z"), 0);
  });

  it("14. businesses cannot see or change each other's appointments", async () => {
    const booked = await book({ date: "2026-10-02", time: "12:00" });
    assert.ok(booked.ok);
    if (!booked.ok) return;

    assert.equal(await getAppointment(otherBusinessId, booked.appointment.id), null);
    const change = await updateAppointmentStatus(otherBusinessId, booked.appointment.id, "CANCELLED", NOW);
    assert.ok(!change.ok && change.code === "not_found");
    const still = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.appointment.id } });
    assert.equal(still.status, AppointmentStatus.SCHEDULED);

    const theirList = await listAppointments(otherBusinessId);
    assert.ok(!theirList.some((a) => a.id === booked.appointment.id));

    const theirDay = await getAvailableSlots(otherBusinessId, { date: "2026-10-02" }, NOW);
    assert.ok(theirDay.ok);
    if (theirDay.ok) assert.deepEqual(theirDay.slots, ALL_SLOTS);

    const crossLead = await book({ leadId: leadA, date: "2026-10-01", time: "10:00" }, NOW, otherBusinessId);
    assert.ok(!crossLead.ok && crossLead.code === "invalid_lead");
  });

  it("15. the AI cannot invent slots — only real free slots can be booked", async () => {
    const call = await createCall(leadA);

    const offer = toolData(
      await runTool(call, "getAvailableSlots", { date: "2026-10-10", preference: "afternoon" }),
    );
    assert.equal(offer.success, true);
    assert.deepEqual(offer.slots?.map((s) => s.time), ["12:00", "12:30"]);
    assert.equal(offer.slots?.[0].label, "Saturday, October 10 at 12:00 PM");

    for (const time of ["12:15", "16:00"]) {
      const invented = toolData(
        await runTool(call, "createAppointment", {
          date: "2026-10-10",
          time,
          appointmentType: "counselling",
          customerAgreed: true,
        }),
      );
      assert.equal(invented.success, false, time);
    }
    assert.equal(await prisma.appointment.count({ where: { callId: call.id } }), 0);

    const booked = toolData(
      await runTool(call, "createAppointment", {
        date: "2026-10-10",
        time: "12:00",
        appointmentType: "counselling",
        customerAgreed: true,
      }),
    );
    assert.equal(booked.success, true);

    const otherCall = await createCall(leadB);
    const taken = toolData(
      await runTool(otherCall, "createAppointment", {
        date: "2026-10-10",
        time: "12:00",
        appointmentType: "counselling",
        customerAgreed: true,
      }),
    );
    assert.equal(taken.success, false);
    assert.equal(taken.error, SLOT_TAKEN_MESSAGE);
    assert.ok(taken.alternatives?.some((s) => s.date === "2026-10-10" && s.time === "12:30"));
  });

  it("invalid AI tool arguments are rejected by Zod and injected ids are ignored", async () => {
    const call = await createCall(leadA);
    const invalid: unknown[] = [
      { date: "tomorrow", time: "11:00", appointmentType: "demo", customerAgreed: true },
      { date: "2026-10-14", time: "6pm", appointmentType: "demo", customerAgreed: true },
      { date: "2026-10-14", time: "11:00", appointmentType: "", customerAgreed: true },
      { date: "2026-10-14", time: "11:00", appointmentType: "party", customerAgreed: true },
      { date: "2026-10-14", time: "11:00", appointmentType: "demo", customerAgreed: "yes" },
      { date: "2026-10-14", time: "11:00", appointmentType: "demo" },
      {},
      "not json",
    ];
    for (const args of invalid) {
      const data = toolData(await runTool(call, "createAppointment", args));
      assert.equal(data.success, false, JSON.stringify(args));
      assert.ok(data.error);
    }
    assert.equal(toolData(await runTool(call, "getAvailableSlots", { date: "next week" })).success, false);
    assert.equal(await prisma.appointment.count({ where: { callId: call.id } }), 0);

    const booked = toolData(
      await runTool(call, "createAppointment", {
        date: "2026-10-14",
        time: "11:00",
        appointmentType: "demo",
        customerAgreed: true,
        leadId: leadB,
        businessId: otherBusinessId,
        agentId: "someone-else",
      }),
    );
    assert.equal(booked.success, true);
    const saved = await prisma.appointment.findFirstOrThrow({ where: { callId: call.id } });
    assert.equal(saved.businessId, businessId);
    assert.equal(saved.leadId, leadA);
    assert.equal(saved.agentId, agentId);
  });

  it("16. the AI cannot confirm before the database saves the booking", async () => {
    const call = await createCall(leadA);

    const notAgreed = toolData(
      await runTool(call, "createAppointment", {
        date: "2026-10-01",
        time: "11:00",
        appointmentType: "demo",
        customerAgreed: false,
      }),
    );
    assert.equal(notAgreed.success, false);
    assert.match(notAgreed.error ?? "", /confirm one of the offered times/);

    const client = prisma as unknown as Record<string, unknown>;
    const original = client.$transaction;
    client.$transaction = async () => {
      throw new Error("database unavailable");
    };
    let failed;
    try {
      failed = await runTool(call, "createAppointment", {
        date: "2026-10-01",
        time: "11:00",
        appointmentType: "demo",
        customerAgreed: true,
      });
    } finally {
      client.$transaction = original;
    }
    assert.ok("error" in failed);
    if ("error" in failed) assert.match(failed.error, /nothing was booked/);
    assert.equal(await prisma.appointment.count({ where: { callId: call.id } }), 0);

    const booked = toolData(
      await runTool(call, "createAppointment", {
        date: "2026-10-01",
        time: "11:00",
        appointmentType: "demo",
        customerAgreed: true,
      }),
    );
    const saved = await prisma.appointment.findFirstOrThrow({ where: { callId: call.id } });
    assert.deepEqual(booked, {
      success: true,
      appointmentId: saved.id,
      customerName: "Rahul",
      date: "2026-10-01",
      time: "11:00",
      appointmentType: "demo",
      status: "SCHEDULED",
      confirmation: "Rahul, your demo appointment is confirmed for Thursday, October 1 at 11:00 AM.",
    });

    const rules = appointmentAgentRules("2026-09-29 (Tuesday)", "Asia/Kolkata");
    assert.match(rules, /Never suggest, guess or promise an appointment date or time yourself/);
    assert.match(rules, /Never say the appointment is booked or confirmed unless createAppointment returns success: true/);
  });

  it("17. duplicate requests, tool calls and webhooks create only one appointment", async () => {
    const first = await book({ date: "2026-10-12", time: "11:00" });
    const again = await book({ date: "2026-10-12", time: "11:00" });
    assert.ok(first.ok && again.ok);
    if (!first.ok || !again.ok) return;
    assert.equal(again.created, false);
    assert.equal(again.appointment.id, first.appointment.id);

    const parallelSame = await Promise.all([
      book({ date: "2026-10-12", time: "11:30" }),
      book({ date: "2026-10-12", time: "11:30" }),
    ]);
    assert.ok(parallelSame.every((r) => r.ok));
    assert.equal(await countAt(businessId, "2026-10-12T06:00:00.000Z"), 1);

    const parallelRivals = await Promise.all([
      book({ date: "2026-10-12", time: "12:00" }),
      book({ leadId: leadB, date: "2026-10-12", time: "12:00" }),
    ]);
    assert.equal(parallelRivals.filter((r) => r.ok).length, 1);
    assert.equal(await countAt(businessId, "2026-10-12T06:30:00.000Z"), 1);

    const call = await createCall(leadA);
    const payload = toolPayload(call, "createAppointment", {
      date: "2026-10-12",
      time: "12:30",
      appointmentType: "counselling",
      customerAgreed: true,
    });
    const token = appointmentToolToken(call.id);
    const deliveries = await Promise.all([
      handleAppointmentToolWebhook(payload, token, NOW),
      handleAppointmentToolWebhook(payload, token, NOW),
    ]);
    const ids = new Set<unknown>();
    for (const delivery of deliveries) {
      assert.equal(delivery.status, 200);
      if (delivery.status === 200) {
        const data = toolData(delivery.body.results[0]);
        assert.equal(data.success, true);
        ids.add(data.appointmentId);
      }
    }
    assert.equal(ids.size, 1);
    assert.equal(await prisma.appointment.count({ where: { callId: call.id } }), 1);
  });

  it("18. slots and confirmations use the business timezone", async () => {
    const ny = await book({ leadId: nyLead, date: "2026-10-02", time: "12:00" }, NOW, nyBusinessId);
    assert.ok(ny.ok);
    if (!ny.ok) return;
    assert.equal(ny.appointment.date.toISOString(), "2026-10-02T16:00:00.000Z");
    assert.equal(ny.confirmation, "Sam, your counselling appointment is confirmed for Friday, October 2 at 12:00 PM.");
    assert.equal(toAppointmentRow(ny.appointment, "America/New_York").time, "12:00 PM");

    // 02:00 UTC on 29 Sep is still 28 Sep in New York but already 29 Sep in India.
    const lateUtc = new Date("2026-09-29T02:00:00.000Z");
    const nyYesterday = await getAvailableSlots(nyBusinessId, { date: "2026-09-28" }, lateUtc);
    const inYesterday = await getAvailableSlots(businessId, { date: "2026-09-28" }, lateUtc);
    assert.equal(nyYesterday.ok, true);
    assert.ok(!inYesterday.ok && inYesterday.code === "past_date");
  });

  it("19. status changes follow the allowed flow", async () => {
    const booked = await book({ date: "2026-10-13", time: "10:00" });
    assert.ok(booked.ok);
    if (!booked.ok) return;
    const id = booked.appointment.id;
    const afterStart = new Date("2026-10-13T05:00:00.000Z");

    assert.ok((await updateAppointmentStatus(businessId, id, "CONFIRMED", NOW)).ok);
    const early = await updateAppointmentStatus(businessId, id, "COMPLETED", NOW);
    assert.ok(!early.ok && early.code === "not_started");
    assert.ok((await updateAppointmentStatus(businessId, id, "COMPLETED", afterStart)).ok);
    const reopen = await updateAppointmentStatus(businessId, id, "CANCELLED", afterStart);
    assert.ok(!reopen.ok && reopen.code === "invalid_transition");
    assert.deepEqual(allowedNextStatuses("COMPLETED"), []);

    const noShow = await book({ date: "2026-10-13", time: "10:30" });
    assert.ok(noShow.ok);
    if (!noShow.ok) return;
    const marked = await updateAppointmentStatus(
      businessId,
      noShow.appointment.id,
      "NO_SHOW",
      new Date("2026-10-13T05:30:00.000Z"),
    );
    assert.ok(marked.ok && marked.appointment.status === "NO_SHOW");
  });

  it("20. booked appointments appear in the dashboard list with the table columns", async () => {
    assert.deepEqual([...APPOINTMENT_TABLE_COLUMNS], ["Customer", "Date", "Time", "Appointment Type", "Status"]);
    assert.ok(firstBooking?.ok);
    if (!firstBooking?.ok) return;
    const bookedId = firstBooking.appointment.id;

    const listed = (await listAppointments(businessId)).find((a) => a.id === bookedId);
    assert.ok(listed, "booked appointment is listed for its business");
    const row = toAppointmentRow(listed, "Asia/Kolkata");
    assert.deepEqual(
      { customer: row.customer, date: row.date, time: row.time, type: row.type, status: row.status },
      { customer: "Rahul", date: "Oct 5, 2026", time: "12:00 PM", type: "Counselling", status: "Scheduled" },
    );
    assert.equal(statusLabel("NO_SHOW"), "No-show");

    const safe = toSafeAppointment(listed, "Asia/Kolkata");
    assert.deepEqual(safe, {
      id: bookedId,
      customerName: "Rahul",
      date: "2026-10-05",
      time: "12:00",
      displayDate: "Oct 5, 2026",
      displayTime: "12:00 PM",
      appointmentType: "counselling",
      status: "SCHEDULED",
    });
    assert.ok(!("slotKey" in safe) && !("businessId" in safe));
  });

  it("the Vapi call gets the appointment tools and rules (telephony mocked)", async () => {
    const env = { ...process.env };
    const realFetch = globalThis.fetch;
    const sent: Array<Record<string, unknown>> = [];
    process.env.VAPI_API_KEY = "test-key";
    process.env.VAPI_PHONE_NUMBER_ID = "test-number";
    delete process.env.VAPI_SERVER_URL;
    delete process.env.APP_URL;
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      sent.push(JSON.parse(init?.body ?? "{}"));
      return new Response(JSON.stringify({ id: "prov-mock" }), { status: 200 });
    }) as typeof fetch;

    const input = {
      callId: "call-123",
      customerNumber: "+919876500001",
      customerName: "Rahul",
      agent: { id: agentId, name: "Priya", language: "HINGLISH", voice: null, systemPrompt: null, objective: null },
      business: { id: businessId, name: "Academy", description: null, phone: null, address: null, timezone: "Asia/Kolkata" },
      lead: { id: leadA, name: "Rahul", phone: "9876500001", notes: null },
      knowledge: [],
    };
    try {
      const provider = new VapiTelephonyProvider();
      await provider.startOutboundCall({ ...input, serverUrl: "https://callai.example/" });
      await provider.startOutboundCall(input);
    } finally {
      globalThis.fetch = realFetch;
      process.env = env;
    }

    type Tool = {
      function: { name: string };
      server: { url: string; headers: Record<string, string> };
    };
    type Model = { messages: Array<{ content: string }>; tools?: Tool[] };
    const withTools = (sent[0].assistant as { model: Model }).model;
    assert.deepEqual(
      withTools.tools?.map((t) => t.function.name),
      ["getAvailableSlots", "createAppointment"],
    );
    assert.equal(withTools.tools?.[0].server.url, "https://callai.example/api/webhooks/vapi/tools");
    assert.equal(withTools.tools?.[0].server.headers[TOOL_TOKEN_HEADER], appointmentToolToken("call-123"));
    assert.match(withTools.messages[0].content, /APPOINTMENT BOOKING/);

    const withoutTools = (sent[1].assistant as { model: Model }).model;
    assert.equal(withoutTools.tools, undefined);
    assert.ok(withoutTools.messages[0].content.includes(NO_BOOKING_RULE));
  });
});
