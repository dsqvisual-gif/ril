import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  carryOverToToday,
  createTask,
  deleteTask,
  listTasks,
  restoreTask,
  setDone,
  type Task,
  type TaskInput,
} from "@/db/tasks";
import { formatDayTitle, fromDateKey, plannerDayHeading, relativeDayName, shiftDateKey, todayKey } from "@/shared/dates";
import { TaskRow } from "@/components/planner/TaskRow";
import { Composer } from "@/components/planner/Composer";
import { UndoToast } from "@/components/UndoToast";
import { radius, usePalette } from "@/theme/theme";

type Notice = { key: number; text: string; undo?: () => void };

export default function PlannerScreen() {
  const db = useSQLiteContext();
  const c = usePalette();
  const [date, setDate] = useState(todayKey);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Bumping the version re-reads the day from the database.
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    void listTasks(db, date, date).then((rows) => {
      if (alive) setTasks(rows);
    });
    return () => {
      alive = false;
    };
  }, [db, date, version]);

  // On every visit: unfinished tasks from past days move to today, as on the website.
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const moved = await carryOverToToday(db, todayKey());
        if (moved > 0) {
          setNotice({
            key: Date.now(),
            text: moved === 1 ? "Невыполненное дело перенесено на сегодня" : `${moved} ${plural(moved)} с прошлых дней перенесены на сегодня`,
          });
          reload();
        }
      })();
    }, [db, reload]),
  );

  const open = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const done = useMemo(() => tasks.filter((t) => t.done), [tasks]);

  async function add(input: TaskInput) {
    await createTask(db, input);
    reload();
  }

  async function toggle(task: Task) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    await setDone(db, task.id, !task.done);
  }

  async function remove(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await deleteTask(db, task.id);
    setNotice({
      key: Date.now(),
      text: `Удалено: «${short(task.title)}»`,
      undo: () => {
        void restoreTask(db, task.id).then(reload);
      },
    });
  }

  const closeNotice = useCallback(() => setNotice(null), []);
  const named = relativeDayName(date);
  const isToday = date === todayKey();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
            <Text style={[styles.summary, { color: c.inkSecondary }]}>{summary(date, open.length, done.length)}</Text>
          </View>

          <View style={styles.list}>
            {[...open, ...done].map((task) => (
              <TaskRow key={task.id} task={task} onToggle={(t) => void toggle(t)} onDelete={(t) => void remove(t)} />
            ))}
          </View>

          {adding ? (
            <Composer date={date} onSubmit={add} onCancel={() => setAdding(false)} />
          ) : (
            <Pressable
              onPress={() => setAdding(true)}
              style={[styles.addBtn, { backgroundColor: c.accentSoft, borderColor: c.accent }]}
            >
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
  scroll: { padding: 16, paddingBottom: 120, gap: 16 },
  nav: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  navBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navText: { fontSize: 26, lineHeight: 28 },
  todayBtn: { paddingHorizontal: 18, paddingVertical: 8 },
  todayText: { fontSize: 15, fontWeight: "700" },
  header: { gap: 4 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  dateLine: { fontSize: 15, textTransform: "capitalize" },
  summary: { fontSize: 15 },
  list: { gap: 10 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  plus: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  plusText: { color: "#fff", fontSize: 20, lineHeight: 22, fontWeight: "600" },
  addText: { fontSize: 16, fontWeight: "700" },
});
