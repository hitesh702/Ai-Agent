import { StartCallForm } from "@/component/StartCallForm";
import { prisma } from "@/lib/db";
import { isTelephonyConfigured } from "@/lib/telephony";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../auth.css";
import "../calls.css";

export default async function CallsPage() {
  const { business } = await getCurrentWorkspace();

  const [agents, leads, calls] = await Promise.all([
    prisma.agent.findMany({
      where: { businessId: business.id, active: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.lead.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.call.findMany({
      where: { businessId: business.id },
      include: { agent: true, lead: true, result: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <>
      <header className="dash-header">
        <h1>Calls</h1>
        <p>
          Start a real AI phone call through the telephony provider abstraction.
        </p>
      </header>

      <section className="dash-panel">
        <h2>Start test call</h2>
        <StartCallForm
          configured={isTelephonyConfigured()}
          agents={agents.map((a) => ({
            id: a.id,
            name: a.name,
            meta: a.language,
          }))}
          leads={leads.map((l) => ({
            id: l.id,
            name: l.name,
            meta: l.phone,
          }))}
        />
      </section>

      <section className="dash-panel" style={{ marginTop: 16 }}>
        <h2>Recent calls</h2>
        {calls.length === 0 ? (
          <p>No calls yet.</p>
        ) : (
          <div className="agent-list">
            {calls.map((call) => (
              <a
                key={call.id}
                href={`/dashboard/calls/${call.id}`}
                className="agent-row"
              >
                <div>
                  <strong>
                    {call.lead.name} · {call.agent.name}
                  </strong>
                  <p>
                    {call.status}
                    {call.result?.interest ? ` · ${call.result.interest}` : ""}
                    {` · ${call.provider}`}
                  </p>
                </div>
                <span className="agent-status agent-status-draft">
                  {new Date(call.createdAt).toLocaleString()}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
