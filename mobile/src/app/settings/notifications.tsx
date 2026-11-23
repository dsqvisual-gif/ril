import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { addDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { confirmAsk, errorText } from "@/components/dialogs";
import { SettingsGroup, SettingsScreen } from "@/components/settings/SettingsUI";
import { fromDateKey, toDateKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";

type Unit = "day" | "week" | "month" | "year";
type Reminder = {
  id: string;
  title: string;
  everyCount: number;
  everyUnit: Unit;
  nextDate: string;
  remindDaysBefore: number;
  addToPlanner: boolean;
};

// The same choices as on the website.
const PRESETS: { label: string; count: number; unit: Unit }[] = [
  { label: "Каждую неделю", count: 1, unit: "week" },
  { label: "Каждый месяц", count: 1, unit: "month" },
  { label: "Раз в 3 месяца", count: 3, unit: "month" },
  { label: "Раз в полгода", count: 6, unit: "month" },
  { label: "Раз в год", count: 1, unit: "year" },
];
const BEFORE = [
  { days: 0, label: "в тот же день" },
  { days: 1, label: "за 1 день" },
  { days: 3, label: "за 3 дня" },
  { days: 7, label: "за неделю" },
];

const UNIT_WORDS: Record<Unit, [string, string, string]> = {
  day: ["день", "дня", "дней"],
  week: ["неделю", "недели", "недель"],
  month: ["месяц", "месяца", "месяцев"],
  year: ["год", "года", "лет"],
};

function plural(n: number, [one, few, many]: [string, string, string]): string {
  const d = n % 10;
  const t = n % 100;
  if (d === 1 && t !== 11) return one;
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return few;
  return many;
}

function every(r: Pick<Reminder, "everyCount" | "everyUnit">): string {
  const preset = PRESETS.find((p) => p.count === r.everyCount && p.unit === r.everyUnit);
  if (preset) return preset.label;
  return `Раз в ${r.everyCount} ${plural(r.everyCount, UNIT_WORDS[r.everyUnit])}`;
}

/** The morning e-mail and repeating reminders ("заменить фильтр", "оплатить страховку"). */
export default function NotificationSettings() {
  const c = usePalette();
  const call = useRpc();
  const [digest, setDigest] = useState<boolean | null>(null);
  const [list, setList] = useState<Reminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [preset, setPreset] = useState(1);
  const [before, setBefore] = useState(1);
  const [first, setFirst] = useState(() => toDateKey(addDays(new Date(), 7)));

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([call<{ digestEnabled: boolean }>("account.profile"), call<Reminder[]>("reminders.list")]);
      setDigest(p.digestEnabled);
      setList(r);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [call]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function toggleDigest(on: boolean) {
    setDigest(on);
    try {
      await call("reminders.setDigest", on);
    } catch (e) {
      setDigest(!on);
      setError(errorText(e));
    }
  }

  async function add() {
    if (!title.trim()) return;
    try {
      const p = PRESETS[preset];
      const r = await call<Reminder>("reminders.create", {
        title: title.trim(),
        everyCount: p.count,
        everyUnit: p.unit,
        nextDate: first,
        remindDaysBefore: BEFORE[before].days,
        addToPlanner: true,
      });
      setList((prev) => [...(prev ?? []), r].sort((a, b) => a.nextDate.localeCompare(b.nextDate)));
      setTitle("");
      setAdding(false);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }

  function remove(r: Reminder) {
    confirmAsk(`Удалить «${r.title}»?`, undefined, "Удалить", async () => {
      try {
        await call("reminders.delete", r.id);
        setList((prev) => prev?.filter((x) => x.id !== r.id) ?? prev);
      } catch (e) {
        setError(errorText(e));
      }
    });
  }

  const shiftFirst = (days: number) => setFirst((d) => toDateKey(addDays(fromDateKey(d), days)));

  return (
    <SettingsScreen title="Уведомления" lead="Письма приходят на почту аккаунта. Напоминания ещё и попадают в планер в нужный день.">
      {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}

      <SettingsGroup title="Утреннее письмо">
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: c.ink }]}>Дела на день — письмом</Text>
            <Text style={[styles.hint, { color: c.inkSecondary }]}>Каждое утро: что запланировано на сегодня</Text>
          </View>
          {digest === null ? <ActivityIndicator color={c.accent} /> : <Switch value={digest} onValueChange={(v) => void toggleDigest(v)} />}
        </View>
      </SettingsGroup>

      <SettingsGroup title="Регулярные напоминания">
        {list === null ? <ActivityIndicator style={{ padding: 14 }} color={c.accent} /> : null}
        {list?.length === 0 && !adding ? (
          <Text style={[styles.empty, { color: c.inkSecondary }]}>Например: поменять фильтр, оплатить страховку, техосмотр.</Text>
        ) : null}
        {list?.map((r) => (
          <View key={r.id} style={[styles.item, { borderBottomColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: c.ink }]}>{r.title}</Text>
              <Text style={[styles.hint, { color: c.inkSecondary }]}>
                {every(r)} · следующий раз {format(fromDateKey(r.nextDate), "d MMMM", { locale: ru })}
              </Text>
            </View>
            <Pressable onPress={() => remove(r)} hitSlop={8}>
              <Text style={{ color: c.inkTertiary, fontSize: 20 }}>×</Text>
            </Pressable>
          </View>
        ))}
        {adding ? (
          <View style={styles.form}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="О чём напомнить"
              placeholderTextColor={c.inkTertiary}
              autoFocus
              style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
            />
            <Text style={[styles.label, { color: c.inkSecondary }]}>Как часто</Text>
            <Chips items={PRESETS.map((p) => p.label)} value={preset} onChange={setPreset} />
            <Text style={[styles.label, { color: c.inkSecondary }]}>Первый раз</Text>
            <View style={styles.dateRow}>
              <Step title="−" onPress={() => shiftFirst(-1)} />
              <Text style={[styles.date, { color: c.ink }]}>{format(fromDateKey(first), "d MMMM yyyy", { locale: ru })}</Text>
              <Step title="+" onPress={() => shiftFirst(1)} />
              <Step title="+нед" onPress={() => shiftFirst(7)} />
            </View>
            <Text style={[styles.label, { color: c.inkSecondary }]}>Напомнить письмом</Text>
            <Chips items={BEFORE.map((b) => b.label)} value={before} onChange={setBefore} />
            <View style={styles.dateRow}>
              <Pressable onPress={() => void add()} style={[styles.btn, { backgroundColor: c.accent, opacity: title.trim() ? 1 : 0.5 }]}>
                <Text style={{ color: c.onAccent, fontWeight: "800" }}>Добавить</Text>
              </Pressable>
              <Pressable onPress={() => setAdding(false)} style={[styles.btn, { borderWidth: 1.5, borderColor: c.border }]}>
                <Text style={{ color: c.ink, fontWeight: "700" }}>Отмена</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setAdding(true)} style={styles.addRow}>
            <Text style={{ color: c.accent, fontWeight: "800", fontSize: 16 }}>+ Новое напоминание</Text>
          </Pressable>
        )}
      </SettingsGroup>
    </SettingsScreen>
  );
}

function Chips({ items, value, onChange }: { items: string[]; value: number; onChange: (i: number) => void }) {
  const c = usePalette();
  return (
    <View style={styles.chips}>
      {items.map((label, i) => (
        <Pressable
          key={label}
          onPress={() => onChange(i)}
          style={[styles.chip, { backgroundColor: i === value ? c.accent : c.surfaceMuted, borderColor: c.border }]}
        >
          <Text style={{ color: i === value ? c.onAccent : c.ink, fontWeight: "700", fontSize: 13 }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Step({ title, onPress }: { title: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} style={[styles.step, { borderColor: c.border, backgroundColor: c.surfaceMuted }]}>
      <Text style={{ color: c.ink, fontWeight: "800" }}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  hint: { fontSize: 13, marginTop: 2 },
  empty: { padding: 14, fontSize: 14, lineHeight: 20 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  form: { padding: 14, gap: 10 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  label: { fontSize: 13, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  date: { fontSize: 15, fontWeight: "700", minWidth: 130, textAlign: "center" },
  step: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: radius.pill },
  addRow: { padding: 14 },
});
