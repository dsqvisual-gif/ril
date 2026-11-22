import { MAIL_FROM, SITE_URL } from "@/lib/site";

export type CodePurpose = "register" | "login" | "reset";

const SUBJECT: Record<CodePurpose, string> = {
  register: "Код подтверждения Uspeyka",
  login: "Код для входа в Uspeyka",
  reset: "Восстановление пароля Uspeyka",
};

const INTRO: Record<CodePurpose, string> = {
  register: "Вы регистрируетесь в Uspeyka. Введите этот код, чтобы подтвердить почту:",
  login: "Вы входите в Uspeyka. Введите этот код на сайте:",
  reset: "Вы восстанавливаете пароль в Uspeyka. Введите этот код, чтобы задать новый:",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function html(purpose: CodePurpose, code: string): string {
  const digits = escapeHtml(code);
  return `<!doctype html>
<html lang="ru"><body style="margin:0;background:#f3f6fd;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#141b3a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;padding:32px 28px">
        <tr><td>
          <img src="${SITE_URL}/email-logo.png" width="150" height="34" alt="Uspeyka" style="display:block;border:0">
          <p style="margin:28px 0 12px;font-size:16px;line-height:1.5">${INTRO[purpose]}</p>
          <p style="margin:0 0 24px;font-size:36px;font-weight:800;letter-spacing:10px;color:#1757f5">${digits}</p>
          <p style="margin:0;font-size:14px;line-height:1.5;color:#5a6280">Код действует 10 минут. Если это были не вы — просто проигнорируйте письмо: без кода никто не войдёт в ваш аккаунт.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#8a90a8">Uspeyka · <a href="${SITE_URL}" style="color:#8a90a8">uspeyka.com</a></p>
    </td></tr>
  </table>
</body></html>`;
}

function text(purpose: CodePurpose, code: string): string {
  return `${INTRO[purpose]}\n\n${code}\n\nКод действует 10 минут. Если это были не вы — проигнорируйте письмо.`;
}

export type EmailMessage = { to: string; subject: string; html: string; text: string };

/**
 * Sends one email through Resend. Without RESEND_API_KEY outside production
 * it is printed to the server log instead, for local work.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:dev] to ${message.to}: ${message.subject}\n${message.text}`);
      return;
    }
    throw new Error("RESEND_API_KEY is not set");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Resend ${response.status}: ${details.slice(0, 300)}`);
  }
}

/** Wraps email content in the Uspeyka letter layout. */
export function letter(inner: string, footer: string): string {
  return `<!doctype html>
<html lang="ru"><body style="margin:0;background:#f3f6fd;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#141b3a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;padding:28px 26px">
        <tr><td>
          <img src="${SITE_URL}/email-logo.png" width="150" height="34" alt="Uspeyka" style="display:block;border:0">
          ${inner}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#8a90a8">${footer}</p>
    </td></tr>
  </table>
</body></html>`;
}

export function escapeHtmlText(value: string): string {
  return escapeHtml(value);
}

export function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 22px;border-radius:999px;background:#1757f5;color:#ffffff;font-weight:700;text-decoration:none">${escapeHtml(label)}</a>`;
}

/**
 * Sends a one-time code through Resend. Without RESEND_API_KEY outside
 * production the code is printed to the server log instead, for local work.
 */
export async function sendCodeEmail(to: string, purpose: CodePurpose, code: string) {
  await sendEmail({ to, subject: SUBJECT[purpose], html: html(purpose, code), text: text(purpose, code) });
}
