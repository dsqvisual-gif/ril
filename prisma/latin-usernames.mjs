// One-time and repeat-safe: turns nicknames with Cyrillic letters into Latin ones
// ("данил" → "danil"), keeping them unique, and refreshes their lookalike keys.
// Runs during the Vercel build after the schema push. Keep TRANSLIT and the key rules in
// sync with src/lib/username.ts.
import { PrismaClient } from "@prisma/client";

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya", ә: "a", ғ: "g", қ: "q", ң: "n", ө: "o", ұ: "u", ү: "u",
  һ: "h", і: "i",
};
const LOOKALIKE = { 0: "o", 1: "l", i: "l" };

const translit = (s) => [...s.toLowerCase()].map((c) => TRANSLIT[c] ?? c).join("");
const keyOf = (s) =>
  [...translit(s)].filter((c) => c !== "_").map((c) => LOOKALIKE[c] ?? c).join("");

const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({
    where: { username: { not: null } },
    select: { id: true, username: true },
  });
  const taken = new Set(users.map((u) => u.username));
  const keys = new Map(users.map((u) => [keyOf(u.username), u.id]));
  let changed = 0;

  for (const user of users) {
    if (/^[a-z0-9_]{3,20}$/.test(user.username)) continue;
    let base = translit(user.username).replace(/[^a-z0-9_]/g, "");
    if (base.length < 3) base = `user_${base}`.slice(0, 20);
    base = base.slice(0, 17);
    let candidate = base;
    for (let n = 2; taken.has(candidate) || (keys.has(keyOf(candidate)) && keys.get(keyOf(candidate)) !== user.id); n++) {
      candidate = `${base}${n}`;
    }
    taken.delete(user.username);
    taken.add(candidate);
    keys.set(keyOf(candidate), user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { username: candidate, usernameKey: keyOf(candidate) },
    });
    changed += 1;
    console.log(`nickname: @${user.username} → @${candidate}`);
  }
  console.log(`latin nicknames: ${changed} changed`);
} finally {
  await prisma.$disconnect();
}
