import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { fromDateKey } from "@/lib/dates";
import { button, escapeHtmlText as e, letter, type EmailMessage } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

const SETTINGS = `${SITE_URL}/app/settings`;

const UNSUBSCRIBE_TEXT = "Если вам не нужны уведомления, вы можете их отключить в настройках профиля.";

function footer(what: string): string {
  return `Вы получили это письмо, потому что включили ${what} в Uspeyka.<br><span style="font-size:11px">Если вам не нужны уведомления, вы можете их отключить в <a href="${SETTINGS}" style="color:#8a90a8">настройках профиля</a>.</span>`;
}

function textFooter(): string {
  return `\n\n—\n${UNSUBSCRIBE_TEXT} ${SETTINGS}`;
}

export type DigestTask = { title: string; time: string | null; important: boolean; urgent: boolean };

/** Morning letter with the day's open tasks. */
export function digestEmail(to: string, name: string, today: string, tasks: DigestTask[]): EmailMessage {
  const shown = tasks.slice(0, 10);
  const more = tasks.length - shown.length;
  const day = format(fromDateKey(today), "d MMMM, EEEE", { locale: ru });
  const rows = shown
    .map((t) => {
      const flag = t.urgent
        ? ' <span style="padding:1px 7px;border-radius:99px;background:#ff3b30;color:#fff;font-size:11px;font-weight:700">СРОЧНО</span>'
        : t.important
          ? ' <span style="padding:1px 7px;border-radius:99px;background:#ffe08a;color:#7a4b00;font-size:11px;font-weight:700">ВАЖНО</span>'
          : "";
      const time = t.time ? `<span style="color:#1757f5;font-weight:700">${t.time}</span> ` : "";
      return `<tr><td style="padding:9px 0;border-top:1px solid #eef0f6;font-size:15px">${time}${e(t.title)}${flag}</td></tr>`;
    })
    .join("");
  const inner = `
    <p style="margin:26px 0 4px;font-size:22px;font-weight:800">Доброе утро, ${e(name)}!</p>
    <p style="margin:0 0 14px;color:#5a6280">${e(day)} · ${tasks.length} ${plural(tasks.length)} в плане</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${more > 0 ? `<p style="margin:8px 0 0;color:#5a6280">и ещё ${more}</p>` : ""}
    ${button(`${SITE_URL}/app`, "Открыть планер")}`;
  const text = [
    `Доброе утро, ${name}! ${day}: ${tasks.length} ${plural(tasks.length)} в плане.`,
    ...shown.map((t) => `— ${t.time ? `${t.time} ` : ""}${t.title}${t.urgent ? " (срочно)" : t.important ? " (важно)" : ""}`),
    more > 0 ? `и ещё ${more}` : "",
    `${SITE_URL}/app`,
  ]
    .filter(Boolean)
    .join("\n") + textFooter();
  return {
    to,
    subject: `План на сегодня: ${tasks.length} ${plural(tasks.length)}`,
    html: letter(inner, footer("утреннее письмо с планом")),
    text,
  };
}

/** Advance notice of a repeating reminder. */
export function reminderEmail(
  to: string,
  title: string,
  date: string,
  when: string,
  repeat: string,
): EmailMessage {
  const day = format(fromDateKey(date), "d MMMM, EEEE", { locale: ru });
  const headline = when === "сегодня" ? `Сегодня: ${title}` : `${title} — ${when}`;
  const inner = `
    <p style="margin:26px 0 6px;font-size:22px;font-weight:800">${e(headline)}</p>
    <p style="margin:0;color:#5a6280">Дата: <b style="color:#141b3a">${e(day)}</b><br>Повторяется ${e(repeat)}.</p>
    <p style="margin:14px 0 0;color:#5a6280">Самое время запланировать — в этот день дело появится у вас в планере.</p>
    ${button(`${SITE_URL}/app`, "Открыть Uspeyka")}`;
  return {
    to,
    subject: headline,
    html: letter(inner, footer("регулярные напоминания")),
    text: `${headline}\nДата: ${day}. Повторяется ${repeat}.\n${SITE_URL}/app` + textFooter(),
  };
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "дело";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дела";
  return "дел";
}

/** A vaccination or doctor visit coming up. */
export function healthEmail(
  to: string,
  childName: string,
  kind: "vaccine" | "visit",
  title: string,
  date: string,
  when: string,
): EmailMessage {
  const day = format(fromDateKey(date), "d MMMM, EEEE", { locale: ru });
  const what = kind === "vaccine" ? "Прививка" : "Визит к врачу";
  const headline = `${childName}: ${title} — ${when}`;
  const inner = `
    <p style="margin:26px 0 6px;font-size:22px;font-weight:800">${e(headline)}</p>
    <p style="margin:0;color:#5a6280">${e(what)} · <b style="color:#141b3a">${e(day)}</b></p>
    <p style="margin:14px 0 0;color:#5a6280">После визита отметьте его выполненным в разделе «Здоровье».</p>
    ${button(`${SITE_URL}/app/baby/health`, "Открыть «Здоровье»")}`;
  return {
    to,
    subject: headline,
    html: letter(inner, footer("напоминания о прививках и визитах")),
    text: `${headline}\n${what}: ${day}.\n${SITE_URL}/app/baby/health` + textFooter(),
  };
}
