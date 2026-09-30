/**
 * AI call summary tests. The LLM is always mocked — no real AI requests.
 * Run: npx tsx --test lib/ai/summarize-call.test.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { CallStatus, CallSummaryStatus } from "@prisma/client";
import { prisma } from "../db";
import { applyProviderSnapshot } from "../telephony/sync";
import {
  CALL_SUMMARY_SYSTEM_PROMPT,
  generateCallSummary,
  getCallSummaryForBusiness,
  summarizeCompletedCall,
  type SummaryCompleter,
  type SummaryCompletionRequest,
} from "./summarize-call";

const TRANSCRIPT = [
  "AI: Namaste, main Sunrise Academy se bol rahi hoon.",
  "User: Haan ji, main Rahul Sharma bol raha hoon. Mujhe JEE Advanced ka weekend batch chahiye.",
  "User: Pehle fees compare karni hai. Mera number 98765 43210 hai aur email rahul@example.com.",
  "User: Aap 2 October ko shaam 5 baje call kar lena.",
].join("\n");

const VALID = {
  customerName: "Rahul Sharma",
  interest: "INTERESTED",
  course: "JEE Advanced",
  requirement: "Wants weekend batch",
  objections: ["Wants to compare fees"],
  followUpRequired: true,
  followUpDate: "2026-10-02T17:00",
  summary:
    "Customer is interested in the JEE Advanced weekend batch and wants to compare fees.",
};

function mockAi(output: unknown, delayMs = 0) {
  const requests: SummaryCompletionRequest[] = [];
  const complete: SummaryCompleter = async (request) => {
    requests.push(request);
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return typeof output === "string" ? output : JSON.stringify(output);
  };
  return { complete, requests };
}

describe("generateCallSummary (mocked AI)", () => {
  let savedKey: string | undefined;
  beforeEach(() => {
    savedKey ??= process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });
  after(() => {
    if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
  });

  it("1. valid transcript produces a valid structured summary", async () => {
    const ai = mockAi(VALID);
    const result = await generateCallSummary(TRANSCRIPT, {
      complete: ai.complete,
      now: new Date("2026-09-29T06:00:00.000Z"),
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.summary, VALID);

    const request = ai.requests[0];
    assert.equal(request.system, CALL_SUMMARY_SYSTEM_PROMPT);
    assert.match(request.system, /Never invent customer information/);
    assert.match(request.user, /Today's date: 2026-09-29 \(timezone Asia\/Kolkata\)/);
    assert.match(request.user, /Rahul Sharma/);
  });

  it("sends only the transcript, with phone numbers and emails removed", async () => {
    const ai = mockAi(VALID);
    await generateCallSummary(TRANSCRIPT, { complete: ai.complete });
    const sent = ai.requests[0].user;
    assert.doesNotMatch(sent, /98765 43210/);
    assert.doesNotMatch(sent, /rahul@example\.com/);
    assert.match(sent, /\[phone\]/);
    assert.match(sent, /\[email\]/);
  });

  it("2. missing customer name returns null (empty text is treated as missing)", async () => {
    for (const customerName of [null, "", "   "]) {
      const result = await generateCallSummary(TRANSCRIPT, {
        complete: mockAi({ ...VALID, customerName }).complete,
      });
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.summary.customerName, null);
    }
  });

  it("3. missing course returns null", async () => {
    const result = await generateCallSummary(TRANSCRIPT, {
      complete: mockAi({ ...VALID, course: null }).complete,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.summary.course, null);
  });

  it("4. no objections returns []", async () => {
    const result = await generateCallSummary(TRANSCRIPT, {
      complete: mockAi({ ...VALID, objections: [] }).complete,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.summary.objections, []);
  });

  it("5. no follow-up returns false/null, even if the AI added a date", async () => {
    const result = await generateCallSummary(TRANSCRIPT, {
      complete: mockAi({ ...VALID, followUpRequired: false, followUpDate: "2026-10-02" })
        .complete,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.summary.followUpRequired, false);
      assert.equal(result.summary.followUpDate, null);
    }
  });

  it("6. follow-up request without a date is detected", async () => {
    const result = await generateCallSummary(TRANSCRIPT, {
      complete: mockAi({ ...VALID, followUpRequired: true, followUpDate: null }).complete,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.summary.followUpRequired, true);
      assert.equal(result.summary.followUpDate, null);
    }
  });

  it("7. follow-up date is accepted only as a real date", async () => {
    for (const followUpDate of ["2026-10-02", "2026-10-02T17:00"]) {
      const result = await generateCallSummary(TRANSCRIPT, {
        complete: mockAi({ ...VALID, followUpDate }).complete,
      });
      assert.equal(result.ok, true, followUpDate);
    }
    for (const followUpDate of ["kal shaam 5pm", "2026-02-31", "02/10/2026"]) {
      const result = await generateCallSummary(TRANSCRIPT, {
        complete: mockAi({ ...VALID, followUpDate }).complete,
      });
      assert.deepEqual(result, { ok: false, reason: "invalid_schema" }, followUpDate);
    }
  });

  it("8. invalid AI output is rejected", async () => {
    const badOutputs = [
      { ...VALID, interest: "MAYBE" },
      { ...VALID, objections: "Price is too high" },
      { ...VALID, followUpRequired: "yes" },
      { ...VALID, summary: "" },
      { ...VALID, extra: "not allowed" },
      { ...VALID, summary: undefined },
      [],
      null,
    ];
    for (const output of badOutputs) {
      const result = await generateCallSummary(TRANSCRIPT, {
        complete: mockAi(output).complete,
      });
      assert.deepEqual(result, { ok: false, reason: "invalid_schema" });
    }
  });

  it("9. invalid JSON is handled", async () => {
    const result = await generateCallSummary(TRANSCRIPT, {
      complete: mockAi("Sure! Here is the summary: {customerName: Rahul").complete,
    });
    assert.deepEqual(result, { ok: false, reason: "invalid_json" });
  });

  it("10. AI timeout is handled", async () => {
    let aborted = false;
    const neverAnswers: SummaryCompleter = ({ signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          aborted = true;
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    const result = await generateCallSummary(TRANSCRIPT, {
      complete: neverAnswers,
      timeoutMs: 30,
    });
    assert.deepEqual(result, { ok: false, reason: "timeout" });
    assert.equal(aborted, true);
  });

  it("handles an AI API error without throwing", async () => {
    const failing: SummaryCompleter = async () => {
      throw new Error("OpenAI request failed with status 500");
    };
    const result = await generateCallSummary(TRANSCRIPT, { complete: failing });
    assert.deepEqual(result, { ok: false, reason: "ai_error" });
  });

  it("11. missing or unusable transcript skips the AI entirely", async () => {
    const ai = mockAi(VALID);
    for (const transcript of [null, undefined, "", "    ", "AI: Hello?", "... ... ... ... ... ..."]) {
      const result = await generateCallSummary(transcript, { complete: ai.complete });
      assert.deepEqual(result, { ok: false, reason: "no_transcript" });
    }
    assert.equal(ai.requests.length, 0);
  });

  it("does nothing when no AI key is configured", async () => {
    const result = await generateCallSummary(TRANSCRIPT);
    assert.deepEqual(result, { ok: false, reason: "not_configured" });
  });
});

describe("summarizeCompletedCall (database)", () => {
  const suffix = `ais_${Date.now()}`;
  let businessId = "";
  let otherBusinessId = "";
  let agentId = "";
  let leadId = "";

  async function createCall(data: { status?: CallStatus; transcript?: string | null } = {}) {
    return prisma.call.create({
      data: {
        businessId,
        leadId,
        agentId,
        status: data.status ?? CallStatus.ENDED,
        transcript: data.transcript === undefined ? TRANSCRIPT : data.transcript,
        endedAt: new Date(),
      },
    });
  }

  before(async () => {
    const owner = await prisma.user.create({
      data: { name: "AI Summary", email: `owner-${suffix}@example.com`, passwordHash: "x" },
    });
    const business = await prisma.business.create({
      data: { ownerId: owner.id, name: `AI Summary ${suffix}`, timezone: "Asia/Kolkata" },
    });
    businessId = business.id;
    const otherOwner = await prisma.user.create({
      data: { name: "Other", email: `other-${suffix}@example.com`, passwordHash: "x" },
    });
    otherBusinessId = (
      await prisma.business.create({ data: { ownerId: otherOwner.id, name: `Other ${suffix}` } })
    ).id;
    agentId = (await prisma.agent.create({ data: { businessId, name: "Agent" } })).id;
    leadId = (
      await prisma.lead.create({ data: { businessId, name: "Rahul", phone: "9876543210" } })
    ).id;
  });

  after(async () => {
    await prisma.business.deleteMany({ where: { id: { in: [businessId, otherBusinessId] } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.$disconnect();
  });

  it("saves a validated summary to CallResult in the business timezone", async () => {
    const call = await createCall();
    const outcome = await summarizeCompletedCall(call.id, { complete: mockAi(VALID).complete });
    assert.equal(outcome, "completed");

    const saved = await prisma.callResult.findUniqueOrThrow({ where: { callId: call.id } });
    assert.equal(saved.summaryStatus, CallSummaryStatus.COMPLETED);
    assert.equal(saved.customerName, "Rahul Sharma");
    assert.equal(saved.interest, "INTERESTED");
    assert.equal(saved.course, "JEE Advanced");
    assert.equal(saved.requirement, "Wants weekend batch");
    assert.deepEqual(saved.objections, ["Wants to compare fees"]);
    assert.equal(saved.followUpRequired, true);
    assert.equal(saved.followUpDate?.toISOString(), "2026-10-02T11:30:00.000Z");
    assert.equal(saved.summary, VALID.summary);

    const view = await getCallSummaryForBusiness(businessId, call.id);
    assert.equal(view?.state, "ready");
    if (view?.state === "ready") assert.equal(view.followUpDate, "2026-10-02 17:00");
  });

  it("11. an ended call without a transcript is skipped and the AI is not called", async () => {
    const call = await createCall({ transcript: null });
    const ai = mockAi(VALID);
    assert.equal(
      await summarizeCompletedCall(call.id, { complete: ai.complete }),
      "skipped_no_transcript",
    );
    assert.equal(ai.requests.length, 0);
    const saved = await prisma.callResult.findUniqueOrThrow({ where: { callId: call.id } });
    assert.equal(saved.summaryStatus, CallSummaryStatus.SKIPPED);
    assert.equal(saved.summary, null);
    assert.equal((await getCallSummaryForBusiness(businessId, call.id))?.state, "no_transcript");
  });

  it("does not summarize a call that is still in progress", async () => {
    const call = await createCall({ status: CallStatus.IN_PROGRESS });
    const ai = mockAi(VALID);
    assert.equal(await summarizeCompletedCall(call.id, { complete: ai.complete }), "not_completed");
    assert.equal(ai.requests.length, 0);
    assert.equal(await prisma.callResult.count({ where: { callId: call.id } }), 0);
  });

  it("handles a missing call", async () => {
    assert.equal(await summarizeCompletedCall("missing-call-id"), "call_not_found");
  });

  it("12. duplicate call completion creates one CallResult and calls the AI once", async () => {
    const call = await createCall();
    const ai = mockAi(VALID, 30);
    const outcomes = await Promise.all([
      summarizeCompletedCall(call.id, { complete: ai.complete }),
      summarizeCompletedCall(call.id, { complete: ai.complete }),
      summarizeCompletedCall(call.id, { complete: ai.complete }),
    ]);
    assert.equal(outcomes.filter((o) => o === "completed").length, 1);
    assert.equal(ai.requests.length, 1);
    assert.equal(await prisma.callResult.count({ where: { callId: call.id } }), 1);
  });

  it("13. an existing valid summary is not overwritten", async () => {
    const call = await createCall();
    await summarizeCompletedCall(call.id, { complete: mockAi(VALID).complete });

    const second = mockAi({ ...VALID, customerName: "Someone Else", summary: "Different" });
    assert.equal(
      await summarizeCompletedCall(call.id, { complete: second.complete }),
      "already_completed",
    );
    assert.equal(second.requests.length, 0);

    // A late provider webhook must not replace the saved AI fields either.
    await applyProviderSnapshot({
      callaiCallId: call.id,
      snapshot: {
        providerCallId: `prov_${suffix}_late`,
        status: "unknown",
        interest: "NOT_INTERESTED",
        summary: "Provider summary",
        requirement: "Provider requirement",
        raw: {},
      },
    });
    const saved = await prisma.callResult.findUniqueOrThrow({ where: { callId: call.id } });
    assert.equal(saved.customerName, "Rahul Sharma");
    assert.equal(saved.summary, VALID.summary);
    assert.equal(saved.interest, "INTERESTED");
    assert.equal(saved.requirement, "Wants weekend batch");
  });

  it("invalid AI output is not saved; the call stays intact and can be retried", async () => {
    const call = await createCall();
    assert.equal(
      await summarizeCompletedCall(call.id, { complete: mockAi("not json").complete }),
      "failed",
    );
    let saved = await prisma.callResult.findUniqueOrThrow({ where: { callId: call.id } });
    assert.equal(saved.summaryStatus, CallSummaryStatus.FAILED);
    assert.equal(saved.summary, null);
    assert.equal(saved.customerName, null);
    assert.equal((await prisma.call.findUniqueOrThrow({ where: { id: call.id } })).status, "ENDED");
    assert.equal((await getCallSummaryForBusiness(businessId, call.id))?.state, "failed");

    assert.equal(
      await summarizeCompletedCall(call.id, { complete: mockAi(VALID).complete }),
      "completed",
    );
    saved = await prisma.callResult.findUniqueOrThrow({ where: { callId: call.id } });
    assert.equal(saved.summaryStatus, CallSummaryStatus.COMPLETED);
  });

  it("14. a database failure is handled without throwing", async () => {
    const call = await createCall();
    const delegate = prisma.callResult as unknown as Record<string, unknown>;
    const original = delegate.updateMany;
    delegate.updateMany = async () => {
      throw new Error("database is unavailable");
    };
    try {
      const outcome = await summarizeCompletedCall(call.id, {
        complete: mockAi(VALID).complete,
      });
      assert.equal(outcome, "failed");
    } finally {
      delegate.updateMany = original;
    }
    const saved = await prisma.callResult.findUnique({ where: { callId: call.id } });
    assert.notEqual(saved?.summaryStatus, CallSummaryStatus.COMPLETED);
    assert.equal((await prisma.call.findUniqueOrThrow({ where: { id: call.id } })).status, "ENDED");
  });

  it("15. another business cannot read the summary", async () => {
    const call = await createCall();
    await summarizeCompletedCall(call.id, { complete: mockAi(VALID).complete });
    assert.equal((await getCallSummaryForBusiness(businessId, call.id))?.state, "ready");
    assert.equal(await getCallSummaryForBusiness(otherBusinessId, call.id), null);
  });
});

describe("16. AI key stays on the server", () => {
  const root = process.cwd();

  function sourceFiles(dir: string): string[] {
    return (readdirSync(join(root, dir), { recursive: true }) as string[])
      .filter((file) => /\.(tsx?|jsx?)$/.test(file) && !/\.test\.tsx?$/.test(file))
      .map((file) => join(root, dir, file));
  }

  it("no client component references the AI key or the AI service", () => {
    const clientFiles = [...sourceFiles("app"), ...sourceFiles("component")].filter((file) =>
      /^\s*["']use client["']/.test(readFileSync(file, "utf8")),
    );
    assert.ok(clientFiles.length > 0);
    for (const file of clientFiles) {
      const code = readFileSync(file, "utf8");
      assert.doesNotMatch(code, /OPENAI/, file);
      assert.doesNotMatch(code, /lib\/ai\//, file);
    }
  });

  it("the key is never exposed through a NEXT_PUBLIC_ variable", () => {
    for (const file of [...sourceFiles("app"), ...sourceFiles("component"), ...sourceFiles("lib")]) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /NEXT_PUBLIC_OPENAI/, file);
    }
  });
});
