import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { format, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { Icon } from "@/components/ui";
import { fromDateKey, shiftDateKey, toDateKey, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";
import { Initial } from "./Initial";
import { TaskSheet } from "./TaskSheet";
import { personName, statusOf, type CTask, type Run, type TeamView } from "./types";

const DAYS = 14;
const COL = 40;
const NAME = 132;
const ROW = 34;

/** Who is busy with what over two weeks: workload per person and task bars by dates. */
export function Schedule({ view, onView, run }: { view: TeamView; onView: (v: TeamView) => void; run: Run }) {
  const c = usePalette();
  const today = todayKey();
  const monday = () => toDateKey(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [start, setStart] = useState(monday);
  const [showDone, setShowDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => shiftDateKey(start, i)), [start]);
  const end = days[DAYS - 1];
  const people = view.members.filter((m) => m.status === "active");

  const rows = useMemo(() => {
    const visible = view.tasks.filter((t) => (showDone || t.status !== "done") && t.startDate <= end && (t.deadline ?? t.startDate) >= start);
    const out = people.map((m) => ({ key: m.userId, name: personName(view, m.userId), id: m.userId as string | null, tasks: visible.filter((t) => t.assigneeId === m.userId) }));
    const none = visible.filter((t) => !t.assigneeId);
    if (none.length) out.push({ key: "none", name: "Без исполнителя", id: null, tasks: none });
    return out;
  }, [view, people, showDone, start, end]);

  const load = people.map((m) => {
    const mine = view.tasks.filter((t) => t.assigneeId === m.userId && t.status !== "done");
    return { m, active: mine.length, late: mine.filter((t) => t.deadline && t.deadline < today).length };
  });
  const maxLoad = Math.max(1, ...load.map((l) => l.active));
  const open = view.tasks.find((t) => t.id === openId) ?? null;

  return (
    <View style={{ gap: 14 }}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.ink }]}>Загрузка</Text>
        {load.map(({ m, active, late }) => (
          <View key={m.userId} style={styles.loadRow}>
            <Initial name={m.name} id={m.userId} size={26} />
            <Text style={{ width: 96, color: c.ink, fontWeight: "600" }} numberOfLines={1}>
              {m.userId === view.me.userId ? "Я" : m.name}
            </Text>
            <View style={[styles.loadTrack, { backgroundColor: c.track }]}>
              <View style={{ width: `${(active / maxLoad) * 100}%`, height: "100%", backgroundColor: c.accent, borderRadius: 4 }} />
            </View>
            <Text style={{ width: 70, textAlign: "right", color: late ? c.danger : c.inkSecondary, fontSize: 13, fontWeight: "700" }}>
              {active}
              {late ? ` · ${late} проср.` : ""}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.bar}>
        <View style={[styles.nav, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Pressable onPress={() => setStart((s) => shiftDateKey(s, -7))} hitSlop={6} style={styles.navBtn} accessibilityLabel="Раньше">
            <Icon name="chevron-back" color={c.ink} size={18} />
          </Pressable>
          <Pressable onPress={() => setStart(monday())} style={styles.navBtn}>
            <Text style={{ color: c.accent, fontWeight: "800" }}>Сегодня</Text>
          </Pressable>
          <Pressable onPress={() => setStart((s) => shiftDateKey(s, 7))} hitSlop={6} style={styles.navBtn} accessibilityLabel="Позже">
            <Icon name="chevron-forward" color={c.ink} size={18} />
          </Pressable>
        </View>
        <Text style={{ color: c.inkSecondary, fontWeight: "700", flex: 1, textAlign: "right" }}>
          {format(fromDateKey(start), "d MMM", { locale: ru })} — {format(fromDateKey(end), "d MMM", { locale: ru })}
        </Text>
      </View>
      <View style={[styles.bar, { justifyContent: "space-between" }]}>
        <Text style={{ color: c.ink, fontWeight: "600" }}>Показывать выполненные</Text>
        <Switch value={showDone} onValueChange={setShowDone} />
      </View>

      <View style={[styles.gantt, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={{ flexDirection: "row" }}>
          {/* Fixed column with people and task names */}
          <View style={{ width: NAME, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border }}>
            <View style={[styles.headCell, { height: 44 }]}>
              <Text style={{ color: c.inkTertiary, fontSize: 12, fontWeight: "700" }}>ЗАДАЧИ</Text>
            </View>
            {rows.map((r) => (
              <View key={r.key}>
                <View style={[styles.personRow, { backgroundColor: c.surfaceMuted }]}>
                  <Initial name={r.name} id={r.id} size={18} />
                  <Text style={{ color: c.ink, fontWeight: "800", fontSize: 12, flex: 1 }} numberOfLines={1}>
                    {r.name}
                  </Text>
                </View>
                {r.tasks.length === 0 ? (
                  <View style={[styles.taskName, { height: ROW }]}>
                    <Text style={{ color: c.inkTertiary, fontSize: 12 }}>нет задач</Text>
                  </View>
                ) : (
                  r.tasks.map((t) => (
                    <Pressable key={t.id} onPress={() => setOpenId(t.id)} style={[styles.taskName, { height: ROW }]}>
                      <Text style={{ color: c.ink, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                        {t.title}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={{ flexDirection: "row", height: 44 }}>
                {days.map((d) => {
                  const date = fromDateKey(d);
                  const weekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <View key={d} style={[styles.dayHead, { width: COL, backgroundColor: d === today ? c.accentSoft : weekend ? c.fill : "transparent" }]}>
                      <Text style={{ color: c.inkTertiary, fontSize: 10, fontWeight: "700" }}>{format(date, "EEEEEE", { locale: ru })}</Text>
                      <Text style={{ color: d === today ? c.accent : c.ink, fontSize: 14, fontWeight: "800" }}>{format(date, "d")}</Text>
                    </View>
                  );
                })}
              </View>
              {rows.map((r) => (
                <View key={r.key}>
                  <View style={[styles.personRow, { backgroundColor: c.surfaceMuted, width: COL * DAYS }]} />
                  {(r.tasks.length ? r.tasks : [null]).map((t, i) => (
                    <View key={t?.id ?? `e${i}`} style={{ height: ROW, width: COL * DAYS, flexDirection: "row" }}>
                      {days.map((d) => {
                        const weekend = [0, 6].includes(fromDateKey(d).getDay());
                        return <View key={d} style={{ width: COL, backgroundColor: d === today ? c.accentSoft : weekend ? c.fill : "transparent" }} />;
                      })}
                      {t ? <Bar task={t} days={days} onPress={() => setOpenId(t.id)} /> : null}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
        {rows.every((r) => r.tasks.length === 0) ? (
          <Text style={{ color: c.inkSecondary, padding: 14, lineHeight: 19 }}>
            На эти две недели задач нет. Укажите у задач начало и срок — они появятся здесь полосками.
          </Text>
        ) : null}
      </View>

      <View style={styles.legend}>
        {(["todo", "doing", "done"] as const).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={{ width: 12, height: 8, borderRadius: 3, backgroundColor: statusOf(s).color }} />
            <Text style={{ color: c.inkSecondary, fontSize: 12 }}>{statusOf(s).label}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={{ width: 12, height: 8, borderRadius: 3, backgroundColor: c.danger }} />
          <Text style={{ color: c.inkSecondary, fontSize: 12 }}>Просрочено</Text>
        </View>
      </View>

      {open ? <TaskSheet task={open} view={view} onView={onView} run={run} onClose={() => setOpenId(null)} /> : null}
    </View>
  );
}

function Bar({ task, days, onPress }: { task: CTask; days: string[]; onPress: () => void }) {
  const c = usePalette();
  const first = days[0];
  const last = days[days.length - 1];
  const from = task.startDate < first ? 0 : days.indexOf(task.startDate);
  const endDate = task.deadline ?? task.startDate;
  const to = endDate > last ? days.length - 1 : days.indexOf(endDate);
  if (from < 0 || to < 0) return null;
  const late = task.status !== "done" && task.deadline && task.deadline < todayKey();
  const color = late ? c.danger : statusOf(task.status).color;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.ganttBar, { left: from * COL + 3, width: (to - from + 1) * COL - 6, backgroundColor: `${color}2a`, borderColor: color }]}
    >
      <Text style={{ color, fontSize: 11, fontWeight: "800" }} numberOfLines={1}>
        {task.important ? "! " : ""}
        {task.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  loadRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  bar: { flexDirection: "row", alignItems: "center", gap: 10 },
  nav: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 4 },
  navBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  gantt: { borderWidth: 1, borderRadius: radius.md, overflow: "hidden" },
  headCell: { justifyContent: "center", paddingHorizontal: 10 },
  personRow: { height: 28, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 },
  taskName: { justifyContent: "center", paddingHorizontal: 10 },
  dayHead: { alignItems: "center", justifyContent: "center" },
  ganttBar: { position: "absolute", top: 5, height: ROW - 10, borderRadius: 7, borderWidth: 1, justifyContent: "center", paddingHorizontal: 6 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
});
