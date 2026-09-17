import {
  ApiError,
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { knowledgeUpdateSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, knowledgeUpdateSchema);

    const existing = await prisma.businessKnowledge.findFirst({
      where: { id, businessId: business.id },
    });
    if (!existing) throw new ApiError(404, "Knowledge item not found");

    const updated = await prisma.businessKnowledge.update({
      where: { id: existing.id },
      data: body,
    });

    return jsonOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const { business } = await requireApiBusiness();

    const existing = await prisma.businessKnowledge.findFirst({
      where: { id, businessId: business.id },
    });
    if (!existing) throw new ApiError(404, "Knowledge item not found");

    await prisma.businessKnowledge.delete({ where: { id: existing.id } });
    return jsonOk({ deleted: true, id: existing.id });
  } catch (error) {
    return handleApiError(error);
  }
}
