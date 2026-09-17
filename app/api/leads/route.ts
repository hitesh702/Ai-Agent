import {
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { leadCreateSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { business } = await requireApiBusiness();
    const leads = await prisma.lead.findMany({
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
    });
    return jsonOk(leads);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, leadCreateSchema);

    const lead = await prisma.lead.create({
      data: {
        businessId: business.id,
        name: body.name,
        phone: body.phone,
        email: body.email ?? null,
        source: body.source ?? null,
        notes: body.notes ?? null,
        status: body.status ?? "NEW",
        company: body.company ?? null,
        assignedTo: body.assignedTo ?? null,
        followUpAt: body.followUpAt ? new Date(body.followUpAt) : null,
        followUpNote: body.followUpNote ?? null,
        followUpReminder: body.followUpReminder ?? false,
      },
    });

    return jsonOk(lead, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
