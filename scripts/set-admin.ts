import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, plan: true },
  });

  console.log("Mevcut kullanıcılar:");
  console.log(JSON.stringify(users, null, 2));

  const email = process.argv[2];
  if (email) {
    const updated = await prisma.user.update({
      where: { email },
      data: { role: "ADMIN" },
      select: { id: true, email: true, role: true },
    });
    console.log(`\n✅ Admin yapıldı: ${updated.email} (${updated.role})`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
