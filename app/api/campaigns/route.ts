import {
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { campaignCreateSchema } from "@/lib/api/schemas";
import { createCampaign } from "@/lib/campaigns/lifecycle";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { business } = await requireApiBusiness();
    const campaigns = await prisma.campaign.findMany({
      where: { businessId: business.id },
      include: {
        agent: true,
        leads: true,
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(campaigns);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, campaignCreateSchema);

    const created = await createCampaign(business.id, body);
    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        agent: true,
        leads: true,
        _count: { select: { leads: true } },
      },
    });

    return jsonOk(campaign, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
