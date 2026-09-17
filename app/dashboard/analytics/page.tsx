import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../calls.css";

export default async function AnalyticsPage() {
  const { business } = await getCurrentWorkspace();

  const [
    leadCount,
    callCount,
    interested,
    notInterested,
    followUp,
    noResponse,
    agentCount,
    appointmentCount,
    campaignCount,
    endedCalls,
  ] = await Promise.all([
    prisma.lead.count({ where: { businessId: business.id } }),
    prisma.call.count({ where: { businessId: business.id } }),
    prisma.lead.count({
      where: { businessId: business.id, status: "INTERESTED" },
    }),
    prisma.lead.count({
      where: { businessId: business.id, status: "NOT_INTERESTED" },
    }),
    prisma.lead.count({
      where: { businessId: business.id, status: "FOLLOW_UP" },
    }),
    prisma.lead.count({
      where: { businessId: business.id, status: "NO_RESPONSE" },
    }),
    prisma.agent.count({ where: { businessId: business.id } }),
    prisma.appointment.count({ where: { businessId: business.id } }),
    prisma.campaign.count({ where: { businessId: business.id } }),
    prisma.call.count({
      where: { businessId: business.id, status: "ENDED" },
    }),
  ]);

  return (
    <>
      <header className="dash-header">
        <h1>Analytics</h1>
        <p>Snapshot of leads, calls, and outcomes for {business.name}.</p>
      </header>

      <div className="dash-grid">
        <div className="dash-stat">
          <span>Leads</span>
          <strong>{leadCount}</strong>
        </div>
        <div className="dash-stat">
          <span>Calls</span>
          <strong>{callCount}</strong>
        </div>
        <div className="dash-stat">
          <span>Ended calls</span>
          <strong>{endedCalls}</strong>
        </div>
      </div>

      <div className="dash-grid" style={{ marginTop: 16 }}>
        <div className="dash-stat">
          <span>Interested</span>
          <strong>{interested}</strong>
        </div>
        <div className="dash-stat">
          <span>Not interested</span>
          <strong>{notInterested}</strong>
        </div>
        <div className="dash-stat">
          <span>Follow-up</span>
          <strong>{followUp}</strong>
        </div>
      </div>

      <div className="dash-grid" style={{ marginTop: 16 }}>
        <div className="dash-stat">
          <span>No response</span>
          <strong>{noResponse}</strong>
        </div>
        <div className="dash-stat">
          <span>Agents</span>
          <strong>{agentCount}</strong>
        </div>
        <div className="dash-stat">
          <span>Appointments</span>
          <strong>{appointmentCount}</strong>
        </div>
      </div>

      <section className="dash-panel" style={{ marginTop: 16 }}>
        <h2>Campaigns</h2>
        <p>{campaignCount} campaign(s) configured.</p>
        <div className="dash-panel-actions">
          <Link href="/dashboard/calls" className="primary-btn">
            View calls
          </Link>
          <Link href="/dashboard/leads" className="primary-btn">
            View leads
          </Link>
        </div>
      </section>
    </>
  );
}
