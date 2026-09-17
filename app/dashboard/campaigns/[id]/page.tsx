import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignControls } from "@/component/CampaignControls";
import { prisma } from "@/lib/db";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../../auth.css";
import "../../calls.css";

type Props = { params: Promise<{ id: string }> };

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const { business } = await getCurrentWorkspace();

  const campaign = await prisma.campaign.findFirst({
    where: { id, businessId: business.id },
    include: {
      agent: true,
      leads: { include: { lead: true } },
    },
  });

  if (!campaign) notFound();

  return (
    <>
      <header className="dash-header agent-header">
        <div>
          <h1>{campaign.name}</h1>
          <p>
            Agent: {campaign.agent.name} · Status: {campaign.status}
          </p>
        </div>
        <Link href="/dashboard/campaigns" className="agent-cancel">
          ← Campaigns
        </Link>
      </header>

      <section className="dash-panel">
        <h2>Controls</h2>
        <CampaignControls campaignId={campaign.id} status={campaign.status} />
        <p className="agent-form-note" style={{ marginTop: 12 }}>
          Start/pause updates campaign status. Bulk AI dialing is not enabled in
          this phase — place individual calls from Calls.
        </p>
      </section>

      <section className="dash-panel" style={{ marginTop: 16 }}>
        <h2>Leads in campaign ({campaign.leads.length})</h2>
        {campaign.leads.length === 0 ? (
          <p>No leads attached.</p>
        ) : (
          <div className="agent-list">
            {campaign.leads.map((row) => (
              <Link
                key={row.id}
                href={`/dashboard/leads/${row.leadId}`}
                className="agent-row"
              >
                <div>
                  <strong>{row.lead.name}</strong>
                  <p>
                    {row.lead.phone} · {row.status} · attempts {row.attempts}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
