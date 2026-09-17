import {
  ApiError,
  handleApiError,
  jsonOk,
  requireApiBusiness,
} from "@/lib/api/http";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();

    const campaign = await prisma.campaign.findFirst({
      where: { id, businessId: business.id },
    });
    if (!campaign) throw new ApiError(404, "Campaign not found");

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "PAUSED" },
      include: {
        agent: true,
        leads: true,
        _count: { select: { leads: true } },
      },
    });

    return jsonOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
