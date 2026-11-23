import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { addDays, endOfWeek, format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { Icon, Segmented, Tag } from "@/components/ui";
import { toDateKey, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";
import { Initial } from "./Initial";
import { NewTaskSheet, TaskSheet } from "./TaskSheet";
import { daysLeft, dueInfo, isManager, personName, plural, statusOf, STATUSES, type CTask, type Run, type Status, type TeamView } from "./types";

type Sort = "deadline" | "priority" | "person" | "status";
type Group = { key: string; title: string; tone?: string; tasks: CTask[] };

const SORTS: { id: Sort; label: string }[] = [
  { id: "deadline", label: "По сроку" },
  { id: "priority", label: "По важности" },
  { id: "person", label: "По людям" },
  { id: "status", label: "По статусу" },
];

const byDeadline = (a: CTask, b: CTask) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || Number(b.important) - Number(a.important);

/** The team's tasks as a work board: numbers on top, active work by groups, finished work apart. */
export function TaskBoard({ view, onView, run }: { view: TeamView; onView: (v: TeamView) => void; run: Run }) {
  const c = usePalette();
  const call = useRpc();
  const manager = isManager(view.me.role);
  const [who, setWho] = useState<string>(manager ? "all" : view.me.userId);
  const [state, setState] = useState<"active" | "done">("active");
  const [sort, setSort] = useState<Sort>("deadline");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const today = todayKey();
  const weekEnd = toDateKey(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekAgo = toDateKey(addDays(new Date(), -7));

  const mineOrAll = useMemo(
    () => view.tasks.filter((t) => (who === "all" ? true : who === "none" ? !t.assigneeId : t.assigneeId === who)),
    [view.tasks, who],
  );
  const active = mineOrAll.filter((t) => t.status !== "done");
  const done = mineOrAll.filter((t) => t.status === "done").sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));

  const kpi = {
    active: active.length,
    overdue: active.filter((t) => t.deadline && t.deadline < today).length,
    week: active.filter((t) => t.deadline && t.deadline >= today && t.deadline <= weekEnd).length,
    done7: done.filter((t) => t.doneAt && t.doneAt.slice(0, 10) >= weekAgo).length,
  };

  const groups: Group[] = useMemo(() => {
    if (state === "done") {
      const g: Group[] = [
        { key: "today", title: "Сегодня", tasks: [] },
        { key: "week", title: "За неделю", tasks: [] },
        { key: "older", title: "Раньше", tasks: [] },
      ];
      for (const t of done) {
        const d = (t.doneAt ?? "").slice(0, 10);
        (d === today ? g[0] : d >= weekAgo ? g[1] : g[2]).tasks.push(t);
      }
      return g;
    }
    if (sort === "deadline") {
      const g: Group[] = [
        { key: "late", title: "Просрочено", tone: c.danger, tasks: [] },
        { key: "today", title: "Сегодня", tone: "#f08c00", tasks: [] },
        { key: "tomorrow", title: "Завтра", tasks: [] },
        { key: "week", title: "На этой неделе", tasks: [] },
        { key: "later", title: "Позже", tasks: [] },
        { key: "none", title: "Без срока", tasks: [] },
      ];
      for (const t of [...active].sort(byDeadline)) {
        if (!t.deadline) g[5].tasks.push(t);
        else {
          const d = daysLeft(t.deadline);
          (d < 0 ? g[0] : d === 0 ? g[1] : d === 1 ? g[2] : t.deadline <= weekEnd ? g[3] : g[4]).tasks.push(t);
        }
      }
      return g;
    }
    if (sort === "priority") {
      return [
        { key: "imp", title: "Важные", tone: "#f08c00", tasks: active.filter((t) => t.important).sort(byDeadline) },
        { key: "rest", title: "Остальные", tasks: active.filter((t) => !t.important).sort(byDeadline) },
      ];
    }
    if (sort === "status") {
      return STATUSES.filter((s) => s.id !== "done").map((s) => ({ key: s.id, title: s.label, tone: s.color, tasks: active.filter((t) => t.status === s.id).sort(byDeadline) }));
    }
    const people = view.members.filter((m) => m.status === "active");
    const g: Group[] = people.map((m) => ({ key: m.userId, title: personName(view, m.userId), tasks: active.filter((t) => t.assigneeId === m.userId).sort(byDeadline) }));
    g.push({ key: "none", title: "Без исполнителя", tasks: active.filter((t) => !t.assigneeId).sort(byDeadline) });
    return g;
  }, [state, sort, active, done, view, today, weekEnd, weekAgo, c.danger]);

  const open = view.tasks.find((t) => t.id === openId) ?? null;
  const people = view.members.filter((m) => m.status === "active");

  async function advance(t: CTask) {
    const next: Status = t.status === "todo" ? "doing" : t.status === "doing" ? "done" : "todo";
    void Haptics.selectionAsync();
    await run(async () => onView(await call<TeamView>("company.updateTask", t.id, { status: next })));
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.kpis}>
        <Kpi value={kpi.active} label="в работе" />
        <Kpi value={kpi.overdue} label="просроч." tone={kpi.overdue ? c.danger : undefined} />
        <Kpi value={kpi.week} label="на неделе" />
        <Kpi value={kpi.done7} label="готово за 7 дн." tone={kpi.done7 ? "#2f9e44" : undefined} />
      </View>

      {manager ? (
        <Pressable onPress={() => setAdding(true)} style={[styles.add, { backgroundColor: c.accent }]}>
          <Icon name="add" color={c.onAccent} size={20} />
          <Text style={{ color: c.onAccent, fontWeight: "800", fontSize: 16 }}>Новая задача</Text>
        </Pressable>
      ) : (
        <View style={[styles.note, { backgroundColor: c.accentSoft }]}>
          <Icon name="information-circle-outline" color={c.accent} size={18} />
          <Text style={{ flex: 1, color: c.ink, fontSize: 13, lineHeight: 18 }}>
            Задачи ставят администраторы. Отмечайте у своих задач: не начато, в процессе, готово — кружком слева или в карточке.
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {[
          { id: "all", label: "Все", count: view.tasks.filter((t) => t.status !== "done").length },
          { id: view.me.userId, label: "Мои", count: view.tasks.filter((t) => t.status !== "done" && t.assigneeId === view.me.userId).length },
          ...people
            .filter((m) => m.userId !== view.me.userId)
            .map((m) => ({ id: m.userId, label: m.name.split(" ")[0], count: view.tasks.filter((t) => t.status !== "done" && t.assigneeId === m.userId).length })),
          { id: "none", label: "Без исполнителя", count: view.tasks.filter((t) => t.status !== "done" && !t.assigneeId).length },
        ].map((f) => {
          const on = who === f.id;
          return (
            <Pressable key={f.id} onPress={() => setWho(f.id)} style={[styles.filter, { backgroundColor: on ? c.ink : c.surface, borderColor: on ? c.ink : c.border }]}>
              <Text style={{ color: on ? c.bg : c.ink, fontWeight: "700", fontSize: 14 }}>{f.label}</Text>
              <Text style={{ color: on ? c.bg : c.inkTertiary, fontWeight: "700", fontSize: 13 }}>{f.count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Segmented
        items={[
          { id: "active", label: `Активные · ${active.length}` },
          { id: "done", label: `Выполненные · ${done.length}` },
        ]}
        value={state}
        onChange={setState}
      />

      {state === "active" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Icon name="swap-vertical" color={c.inkTertiary} size={16} />
          {SORTS.map((s) => {
            const on = sort === s.id;
            return (
              <Pressable key={s.id} onPress={() => setSort(s.id)} hitSlop={4}>
                <Text style={{ color: on ? c.accent : c.inkSecondary, fontWeight: on ? "800" : "600", fontSize: 14 }}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {(state === "active" ? active : done).length === 0 ? (
        <View style={[styles.empty, { borderColor: c.border }]}>
          <Icon name={state === "active" ? "checkmark-done-outline" : "archive-outline"} color={c.inkTertiary} size={28} />
          <Text style={{ color: c.inkSecondary, textAlign: "center" }}>
            {state === "active" ? (manager ? "Активных задач нет. Создайте задачу и назначьте исполнителя." : "У вас нет активных задач.") : "Выполненных задач пока нет."}
          </Text>
        </View>
      ) : null}

      {groups
        .filter((g) => g.tasks.length)
        .map((g) => (
          <View key={g.key} style={{ gap: 6 }}>
            <View style={styles.groupHead}>
              {sort === "person" && state === "active" && g.key !== "none" ? <Initial name={g.title} id={g.key} size={20} /> : null}
              <Text style={[styles.groupTitle, { color: g.tone ?? c.ink }]}>{g.title}</Text>
              <Text style={{ color: c.inkTertiary, fontWeight: "700" }}>{g.tasks.length}</Text>
            </View>
            <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
              {g.tasks.map((t, i) => (
                <Row
                  key={t.id}
                  task={t}
                  view={view}
                  last={i === g.tasks.length - 1}
                  hidePerson={sort === "person" && state === "active"}
                  onOpen={() => setOpenId(t.id)}
                  onAdvance={isManager(view.me.role) || t.assigneeId === view.me.userId ? () => void advance(t) : undefined}
                />
              ))}
            </View>
          </View>
        ))}

      {open ? <TaskSheet task={open} view={view} onView={onView} run={run} onClose={() => setOpenId(null)} /> : null}
      {adding ? <NewTaskSheet view={view} onView={onView} run={run} onClose={() => setAdding(false)} /> : null}
    </View>
  );
}

function Kpi({ value, label, tone }: { value: number; label: string; tone?: string }) {
  const c = usePalette();
  return (
    <View style={[styles.kpi, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={{ color: tone ?? c.ink, fontSize: 24, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: c.inkSecondary, fontSize: 11, fontWeight: "600" }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/** Status circle: empty — not started, half — in progress, tick — done. */
function StatusDot({ status, onPress }: { status: Status; onPress?: () => void }) {
  const s = statusOf(status);
  const body = (
    <View style={[styles.dot, { borderColor: s.color, backgroundColor: status === "done" ? s.color : "transparent" }]}>
      {status === "doing" ? <View style={[styles.half, { backgroundColor: s.color }]} /> : null}
      {status === "done" ? <Icon name="checkmark" color="#fff" size={14} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${s.label}. Нажмите, чтобы сменить статус`}>
      {body}
    </Pressable>
  );
}

function Row({ task, view, last, hidePerson, onOpen, onAdvance }: { task: CTask; view: TeamView; last: boolean; hidePerson: boolean; onOpen: () => void; onAdvance?: () => void }) {
  const c = usePalette();
  const done = task.status === "done";
  const due = dueInfo(task.deadline, done);
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, pressed && { backgroundColor: c.fill }]}>
      <StatusDot status={task.status} onPress={onAdvance} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.titleRow}>
          {task.important && !done ? <View style={[styles.flag, { backgroundColor: "#f0b429" }]} /> : null}
          <Text style={[styles.title, { color: done ? c.inkTertiary : c.ink }, done && styles.struck]} numberOfLines={2}>
            {task.title}
          </Text>
        </View>
        <View style={styles.meta}>
          {!hidePerson ? (
            <View style={styles.metaItem}>
              <Initial name={personName(view, task.assigneeId)} id={task.assigneeId} size={18} />
              <Text style={{ color: c.inkSecondary, fontSize: 13 }} numberOfLines={1}>
                {personName(view, task.assigneeId)}
              </Text>
            </View>
          ) : null}
          {task.status === "doing" ? <Tag tone="warn" text="в процессе" /> : null}
          {due && !done ? <Tag tone={due.tone} text={due.text} /> : null}
          {done && task.doneAt ? <Text style={{ color: c.inkTertiary, fontSize: 13 }}>выполнено {format(new Date(task.doneAt), "d MMM", { locale: ru })}</Text> : null}
          {task.note ? <Icon name="document-text-outline" color={c.inkTertiary} size={14} /> : null}
        </View>
      </View>
      <Icon name="chevron-forward" color={c.inkTertiary} size={16} />
    </Pressable>
  );
}

export function countText(n: number) {
  return `${n} ${plural(n, ["задача", "задачи", "задач"])}`;
}

const styles = StyleSheet.create({
  kpis: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 8, gap: 1 },
  add: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, borderRadius: radius.md },
  note: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderRadius: radius.md, padding: 12 },
  filters: { gap: 8, alignItems: "center", paddingRight: 8 },
  filter: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1 },
  empty: { alignItems: "center", gap: 8, padding: 24, borderWidth: 1, borderStyle: "dashed", borderRadius: radius.lg },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 7, paddingLeft: 2, marginTop: 4 },
  groupTitle: { fontSize: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 12 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  half: { position: "absolute", left: 0, top: 0, bottom: 0, width: "50%" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  flag: { width: 4, height: 16, borderRadius: 2 },
  title: { flex: 1, fontSize: 15, fontWeight: "600", lineHeight: 20 },
  struck: { textDecorationLine: "line-through" },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 170 },
});
