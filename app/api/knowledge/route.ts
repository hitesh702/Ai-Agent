import {
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { knowledgeCreateSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { business } = await requireApiBusiness();
    const items = await prisma.businessKnowledge.findMany({
      where: { businessId: business.id },
      orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
    });
    return jsonOk(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, knowledgeCreateSchema);

    const item = await prisma.businessKnowledge.create({
      data: {
        businessId: business.id,
        category: body.category,
        title: body.title,
        content: body.content,
        active: body.active ?? true,
      },
    });

    return jsonOk(item, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
