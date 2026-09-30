import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshCallButton } from "@/component/RefreshCallButton";
import { prisma } from "@/lib/db";
import { getCurrentWorkspace } from "@/lib/workspace";
import {
  getCallSummaryForBusiness,
  type CallSummaryView,
} from "@/lib/ai/summarize-call";
import "../../../auth.css";
import "../../calls.css";

type Props = {
  params: Promise<{ id: string }>;
};

function ProviderSummary({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p style={{ marginTop: 12 }}>
      <strong>Voice provider summary:</strong> {text}
    </p>
  );
}

function AiSummary({ view }: { view: CallSummaryView }) {
  switch (view.state) {
    case "waiting_for_call_end":
      return <p className="ai-summary-note">Summary will appear after the call ends.</p>;
    case "generating":
      return (
        <p className="ai-summary-note">
          Generating AI summary... Refresh the page in a few seconds.
        </p>
      );
    case "no_transcript":
      return <p className="ai-summary-note">No transcript available for this call.</p>;
    case "failed":
      return (
        <>
          <p className="form-error">AI summary could not be generated.</p>
          <ProviderSummary text={view.providerSummary} />
        </>
      );
    case "not_generated":
      return (
        <>
          <p className="ai-summary-note">
            No AI summary for this call yet. Use &ldquo;Refresh from provider&rdquo;
            below to generate one.
          </p>
          <ProviderSummary text={view.providerSummary} />
        </>
      );
    case "ready":
      return (
        <>
          <dl className="ai-summary-grid">
            <dt>Customer</dt>
            <dd>{view.customerName ?? "Not mentioned"}</dd>
            <dt>Interest</dt>
            <dd>{view.interest ? view.interest.replaceAll("_", " ") : "Unclear"}</dd>
            <dt>Course</dt>
            <dd>{view.course ?? "Not mentioned"}</dd>
            <dt>Requirement</dt>
            <dd>{view.requirement ?? "Not mentioned"}</dd>
            <dt>Objections</dt>
            <dd>
              {view.objections.length ? (
                <ul>
                  {view.objections.map((objection, i) => (
                    <li key={i}>{objection}</li>
                  ))}
                </ul>
              ) : (
                "None"
              )}
            </dd>
            <dt>Follow-up</dt>
            <dd>{view.followUpRequired ? "Yes" : "No"}</dd>
            <dt>Follow-up date</dt>
            <dd>{view.followUpDate ?? "—"}</dd>
            <dt>Summary</dt>
            <dd>{view.summary}</dd>
          </dl>
        </>
      );
  }
}

export default async function CallDetailPage({ params }: Props) {
  const { id } = await params;
  const { business } = await getCurrentWorkspace();

  const call = await prisma.call.findFirst({
    where: { id, businessId: business.id },
    include: { agent: true, lead: true, result: true },
  });

  if (!call) notFound();

  const summary = await getCallSummaryForBusiness(business.id, call.id);

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
        {summary ? <AiSummary view={summary} /> : null}
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
