import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: (PrismaClient & { __schemaMark?: string }) | undefined;
};

/** Bump when Prisma models change so the dev singleton is replaced. */
const SCHEMA_MARK = "followUpEngineV1";

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }) as PrismaClient & { __schemaMark?: string };
  client.__schemaMark = SCHEMA_MARK;
  return client;
}

function getPrismaClient() {
  const existing = globalForPrisma.prisma;
  if (existing?.__schemaMark === SCHEMA_MARK) {
    return existing;
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrismaClient();
