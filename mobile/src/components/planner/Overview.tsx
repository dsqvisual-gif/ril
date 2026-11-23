import { Pressable, StyleSheet, Text, View } from "react-native";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { Task } from "@/account/api";
import { formatShortDay, fromDateKey, getMonthGrid, getWeekDays, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";

function byDate(tasks: Task[]) {
  const map = new Map<string, Task[]>();
  for (const t of tasks) map.set(t.date, [...(map.get(t.date) ?? []), t]);
  return map;
}

/** The week, as on the website: each day with its first tasks; tap a day to open it. */
export function WeekView({ date, tasks, onSelectDay }: { date: string; tasks: Task[]; onSelectDay: (d: string) => void }) {
  const c = usePalette();
  const groups = byDate(tasks);
  const today = todayKey();
  return (
    <View style={{ gap: 8 }}>
      {getWeekDays(date).map((day) => {
        const list = groups.get(day) ?? [];
        const open = list.filter((t) => !t.done).length;
        const done = list.length - open;
        return (
          <Pressable
            key={day}
            onPress={() => onSelectDay(day)}
            style={[styles.day, { backgroundColor: c.surface, borderColor: day === today ? c.accent : c.border }]}
          >
            <View style={styles.dayHead}>
              <Text style={[styles.dayName, { color: day === today ? c.accent : c.ink }]}>{formatShortDay(day)}</Text>
              <Text style={{ color: c.inkTertiary, fontSize: 13, fontWeight: "600" }}>
                {list.length === 0 ? "пусто" : `${open} в плане${done ? ` · ${done} готово` : ""}`}
              </Text>
            </View>
            {list.slice(0, 3).map((t) => (
              <Text
                key={t.id}
                numberOfLines={1}
                style={[
                  styles.preview,
                  { color: t.done ? c.inkTertiary : t.urgent ? "#d63031" : c.ink },
                  t.done && { textDecorationLine: "line-through" },
                  (t.important || t.urgent) && !t.done && { fontWeight: "700" },
                ]}
              >
                {t.time ? <Text style={{ color: c.accent }}>{t.time} </Text> : null}
                {t.title}
              </Text>
            ))}
            {list.length > 3 ? <Text style={{ color: c.inkTertiary, fontSize: 13 }}>и ещё {list.length - 3}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const WEEK = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

/** The month grid: how many tasks each day has; tap a day to open it. */
export function MonthView({ date, tasks, onSelectDay }: { date: string; tasks: Task[]; onSelectDay: (d: string) => void }) {
  const c = usePalette();
  const groups = byDate(tasks);
  const today = todayKey();
  const month = date.slice(0, 7);
  return (
    <View style={[styles.month, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.monthTitle, { color: c.ink }]}>{format(fromDateKey(date), "LLLL yyyy", { locale: ru })}</Text>
      <View style={styles.week}>
        {WEEK.map((d) => (
          <Text key={d} style={[styles.weekDay, { color: c.inkTertiary }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {getMonthGrid(date).map((day) => {
          const list = groups.get(day) ?? [];
          const open = list.filter((t) => !t.done).length;
          const inMonth = day.startsWith(month);
          return (
            <Pressable key={day} onPress={() => onSelectDay(day)} style={styles.cell}>
              <View style={[styles.num, day === today && { backgroundColor: c.accent }]}>
                <Text style={{ color: day === today ? c.onAccent : inMonth ? c.ink : c.inkTertiary, fontWeight: day === today ? "800" : "600", opacity: inMonth ? 1 : 0.5 }}>
                  {Number(day.slice(8))}
                </Text>
              </View>
              {list.length ? (
                <View style={styles.dots}>
                  {open > 0 ? <View style={[styles.dotBadge, { backgroundColor: c.accentSoft }]}><Text style={[styles.dotText, { color: c.accent }]}>{open}</Text></View> : null}
                  {list.length - open > 0 ? <View style={[styles.dotSmall, { backgroundColor: c.success }]} /> : null}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  day: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 4 },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayName: { fontSize: 15, fontWeight: "800", textTransform: "capitalize" },
  preview: { fontSize: 14 },
  month: { borderWidth: 1, borderRadius: radius.lg, padding: 12, gap: 8 },
  monthTitle: { fontSize: 17, fontWeight: "800", textTransform: "capitalize", textAlign: "center" },
  week: { flexDirection: "row" },
  weekDay: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 56, alignItems: "center", paddingTop: 4, gap: 3 },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", alignItems: "center", gap: 3 },
  dotBadge: { minWidth: 18, paddingHorizontal: 4, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dotText: { fontSize: 10, fontWeight: "800" },
  dotSmall: { width: 6, height: 6, borderRadius: 3 },
});
