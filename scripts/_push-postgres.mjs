import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

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

const databaseUrl = readEnvValue("DATABASE_URL_UNPOOLED");
const result = spawnSync("npx", ["prisma", "db", "push", "--accept-data-loss"], {
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
