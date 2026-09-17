import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import {
  ApiError,
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/lib/api/http";
import { registerBodySchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, registerBodySchema);
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, "An account with this email already exists");
    }

    const passwordHash = await hashPassword(body.password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: body.name,
          email,
          passwordHash,
        },
      });
      const business = await tx.business.create({
        data: {
          ownerId: user.id,
          name: body.businessName,
        },
      });
      return { user, business };
    });

    await setSessionCookie({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      businessId: result.business.id,
    });

    return jsonOk(
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        business: {
          id: result.business.id,
          name: result.business.name,
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
