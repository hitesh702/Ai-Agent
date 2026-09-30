import Link from "next/link";
import { CampaignForm } from "@/component/CampaignForm";
import { CampaignStatusBadge } from "@/component/CampaignStatusBadge";
import { formatCampaignSchedule } from "@/lib/campaigns/rules";
import { prisma } from "@/lib/db";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../auth.css";
import "../calls.css";
import "./campaigns.css";

export default async function CampaignsPage() {
  const { business } = await getCurrentWorkspace();
  const timezone = business.timezone || "Asia/Kolkata";

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
          Group leads with an agent, a calling schedule and retry rules. Calls are
          placed a few at a time, only after you mark a campaign ready and confirm Start.
        </p>
      </header>

      <section className="dash-panel">
        <h2>Your campaigns</h2>
        {campaigns.length === 0 ? (
          <div className="campaign-empty">
            <strong>No campaigns yet</strong>
            <p>Create your first campaign below. It is saved as a draft and never calls anyone until you start it.</p>
          </div>
        ) : (
          <div className="campaign-table-wrap">
            <table className="campaign-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Agent</th>
                  <th>Leads</th>
                  <th>Status</th>
                  <th>Schedule</th>
                  <th>Created</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/dashboard/campaigns/${c.id}`} className="campaign-table-name">
                        {c.name}
                      </Link>
                    </td>
                    <td>{c.agent.name}</td>
                    <td>{c._count.leads}</td>
                    <td>
                      <CampaignStatusBadge status={c.status} />
                    </td>
                    <td className="campaign-muted">{formatCampaignSchedule(c, timezone)}</td>
                    <td className="campaign-muted">
                      {c.createdAt.toLocaleDateString("en-IN", {
                        timeZone: timezone,
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <Link href={`/dashboard/campaigns/${c.id}`} className="campaign-table-action">
                        {c.status === "READY"
                          ? "Review & start"
                          : c.status === "DRAFT"
                            ? "Continue setup"
                            : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dash-panel">
        <h2>Create campaign</h2>
        <CampaignForm
          timezone={timezone}
          agents={agents.map((a) => ({ id: a.id, name: a.name }))}
          leads={leads.map((l) => ({
            id: l.id,
            name: `${l.name} (${l.phone})`,
            blocked: l.doNotCall
              ? "opted out"
              : l.status === "NOT_INTERESTED"
                ? "not interested"
                : null,
          }))}
        />
      </section>
    </>
  );
}
