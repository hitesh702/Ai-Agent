import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignControls } from "@/component/CampaignControls";
import { CampaignForm } from "@/component/CampaignForm";
import { CampaignStatusBadge } from "@/component/CampaignStatusBadge";
import { getCampaignReadiness } from "@/lib/campaigns/lifecycle";
import { countActiveCampaignCalls } from "@/lib/campaigns/queue";
import { formatCampaignSchedule } from "@/lib/campaigns/rules";
import { prisma } from "@/lib/db";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../../auth.css";
import "../../calls.css";
import "../campaigns.css";

type Props = { params: Promise<{ id: string }> };

const OUTCOME_LABELS: Record<string, string> = {
  CONNECTED: "Connected",
  BUSY: "Busy",
  NO_ANSWER: "No answer",
  VOICEMAIL: "Voicemail",
  FAILED: "Call failed",
  REFUSED: "Refused",
  OPTED_OUT: "Opted out",
  MAX_ATTEMPTS: "Max attempts reached",
};

function leadBlockLabel(lead: { doNotCall: boolean; status: string }) {
  if (lead.doNotCall) return "opted out";
  if (lead.status === "NOT_INTERESTED") return "not interested";
  return null;
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const { business } = await getCurrentWorkspace();

  const campaign = await prisma.campaign.findFirst({
    where: { id, businessId: business.id },
    include: {
      agent: true,
      leads: {
        include: { lead: true },
        orderBy: { lead: { name: "asc" } },
      },
    },
  });
  if (!campaign) notFound();

  const editable = campaign.status === "DRAFT" || campaign.status === "READY";

  const [readiness, activeCalls, agents, allLeads] = await Promise.all([
    getCampaignReadiness(business.id, campaign.id),
    countActiveCampaignCalls(campaign.id),
    editable
      ? prisma.agent.findMany({
          where: { businessId: business.id, active: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    editable
      ? prisma.lead.findMany({
          where: { businessId: business.id },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const counts = { PENDING: 0, CALLING: 0, COMPLETED: 0, FAILED: 0, SKIPPED: 0 };
  let totalAttempts = 0;
  for (const row of campaign.leads) {
    counts[row.status]++;
    totalAttempts += row.attempts;
  }
  const total = campaign.leads.length;
  const finished = counts.COMPLETED + counts.FAILED + counts.SKIPPED;
  const progress = total ? Math.round((finished / total) * 100) : 0;

  const timezone = business.timezone || "Asia/Kolkata";
  const schedule = formatCampaignSchedule(campaign, timezone);

  return (
    <>
      <header className="dash-header agent-header">
        <div>
          <h1>{campaign.name}</h1>
          <p>
            Agent: {campaign.agent.name} · <CampaignStatusBadge status={campaign.status} />
          </p>
        </div>
        <Link href="/dashboard/campaigns" className="agent-cancel">
          ← Campaigns
        </Link>
      </header>

      <div className="dash-grid campaign-stats">
        <div className="dash-stat">
          <span>Leads</span>
          <strong>{total}</strong>
        </div>
        <div className="dash-stat">
          <span>Eligible to call</span>
          <strong>{readiness.eligible}</strong>
        </div>
        <div className="dash-stat">
          <span>Active calls</span>
          <strong>{activeCalls}</strong>
        </div>
        <div className="dash-stat">
          <span>Attempts made</span>
          <strong>{totalAttempts}</strong>
        </div>
        <div className="dash-stat">
          <span>Completed</span>
          <strong>{counts.COMPLETED}</strong>
        </div>
        <div className="dash-stat">
          <span>Failed / skipped</span>
          <strong>
            {counts.FAILED} / {counts.SKIPPED}
          </strong>
        </div>
      </div>

      <section className="dash-panel">
        <h2>Controls</h2>
        <div className="campaign-progress" aria-label={`Progress ${progress}%`}>
          <div style={{ width: `${progress}%` }} />
        </div>
        <div className="campaign-info">
          <p>
            {finished} of {total} leads finished ({progress}%).
          </p>
          <p>Schedule: {schedule}</p>
          <p>
            Up to {campaign.maxAttempts} attempt{campaign.maxAttempts === 1 ? "" : "s"} per
            lead · retry busy after {campaign.busyRetryMinutes} min, no answer after{" "}
            {campaign.retryDelayMinutes} min, failed after {campaign.failedRetryMinutes} min ·
            voicemail {campaign.retryOnVoicemail ? "retried" : "not retried"} · callback
            requests {campaign.createFollowUps ? "create follow-ups" : "do not create follow-ups"}
          </p>
          {campaign.status === "FAILED" && campaign.failureReason ? (
            <p className="form-error">Stopped: {campaign.failureReason}</p>
          ) : null}
        </div>
        <CampaignControls
          campaignId={campaign.id}
          status={campaign.status}
          eligibleCount={readiness.eligible}
          readinessErrors={readiness.errors}
          summary={{
            name: campaign.name,
            agentName: campaign.agent.name,
            leadCount: total,
            schedule,
            maxAttempts: campaign.maxAttempts,
          }}
        />
      </section>

      {editable ? (
        <section className="dash-panel">
          <h2>Edit campaign</h2>
          <p>Saving returns the campaign to draft so it can be checked again.</p>
          <CampaignForm
            timezone={timezone}
            agents={agents.map((a) => ({ id: a.id, name: a.name }))}
            leads={allLeads.map((l) => ({
              id: l.id,
              name: `${l.name} (${l.phone})`,
              blocked: leadBlockLabel(l),
            }))}
            campaign={{
              id: campaign.id,
              name: campaign.name,
              agentId: campaign.agentId,
              leadIds: campaign.leads.map((r) => r.leadId),
              callingDays: campaign.callingDays,
              callingWindowStart: campaign.callingWindowStart,
              callingWindowEnd: campaign.callingWindowEnd,
              maxAttempts: campaign.maxAttempts,
              busyRetryMinutes: campaign.busyRetryMinutes,
              retryDelayMinutes: campaign.retryDelayMinutes,
              failedRetryMinutes: campaign.failedRetryMinutes,
              retryOnVoicemail: campaign.retryOnVoicemail,
              createFollowUps: campaign.createFollowUps,
            }}
          />
        </section>
      ) : null}

      <section className="dash-panel">
        <h2>Leads in campaign ({total})</h2>
        {total === 0 ? (
          <p>No leads attached.</p>
        ) : (
          <div className="agent-list">
            {campaign.leads.map((row) => {
              const blocked = leadBlockLabel(row.lead);
              return (
                <Link
                  key={row.id}
                  href={`/dashboard/leads/${row.leadId}`}
                  className="agent-row"
                >
                  <div>
                    <strong>{row.lead.name}</strong>
                    <p>
                      {row.lead.phone} · attempts {row.attempts}/{campaign.maxAttempts}
                      {row.lastOutcome
                        ? ` · last: ${OUTCOME_LABELS[row.lastOutcome] ?? row.lastOutcome}`
                        : ""}
                      {row.status === "PENDING" && row.nextAttemptAt
                        ? ` · next try ${row.nextAttemptAt.toLocaleString("en-IN", { timeZone: timezone })}`
                        : ""}
                      {blocked && row.status === "PENDING" ? ` · ${blocked}, will be skipped` : ""}
                    </p>
                  </div>
                  <span className="agent-status agent-status-draft">{row.status}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
