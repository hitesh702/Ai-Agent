"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearSessionCookie,
  setSessionCookie,
} from "@/lib/auth/session";

export type AuthActionState = {
  error?: string;
  success?: boolean;
};

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  businessName: z
    .string()
    .trim()
    .min(2, "Business / institute name must be at least 2 characters"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    businessName: formData.get("businessName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, password, businessName } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
      },
    });

    const business = await tx.business.create({
      data: {
        ownerId: createdUser.id,
        name: businessName,
      },
    });

    return { createdUser, business };
  });

  await setSessionCookie({
    userId: result.createdUser.id,
    email: result.createdUser.email,
    name: result.createdUser.name,
    businessId: result.business.id,
  });

  redirect("/onboarding/business");
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      businesses: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!user || !user.passwordHash) {
    return { error: "Invalid email or password" };
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  const business = user.businesses[0];
  if (!business) {
    return { error: "Account is missing a business profile. Contact support." };
  }

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    businessId: business.id,
  });

  const needsDetails = !business.phone && !business.address && !business.description;
  redirect(needsDetails ? "/onboarding/business" : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
