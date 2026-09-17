import Link from "next/link";
import { CampaignForm } from "@/component/CampaignForm";
import { prisma } from "@/lib/db";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../auth.css";
import "../calls.css";

export default async function CampaignsPage() {
  const { business } = await getCurrentWorkspace();

  const [campaigns, agents, leads] = await Promise.all([
    prisma.campaign.findMany({
      where: { businessId: business.id },
      include: {
        agent: true,
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.agent.findMany({
      where: { businessId: business.id, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.lead.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <header className="dash-header">
        <h1>Campaigns</h1>
        <p>
          Group leads with an agent. Auto-dialing comes later; status control is
          available now.
        </p>
      </header>

      <section className="dash-panel">
        <h2>Create campaign</h2>
        <CampaignForm
          agents={agents.map((a) => ({ id: a.id, name: a.name }))}
          leads={leads.map((l) => ({ id: l.id, name: `${l.name} (${l.phone})` }))}
        />
      </section>

      <section className="dash-panel" style={{ marginTop: 16 }}>
        <h2>Your campaigns</h2>
        {campaigns.length === 0 ? (
          <p>No campaigns yet.</p>
        ) : (
          <div className="agent-list">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/campaigns/${c.id}`}
                className="agent-row"
              >
                <div>
                  <strong>{c.name}</strong>
                  <p>
                    {c.agent.name} · {c._count.leads} leads · {c.status}
                  </p>
                </div>
                <span
                  className={`agent-status ${
                    c.status === "ACTIVE"
                      ? "agent-status-active"
                      : "agent-status-draft"
                  }`}
                >
                  {c.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
