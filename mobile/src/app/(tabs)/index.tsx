import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useStore } from "@/db/store-types";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { Task, TaskInput, TaskItem, ToggleResult } from "@/account/api";
import { useRpc } from "@/account/use-rpc";
import { enqueue, flush, isOffline, localTask, pendingCount, readDay, writeDay } from "@/account/offline-planner";
import { formatDayTitle, formatMonthTitle, fromDateKey, getMonthGrid, getWeekDays, plannerDayHeading, relativeDayName, shiftDateKey, todayKey } from "@/shared/dates";
import { describeUnlocked } from "@/shared/achievements";
import { TaskRow } from "@/components/planner/TaskRow";
import { TaskEditor } from "@/components/planner/TaskEditor";
import { MonthView, WeekView } from "@/components/planner/Overview";
import { Icon, Segmented } from "@/components/ui";
import { UndoToast } from "@/components/UndoToast";
import { radius, usePalette } from "@/theme/theme";

type Notice = { key: number; text: string; undo?: () => void };
type Mode = "day" | "week" | "month";

/**
 * The day planner: the account's tasks, as on the website. Without internet it works
 * from the copy on the phone, and changes are sent when the connection is back.
 */
export default function PlannerScreen() {
  const c = usePalette();
  const call = useRpc();
  const db = useStore();
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState(0);
  // Which day the shown tasks belong to, so a copy is never saved under another day.
  const loadedFor = useRef<string | null>(null);
  const [date, setDate] = useState(todayKey);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("day");
  const [range, setRange] = useState<Task[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Task[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const say = useCallback((text: string, undo?: () => void) => setNotice({ key: Date.now(), text, undo }), []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // The saved copy first, so the day shows at once — also without internet.
      const saved = await readDay(db, date);
      if (alive && loadedFor.current !== date) {
        loadedFor.current = saved ? date : null;
        setTasks(saved);
      }
      try {
        await flush(db, call);
        const rows = await call<Task[]>("tasks.query", date, date);
        if (!alive) return;
        loadedFor.current = date;
        setTasks(rows);
        setOffline(false);
        setError(null);
        await writeDay(db, date, rows);
      } catch (e) {
        if (!alive) return;
        if (isOffline(e)) {
          setOffline(true);
          if (!saved) {
            loadedFor.current = date;
            setTasks([]);
          }
        } else setError(e instanceof Error ? e.message : "Не получилось загрузить");
      } finally {
        if (alive) {
          setRefreshing(false);
          setWaiting(await pendingCount(db));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [call, db, date, version]);

  // Week and month: all tasks of the shown days, as on the website.
  useEffect(() => {
    if (mode === "day") return;
    let alive = true;
    const days = mode === "week" ? getWeekDays(date) : getMonthGrid(date);
    call<Task[]>("tasks.query", days[0], days[days.length - 1])
      .then((rows) => alive && setRange(rows))
      .catch(() => alive && setRange([]));
    return () => {
      alive = false;
    };
  }, [call, mode, date, version]);

  // Search across all days, from two letters.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      call<Task[]>("tasks.search", q)
        .then((rows) => alive && setHits(rows))
        .catch(() => alive && setHits([]));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [call, query]);

  // While offline, try again every 20 seconds.
  useEffect(() => {
    if (!offline) return;
    const t = setInterval(reload, 20_000);
    return () => clearInterval(t);
  }, [offline, reload]);

  // Keep the phone's copy of the open day up to date after every change.
  useEffect(() => {
    if (tasks && loadedFor.current === date) void writeDay(db, date, tasks);
  }, [db, date, tasks]);

  // On each visit, as on the website: unfinished tasks from past days move to today.
  useFocusEffect(
    useCallback(() => {
      call<{ movedCount: number }>("tasks.settle", todayKey())
        .then((r) => {
          if (r.movedCount > 0) {
            say(r.movedCount === 1 ? "Невыполненное дело перенесено на сегодня" : `${r.movedCount} ${plural(r.movedCount)} с прошлых дней перенесены на сегодня`);
            reload();
          }
        })
        .catch(() => {});
    }, [call, reload, say]),
  );

  const open = useMemo(() => (tasks ?? []).filter((t) => !t.done), [tasks]);
  const done = useMemo(() => (tasks ?? []).filter((t) => t.done), [tasks]);

  async function add(input: TaskInput) {
    try {
      const task = await call<Task>("tasks.create", input);
      setTasks((prev) => [...(prev ?? []), task]);
    } catch (e) {
      if (!isOffline(e)) throw e;
      const task = localTask(input);
      setTasks((prev) => [...(prev ?? []), task]);
      await enqueue(db, { kind: "create", tempId: task.id, input });
      wentOffline();
    }
  }

  function wentOffline() {
    setOffline(true);
    void pendingCount(db).then(setWaiting);
  }

  async function toggle(task: Task) {
    // As on the website: a task with a list closes once every item is checked.
    if (!task.done && task.items.some((i) => !i.done)) {
      say(`Отметьте все пункты списка: ${task.items.filter((i) => i.done).length} из ${task.items.length}`);
      return;
    }
    setTasks((prev) => prev?.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)) ?? prev);
    if (task.id.startsWith("local-")) {
      await enqueue(db, { kind: "toggle", id: task.id, done: !task.done });
      return;
    }
    try {
      const r = await call<ToggleResult>("tasks.toggle", task.id);
      setTasks((prev) => prev?.map((t) => (t.id === task.id ? r.task : t)) ?? prev);
      const award = describeUnlocked(r.newlyUnlocked);
      if (award) say(`Новое достижение: ${award.title}`);
    } catch (e) {
      if (isOffline(e)) {
        await enqueue(db, { kind: "toggle", id: task.id, done: !task.done });
        wentOffline();
        return;
      }
      setTasks((prev) => prev?.map((t) => (t.id === task.id ? task : t)) ?? prev);
      say(e instanceof Error ? e.message : "Не получилось");
    }
  }

  // Deleting waits a few seconds, so "Отменить" brings the task back untouched — as on the website.
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = pending.current;
    return () => {
      for (const [id, t] of timers) {
        clearTimeout(t);
        void call("tasks.delete", id).catch((e) => {
          if (isOffline(e)) void enqueue(db, { kind: "delete", id });
        });
      }
    };
  }, [call, db]);

  function remove(task: Task) {
    setTasks((prev) => prev?.filter((t) => t.id !== task.id) ?? prev);
    pending.current.set(
      task.id,
      setTimeout(() => {
        pending.current.delete(task.id);
        if (task.id.startsWith("local-")) {
          void enqueue(db, { kind: "delete", id: task.id }).then(() => pendingCount(db).then(setWaiting));
          return;
        }
        call("tasks.delete", task.id).catch((e: Error) => {
          if (isOffline(e)) {
            void enqueue(db, { kind: "delete", id: task.id });
            wentOffline();
            return;
          }
          setTasks((prev) => [...(prev ?? []), task]);
          say(e.message);
        });
      }, 5000),
    );
    const shared = task.shared ? ". У друзей дело останется" : "";
    say(`Удалено: «${short(task.title)}»${shared}`, () => {
      const t = pending.current.get(task.id);
      if (t) clearTimeout(t);
      pending.current.delete(task.id);
      setTasks((prev) => [...(prev ?? []), task]);
    });
  }

  const replace = (task: Task) => setTasks((prev) => prev?.map((t) => (t.id === task.id ? task : t)) ?? prev);

  async function online<T>(run: () => Promise<T>): Promise<T | undefined> {
    try {
      return await run();
    } catch (e) {
      say(isOffline(e) ? "Нужен интернет — это действие отправится на сайт" : e instanceof Error ? e.message : "Не получилось");
    }
  }

  async function tomorrow(task: Task) {
    const next = shiftDateKey(task.date, 1);
    setTasks((prev) => prev?.filter((t) => t.id !== task.id) ?? prev);
    const moved = await online(() => call<Task>("tasks.move", task.id, next));
    if (!moved) {
      setTasks((prev) => [...(prev ?? []), task]);
      return;
    }
    say(`«${short(task.title)}» — на завтра`, () => {
      void online(() => call<Task>("tasks.move", task.id, task.date, task.originDate)).then((back) => {
        if (back) setTasks((prev) => [...(prev ?? []), back]);
      });
    });
  }

  async function itemToggle(task: Task, item: TaskItem) {
    replace({ ...task, items: task.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) });
    const r = await online(() => call<ToggleResult>("tasks.itemToggle", task.id, item.id));
    if (!r) return replace(task);
    replace(r.task);
    if (r.task.done && !task.done) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      say("Весь список отмечен — дело выполнено");
    }
    const award = describeUnlocked(r.newlyUnlocked);
    if (award) say(`Новое достижение: ${award.title}`);
  }

  async function itemAdd(task: Task, text: string) {
    const r = await online(() => call<ToggleResult>("tasks.itemAdd", task.id, text));
    if (r) replace(r.task);
  }

  async function itemRemove(task: Task, item: TaskItem) {
    replace({ ...task, items: task.items.filter((i) => i.id !== item.id) });
    const r = await online(() => call<ToggleResult>("tasks.itemRemove", task.id, item.id));
    replace(r ? r.task : task);
  }

  async function save(task: Task, input: TaskInput) {
    const updated = await call<Task>("tasks.update", task.id, input);
    setEditing(null);
    if (updated.date !== date) {
      setTasks((prev) => prev?.filter((t) => t.id !== task.id) ?? prev);
      say(`Перенесено на ${format(fromDateKey(updated.date), "d MMMM", { locale: ru })}`);
    } else replace(updated);
  }

  function openDay(day: string) {
    setDate(day);
    setMode("day");
    setSearching(false);
    setQuery("");
    setHits(null);
  }

  const closeNotice = useCallback(() => setNotice(null), []);
  const named = relativeDayName(date);
  const isToday = date === todayKey();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                reload();
              }}
            />
          }
        >
          <View style={[styles.nav, { backgroundColor: c.surface, borderColor: c.border }]}>
            <NavButton icon="chevron-back" a11y="Назад" onPress={() => setDate((d) => step(d, mode, -1))} />
            <Pressable onPress={() => setDate(todayKey())} style={styles.todayBtn}>
              <Text style={[styles.todayText, { color: c.accent }]}>{isToday ? "Сегодня" : "К сегодня"}</Text>
            </Pressable>
            <NavButton icon="chevron-forward" a11y="Вперёд" onPress={() => setDate((d) => step(d, mode, 1))} />
            <View style={[styles.navSep, { backgroundColor: c.border }]} />
            <NavButton icon={searching ? "close" : "search"} a11y="Поиск" onPress={() => { setSearching((v) => !v); setQuery(""); setHits(null); }} />
          </View>

          {searching ? (
            <View style={{ gap: 10 }}>
              <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Icon name="search" color={c.inkTertiary} size={18} />
                <TextInput
                  value={query}
                  onChangeText={(t) => { setQuery(t); if (t.trim().length < 2) setHits(null); }}
                  placeholder="Найти дело по названию, заметке или списку"
                  placeholderTextColor={c.inkTertiary}
                  autoFocus
                  style={[styles.searchInput, { color: c.ink }]}
                />
              </View>
              {hits && hits.length === 0 ? <Text style={{ color: c.inkSecondary, textAlign: "center" }}>Ничего не нашлось</Text> : null}
              {hits?.map((t) => (
                <Pressable key={t.id} onPress={() => openDay(t.date)} style={[styles.hit, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Icon name={t.done ? "checkmark-circle" : "ellipse-outline"} color={t.done ? c.success : c.inkTertiary} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontSize: 15, fontWeight: "600" }} numberOfLines={2}>{t.title}</Text>
                    <Text style={{ color: c.inkSecondary, fontSize: 13 }}>{format(fromDateKey(t.date), "d MMMM yyyy, EEEEEE", { locale: ru })}</Text>
                  </View>
                  <Icon name="chevron-forward" color={c.inkTertiary} size={18} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <Segmented
            items={[
              { id: "day", label: "День" },
              { id: "week", label: "Неделя" },
              { id: "month", label: "Месяц" },
            ]}
            value={mode}
            onChange={(m) => { setRange(null); setMode(m); }}
          />

          {mode !== "day" ? (
            <>
              <Text style={[styles.title, { color: c.ink, textTransform: "capitalize" }]}>
                {mode === "month" ? formatMonthTitle(date) : weekTitle(date)}
              </Text>
              {range === null ? <ActivityIndicator color={c.accent} /> : null}
              {range && mode === "week" ? <WeekView date={date} tasks={range} onSelectDay={openDay} /> : null}
              {range && mode === "month" ? <MonthView date={date} tasks={range} onSelectDay={openDay} /> : null}
              <Text style={{ color: c.inkTertiary, textAlign: "center", fontSize: 13 }}>Нажмите на день, чтобы открыть его</Text>
            </>
          ) : null}

          {mode === "day" ? (
          <>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.ink }]}>{plannerDayHeading(date)}</Text>
            <Text style={[styles.dateLine, { color: c.inkSecondary }]}>
              {named ? formatDayTitle(date) : format(fromDateKey(date), "EEEE", { locale: ru })}
            </Text>
            {tasks ? (
              <Text style={[styles.summary, { color: c.inkSecondary }]}>{summary(date, open.length, done.length)}</Text>
            ) : null}
          </View>

          {offline ? (
            <View style={[styles.offline, { backgroundColor: c.tintWarn }]}>
              <Text style={{ color: c.warnInk, fontWeight: "700" }}>Нет интернета</Text>
              <Text style={{ color: c.warnInk }}>
                Дела можно добавлять и отмечать — они сохранятся на телефоне и отправятся, когда появится связь.
                {waiting > 0 ? ` Ждут отправки: ${waiting}.` : ""}
              </Text>
            </View>
          ) : null}

          {error ? (
            <Pressable onPress={reload} style={[styles.error, { backgroundColor: c.tintDanger }]}>
              <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text>
              <Text style={{ color: c.accent, fontWeight: "700" }}>Повторить</Text>
            </Pressable>
          ) : null}

          {tasks === null && !error ? <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} /> : null}

          <View style={styles.list}>
            {[...open, ...done].map((task) =>
              editing === task.id ? (
                <TaskEditor
                  key={task.id}
                  withDate
                  initial={{
                    title: task.title,
                    date: task.date,
                    time: task.time,
                    important: task.important,
                    urgent: task.urgent,
                    friendIds: task.partners.map((p) => p.id),
                    note: task.note,
                    items: task.items.map((i) => ({ text: i.text, done: i.done })),
                  }}
                  submitLabel="Сохранить"
                  onSubmit={(input) => save(task, input)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={(t) => void toggle(t)}
                  onDelete={remove}
                  onTomorrow={(t) => void tomorrow(t)}
                  onEdit={(t) => setEditing(t.id)}
                  onItemToggle={(t, i) => void itemToggle(t, i)}
                  onItemAdd={(t, text) => void itemAdd(t, text)}
                  onItemRemove={(t, i) => void itemRemove(t, i)}
                />
              ),
            )}
          </View>
          {tasks && tasks.length > 0 ? (
            <Text style={{ color: c.inkTertiary, fontSize: 12, textAlign: "center" }}>
              Свайп вправо — на завтра, влево — выполнено. Нажмите на дело, чтобы открыть список и заметку.
            </Text>
          ) : null}

          {adding ? (
            <TaskEditor
              initial={{ date }}
              submitLabel="Добавить"
              onSubmit={async (input) => {
                await add(input);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <Pressable onPress={() => setAdding(true)} style={[styles.addBtn, { backgroundColor: c.accentSoft, borderColor: c.accent }]}>
              <View style={[styles.plus, { backgroundColor: c.accent }]}>
                <Text style={styles.plusText}>+</Text>
              </View>
              <Text style={[styles.addText, { color: c.accent }]}>Новое дело</Text>
            </Pressable>
          )}
          </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {notice ? <UndoToast key={notice.key} text={notice.text} onUndo={notice.undo} onClose={closeNotice} /> : null}
    </SafeAreaView>
  );
}

function NavButton({ icon, a11y, onPress }: { icon: React.ComponentProps<typeof Icon>["name"]; a11y: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} accessibilityLabel={a11y} hitSlop={6} style={styles.navBtn}>
      <Icon name={icon} color={c.ink} size={21} />
    </Pressable>
  );
}

function step(d: string, mode: Mode, dir: 1 | -1): string {
  if (mode === "day") return shiftDateKey(d, dir);
  if (mode === "week") return shiftDateKey(d, 7 * dir);
  const x = fromDateKey(d);
  return format(new Date(x.getFullYear(), x.getMonth() + dir, 1), "yyyy-MM-dd");
}

function weekTitle(d: string): string {
  const days = getWeekDays(d);
  return `${format(fromDateKey(days[0]), "d MMM", { locale: ru })} — ${format(fromDateKey(days[6]), "d MMM", { locale: ru })}`;
}

function summary(date: string, open: number, done: number): string {
  const today = todayKey();
  if (open === 0 && done === 0) {
    return date < today ? "В этот день ничего не было запланировано" : "Пока пусто — запиши дела, чтобы ничего не забыть";
  }
  if (open === 0) return date === today ? "На сегодня всё выполнено" : "На этот день всё выполнено";
  const left = `${open} ${plural(open)} в плане`;
  return done > 0 ? `${left} · ${done} уже сделано` : left;
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "дело";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дела";
  return "дел";
}

function short(title: string): string {
  return title.length > 32 ? `${title.slice(0, 30)}…` : title;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 120, gap: 16 },
  nav: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, padding: 4, borderRadius: radius.pill, borderWidth: 1 },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navSep: { width: 1, height: 22, marginHorizontal: 2 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 12 },
  hit: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radius.md, padding: 12 },
  todayBtn: { paddingHorizontal: 18, paddingVertical: 8 },
  todayText: { fontSize: 15, fontWeight: "700" },
  header: { gap: 4 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  dateLine: { fontSize: 15, textTransform: "capitalize" },
  summary: { fontSize: 15 },
  error: { padding: 14, borderRadius: radius.md, gap: 6 },
  offline: { padding: 14, borderRadius: radius.md, gap: 4 },
  list: { gap: 10 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed" },
  plus: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  plusText: { color: "#fff", fontSize: 20, lineHeight: 22, fontWeight: "600" },
  addText: { fontSize: 16, fontWeight: "700" },
});
