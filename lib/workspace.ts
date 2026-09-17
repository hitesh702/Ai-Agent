import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function getCurrentWorkspace() {
  const session = await requireSession();

  const business = await prisma.business.findFirst({
    where: {
      id: session.businessId,
      ownerId: session.userId,
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!business) {
    redirect("/login");
  }

  return {
    session,
    user: business.owner,
    business,
  };
}
