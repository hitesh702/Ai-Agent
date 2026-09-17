import {
  handleApiError,
  jsonOk,
  requireApiBusiness,
} from "@/lib/api/http";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { business } = await requireApiBusiness();
    const calls = await prisma.call.findMany({
      where: { businessId: business.id },
      include: { agent: true, lead: true, result: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk(calls);
  } catch (error) {
    return handleApiError(error);
  }
}
