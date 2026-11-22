import bcrypt from "bcryptjs";
import { authorizeEmailCode, EmailCodeRejected } from "@/lib/auth";
import {
  requestLoginCode,
  requestResetCode,
  resendCode,
  startRegistration,
} from "@/lib/actions/email-auth";
import { codeErrorText, consumeCode, normalizeEmail } from "@/lib/email-codes";
import { mobileJson, preflight, redeemHandoffCode, sessionFor } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { transliterate } from "@/lib/username";

const PASSWORD_MIN = 6;

type Body = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The app's forms go through the same checks as the website's: build the same FormData. */
function form(body: Body, fields: string[]): FormData {
  const fd = new FormData();
  for (const f of fields) fd.set(f, str(body[f]));
  if (body.consent === true) fd.set("consent", "on");
  // Cloudflare Turnstile token from the captcha screen in the app.
  fd.set("cf-turnstile-response", str(body.captcha));
  return fd;
}

function codeError(error: unknown): string {
  if (error instanceof EmailCodeRejected) {
    if (error.code === "taken") return "Этот email или ник уже заняли. Начните заново.";
    if (error.code === "no_user") return "Аккаунт с этим email не найден";
    return codeErrorText(error.code as Parameters<typeof codeErrorText>[0]);
  }
  throw error;
}

async function handle(action: string, body: Body, request: Request): Promise<Response> {
  const ok = async (userId: string) => mobileJson(request, await sessionFor(userId));
  const fail = (error: string, status = 400) => mobileJson(request, { error }, status);

  switch (action) {
    case "login": {
      const typed = str(body.login).toLowerCase().trim();
      const login = typed.includes("@") ? typed : transliterate(typed.replace(/^@/, ""));
      const password = str(body.password);
      if (!login || !password) return fail("Введите email или ник и пароль");
      const allowed =
        (await rateLimit(`login:ip:${clientIp(request.headers)}`, 30, 15 * 60)) &&
        (await rateLimit(`login:acct:${login}`, 10, 15 * 60));
      if (!allowed) return fail("Слишком много попыток входа. Подождите 15 минут.", 429);
      const user = await prisma.user.findFirst({
        where: login.includes("@") ? { email: login } : { username: login },
        select: { id: true, passwordHash: true },
      });
      if (user && !user.passwordHash) {
        return fail("У этого аккаунта нет пароля — войдите через Google или по коду из письма");
      }
      if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
        return fail("Неверный email, ник или пароль", 401);
      }
      return ok(user.id);
    }

    case "register-start": {
      const r = await startRegistration({}, form(body, ["name", "username", "email", "password"]));
      return r.error ? fail(r.error) : mobileJson(request, { email: r.email });
    }

    case "code-start": {
      const r = await requestLoginCode({}, form(body, ["email"]));
      return r.error ? fail(r.error) : mobileJson(request, { email: r.email });
    }

    case "reset-start": {
      const r = await requestResetCode({}, form(body, ["email"]));
      return r.error ? fail(r.error) : mobileJson(request, { email: r.email });
    }

    case "register-confirm":
    case "code-confirm": {
      try {
        const user = await authorizeEmailCode({
          email: str(body.email),
          code: str(body.code),
          purpose: action === "register-confirm" ? "register" : "login",
        });
        return user ? ok(user.id) : fail("Введите код из письма");
      } catch (error) {
        return fail(codeError(error));
      }
    }

    case "reset-confirm": {
      const email = normalizeEmail(str(body.email));
      const password = str(body.password);
      if (password.length < PASSWORD_MIN) return fail(`Пароль должен быть не короче ${PASSWORD_MIN} символов`);
      const check = await consumeCode(email, "reset", str(body.code));
      if (!check.ok) return fail(codeErrorText(check.reason));
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) return fail("Аккаунт с этим email не найден");
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(password, 10), emailVerified: new Date() },
      });
      return ok(user.id);
    }

    case "resend": {
      const purpose = body.purpose === "register" || body.purpose === "reset" ? body.purpose : "login";
      const r = await resendCode(str(body.email), purpose);
      return r.error ? fail(r.error) : mobileJson(request, { ok: true });
    }

    case "exchange": {
      const userId = await redeemHandoffCode(str(body.code));
      return userId ? ok(userId) : fail("Ссылка для входа устарела. Попробуйте ещё раз.", 401);
    }

    default:
      return fail("Неизвестное действие", 404);
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") return mobileJson(request, { error: "Пустой запрос" }, 400);
  return handle(action, body, request);
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
