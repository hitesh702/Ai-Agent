import { LeadManagement } from "@/component/leads/LeadManagement";
import { mapApiLeadToRecord, type ApiLead } from "@/component/leads/mappers";
import { prisma } from "@/lib/db";
import { isTelephonyConfigured } from "@/lib/telephony";
import { getCurrentWorkspace } from "@/lib/workspace";

export default async function LeadsPage() {
  const { business } = await getCurrentWorkspace();

  const [leads, agents] = await Promise.all([
    prisma.lead.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      include: {
        calls: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            agent: { select: { id: true, name: true } },
            result: true,
          },
        },
      },
    }),
    prisma.agent.findMany({
      where: { businessId: business.id, active: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  const initialLeads = leads.map((lead) =>
    mapApiLeadToRecord({
      ...lead,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      followUpAt: lead.followUpAt?.toISOString() ?? null,
      calls: lead.calls.map((call) => ({
        ...call,
        createdAt: call.createdAt.toISOString(),
        startedAt: call.startedAt?.toISOString() ?? null,
        endedAt: call.endedAt?.toISOString() ?? null,
        result: call.result
          ? {
              ...call.result,
              followUpDate: call.result.followUpDate?.toISOString() ?? null,
            }
          : null,
      })),
    } as ApiLead),
  );

  return (
    <LeadManagement
      initialLeads={initialLeads}
      agents={agents}
      telephonyConfigured={isTelephonyConfigured()}
    />
  );
}
