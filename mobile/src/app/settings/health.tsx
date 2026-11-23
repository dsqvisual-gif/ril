import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { BabyIcon, ChildChips, Empty, useChildren } from "@/components/baby/children";
import { confirmAsk, errorText } from "@/components/dialogs";
import { SettingsScreen } from "@/components/settings/SettingsUI";
import { Button, DateField, Segmented } from "@/components/ui";
import { plural, type Child, type Health } from "@/shared/baby";
import { fromDateKey, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";

const VISIT_PRESETS = ["Осмотр педиатра", "Невролог", "Ортопед", "Окулист", "ЛОР", "Стоматолог", "Анализы", "УЗИ"];
const VACCINE_PRESETS = ["Прививка", "Плановая прививка"];
const REMIND = [
  { days: 0, label: "в тот же день" },
  { days: 1, label: "за 1 день" },
  { days: 3, label: "за 3 дня" },
  { days: 7, label: "за неделю" },
];

function inDays(date: string): string {
  const d = differenceInCalendarDays(fromDateKey(date), fromDateKey(todayKey()));
  if (d === 0) return "сегодня";
  if (d === 1) return "завтра";
  if (d < 0) return "прошло";
  return `через ${d} ${plural(d, ["день", "дня", "дней"])}`;
}

/** Vaccinations and doctor visits; everyone tracking the baby gets an e-mail a few days before. */
export default function HealthScreen() {
  const c = usePalette();
  const { kids, child, setChildId } = useChildren();
  return (
    <SettingsScreen title="Здоровье" lead="Прививки и визиты к врачу: запишите дату — за несколько дней придёт письмо всем, кто отмечает малыша. График прививок уточняйте у педиатра.">
      {kids && kids.length > 1 ? <ChildChips kids={kids} childId={child?.id ?? null} onChange={setChildId} /> : null}
      {kids === null ? <ActivityIndicator color={c.accent} /> : null}
      {kids && kids.length === 0 ? <Empty text="Сначала добавьте малыша на вкладке «Малыш»." /> : null}
      {child ? <Board key={child.id} child={child} /> : null}
    </SettingsScreen>
  );
}

function Board({ child }: { child: Child }) {
  const c = usePalette();
  const call = useRpc();
  const [items, setItems] = useState<Health[] | null>(null);
  const [form, setForm] = useState<"new" | Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    call<Health[]>("baby.health", child.id).then(setItems).catch((e) => setError(errorText(e)));
  }, [call, child.id]);

  const upsert = (h: Health) => setItems((prev) => [...(prev ?? []).filter((x) => x.id !== h.id), h].sort((a, b) => a.date.localeCompare(b.date)));
  const ahead = (items ?? []).filter((h) => !h.done);
  const done = (items ?? []).filter((h) => h.done).reverse();

  return (
    <>
      {form ? (
        <HealthForm
          initial={form === "new" ? undefined : form}
          onCancel={() => setForm(null)}
          onSave={async (input) => {
            try {
              upsert(await call<Health>("baby.saveHealth", child.id, form === "new" ? null : form.id, input));
              setForm(null);
              setError(null);
            } catch (e) {
              setError(errorText(e));
            }
          }}
          onDelete={
            form !== "new"
              ? () =>
                  confirmAsk(`Удалить «${form.title}»?`, undefined, "Удалить", async () => {
                    await call("baby.deleteHealth", form.id);
                    setItems((p) => p?.filter((x) => x.id !== form.id) ?? p);
                    setForm(null);
                  })
              : undefined
          }
        />
      ) : (
        <Button title="Прививка или визит" icon="add" full onPress={() => setForm("new")} />
      )}
      {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
      {items === null ? <ActivityIndicator color={c.accent} /> : null}

      {[
        ["Впереди", ahead],
        ["Сделано", done],
      ].map(([title, list]) =>
        (list as Health[]).length ? (
          <View key={title as string} style={{ gap: 8 }}>
            <Text style={{ color: c.ink, fontWeight: "800", fontSize: 16 }}>{title as string}</Text>
            {(list as Health[]).map((h) => (
              <View key={h.id} style={[styles.item, { backgroundColor: c.surface, borderColor: c.border, opacity: h.done ? 0.7 : 1 }]}>
                <Pressable
                  onPress={() => void call<Health>("baby.setHealthDone", h.id, !h.done).then(upsert)}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: h.done }}
                  style={[styles.check, { borderColor: h.done ? c.success : c.accent, backgroundColor: h.done ? c.success : "transparent" }]}
                >
                  {h.done ? <BabyIcon name="check" color="#fff" size={15} /> : null}
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => setForm(h)}>
                  <View style={styles.row}>
                    <BabyIcon name={h.kind === "vaccine" ? "needle" : "stethoscope"} color={c.accent} size={16} />
                    <Text style={{ color: c.ink, fontWeight: "700", fontSize: 15 }}>{h.title}</Text>
                  </View>
                  <Text style={{ color: c.inkSecondary, fontSize: 13 }}>
                    {format(fromDateKey(h.date), "d MMMM yyyy", { locale: ru })}
                    {h.done ? "" : ` · ${inDays(h.date)}`}
                    {h.note ? ` · ${h.note}` : ""}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null,
      )}
      {items && items.length === 0 && !form ? <Empty text="Запишите ближайший визит к педиатру или прививку." /> : null}
    </>
  );
}

function HealthForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Health;
  onSave: (input: Omit<Health, "id" | "done">) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const c = usePalette();
  const [kind, setKind] = useState<Health["kind"]>(initial?.kind ?? "visit");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState<string | null>(initial?.date ?? null);
  const [remind, setRemind] = useState(initial?.remindDaysBefore ?? 3);
  const [note, setNote] = useState(initial?.note ?? "");
  const presets = kind === "vaccine" ? VACCINE_PRESETS : VISIT_PRESETS;
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Segmented
        items={[
          { id: "visit", label: "Визит к врачу" },
          { id: "vaccine", label: "Прививка" },
        ]}
        value={kind}
        onChange={setKind}
      />
      <View style={styles.wrap}>
        {presets.map((p) => (
          <Pressable key={p} onPress={() => setTitle(p)} style={[styles.chip, { backgroundColor: title === p ? c.accentSoft : "transparent", borderColor: title === p ? c.accent : c.border }]}>
            <Text style={{ color: title === p ? c.accent : c.inkSecondary, fontWeight: "600", fontSize: 13 }}>{p}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        placeholder={kind === "vaccine" ? "Например: АКДС" : "Например: осмотр педиатра"}
        placeholderTextColor={c.inkTertiary}
        style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
      />
      <DateField value={date} onChange={setDate} placeholder="Когда" />
      <Text style={{ color: c.inkSecondary, fontSize: 13, fontWeight: "700" }}>Напомнить письмом</Text>
      <View style={styles.wrap}>
        {REMIND.map((r) => (
          <Pressable key={r.days} onPress={() => setRemind(r.days)} style={[styles.chip, { backgroundColor: remind === r.days ? c.accent : c.surfaceMuted, borderColor: c.border }]}>
            <Text style={{ color: remind === r.days ? c.onAccent : c.ink, fontWeight: "700", fontSize: 13 }}>{r.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={note} onChangeText={setNote} maxLength={300} placeholder="Заметка (необязательно)" placeholderTextColor={c.inkTertiary} style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]} />
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        {onDelete ? (
          <Pressable onPress={onDelete} hitSlop={6}>
            <Text style={{ color: c.danger, fontWeight: "700" }}>Удалить</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={styles.row}>
          <Button title="Отмена" kind="ghost" small onPress={onCancel} />
          <Button title="Сохранить" small disabled={!title.trim() || !date} onPress={() => void onSave({ kind, title: title.trim(), date: date!, remindDaysBefore: remind, note: note.trim() || null })} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radius.md, padding: 12 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
