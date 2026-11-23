import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { addDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { confirmAsk, errorText } from "@/components/dialogs";
import { SettingsGroup, SettingsScreen } from "@/components/settings/SettingsUI";
import { fromDateKey, toDateKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";
import { useStore } from "@/db/store-types";
import { Button, IconBadge } from "@/components/ui";
import { askPermission, DEFAULT_PREFS, notifyChanged, NOTIFY_SUPPORTED, permission, readPrefs, writePrefs, type NotifyPrefs, type Permission } from "@/notify/notify";

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
  const store = useStore();
  const [perm, setPerm] = useState<Permission | null>(null);
  const [prefs, setPrefs] = useState<NotifyPrefs>(DEFAULT_PREFS);
  const [list, setList] = useState<Reminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [preset, setPreset] = useState(1);
  const [before, setBefore] = useState(1);
  const [first, setFirst] = useState(() => toDateKey(addDays(new Date(), 7)));

  const load = useCallback(async () => {
    try {
      const [p, saved, r] = await Promise.all([permission(), readPrefs(store), call<Reminder[]>("reminders.list")]);
      setPerm(p);
      setPrefs(saved);
      setList(r);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [call, store]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function change(patch: Partial<NotifyPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await writePrefs(store, next);
    notifyChanged();
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
      notifyChanged();
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
    <SettingsScreen title="Уведомления" lead="Всплывающие уведомления на телефоне: о делах, о плане на день, о сроках в команде и о напоминаниях.">
      {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}

      {!NOTIFY_SUPPORTED ? (
        <View style={[styles.state, { backgroundColor: c.tintWarn }]}>
          <Text style={{ color: c.warnInk, lineHeight: 20 }}>
            В браузерной версии уведомления не приходят. Они работают в приложении для Android и iPhone, которое ставится из магазина приложений.
          </Text>
        </View>
      ) : perm === "granted" ? (
        <View style={[styles.state, { backgroundColor: "rgba(52,199,89,0.12)" }]}>
          <IconBadge name="notifications" color="#2f9e44" />
          <Text style={{ flex: 1, color: c.ink, fontWeight: "700" }}>Уведомления включены</Text>
        </View>
      ) : perm === "denied" ? (
        <View style={[styles.state, { backgroundColor: c.tintDanger, flexDirection: "column", alignItems: "stretch" }]}>
          <Text style={{ color: c.ink, lineHeight: 20 }}>Уведомления запрещены в настройках телефона. Откройте настройки и разрешите их для Uspeyka.</Text>
          <Button title="Открыть настройки" small onPress={() => void Linking.openSettings()} />
        </View>
      ) : perm === "undetermined" ? (
        <View style={[styles.state, { backgroundColor: c.accentSoft, flexDirection: "column", alignItems: "stretch" }]}>
          <Text style={{ color: c.ink, lineHeight: 20 }}>Разрешите уведомления — телефон спросит один раз.</Text>
          <Button title="Разрешить уведомления" onPress={() => void askPermission().then((p) => { setPerm(p); notifyChanged(); })} />
        </View>
      ) : (
        <ActivityIndicator color={c.accent} />
      )}

      <SettingsGroup title="О делах">
        <View style={styles.block}>
          <Text style={[styles.rowTitle, { color: c.ink }]}>Дела со временем</Text>
          <Chips
            items={["Не напоминать", "В момент", "За 10 мин", "За 30 мин", "За час"]}
            value={[-1, 0, 10, 30, 60].indexOf(prefs.before)}
            onChange={(i) => void change({ before: [-1, 0, 10, 30, 60][i] })}
          />
        </View>
        <View style={[styles.block, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
          <Text style={[styles.rowTitle, { color: c.ink }]}>План на день — утром</Text>
          <Chips items={["Выкл.", "07:00", "08:00", "09:00", "10:00"]} value={["", "07:00", "08:00", "09:00", "10:00"].indexOf(prefs.morning)} onChange={(i) => void change({ morning: ["", "07:00", "08:00", "09:00", "10:00"][i] })} />
        </View>
        <View style={[styles.block, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
          <Text style={[styles.rowTitle, { color: c.ink }]}>Итоги дня — вечером</Text>
          <Chips items={["Выкл.", "20:00", "21:00", "22:00"]} value={["", "20:00", "21:00", "22:00"].indexOf(prefs.evening)} onChange={(i) => void change({ evening: ["", "20:00", "21:00", "22:00"][i] })} />
        </View>
      </SettingsGroup>

      <SettingsGroup title="Ещё">
        <SwitchRow title="Сроки задач команды" hint="Накануне и в день дедлайна" value={prefs.team} onChange={(v) => void change({ team: v })} />
        <SwitchRow title="Регулярные напоминания" hint="Из списка ниже" value={prefs.reminders} onChange={(v) => void change({ reminders: v })} />
        <SwitchRow title="Прививки и визиты" hint="В режиме мамы" value={prefs.baby} onChange={(v) => void change({ baby: v })} last />
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
            <Text style={[styles.label, { color: c.inkSecondary }]}>Напомнить</Text>
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

function SwitchRow({ title, hint, value, onChange, last }: { title: string; hint: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const c = usePalette();
  return (
    <View style={[styles.switchRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: c.ink }]}>{title}</Text>
        <Text style={[styles.hint, { color: c.inkSecondary }]}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
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
  state: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.lg, padding: 14 },
  block: { padding: 14, gap: 10 },
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
