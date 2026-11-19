import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const secret = randomBytes(32).toString("base64url");

for (const environment of ["production", "preview", "development"]) {
  const result = spawnSync(
    "vercel",
    [
      "env",
      "add",
      "AUTH_SECRET",
      "--environment",
      environment,
      "--yes",
      "--sensitive",
      "--force",
      "--scope",
      "danil-gogulya",
    ],
    {
      input: secret,
      stdio: ["pipe", "inherit", "inherit"],
      shell: true,
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("AUTH_SECRET set");
