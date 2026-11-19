import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function readEnvValue(name) {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = text.split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
  if (!line) throw new Error(`Missing ${name}`);
  let value = line.slice(name.length + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

process.env.DATABASE_URL = readEnvValue("DATABASE_URL_UNPOOLED");
const prisma = new PrismaClient();
const users = JSON.parse(
  readFileSync(new URL("./_user-export.json", import.meta.url), "utf8"),
);

for (const user of users) {
  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      username: user.username,
      image: user.image,
      createdAt: user.createdAt,
    },
  });
}

console.log(`imported ${users.length}`);
await prisma.$disconnect();
