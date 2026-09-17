import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../../auth.css";
import "../../calls.css";

type Props = { params: Promise<{ id: string }> };

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const { business } = await getCurrentWorkspace();

  const lead = await prisma.lead.findFirst({
    where: { id, businessId: business.id },
    include: {
      calls: {
        include: { agent: true, result: true },
        orderBy: { createdAt: "desc" },
      },
      appointments: { orderBy: { date: "asc" } },
    },
  });

  if (!lead) notFound();

  return (
    <>
      <header className="dash-header agent-header">
        <div>
          <h1>{lead.name}</h1>
          <p>
            {lead.phone}
            {lead.email ? ` · ${lead.email}` : ""} · Status:{" "}
            {lead.status.replaceAll("_", " ")}
          </p>
        </div>
        <div className="dash-panel-actions">
          <Link href="/dashboard/calls" className="primary-btn">
            Start call
          </Link>
          <Link href="/dashboard/leads" className="agent-cancel">
            ← Leads
          </Link>
        </div>
      </header>

      <section className="dash-panel">
        <h2>Details</h2>
        <p>
          Source: {lead.source || "—"}
          <br />
          Notes: {lead.notes || "—"}
        </p>
      </section>

      <section className="dash-panel" style={{ marginTop: 16 }}>
        <h2>Calls</h2>
        {lead.calls.length === 0 ? (
          <p>No calls yet.</p>
        ) : (
          <div className="agent-list">
            {lead.calls.map((call) => (
              <Link
                key={call.id}
                href={`/dashboard/calls/${call.id}`}
                className="agent-row"
              >
                <div>
                  <strong>{call.agent.name}</strong>
                  <p>
                    {call.status}
                    {call.result?.interest ? ` · ${call.result.interest}` : ""}
                  </p>
                </div>
                <span className="agent-status agent-status-draft">
                  {new Date(call.createdAt).toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="dash-panel" style={{ marginTop: 16 }}>
        <h2>Appointments</h2>
        {lead.appointments.length === 0 ? (
          <p>
            None yet.{" "}
            <Link href="/dashboard/appointments">Schedule one →</Link>
          </p>
        ) : (
          <ul className="simple-list">
            {lead.appointments.map((a) => (
              <li key={a.id}>
                <strong>
                  {a.date.toLocaleDateString()}
                  {a.time ? ` · ${a.time}` : ""} · {a.type || "appointment"}
                </strong>
                <span>{a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
