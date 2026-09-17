import {
  handleApiError,
  jsonOk,
  parseJsonBody,
  requireApiBusiness,
} from "@/lib/api/http";
import { businessUpdateSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { business } = await requireApiBusiness();
    return jsonOk(business);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { business } = await requireApiBusiness();
    const body = await parseJsonBody(request, businessUpdateSchema);

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.website !== undefined ? { website: body.website } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
      },
    });

    return jsonOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
