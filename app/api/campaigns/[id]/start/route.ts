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
      include: { leads: true },
    });
    if (!campaign) throw new ApiError(404, "Campaign not found");

    if (campaign.leads.length === 0) {
      throw new ApiError(400, "Campaign has no leads");
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "ACTIVE",
        startTime: campaign.startTime ?? new Date(),
      },
      include: {
        agent: true,
        leads: true,
        _count: { select: { leads: true } },
      },
    });

    // Dialer loop is a later phase — this API marks the campaign ACTIVE only.
    return jsonOk({
      campaign: updated,
      note: "Campaign marked ACTIVE. Automated dialing ships in a later phase.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
