import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { addDays, addMonths, format, getDay, getDaysInMonth, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { fromDateKey, toDateKey, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Small icon in a tinted square, used in lists and settings. */
export function IconBadge({ name, color, size = 32 }: { name: IconName; color: string; size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: `${color}22` }]}>
      <Ionicons name={name} size={size * 0.56} color={color} />
    </View>
  );
}

export function Icon({ name, color, size = 18 }: { name: IconName; color: string; size?: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/** Buttons in the website's style. */
export function Button(props: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  full?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = usePalette();
  const kind = props.kind ?? "primary";
  const bg = kind === "primary" ? c.accent : kind === "secondary" ? c.accentSoft : "transparent";
  const fg = kind === "primary" ? c.onAccent : kind === "danger" ? c.danger : c.accent;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled || props.busy}
      style={({ pressed }) => [
        styles.btn,
        props.small && styles.btnSmall,
        { backgroundColor: bg, opacity: props.disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind === "ghost" && { borderWidth: 1, borderColor: c.border },
        props.full && { alignSelf: "stretch" },
        props.style,
      ]}
    >
      {props.busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {props.icon ? <Ionicons name={props.icon} size={props.small ? 15 : 17} color={fg} /> : null}
          <Text style={[styles.btnText, props.small && styles.btnTextSmall, { color: fg }]}>{props.title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** A row of options, one chosen — like the website's segmented controls. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  disabled,
}: {
  items: { id: T; label: string }[];
  value: T | null;
  onChange: (id: T) => void;
  disabled?: boolean;
}) {
  const c = usePalette();
  return (
    <View style={[styles.seg, { backgroundColor: c.track }]}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <Pressable
            key={it.id}
            disabled={disabled || on}
            onPress={() => onChange(it.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segItem, on && [styles.segOn, { backgroundColor: c.surface }]]}
          >
            <Text style={[styles.segText, { color: on ? c.ink : c.inkSecondary }]} numberOfLines={1}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small label pill: "Важно", "до 25 нояб.", "просрочено". */
export function Tag({ text, tone }: { text: string; tone: "warn" | "danger" | "ok" | "muted" | "accent" }) {
  const c = usePalette();
  const map = {
    warn: [c.tintWarn, c.warnInk],
    danger: [c.tintDanger, c.danger],
    ok: ["rgba(52,199,89,0.14)", "#1f9d48"],
    muted: [c.fill, c.inkSecondary],
    accent: [c.accentSoft, c.accent],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const c = usePalette();
  return <Text style={[styles.section, { color: c.inkTertiary }]}>{children}</Text>;
}

/** A date: tap to open a small month calendar. Empty means "без срока". */
export function DateField({
  value,
  onChange,
  placeholder = "Без срока",
  min,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
  placeholder?: string;
  min?: string;
}) {
  const c = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.dateRow}>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          style={[styles.dateBox, { borderColor: open ? c.accent : c.border, backgroundColor: c.surfaceMuted }]}
        >
          <Ionicons name="calendar-outline" size={17} color={value ? c.accent : c.inkTertiary} />
          <Text style={[styles.dateText, { color: value ? c.ink : c.inkTertiary }]}>
            {value ? format(fromDateKey(value), "d MMMM yyyy, EEEEEE", { locale: ru }) : placeholder}
          </Text>
        </Pressable>
        {value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel="Убрать дату">
            <Ionicons name="close-circle" size={20} color={c.inkTertiary} />
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <Calendar
          value={value}
          min={min}
          onPick={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

const WEEK = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function Calendar({ value, onPick, min }: { value: string | null; onPick: (d: string) => void; min?: string }) {
  const c = usePalette();
  const [month, setMonth] = useState(() => startOfMonth(value ? fromDateKey(value) : new Date()));
  const today = todayKey();
  const lead = (getDay(month) + 6) % 7;
  const days = getDaysInMonth(month);
  const cells: (string | null)[] = [...Array(lead).fill(null)];
  for (let i = 0; i < days; i += 1) cells.push(toDateKey(addDays(month, i)));
  while (cells.length % 7) cells.push(null);
  const quick: { label: string; date: string }[] = [
    { label: "Сегодня", date: today },
    { label: "Завтра", date: toDateKey(addDays(new Date(), 1)) },
    { label: "Через неделю", date: toDateKey(addDays(new Date(), 7)) },
    { label: "Через месяц", date: toDateKey(addMonths(new Date(), 1)) },
  ];

  return (
    <View style={[styles.cal, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.quick}>
        {quick.map((q) => (
          <Pressable key={q.label} onPress={() => onPick(q.date)} style={[styles.quickItem, { backgroundColor: c.accentSoft }]}>
            <Text style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>{q.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.calHead}>
        <Pressable onPress={() => setMonth((m) => addMonths(m, -1))} hitSlop={10} accessibilityLabel="Предыдущий месяц">
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <Text style={[styles.calTitle, { color: c.ink }]}>{format(month, "LLLL yyyy", { locale: ru })}</Text>
        <Pressable onPress={() => setMonth((m) => addMonths(m, 1))} hitSlop={10} accessibilityLabel="Следующий месяц">
          <Ionicons name="chevron-forward" size={20} color={c.ink} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {WEEK.map((d) => (
          <Text key={d} style={[styles.weekDay, { color: c.inkTertiary }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={styles.cell} />;
          const on = d === value;
          const off = Boolean(min && d < min);
          return (
            <Pressable key={d} disabled={off} onPress={() => onPick(d)} style={styles.cell}>
              <View style={[styles.dayDot, on && { backgroundColor: c.accent }, !on && d === today && { borderWidth: 1.5, borderColor: c.accent }]}>
                <Text style={{ color: on ? c.onAccent : off ? c.inkTertiary : c.ink, fontWeight: on || d === today ? "800" : "500", opacity: off ? 0.4 : 1 }}>
                  {Number(d.slice(8))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", justifyContent: "center" },
  btn: { flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, minHeight: 46, borderRadius: radius.pill, alignSelf: "flex-start" },
  btnSmall: { minHeight: 36, paddingHorizontal: 14 },
  btnText: { fontSize: 16, fontWeight: "700" },
  btnTextSmall: { fontSize: 14 },
  seg: { flexDirection: "row", borderRadius: 12, padding: 3, gap: 3 },
  segItem: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 9, paddingHorizontal: 6 },
  segOn: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 14, fontWeight: "700" },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, alignSelf: "flex-start" },
  tagText: { fontSize: 12, fontWeight: "700" },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 46 },
  dateText: { fontSize: 15, fontWeight: "600" },
  cal: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 10 },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quickItem: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  calHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  calTitle: { fontSize: 16, fontWeight: "800", textTransform: "capitalize" },
  week: { flexDirection: "row" },
  weekDay: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 40, alignItems: "center", justifyContent: "center" },
  dayDot: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
