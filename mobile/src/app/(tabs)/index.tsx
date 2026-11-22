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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { Task, TaskInput, ToggleResult } from "@/account/api";
import { useRpc } from "@/account/use-rpc";
import { enqueue, flush, isOffline, localTask, pendingCount, readDay, writeDay } from "@/account/offline-planner";
import { formatDayTitle, fromDateKey, plannerDayHeading, relativeDayName, shiftDateKey, todayKey } from "@/shared/dates";
import { describeUnlocked } from "@/shared/achievements";
import { TaskRow } from "@/components/planner/TaskRow";
import { Composer } from "@/components/planner/Composer";
import { UndoToast } from "@/components/UndoToast";
import { radius, usePalette } from "@/theme/theme";

type Notice = { key: number; text: string; undo?: () => void };

/**
 * The day planner: the account's tasks, as on the website. Without internet it works
 * from the copy on the phone, and changes are sent when the connection is back.
 */
export default function PlannerScreen() {
  const c = usePalette();
  const call = useRpc();
  const db = useSQLiteContext();
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState(0);
  // Which day the shown tasks belong to, so a copy is never saved under another day.
  const loadedFor = useRef<string | null>(null);
  const [date, setDate] = useState(todayKey);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
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
      if (award) say(`${award.icon} Новое достижение: ${award.title}`);
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
            <NavButton label="‹" a11y="Предыдущий день" onPress={() => setDate((d) => shiftDateKey(d, -1))} />
            <Pressable onPress={() => setDate(todayKey())} style={styles.todayBtn}>
              <Text style={[styles.todayText, { color: c.accent }]}>{isToday ? "Сегодня" : "К сегодня"}</Text>
            </Pressable>
            <NavButton label="›" a11y="Следующий день" onPress={() => setDate((d) => shiftDateKey(d, 1))} />
          </View>

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
            {[...open, ...done].map((task) => (
              <TaskRow key={task.id} task={task} onToggle={(t) => void toggle(t)} onDelete={remove} />
            ))}
          </View>

          {adding ? (
            <Composer date={date} onSubmit={add} onCancel={() => setAdding(false)} />
          ) : (
            <Pressable onPress={() => setAdding(true)} style={[styles.addBtn, { backgroundColor: c.accentSoft, borderColor: c.accent }]}>
              <View style={[styles.plus, { backgroundColor: c.accent }]}>
                <Text style={styles.plusText}>+</Text>
              </View>
              <Text style={[styles.addText, { color: c.accent }]}>Новое дело</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {notice ? <UndoToast key={notice.key} text={notice.text} onUndo={notice.undo} onClose={closeNotice} /> : null}
    </SafeAreaView>
  );
}

function NavButton({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} accessibilityLabel={a11y} hitSlop={6} style={styles.navBtn}>
      <Text style={[styles.navText, { color: c.ink }]}>{label}</Text>
    </Pressable>
  );
}

function summary(date: string, open: number, done: number): string {
  const today = todayKey();
  if (open === 0 && done === 0) {
    return date < today ? "В этот день ничего не было запланировано" : "Пока пусто — запиши дела, чтобы ничего не забыть";
  }
  if (open === 0) return date === today ? "На сегодня всё выполнено 🎉" : "На этот день всё выполнено 🎉";
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
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
  nav: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, padding: 4, borderRadius: radius.pill, borderWidth: 1 },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navText: { fontSize: 26, lineHeight: 28 },
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
