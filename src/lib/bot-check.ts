import { clientIp, rateLimit } from "@/lib/rate-limit";
import { HONEYPOT_FIELD, STARTED_FIELD } from "@/lib/bot-check-fields";
const MIN_FILL_MS = 2000;

const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare Turnstile is on only when both keys are set in the environment. */
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

// Throwaway inbox services used for mass sign-ups. Not exhaustive, just the common ones.
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "grr.la",
  "10minutemail.com", "10minutemail.net", "temp-mail.org", "tempmail.com", "tempmail.net",
  "temp-mail.io", "tempmailo.com", "throwawaymail.com", "yopmail.com", "yopmail.net",
  "getnada.com", "nada.email", "trashmail.com", "trashmail.de", "dispostable.com",
  "maildrop.cc", "mailnesia.com", "mintemail.com", "mohmal.com", "emailondeck.com",
  "fakeinbox.com", "spamgourmet.com", "mailcatch.com", "tempinbox.com", "tempr.email",
  "discard.email", "moakt.com", "mailpoof.com", "burnermail.io", "inboxkitten.com",
  "1secmail.com", "1secmail.net", "1secmail.org", "emailfake.com", "crazymailing.com",
  "linshiyouxiang.net", "dropmail.me", "minuteinbox.com", "fakemail.net", "tmpmail.org",
  "tmpmail.net", "mail.tm", "mail.gw", "cloud-mail.top", "tempm.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (DISPOSABLE.has(domain)) return true;
  // Subdomains of the same services, e.g. "x.mailinator.com".
  return [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`));
}

async function turnstilePasses(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch(TURNSTILE_VERIFY, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) console.warn("turnstile rejected", data["error-codes"]);
    return Boolean(data.success);
  } catch (error) {
    // Cloudflare unreachable: let people through rather than lock everyone out;
    // the other checks and the rate limits still apply.
    console.error("turnstile verification failed, allowing", error);
    return true;
  }
}

/**
 * Checks a form that sends email for signs of a bot.
 * Returns the text to show, or null when the request looks human.
 */
export async function botCheck(
  formData: FormData,
  headers: Headers,
  kind: "register" | "code",
): Promise<string | null> {
  const ip = clientIp(headers);

  if (String(formData.get(HONEYPOT_FIELD) ?? "").trim()) {
    return "Не удалось отправить форму. Обновите страницу и попробуйте ещё раз.";
  }
  // A browser clock running ahead gives a negative time: let that through.
  const elapsed = Date.now() - Number(formData.get(STARTED_FIELD));
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < MIN_FILL_MS) {
    return "Слишком быстро — подождите пару секунд и отправьте ещё раз.";
  }

  if (kind === "register") {
    // Per address, and a ceiling for the whole site so a botnet cannot burn the email quota.
    if (!(await rateLimit(`register:ip:${ip}`, 5, 60 * 60))) {
      return "С этого адреса слишком много регистраций. Попробуйте через час.";
    }
    if (!(await rateLimit("register:all", 300, 60 * 60))) {
      return "Сейчас слишком много регистраций. Попробуйте через несколько минут.";
    }
  }

  if (!(await turnstilePasses(String(formData.get("cf-turnstile-response") ?? ""), ip))) {
    return "Подтвердите, что вы не робот, и отправьте ещё раз.";
  }
  return null;
}
