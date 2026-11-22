// Kept in step with the website: src/lib/achievements.ts in the main project.
/** Numbers the achievements are measured against; see achievement-stats.ts. */
export type StatKey =
  | "tasksDone"
  | "importantDone"
  | "urgentDone"
  | "delayed3Done"
  | "maxDelayDays"
  | "bestDay"
  | "cleanDays"
  | "bestStreak"
  | "sharedDone"
  | "friends"
  | "keptThenDone"
  | "comebackDay"
  | "goalsCreated"
  | "maxGoalSteps"
  | "stepsDone"
  | "entries"
  | "goalsDone"
  | "goalsOnTime"
  | "longestGoalDays"
  | "perfectGoals"
  | "companiesOwned"
  | "teamDone"
  | "teamOnTime"
  | "bestUseStreak"
  | "useStreak"
  | "activeDays"
  | "daysWithUs"
  | "minutesInApp";

export type Stats = Record<StatKey, number>;

export type AchievementCategory = "tasks" | "delay" | "rhythm" | "goals" | "people" | "loyalty";

export type AchievementDef = {
  code: string;
  category: AchievementCategory;
  icon: string;
  title: string;
  description: string;
  stat: StatKey;
  target: number;
  /** Hidden until unlocked: shows only a hint. */
  secret?: boolean;
};

export const CATEGORIES: { id: AchievementCategory; title: string; lead: string }[] = [
  { id: "tasks", title: "Дела", lead: "Каждое закрытое дело — в копилку" },
  { id: "delay", title: "Победа над «потом»", lead: "За дела, которые долго ждали своего часа" },
  { id: "rhythm", title: "Ритм", lead: "Серии, рекорды и идеальные дни" },
  { id: "goals", title: "Цели", lead: "Большие мечты, шаги и записи" },
  { id: "people", title: "Вместе", lead: "Друзья, общие дела и команда" },
  { id: "loyalty", title: "С нами", lead: "За то, что возвращаешься каждый день" },
];

const A = (
  code: string,
  category: AchievementCategory,
  icon: string,
  title: string,
  description: string,
  stat: StatKey,
  target: number,
  secret = false,
): AchievementDef => ({ code, category, icon, title, description, stat, target, secret });

