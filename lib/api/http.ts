import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(
  status: number,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    { ok: false, error: message, ...(details ? { details } : {}) },
    { status },
  );
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", parsed.error.flatten());
  }
  return parsed.data;
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return jsonError(error.status, error.message, error.details);
  }
  if (error instanceof ZodError) {
    return jsonError(400, "Validation failed", error.flatten());
  }
  console.error("[api]", error);
  return jsonError(
    500,
    error instanceof Error ? error.message : "Internal server error",
  );
}

export async function requireApiSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new ApiError(401, "Unauthorized");
  }
  return session;
}

export async function requireApiBusiness() {
  const session = await requireApiSession();
  const business = await prisma.business.findFirst({
    where: { id: session.businessId, ownerId: session.userId },
  });
  if (!business) {
    throw new ApiError(403, "Business not found for this account");
  }
  return { session, business };
}
