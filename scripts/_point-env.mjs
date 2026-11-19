import { readFileSync, writeFileSync } from "node:fs";

function readEnvValue(text, name) {
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

const local = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const databaseUrl = readEnvValue(local, "DATABASE_URL");
const envPath = new URL("../.env", import.meta.url);
let env = readFileSync(envPath, "utf8");
if (/^DATABASE_URL=.*$/m.test(env)) {
  env = env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${databaseUrl}"`);
} else {
  env = `DATABASE_URL="${databaseUrl}"\n${env}`;
}
writeFileSync(envPath, env);
console.log("local database url updated");
