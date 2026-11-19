import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();
const users = await prisma.user.findMany();
writeFileSync(
  new URL("./_user-export.json", import.meta.url),
  JSON.stringify(users),
);
console.log(`exported ${users.length}`);
await prisma.$disconnect();
