import {
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { agentCreateSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { business } = await requireApiBusiness();
    const agents = await prisma.agent.findMany({
      where: { businessId: business.id },
      orderBy: { updatedAt: "desc" },
    });
    return jsonOk(agents);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, agentCreateSchema);

    const agent = await prisma.agent.create({
      data: {
        businessId: business.id,
        name: body.name,
        language: body.language ?? "HINGLISH",
        voice: body.voice ?? null,
        systemPrompt: body.systemPrompt ?? null,
        objective: body.objective ?? null,
        active: body.active ?? true,
      },
    });

    return jsonOk(agent, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
