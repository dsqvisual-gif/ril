"use strict";

const STORAGE_KEY = "ril-planner-v1";
const CIRC = 2 * Math.PI * 15;

const AWARDS = [
  { at: 10, name: "Десяток", line: "Десять дел доведены до конца.", color: "#007AFF" },
  { at: 50, name: "Полсотни", line: "Пятьдесят дел позади. Появился свой ритм.", color: "#5E5CE6" },
  { at: 100, name: "Сотня", line: "Сто завершённых дел. Это уже система.", color: "#BF5AF2" },
  { at: 250, name: "Двести пятьдесят", line: "Четверть тысячи. Привычка держится.", color: "#FF9F0A" },
  { at: 500, name: "Пятьсот", line: "Пятьсот дел. Редкая собранность.", color: "#FF375F" },
  { at: 1000, name: "Тысяча", line: "Тысяча дел, доведённых до конца.", color: "#E0A100" },
  { at: 2500, name: "Две тысячи пятьсот", line: "Две с половиной тысячи. Долгая, тихая работа.", color: "#0090B0" },
  { at: 5000, name: "Пять тысяч", line: "Пять тысяч дел. Так выглядит характер.", color: "#A67C2D" },
];

const PRESETS = [
  ["09:00", "Утро"],
  ["12:00", "Полдень"],
  ["15:00", "День"],
  ["18:00", "Вечер"],
  ["21:00", "Поздний вечер"],
];

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const WEEKDAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const WEEKDAYS_MON = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.6l3.8 3.8L18 8.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EMPTY_SVG = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8.6v6.8M8.6 12h6.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

const state = {
  view: "day",
  cursor: strip(new Date()),
  tasks: [],
  lifetime: 0,
  celebrated: [],
  hideDone: false,
  theme: "light",
  draft: "",
  draftTime: "",
  editingId: null,
  editDraft: null,
  timePopover: null,
  awardsOpen: false,
  celebrate: null,
  toast: null,
  focusDraft: false,
  focusEdit: false,
  focusQuick: null,
  justAddedId: null,
  justDoneId: null,
  animateView: false,
  alignWeek: false,
};

let toastTimer = 0;
let uidSeq = 0;

function uid() {
  uidSeq += 1;
  return `${Date.now().toString(36)}-${uidSeq.toString(36)}`;
}

function strip(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function ymd(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function parseYmd(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return strip(next);
}

function startOfWeek(date) {
  const d = strip(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function today() {
  return strip(new Date());
}

function isSameDay(a, b) {
  return ymd(a) === ymd(b);
}

function plural(n, one, few, many) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

function tasksPhrase(n) {
  return `${n} ${plural(n, "дело", "дела", "дел")}`;
}

function formatNum(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatTime(value) {
  if (!value) return "";
  const [h, m] = value.split(":");
  return `${Number(h)}:${m}`;
}

function cap(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function weekdayName(date) {
  return WEEKDAYS[date.getDay()];
}

function relativeLabel(date) {
  const delta = Math.round((strip(date) - today()) / 86400000);
  if (delta === 0) return "Сегодня";
  if (delta === 1) return "Завтра";
  if (delta === -1) return "Вчера";
  return cap(weekdayName(date));
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nextAward() {
  return AWARDS.find((award) => award.at > state.lifetime) || null;
}

function sanitizeTask(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title || "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date || "")) return null;
  const time = /^\d{2}:\d{2}$/.test(raw.time || "") ? raw.time : "";
  const done = Boolean(raw.done);
  return {
    id: String(raw.id || uid()),
    title,
    date: raw.date,
    time,
    done,
    credited: Boolean(raw.credited) || done,
    createdAt: Number(raw.createdAt) || Date.now(),
    completedAt: raw.completedAt ? Number(raw.completedAt) : null,
  };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return;
    state.tasks = Array.isArray(raw.tasks) ? raw.tasks.map(sanitizeTask).filter(Boolean) : [];
    state.lifetime = Math.max(0, Number(raw.lifetime) || 0);
    const credited = state.tasks.filter((task) => task.credited).length;
    if (state.lifetime < credited) state.lifetime = credited;
    state.celebrated = Array.isArray(raw.celebrated)
      ? raw.celebrated.filter((n) => AWARDS.some((award) => award.at === n))
      : AWARDS.filter((award) => award.at <= state.lifetime).map((award) => award.at);
    state.hideDone = Boolean(raw.hideDone);
    state.theme = raw.theme === "dark" ? "dark" : "light";
    if (["day", "week", "month"].includes(raw.view)) state.view = raw.view;
  } catch {
    /* keep defaults */
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tasks: state.tasks,
      lifetime: state.lifetime,
      celebrated: state.celebrated,
      hideDone: state.hideDone,
      theme: state.theme,
      view: state.view,
    }));
  } catch {
    /* storage can be unavailable */
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = state.theme === "dark" ? "#000000" : "#f5f5f7";
}

function announce(text) {
  const live = document.getElementById("live");
  live.textContent = "";
  window.setTimeout(() => { live.textContent = text; }, 20);
}

function activeSort(a, b) {
  if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
  if (a.time && !b.time) return -1;
  if (!a.time && b.time) return 1;
  return a.createdAt - b.createdAt;
}

function dayBundle(dateStr) {
  const all = state.tasks.filter((task) => task.date === dateStr);
  return {
    all,
    active: all.filter((task) => !task.done).sort(activeSort),
    done: all.filter((task) => task.done).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)),
  };
}

function setCursor(date) {
  const next = strip(date);
  if (ymd(next) !== ymd(state.cursor)) {
    state.draft = "";
    state.draftTime = "";
    state.timePopover = null;
    state.editingId = null;
    state.editDraft = null;
  }
  state.cursor = next;
}

function setView(view) {
  if (state.view === view) return;
  commitEdit();
  state.view = view;
  state.animateView = true;
  state.editingId = null;
  state.editDraft = null;
  state.timePopover = null;
  if (view === "week") state.alignWeek = true;
  save();
  render();
}

function shift(direction) {
  const date = new Date(state.cursor);
  if (state.view === "week") date.setDate(date.getDate() + direction * 7);
  else if (state.view === "month") {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, last));
  } else {
    date.setDate(date.getDate() + direction);
  }
  setCursor(date);
  render();
}

