import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshCallButton } from "@/component/RefreshCallButton";
import { prisma } from "@/lib/db";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../../auth.css";
import "../../calls.css";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CallDetailPage({ params }: Props) {
  const { id } = await params;
  const { business } = await getCurrentWorkspace();

  const call = await prisma.call.findFirst({
    where: { id, businessId: business.id },
    include: { agent: true, lead: true, result: true },
  });

  if (!call) notFound();

  return (
    <>
      <header className="dash-header agent-header">
        <div>
          <h1>Call with {call.lead.name}</h1>
          <p>
            Agent: {call.agent.name} · Status: {call.status} · Provider:{" "}
            {call.provider}
            {call.providerCallId ? ` · ${call.providerCallId}` : ""}
          </p>
        </div>
        <Link href="/dashboard/calls" className="agent-cancel">
          ← All calls
        </Link>
      </header>

      <div className="dash-grid">
        <div className="dash-stat">
          <span>Interest</span>
          <strong style={{ fontSize: 18 }}>
            {call.result?.interest || "PENDING"}
          </strong>
        </div>
        <div className="dash-stat">
          <span>Lead status</span>
          <strong style={{ fontSize: 18 }}>
            {call.lead.status.replaceAll("_", " ")}
          </strong>
        </div>
        <div className="dash-stat">
          <span>Duration</span>
          <strong style={{ fontSize: 18 }}>
            {call.duration != null ? `${call.duration}s` : "—"}
          </strong>
        </div>
      </div>

      {call.errorMessage ? (
        <section className="dash-panel">
          <h2>Error</h2>
          <p className="form-error">{call.errorMessage}</p>
        </section>
      ) : null}

      <section className="dash-panel">
        <h2>AI summary</h2>
        <p>
          {call.result?.summary ||
            call.summary ||
            "Summary will appear after the call ends."}
        </p>
        {call.result?.requirement ? (
          <p style={{ marginTop: 12 }}>
            <strong>Requirement:</strong> {call.result.requirement}
          </p>
        ) : null}
        {call.result?.followUpRequired ? (
          <p style={{ marginTop: 8 }}>
            <strong>Follow-up required</strong>
            {call.result.followUpDate
              ? ` · ${call.result.followUpDate.toLocaleString()}`
              : ""}
          </p>
        ) : null}
      </section>

      <section className="dash-panel">
        <h2>Transcript</h2>
        {call.transcript ? (
          <pre className="transcript-box">{call.transcript}</pre>
        ) : (
          <p>
            Transcript appears when the call finishes. Use refresh if webhooks
            are not reachable locally.
          </p>
        )}
        <div style={{ marginTop: 16 }}>
          <RefreshCallButton callId={call.id} />
        </div>
      </section>
    </>
  );
}