export const ACHIEVEMENTS: AchievementDef[] = [
  // ---------- tasks (codes tasks_N predate this list and stay as they are) ----------
  A("tasks_1", "tasks", "🥞", "Первый блин", "Выполни первое дело. Он точно не комом!", "tasksDone", 1),
  A("tasks_10", "tasks", "🔥", "Разогрев", "Выполни 10 дел", "tasksDone", 10),
  A("tasks_50", "tasks", "⚙️", "Машина продуктивности", "Выполни 50 дел", "tasksDone", 50),
  A("tasks_100", "tasks", "💯", "Сотня!", "Выполни 100 дел", "tasksDone", 100),
  A("tasks_250", "tasks", "📋", "Человек-чеклист", "Выполни 250 дел", "tasksDone", 250),
  A("tasks_500", "tasks", "👑", "Повелитель списков", "Выполни 500 дел", "tasksDone", 500),
  A("tasks_1000", "tasks", "🏆", "Легенда Uspeyka", "Выполни 1000 дел", "tasksDone", 1000),
  A("important_1", "tasks", "⭐", "Не мелочусь", "Выполни первое важное дело", "importantDone", 1),
  A("important_10", "tasks", "🎯", "Главное — главное", "Выполни 10 важных дел", "importantDone", 10),
  A("important_50", "tasks", "🏋️", "Тяжеловес", "Выполни 50 важных дел", "importantDone", 50),
  A("urgent_1", "tasks", "🚒", "Пожарный", "Потуши первое срочное дело", "urgentDone", 1),
  A("urgent_25", "tasks", "🚑", "Скорая помощь", "Выполни 25 срочных дел", "urgentDone", 25),

  // ---------- delayed tasks ----------
  A("delay_3", "delay", "😮‍💨", "Ну наконец-то", "Закрой дело, которое висело 3 дня и больше", "maxDelayDays", 3),
  A("delay_7", "delay", "🐢", "Лучше поздно, чем никогда", "Закрой дело, которое ждало целую неделю", "maxDelayDays", 7),
  A("delay_14", "delay", "🦴", "Археолог", "Откопай и закрой дело, пролежавшее 2 недели", "maxDelayDays", 14),
  A("delay_30", "delay", "🦖", "Динозавр повержен", "Закрой дело, которое тянулось целый месяц", "maxDelayDays", 30),
  A("delay_total_10", "delay", "🧹", "Разгребатель завалов", "Закрой 10 дел, которые висели 3+ дня", "delayed3Done", 10),
  A("delay_total_30", "delay", "🥊", "Нокаут прокрастинации", "Закрой 30 давно отложенных дел", "delayed3Done", 30),
  A("kept_done", "delay", "🐦‍🔥", "Второй шанс", "Оставь дело после вопроса «оставить или удалить?» — и всё-таки сделай его", "keptThenDone", 1, true),
  A("comeback", "delay", "💥", "Камбэк года", "Закрой за один день три дела, которые ждали неделю и больше", "comebackDay", 3, true),

  // ---------- rhythm ----------
  A("day_5", "rhythm", "🖐️", "Пятёрочка", "Выполни 5 дел за один день", "bestDay", 5),
  A("day_10", "rhythm", "⚡", "Десятиборец", "Выполни 10 дел за один день", "bestDay", 10),
  A("day_20", "rhythm", "🌪️", "Ураган", "Выполни 20 дел за один день", "bestDay", 20, true),
  A("clean_1", "rhythm", "✨", "Чистый лист", "Закрой все дела дня — когда их хотя бы три", "cleanDays", 1),
  A("clean_10", "rhythm", "🧘", "Порядок — моё второе имя", "10 дней, в которые сделано всё запланированное", "cleanDays", 10),
  A("streak_3", "rhythm", "🚀", "Разгон", "Выполняй хотя бы одно дело 3 дня подряд", "bestStreak", 3),
  A("streak_7", "rhythm", "🔥", "Неделя огня", "7 дней подряд хотя бы с одним сделанным делом", "bestStreak", 7),
  A("streak_30", "rhythm", "🛡️", "Железная привычка", "30 дней подряд без пропуска", "bestStreak", 30),
  A("streak_100", "rhythm", "🌋", "Неостановимый", "100 дней подряд без пропуска", "bestStreak", 100, true),

  // ---------- goals ----------
  A("goal_first", "goals", "💭", "Мечтать не вредно", "Запиши свою первую цель", "goalsCreated", 1),
  A("goal_plan", "goals", "🗺️", "Стратег", "Разбей цель на 5 шагов и больше", "maxGoalSteps", 5),
  A("steps_10", "goals", "👣", "Шаг за шагом", "Выполни 10 шагов к целям", "stepsDone", 10),
  A("steps_50", "goals", "🪜", "Лестница в небо", "Выполни 50 шагов к целям", "stepsDone", 50),
  A("entries_10", "goals", "📝", "Летописец", "Сделай 10 записей «Что сделано»", "entries", 10),
  A("entries_50", "goals", "📚", "Хроники успеха", "Сделай 50 записей «Что сделано»", "entries", 50),
  A("goal_done_1", "goals", "🌈", "Мечта сбылась", "Достигни первой цели", "goalsDone", 1),
  A("goal_done_5", "goals", "🏹", "Охотник за целями", "Достигни 5 целей", "goalsDone", 5),
  A("goal_done_10", "goals", "🧙", "Мастер целей", "Достигни 10 целей", "goalsDone", 10),
  A("goal_on_time", "goals", "⏰", "Точно в срок", "Достигни цели раньше дедлайна", "goalsOnTime", 1),
  A("goal_marathon", "goals", "🏃", "Марафонец", "Достигни цели, на путь к которой ушло 30 дней и больше", "longestGoalDays", 30),
  A("goal_perfect", "goals", "💎", "Перфекционист", "Достигни цели, где все шаги (5+) выполнены", "perfectGoals", 1),

  // ---------- people ----------
  A("friends_1", "people", "🤝", "Не один в поле воин", "Добавь первого друга", "friends", 1),
  A("friends_5", "people", "🎉", "Душа компании", "Добавь 5 друзей", "friends", 5),
  A("shared_1", "people", "👯", "Командная игра", "Выполни первое совместное дело", "sharedDone", 1),
  A("shared_10", "people", "🫶", "Вместе веселее", "Выполни 10 совместных дел", "sharedDone", 10),
  A("team_boss", "people", "🧑‍💼", "Большой босс", "Создай свою компанию", "companiesOwned", 1),
  A("team_done_1", "people", "🧩", "Свой в команде", "Выполни задачу, назначенную тебе в команде", "teamDone", 1),
  A("team_done_25", "people", "🏛️", "Опора команды", "Выполни 25 командных задач", "teamDone", 25),
  A("team_on_time_10", "people", "🥷", "Дедлайн-ниндзя", "Сдай 10 командных задач до дедлайна", "teamOnTime", 10),

  // ---------- loyalty ----------
  A("use_3", "loyalty", "🌱", "Привет снова", "Заходи в Uspeyka 3 дня подряд", "bestUseStreak", 3),
  A("use_7", "loyalty", "📅", "Неделя без пропусков", "Заходи 7 дней подряд", "bestUseStreak", 7),
  A("use_30", "loyalty", "🗓️", "Привычка планировать", "Заходи 30 дней подряд", "bestUseStreak", 30),
  A("use_100", "loyalty", "🏅", "Сотня подряд", "Заходи 100 дней подряд", "bestUseStreak", 100),
  A("use_365", "loyalty", "👑", "Год без выходных", "Заходи каждый день целый год", "bestUseStreak", 365, true),
  A("active_10", "loyalty", "☕", "Завсегдатай", "Проведи в Uspeyka 10 разных дней", "activeDays", 10),
  A("active_50", "loyalty", "🏠", "Как дома", "Проведи в Uspeyka 50 разных дней", "activeDays", 50),
  A("active_100", "loyalty", "💯", "Сто дней в деле", "Проведи в Uspeyka 100 разных дней", "activeDays", 100),
  A("active_365", "loyalty", "🌟", "Триста шестьдесят пять", "Проведи в Uspeyka 365 разных дней", "activeDays", 365),
  A("age_30", "loyalty", "🎂", "Первый месяц", "Будь с Uspeyka уже месяц", "daysWithUs", 30),
  A("age_180", "loyalty", "🌗", "Полгода вместе", "Будь с Uspeyka полгода", "daysWithUs", 180),
  A("age_365", "loyalty", "🎉", "Годовщина", "Будь с Uspeyka целый год", "daysWithUs", 365),
  A("age_730", "loyalty", "🐘", "Старожил", "Будь с Uspeyka два года", "daysWithUs", 730, true),
];

