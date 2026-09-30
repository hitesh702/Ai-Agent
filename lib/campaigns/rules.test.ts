import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyCallOutcome } from "../calling/outcome";
import { decideAfterCall, formatCampaignSchedule } from "./rules";

const window = {
  timezone: "Asia/Kolkata",
  callingDays: "1,2,3,4,5,6,7",
  callingWindowStart: "00:00",
  callingWindowEnd: "00:00",
};
const rules = {
  maxAttempts: 3,
  busyRetryMinutes: 30,
  retryDelayMinutes: 120,
  failedRetryMinutes: 45,
  retryOnVoicemail: true,
};
const now = new Date("2026-09-29T06:00:00Z");

describe("classifyCallOutcome", () => {
  it("returns null while a call is active", () => {
    assert.equal(classifyCallOutcome({ status: "RINGING" }), null);
  });

  it("maps provider end reasons", () => {
    assert.equal(classifyCallOutcome({ status: "ENDED", endedReason: "customer-busy" }), "BUSY");
    assert.equal(classifyCallOutcome({ status: "FAILED", providerStatus: "busy" }), "BUSY");
    assert.equal(
      classifyCallOutcome({ status: "ENDED", endedReason: "customer-did-not-answer" }),
      "NO_ANSWER",
    );
    assert.equal(classifyCallOutcome({ status: "FAILED", providerStatus: "no-answer" }), "NO_ANSWER");
    assert.equal(classifyCallOutcome({ status: "ENDED", endedReason: "voicemail" }), "VOICEMAIL");
    assert.equal(
      classifyCallOutcome({ status: "ENDED", endedReason: "twilio-failed-to-connect-call" }),
      "FAILED",
    );
    assert.equal(classifyCallOutcome({ status: "FAILED" }), "FAILED");
    assert.equal(
      classifyCallOutcome({ status: "ENDED", endedReason: "customer-ended-call" }),
      "CONNECTED",
    );
  });

  it("separates refusal from opt-out", () => {
    assert.equal(
      classifyCallOutcome({ status: "ENDED", endedReason: "customer-ended-call", interest: "NOT_INTERESTED" }),
      "REFUSED",
    );
    assert.equal(
      classifyCallOutcome({ status: "ENDED", interest: "NOT_INTERESTED", optOut: true }),
      "OPTED_OUT",
    );
  });
});

describe("decideAfterCall", () => {
  it("completes on conversation outcomes without retrying", () => {
    for (const outcome of ["CONNECTED", "REFUSED", "OPTED_OUT"] as const) {
      const d = decideAfterCall({ outcome, attempts: 1, rules, window, now });
      assert.equal(d.status, "COMPLETED");
      assert.equal(d.nextAttemptAt, null);
    }
  });

  it("retries each outcome after its own delay while attempts remain", () => {
    const expected = { BUSY: 30, NO_ANSWER: 120, VOICEMAIL: 120, FAILED: 45 } as const;
    for (const [outcome, minutes] of Object.entries(expected)) {
      const d = decideAfterCall({
        outcome: outcome as keyof typeof expected,
        attempts: 1,
        rules,
        window,
        now,
      });
      assert.equal(d.status, "PENDING", outcome);
      assert.equal(d.lastOutcome, outcome);
      assert.equal(d.nextAttemptAt?.getTime(), now.getTime() + minutes * 60_000, outcome);
    }
  });

  it("stops at maximum attempts for every retryable outcome", () => {
    for (const outcome of ["BUSY", "NO_ANSWER", "VOICEMAIL", "FAILED"] as const) {
      const d = decideAfterCall({ outcome, attempts: 3, rules, window, now });
      assert.equal(d.status, "FAILED", outcome);
      assert.equal(d.nextAttemptAt, null);
    }
  });

  it("applies the voicemail rule", () => {
    assert.equal(
      decideAfterCall({ outcome: "VOICEMAIL", attempts: 1, rules, window, now }).status,
      "PENDING",
    );
    assert.equal(
      decideAfterCall({
        outcome: "VOICEMAIL",
        attempts: 1,
        rules: { ...rules, retryOnVoicemail: false },
        window,
        now,
      }).status,
      "COMPLETED",
    );
  });

  it("moves retries into the calling window", () => {
    const d = decideAfterCall({
      outcome: "BUSY",
      attempts: 1,
      rules,
      window: { ...window, callingWindowStart: "09:00", callingWindowEnd: "18:00" },
      now: new Date("2026-09-29T12:00:00Z"), // 17:30 IST; +30 min reaches closing time
    });
    const ist = d.nextAttemptAt!.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });
    assert.equal(d.status, "PENDING");
    assert.equal(ist, "09:00");
  });
});

describe("formatCampaignSchedule", () => {
  it("summarises days and hours", () => {
    const base = { callingWindowStart: "09:00", callingWindowEnd: "18:00" };
    assert.equal(
      formatCampaignSchedule({ ...base, callingDays: "1,2,3,4,5,6" }, "Asia/Kolkata"),
      "Mon–Sat · 09:00–18:00 (Asia/Kolkata)",
    );
    assert.equal(
      formatCampaignSchedule({ ...base, callingDays: "1,3,5" }, "Asia/Kolkata"),
      "Mon, Wed, Fri · 09:00–18:00 (Asia/Kolkata)",
    );
    assert.equal(
      formatCampaignSchedule(
        { callingDays: "1,2,3,4,5,6,7", callingWindowStart: "00:00", callingWindowEnd: "00:00" },
        "Asia/Kolkata",
      ),
      "Every day · all day (Asia/Kolkata)",
    );
  });
});