function goToday() {
  setCursor(new Date());
  render();
}

function periodHasToday() {
  const now = today();
  if (state.view === "week") {
    const start = startOfWeek(state.cursor);
    const end = addDays(start, 6);
    return now >= start && now <= end;
  }
  if (state.view === "month") {
    return state.cursor.getFullYear() === now.getFullYear() && state.cursor.getMonth() === now.getMonth();
  }
  return isSameDay(state.cursor, now);
}

function addTask({ title, date, time }) {
  const clean = String(title || "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!clean) return;
  const task = {
    id: uid(),
    title: clean,
    date,
    time: time || "",
    done: false,
    credited: false,
    createdAt: Date.now(),
    completedAt: null,
  };
  state.tasks.push(task);
  state.justAddedId = task.id;
  state.draft = "";
  state.draftTime = "";
  state.timePopover = null;
  if (state.view === "week") state.focusQuick = date;
  else state.focusDraft = true;
  save();
  render();
}

function commitEdit() {
  if (!state.editingId) return;
  const task = state.tasks.find((item) => item.id === state.editingId);
  if (!task) return;
  const title = String(state.editDraft ?? task.title).replace(/\s+/g, " ").trim();
  if (title) task.title = title.slice(0, 200);
  save();
}

function toggleDone(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  task.done = !task.done;
  if (task.done) {
    task.completedAt = Date.now();
    state.justDoneId = id;
    if (!task.credited) {
      task.credited = true;
      state.lifetime += 1;
      const pending = AWARDS.filter((award) => state.lifetime >= award.at && !state.celebrated.includes(award.at));
      if (pending.length) {
        pending.forEach((award) => state.celebrated.push(award.at));
        state.celebrate = pending[pending.length - 1];
      }
    }
    announce(state.celebrate ? `${state.celebrate.name}. ${state.celebrate.line}` : `Выполнено. Всего ${state.lifetime}.`);
  } else {
    task.completedAt = null;
    announce("Снова в списке.");
  }
  save();
  render();
}

function setTime(id, value) {
  const time = value || "";
  if (id === "composer") {
    state.draftTime = time;
    state.focusDraft = true;
  } else {
    const task = state.tasks.find((item) => item.id === id);
    if (task) task.time = time;
    if (state.editingId === id) state.focusEdit = true;
    save();
  }
  state.timePopover = null;
  render();
}

function removeTask(id) {
  const index = state.tasks.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [task] = state.tasks.splice(index, 1);
  if (state.editingId === id) {
    state.editingId = null;
    state.editDraft = null;
  }
  state.timePopover = null;
  showToast("Дело удалено", () => {
    state.tasks.push(task);
    save();
    render();
  });
  save();
  render();
}

function openTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  commitEdit();
  state.cursor = parseYmd(task.date);
  state.view = "day";
  state.animateView = true;
  state.editingId = id;
  state.editDraft = task.title;
  state.focusEdit = true;
  state.timePopover = null;
  save();
  render();
}

