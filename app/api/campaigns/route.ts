import {
  ApiError,
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { campaignCreateSchema } from "@/lib/api/schemas";
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

    const agent = await prisma.agent.findFirst({
      where: { id: body.agentId, businessId: business.id },
    });
    if (!agent) throw new ApiError(404, "Agent not found");

    if (body.leadIds.length > 0) {
      const leads = await prisma.lead.findMany({
        where: { businessId: business.id, id: { in: body.leadIds } },
        select: { id: true },
      });
      if (leads.length !== body.leadIds.length) {
        throw new ApiError(400, "One or more leadIds are invalid");
      }
    }

    const startTime = body.startTime ? new Date(body.startTime) : null;
    const endTime = body.endTime ? new Date(body.endTime) : null;
    if (startTime && Number.isNaN(startTime.getTime())) {
      throw new ApiError(400, "Invalid startTime");
    }
    if (endTime && Number.isNaN(endTime.getTime())) {
      throw new ApiError(400, "Invalid endTime");
    }

    const campaign = await prisma.campaign.create({
      data: {
        businessId: business.id,
        agentId: body.agentId,
        name: body.name,
        status: "DRAFT",
        startTime,
        endTime,
        leads: {
          create: body.leadIds.map((leadId) => ({ leadId })),
        },
      },
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