/** How to name a person's own number for each stat, shown once an achievement is earned. */
export const STAT_LABELS: Record<StatKey, string> = {
  tasksDone: "дел сделано",
  importantDone: "важных дел сделано",
  urgentDone: "срочных дел сделано",
  delayed3Done: "давних дел закрыто",
  maxDelayDays: "дней — самое долгое ожидание",
  bestDay: "дел — рекорд за день",
  cleanDays: "идеальных дней",
  bestStreak: "дней — лучшая серия",
  sharedDone: "совместных дел",
  friends: "друзей",
  keptThenDone: "дел со второго шанса",
  comebackDay: "давних дел — рекорд за день",
  goalsCreated: "целей записано",
  maxGoalSteps: "шагов в самой большой цели",
  stepsDone: "шагов выполнено",
  entries: "записей о прогрессе",
  goalsDone: "целей достигнуто",
  goalsOnTime: "целей в срок",
  longestGoalDays: "дней — самый долгий путь к цели",
  perfectGoals: "идеальных целей",
  companiesOwned: "своих компаний",
  teamDone: "командных задач",
  teamOnTime: "задач до дедлайна",
  bestUseStreak: "дней подряд — рекорд заходов",
  useStreak: "дней подряд сейчас",
  activeDays: "дней в Uspeyka",
  daysWithUs: "дней с Uspeyka",
  minutesInApp: "минут в приложении",
};

export function achievementByCode(code: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.code === code);
}

/** Toast text for freshly unlocked achievements, or null when there are none. */
export function describeUnlocked(codes: string[]): { icon: string; title: string } | null {
  const defs = codes.map(achievementByCode).filter((a): a is AchievementDef => Boolean(a));
  if (defs.length === 0) return null;
  const more = defs.length - 1;
  return {
    icon: defs[0].icon,
    title: more > 0 ? `${defs[0].title} и ещё ${more}` : defs[0].title,
  };
}