function showToast(message, onUndo) {
  state.toast = { message, onUndo: onUndo || null };
  paintToast();
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    state.toast = null;
    paintToast();
  }, 4600);
}

function paintToast() {
  const el = document.getElementById("toast");
  if (!state.toast) {
    el.classList.remove("show");
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<span>${esc(state.toast.message)}</span>${state.toast.onUndo ? '<button type="button" data-undo>Вернуть</button>' : ""}`;
  el.classList.add("show");
}

function checkButton(task, small) {
  return `<button class="check${small ? " sm" : ""}" type="button" data-check="${task.id}" aria-pressed="${task.done ? "true" : "false"}" aria-label="${task.done ? "Отметить невыполненным" : "Отметить выполненным"}">${CHECK_SVG}</button>`;
}

function taskRow(task) {
  const editing = state.editingId === task.id;
  const timeLabel = task.time ? formatTime(task.time) : "Время";
  const title = editing
    ? `<input class="title-input" data-edit-title="${task.id}" value="${esc(state.editDraft ?? task.title)}" maxlength="200" aria-label="Название дела">`
    : `<div class="task-title">${esc(task.title)}</div>`;
  const editor = editing
    ? `<div class="edit-row">
        <input class="date-field" type="date" data-edit-date="${task.id}" value="${task.date}" aria-label="День">
        <button class="danger" type="button" data-delete="${task.id}">Удалить</button>
      </div>`
    : "";
  const classes = [
    "task",
    task.done ? "done" : "",
    editing ? "editing" : "",
    task.id === state.justAddedId ? "just-added" : "",
    task.id === state.justDoneId ? "just-done" : "",
  ].filter(Boolean).join(" ");
  return `<article class="${classes}" data-task="${task.id}">
    ${checkButton(task)}
    <div class="task-main">${title}${editor}</div>
    <button class="time-pill${task.time ? " has-time" : " is-empty"}" type="button" data-time-for="${task.id}">${esc(timeLabel)}</button>
  </article>`;
}

function listHTML(dateStr) {
  const bundle = dayBundle(dateStr);
  if (!bundle.all.length) {
    const isToday = dateStr === ymd(today());
    return `<div class="empty">
      <div class="empty-mark" aria-hidden="true">${EMPTY_SVG}</div>
      <h2>${isToday ? "Пока пусто" : "Свободный день"}</h2>
      <p>Напишите дело выше. Время можно поставить сразу или оставить на потом.</p>
    </div>`;
  }
  const allDone = bundle.active.length === 0;
  const doneBlock = bundle.done.length
    ? `<button class="section-toggle" type="button" data-toggle-done aria-expanded="${state.hideDone ? "false" : "true"}">
        <span>Выполнено</span>
        <span class="section-meta">${bundle.done.length}<i class="chev ${state.hideDone ? "right" : "down"}"></i></span>
      </button>
      ${state.hideDone ? "" : `<div class="list">${bundle.done.map(taskRow).join("")}</div>`}`
    : "";
  const clear = allDone
    ? `<div class="all-clear"><span class="check is-on" aria-hidden="true">${CHECK_SVG}</span><div><strong>Всё сделано</strong><p>${dateStr === ymd(today()) ? "На сегодня ничего не осталось." : "Список на этот день закрыт."}</p></div></div>`
    : "";
  return `${clear}${bundle.active.length ? `<div class="list">${bundle.active.map(taskRow).join("")}</div>` : ""}${doneBlock}`;
}

function composerHTML() {
  const timeLabel = state.draftTime ? formatTime(state.draftTime) : "Время";
  return `<form class="composer" id="composer">
    <span class="check is-spacer" aria-hidden="true"></span>
    <input id="draft-title" type="text" maxlength="200" placeholder="Новое дело" autocomplete="off" enterkeyhint="done" aria-label="Новое дело">
    <button class="time-btn${state.draftTime ? " has-time" : ""}" type="button" data-time-for="composer">${esc(timeLabel)}</button>
    <button class="add-btn" id="add-btn" type="submit" disabled>
      <span class="add-label">Добавить</span>
      <span class="add-plus" aria-hidden="true">+</span>
    </button>
  </form>`;
}

function navHTML(prevLabel, nextLabel) {
  const todayBtn = periodHasToday() ? "" : '<button class="today-btn" type="button" data-today>Сегодня</button>';
  return `<div class="kicker-row">
    <button class="nav-btn" type="button" data-shift="-1" aria-label="${prevLabel}"><i class="chev left"></i></button>
    <button class="nav-btn" type="button" data-shift="1" aria-label="${nextLabel}"><i class="chev right"></i></button>
    ${todayBtn}
  </div>`;
}

function ringHTML(done, total) {
  const p = total ? done / total : 0;
  const offset = CIRC * (1 - p);
  return `<div class="hero-ring">
    <div class="ring-wrap${total && done === total ? " is-full" : ""}">
      <svg class="ring" viewBox="0 0 36 36" aria-hidden="true">
        <circle class="ring-track" cx="18" cy="18" r="15"></circle>
        <circle class="ring-value" cx="18" cy="18" r="15" stroke-dasharray="${CIRC.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
      </svg>
      <div class="ring-center">${total ? done : "–"}</div>
    </div>
    <div class="ring-caption">${total ? `${done} из ${total}` : "пусто"}</div>
  </div>`;
}

function statusLine(date, bundle) {
  const rel = relativeLabel(date);
  const dayName = weekdayName(date);
  const prefix = rel === cap(dayName) ? "" : `${dayName} · `;
  if (!bundle.all.length) return `${prefix}свободно`;
  if (bundle.active.length === 0) return `${prefix}всё сделано`;
  return `${prefix}${tasksPhrase(bundle.all.length)} · выполнено ${bundle.done.length}`;
}

function awardCard() {
  const next = nextAward();
  const prevAt = [...AWARDS].reverse().find((award) => award.at <= state.lifetime)?.at || 0;
  const dots = AWARDS.map((award) => {
    const on = state.lifetime >= award.at;
    const isNext = next && next.at === award.at;
    return `<i class="medal-dot${on ? " is-on" : ""}${isNext ? " is-next" : ""}" style="--c:${award.color}" title="${esc(award.name)}"></i>`;
  }).join("");
  let progress = "";
  if (next) {
    const width = Math.max(0, Math.min(100, (state.lifetime / next.at) * 100));
    progress = `<div class="next-line"><b>Дальше · ${esc(next.name)}</b><span>${formatNum(state.lifetime)} из ${formatNum(next.at)}</span></div>
      <div class="bar" aria-hidden="true"><span style="width:${width}%;background:${next.color}"></span></div>`;
  } else {
    progress = `<div class="next-line"><b>Все достижения открыты</b></div>`;
  }
  return `<button class="side-card" type="button" data-open-awards>
    <p class="side-kicker">Достижения</p>
    <div class="lifetime-num">${formatNum(state.lifetime)}</div>
    <p class="lifetime-label">${plural(state.lifetime, "дело завершено", "дела завершено", "дел завершено")}</p>
    ${progress}
    <div class="medal-row" aria-hidden="true">${dots}</div>
  </button>`;
}

function renderDay() {
  const bundle = dayBundle(ymd(state.cursor));
  const year = state.cursor.getFullYear() !== today().getFullYear() ? ` ${state.cursor.getFullYear()}` : "";
  return `<div class="view-wrap">
    <div class="day-layout">
      <div>
        ${navHTML("Предыдущий день", "Следующий день")}
        <div class="hero">
          <div>
            <p class="kicker">${esc(relativeLabel(state.cursor))}</p>
            <h1 class="hero-title"><span class="big">${state.cursor.getDate()}</span><span class="month">${MONTHS_GEN[state.cursor.getMonth()]}${year}</span></h1>
            <p class="meta">${esc(statusLine(state.cursor, bundle))}</p>
          </div>
          ${ringHTML(bundle.done.length, bundle.all.length)}
        </div>
        ${composerHTML()}
        ${listHTML(ymd(state.cursor))}
      </div>
      <aside>${awardCard()}</aside>
    </div>
  </div>`;
}

function renderWeek() {
  const start = startOfWeek(state.cursor);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const inWeek = state.tasks.filter((task) => {
    const date = parseYmd(task.date);
    return date >= start && date <= end;
  });
  const done = inWeek.filter((task) => task.done).length;
  const width = inWeek.length ? Math.round((done / inWeek.length) * 100) : 0;
  const sameMonth = start.getMonth() === end.getMonth();
  const range = sameMonth
    ? `${start.getDate()}–${end.getDate()} ${MONTHS_GEN[start.getMonth()]}`
    : `${start.getDate()} ${MONTHS_GEN[start.getMonth()]} – ${end.getDate()} ${MONTHS_GEN[end.getMonth()]}`;
  const year = start.getFullYear() !== today().getFullYear() || end.getFullYear() !== today().getFullYear()
    ? ` ${end.getFullYear()}`
    : "";
  const cols = days.map((date) => {
    const key = ymd(date);
    const bundle = dayBundle(key);
    const chips = [...bundle.active, ...bundle.done].map((task) => `<div class="chip${task.done ? " done" : ""}">
      ${checkButton(task, true)}
      <button class="chip-body" type="button" data-open-task="${task.id}">
        ${task.time ? `<span class="chip-time">${esc(formatTime(task.time))}</span>` : ""}
        <span class="chip-title">${esc(task.title)}</span>
      </button>
    </div>`).join("");
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    return `<section class="week-col${isSameDay(date, today()) ? " is-today" : ""}${weekend ? " is-weekend" : ""}">
      <button class="week-head" type="button" data-open-day="${key}">
        <span class="week-name">${WEEKDAYS_SHORT[date.getDay()]}</span>
        <span class="week-date">${date.getDate()}</span>
      </button>
      <div class="chips">${chips}</div>
      <form class="quick-add" data-quick="${key}">
        <input type="text" maxlength="200" placeholder="Дело" aria-label="Новое дело на ${weekdayName(date)}" autocomplete="off">
      </form>
    </section>`;
  }).join("");
  return `<div class="view-wrap is-wide">
    ${navHTML("Предыдущая неделя", "Следующая неделя")}
    <div class="view-head">
      <div>
        <h1 class="view-title">${range}${year}</h1>
        <p class="view-sub">${inWeek.length ? `${tasksPhrase(inWeek.length)} на неделе` : "Неделя ещё пустая"}</p>
      </div>
      <div class="week-progress">
        <strong>${inWeek.length ? `${done} из ${inWeek.length}` : "0 дел"}</strong>
        <span>выполнено</span>
        <div class="bar" aria-hidden="true"><span style="width:${width}%"></span></div>
      </div>
    </div>
    <div class="week-scroll"><div class="week-grid">${cols}</div></div>
  </div>`;
}

function monthGrid(cursor) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const days = [];
  for (let date = new Date(start); date <= last || date.getDay() !== 1; date = addDays(date, 1)) {
    days.push(date);
    if (days.length > 42) break;
  }
  return days;
}

function renderMonth() {
  const days = monthGrid(state.cursor);
  const monthTasks = state.tasks.filter((task) => task.date.startsWith(`${state.cursor.getFullYear()}-${String(state.cursor.getMonth() + 1).padStart(2, "0")}`));
  const cells = days.map((date) => {
    const key = ymd(date);
    const tasks = state.tasks.filter((task) => task.date === key).sort(activeSort);
    const outside = date.getMonth() !== state.cursor.getMonth();
    const selected = isSameDay(date, state.cursor);
    const pips = tasks.slice(0, 2).map((task) => `<span class="pip${task.done ? " is-done" : ""}">${task.time ? `${esc(formatTime(task.time))} ` : ""}${esc(task.title)}</span>`).join("");
    const more = tasks.length > 2 ? `<span class="pip-more">+${tasks.length - 2}</span>` : "";
    const dots = tasks.slice(0, 4).map((task) => `<i class="${task.done ? "is-done" : ""}"></i>`).join("");
    return `<button class="cal-cell${outside ? " is-out" : ""}${isSameDay(date, today()) ? " is-today" : ""}${selected ? " is-selected" : ""}" type="button" data-day="${key}" aria-pressed="${selected ? "true" : "false"}" ${isSameDay(date, today()) ? 'aria-current="date"' : ""}>
      <span class="cal-num">${date.getDate()}</span>
      ${pips}${more}
      <span class="dots">${dots}</span>
    </button>`;
  }).join("");
  const key = ymd(state.cursor);
  const bundle = dayBundle(key);
  const year = state.cursor.getFullYear();
  return `<div class="view-wrap is-wide">
    ${navHTML("Предыдущий месяц", "Следующий месяц")}
    <div class="view-head">
      <div>
        <h1 class="view-title">${MONTHS_NOM[state.cursor.getMonth()]} ${year}</h1>
        <p class="view-sub">${monthTasks.length ? `${tasksPhrase(monthTasks.length)} в этом месяце` : "В этом месяце пока пусто"}</p>
      </div>
    </div>
    <div class="month-layout">
      <div class="month-board">
        <div class="cal-weekdays">${WEEKDAYS_MON.map((name, index) => `<span class="${index > 4 ? "is-weekend" : ""}">${name}</span>`).join("")}</div>
        <div class="cal-grid">${cells}</div>
      </div>
      <aside class="month-panel">
        <p class="panel-kicker">${esc(relativeLabel(state.cursor))}</p>
        <h2 class="panel-title">${state.cursor.getDate()} ${MONTHS_GEN[state.cursor.getMonth()]}</h2>
        <button class="panel-open" type="button" data-open-day="${key}">Открыть день</button>
        ${composerHTML()}
        ${bundle.all.length ? listHTML(key) : '<p class="panel-empty">На этот день дел нет.</p>'}
      </aside>
    </div>
  </div>`;
}

function awardsHTML() {
  const next = nextAward();
  const width = next ? Math.max(0, Math.min(100, (state.lifetime / next.at) * 100)) : 100;
  const goal = next
    ? `<div class="next-line"><b>Дальше · ${esc(next.name)}</b><span>${formatNum(state.lifetime)} из ${formatNum(next.at)}</span></div>
       <div class="bar"><span style="width:${width}%;background:${next.color}"></span></div>`
    : `<p class="goal-copy">Все рубежи уже открыты.</p>`;
  const cards = AWARDS.map((award) => {
    const on = state.lifetime >= award.at;
    const left = award.at - state.lifetime;
    const note = on ? award.line : `Ещё ${tasksPhrase(left)}`;
    return `<article class="award${on ? " is-on" : " is-locked"}">
      <div class="medal" style="--medal:${award.color}"><span>${formatNum(award.at)}</span></div>
      <h3>${esc(award.name)}</h3>
      <p>${esc(note)}</p>
    </article>`;
  }).join("");
  return `<div class="sheet-head">
      <div>
        <p class="kicker">PLANO</p>
        <h2 id="awards-title">Достижения</h2>
      </div>
      <button class="close-x" type="button" data-close-dialog aria-label="Закрыть">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="lifetime-hero">
      <div class="lifetime-num">${formatNum(state.lifetime)}</div>
      <div class="lifetime-label">завершено за всё время</div>
      ${goal}
    </div>
    <div class="awards-grid">${cards}</div>`;
}

function celebrateHTML(award) {
  return `<div class="medal" style="--medal:${award.color}"><span>${formatNum(award.at)}</span></div>
    <h2 id="celebrate-title">${esc(award.name)}</h2>
    <p class="celebrate-line">${esc(award.line)}</p>
    <button class="primary" type="button" data-close-dialog autofocus>Готово</button>`;
}

function paintChrome() {
  document.querySelectorAll("[data-view-btn]").forEach((button) => {
    const on = button.dataset.viewBtn === state.view;
    button.classList.toggle("is-active", on);
    button.setAttribute("aria-selected", on ? "true" : "false");
  });
  const next = nextAward();
  const count = document.getElementById("awards-count");
  const caption = document.getElementById("awards-caption");
  const mini = document.getElementById("mini-value");
  if (next) {
    count.textContent = `${formatNum(state.lifetime)} из ${formatNum(next.at)}`;
    caption.textContent = next.name;
    mini.style.stroke = next.color;
    mini.style.strokeDasharray = String(CIRC);
    mini.style.strokeDashoffset = String(CIRC * (1 - state.lifetime / next.at));
  } else {
    count.textContent = formatNum(state.lifetime);
    caption.textContent = "Все открыты";
    mini.style.strokeDasharray = String(CIRC);
    mini.style.strokeDashoffset = "0";
  }
  const dateBit = state.view === "month"
    ? `${MONTHS_NOM[state.cursor.getMonth()]} ${state.cursor.getFullYear()}`
    : `${state.cursor.getDate()} ${MONTHS_GEN[state.cursor.getMonth()]}`;
  document.title = `${dateBit} — PLANO`;
}

function mountPopover() {
  const existing = document.getElementById("time-popover");
  if (!state.timePopover) {
    existing?.remove();
    return;
  }
  const anchor = document.querySelector(`[data-time-for="${state.timePopover}"]`);
  if (!anchor) {
    existing?.remove();
    state.timePopover = null;
    return;
  }
  const current = state.timePopover === "composer"
    ? state.draftTime
    : (state.tasks.find((task) => task.id === state.timePopover)?.time || "");
  const presets = PRESETS.map(([time, label]) => `<button class="preset${time === current ? " is-on" : ""}" type="button" data-preset="${time}" data-preset-for="${state.timePopover}"><b>${formatTime(time)}</b><span>${label}</span></button>`).join("");
  const pop = existing || document.createElement("div");
  pop.id = "time-popover";
  pop.className = "popover";
  pop.innerHTML = `<div class="popover-label">Когда сделать</div>
    ${presets}
    <label class="custom-time"><span>Своё</span><input type="time" data-custom-time="${state.timePopover}" value="${current}"></label>
    <button class="preset preset-clear" type="button" data-clear-time="${state.timePopover}" ${current ? "" : "disabled"}>Без времени</button>`;
  if (!existing) document.body.appendChild(pop);
  repositionPopover();
}

function repositionPopover() {
  const pop = document.getElementById("time-popover");
  if (!pop || !state.timePopover) return;
  const anchor = document.querySelector(`[data-time-for="${state.timePopover}"]`);
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const width = 248;
  let left = rect.right - width;
  left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
  let top = rect.bottom + 8;
  const height = pop.offsetHeight || 300;
  if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 8);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}

function syncDialogs() {
  const awards = document.getElementById("awards");
  const celebrate = document.getElementById("celebrate");
  if (state.awardsOpen) {
    awards.innerHTML = awardsHTML();
    if (!awards.open) awards.showModal();
  } else if (awards.open) awards.close();

  if (state.celebrate) {
    celebrate.innerHTML = celebrateHTML(state.celebrate);
    if (!celebrate.open) celebrate.showModal();
  } else if (celebrate.open) celebrate.close();
}

function render() {
  const outlet = document.getElementById("outlet");
  const html = state.view === "week" ? renderWeek() : state.view === "month" ? renderMonth() : renderDay();
  outlet.innerHTML = html;
  if (state.animateView) {
    outlet.querySelector(".view-wrap")?.classList.add("fade-in");
    state.animateView = false;
  }
  const draft = document.getElementById("draft-title");
  if (draft) {
    draft.value = state.draft;
    const add = document.getElementById("add-btn");
    if (add) add.disabled = !state.draft.trim();
    if (state.focusDraft) {
      draft.focus();
      state.focusDraft = false;
    }
  }
  const edit = document.querySelector("[data-edit-title]");
  if (edit && state.focusEdit) {
    edit.focus();
    const end = edit.value.length;
    edit.setSelectionRange(end, end);
    state.focusEdit = false;
  }
  if (state.focusQuick) {
    const input = document.querySelector(`[data-quick="${state.focusQuick}"] input`);
    input?.focus();
    state.focusQuick = null;
  }
  if (state.view === "week" && state.alignWeek) {
    const column = document.querySelector(".week-col.is-today");
    const scroller = document.querySelector(".week-scroll");
    if (column && scroller && scroller.scrollWidth > scroller.clientWidth + 8) {
      scroller.scrollLeft = Math.max(0, column.offsetLeft - 12);
    }
    state.alignWeek = false;
  }
  state.justAddedId = null;
  state.justDoneId = null;
  paintChrome();
  mountPopover();
  syncDialogs();
}

function onClick(event) {
  const target = event.target;
  if (target.closest("[data-undo]")) {
    const undo = state.toast?.onUndo;
    state.toast = null;
    window.clearTimeout(toastTimer);
    paintToast();
    undo?.();
    return;
  }
  const viewBtn = target.closest("[data-view-btn]");
  if (viewBtn) {
    setView(viewBtn.dataset.viewBtn);
    return;
  }
  if (target.closest("[data-open-awards]")) {
    commitEdit();
    state.editingId = null;
    state.editDraft = null;
    state.awardsOpen = true;
    state.timePopover = null;
    render();
    return;
  }
  if (target.closest("#theme-toggle")) {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
    save();
    return;
  }
  if (target.closest("[data-close-dialog]")) {
    const dialog = target.closest("dialog");
    if (dialog?.id === "awards") state.awardsOpen = false;
    if (dialog?.id === "celebrate") state.celebrate = null;
    dialog?.close();
    return;
  }
  const shiftBtn = target.closest("[data-shift]");
  if (shiftBtn) {
    shift(Number(shiftBtn.dataset.shift));
    return;
  }
  if (target.closest("[data-today]")) {
    goToday();
    return;
  }
  if (target.closest("[data-toggle-done]")) {
    state.hideDone = !state.hideDone;
    save();
    render();
    return;
  }
  const preset = target.closest("[data-preset]");
  if (preset) {
    setTime(preset.dataset.presetFor, preset.dataset.preset);
    return;
  }
  const clearTime = target.closest("[data-clear-time]");
  if (clearTime) {
    setTime(clearTime.dataset.clearTime, "");
    return;
  }
  const check = target.closest("[data-check]");
  if (check) {
    toggleDone(check.dataset.check);
    return;
  }
  const timeBtn = target.closest("[data-time-for]");
  if (timeBtn) {
    const id = timeBtn.dataset.timeFor;
    state.timePopover = state.timePopover === id ? null : id;
    render();
    return;
  }
  const remove = target.closest("[data-delete]");
  if (remove) {
    removeTask(remove.dataset.delete);
    return;
  }
  const open = target.closest("[data-open-task]");
  if (open) {
    openTask(open.dataset.openTask);
    return;
  }
  const openDay = target.closest("[data-open-day]");
  if (openDay) {
    setCursor(parseYmd(openDay.dataset.openDay));
    setView("day");
    return;
  }
  const dayCell = target.closest("[data-day]");
  if (dayCell) {
    setCursor(parseYmd(dayCell.dataset.day));
    render();
    return;
  }
  const taskEl = target.closest("[data-task]");
  if (taskEl && !target.closest("input, button, textarea, label")) {
    const id = taskEl.dataset.task;
    if (state.editingId !== id) {
      commitEdit();
      const task = state.tasks.find((item) => item.id === id);
      state.editingId = id;
      state.editDraft = task ? task.title : "";
      state.focusEdit = true;
      state.timePopover = null;
      render();
    }
    return;
  }
  if (state.timePopover && !target.closest("#time-popover") && !target.closest("[data-time-for]")) {
    const returnFocus = state.timePopover === "composer";
    state.timePopover = null;
    if (returnFocus) state.focusDraft = true;
    render();
    return;
  }
  if (state.editingId && !taskEl && !target.closest("#time-popover")) {
    commitEdit();
    state.editingId = null;
    state.editDraft = null;
    render();
  }
}

function onInput(event) {
  if (event.target.id === "draft-title") {
    state.draft = event.target.value;
    const add = document.getElementById("add-btn");
    if (add) add.disabled = !state.draft.trim();
  }
  if (event.target.matches("[data-edit-title]")) state.editDraft = event.target.value;
}

function onChange(event) {
  if (event.target.matches("[data-edit-date]")) {
    const task = state.tasks.find((item) => item.id === event.target.dataset.editDate);
    if (task && /^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) {
      task.date = event.target.value;
      state.cursor = parseYmd(task.date);
      save();
      render();
    }
  }
  if (event.target.matches("[data-custom-time]")) {
    setTime(event.target.dataset.customTime, event.target.value);
  }
}

function onSubmit(event) {
  const form = event.target;
  if (form.id === "composer") {
    event.preventDefault();
    const input = form.querySelector("input[type='text']");
    addTask({ title: input.value, date: ymd(state.cursor), time: state.draftTime });
    return;
  }
  if (form.dataset.quick) {
    event.preventDefault();
    const input = form.querySelector("input");
    addTask({ title: input.value, date: form.dataset.quick, time: "" });
  }
}

function onKeydown(event) {
  const dialogOpen = Boolean(document.querySelector("dialog[open]"));
  if (event.key === "Escape") {
    if (state.timePopover) {
      state.timePopover = null;
      render();
      return;
    }
    if (state.editingId) {
      state.editDraft = null;
      state.editingId = null;
      render();
    }
    return;
  }
  if (event.key === "Enter" && event.target.matches("[data-edit-title]")) {
    event.preventDefault();
    commitEdit();
    state.editingId = null;
    state.editDraft = null;
    render();
    return;
  }
  if (dialogOpen || event.target.matches("input, textarea")) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    shift(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    shift(1);
  } else if (event.key === "t" || event.key === "T" || event.key === "т" || event.key === "Т") {
    goToday();
  }
}

function bind() {
  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("change", onChange);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("focusout", (event) => {
    if (event.target.matches?.("[data-edit-title]")) commitEdit();
  });
  window.addEventListener("resize", repositionPopover);
  document.addEventListener("scroll", repositionPopover, true);
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      if (dialog.id === "awards") state.awardsOpen = false;
      if (dialog.id === "celebrate") state.celebrate = null;
    });
  });
}

function init() {
  load();
  applyTheme();
  if (state.view === "day") state.focusDraft = true;
  if (state.view === "week") state.alignWeek = true;
  bind();
  render();
}

init();
