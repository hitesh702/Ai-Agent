import { prisma } from "./lib/db";

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: "e2e-", endsWith: "@example.com" } },
    select: { id: true, email: true },
  });
  const ids = users.map((u) => u.id);
  const biz = await prisma.business.deleteMany({ where: { ownerId: { in: ids } } });
  const del = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log({ users: users.map((u) => u.email), businessesDeleted: biz.count, usersDeleted: del.count });
  await prisma.$disconnect();
}

main();
