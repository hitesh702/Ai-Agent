import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import {
  ApiError,
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/lib/api/http";
import { loginBodySchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, loginBodySchema);
    const email = body.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        businesses: { orderBy: { createdAt: "asc" }, take: 1 },
      },
    });

    if (!user?.passwordHash) {
      throw new ApiError(401, "Invalid email or password");
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const business = user.businesses[0];
    if (!business) {
      throw new ApiError(403, "Account is missing a business profile");
    }

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      businessId: business.id,
    });

    return jsonOk({
      user: { id: user.id, name: user.name, email: user.email },
      business: { id: business.id, name: business.name },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
