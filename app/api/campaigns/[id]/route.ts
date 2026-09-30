import {
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { campaignCreateSchema } from "@/lib/api/schemas";
import { getCampaignReadiness, updateCampaign } from "@/lib/campaigns/lifecycle";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

async function loadCampaign(businessId: string, campaignId: string) {
  const { errors, eligible, calling } = await getCampaignReadiness(businessId, campaignId);
  const campaign = await prisma.campaign.findFirstOrThrow({
    where: { id: campaignId, businessId },
    include: {
      agent: { select: { id: true, name: true, active: true } },
      leads: {
        include: {
          lead: {
            select: { id: true, name: true, phone: true, status: true, doNotCall: true },
          },
        },
        orderBy: { lead: { name: "asc" } },
      },
    },
  });
  return { ...campaign, readiness: { errors, eligible, calling } };
}

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    return jsonOk(await loadCampaign(business.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Edit a DRAFT/READY campaign that has not placed calls. Saving returns it to DRAFT. */
export async function PUT(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, campaignCreateSchema);
    await updateCampaign(business.id, id, body);
    return jsonOk(await loadCampaign(business.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}
