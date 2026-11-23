import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { confirmAsk, errorText } from "@/components/dialogs";
import { formatAmount, goalProgress, guessTarget, type GoalKind } from "@/shared/goal-progress";
import { fromDateKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";

type Entry = { id: string; text: string; amount: number | null; progress: number | null; createdAt: string };
type Step = { id: string; title: string; done: boolean };
type Goal = {
  id: string;
  title: string;
  why: string | null;
  deadline: string | null;
  kind: GoalKind;
  target: number | null;
  unit: string | null;
  selfProgress: number | null;
  doneAt: string | null;
  steps: Step[];
  entries: Entry[];
};

/** Goals with steps, progress and "что сделано" — the same as on the website. */
export default function GoalsScreen() {
  const c = usePalette();
  const call = useRpc();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setGoals(await call<Goal[]>("goals.list"));
      setError(null);
    } catch (e) {
      setError(errorText(e, "Не получилось загрузить"));
    } finally {
      setRefreshing(false);
    }
  }, [call]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const replace = (g: Goal) => setGoals((prev) => prev?.map((x) => (x.id === g.id ? g : x)) ?? prev);
  const drop = (id: string) => setGoals((prev) => prev?.filter((x) => x.id !== id) ?? prev);

  async function create() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      // Like on the website: "Прочитать 12 книг" becomes a goal counted in numbers.
      const guess = guessTarget(t);
      const base = { title: t, why: why.trim() || null };
      const goal = await call<Goal>("goals.create", guess ? { ...base, kind: "number", ...guess } : { ...base, kind: "feeling" });
      setGoals((prev) => [goal, ...(prev ?? [])]);
      setTitle("");
      setWhy("");
      setOpen(goal.id);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const active = (goals ?? []).filter((g) => !g.doneAt);
  const done = (goals ?? []).filter((g) => g.doneAt);
  const guess = guessTarget(title);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <Text style={[styles.title, { color: c.ink }]}>Цели</Text>
        <View style={[styles.newCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.addRow}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Новая цель, например: прочитать 12 книг"
              placeholderTextColor={c.inkTertiary}
              onSubmitEditing={() => void create()}
              returnKeyType="done"
              style={[styles.addInput, { color: c.ink }]}
            />
            <Pressable
              onPress={() => void create()}
              disabled={!title.trim() || busy}
              style={[styles.round, { backgroundColor: c.accent, opacity: title.trim() ? 1 : 0.5 }]}
            >
              <Text style={[styles.roundText, { color: c.onAccent }]}>+</Text>
            </Pressable>
          </View>
          {title.trim() ? (
            <>
              <TextInput
                value={why}
                onChangeText={setWhy}
                placeholder="Зачем это вам? (необязательно)"
                placeholderTextColor={c.inkTertiary}
                maxLength={300}
                style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
              />
              <Text style={[styles.meta, { color: c.inkSecondary }]}>
                {guess
                  ? `Будем считать числом: ${formatAmount(guess.target)} ${guess.unit}`
                  : "Будем оценивать по ощущениям — способ можно поменять в цели"}
              </Text>
            </>
          ) : null}
        </View>

        {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}
        {!goals && !error ? <ActivityIndicator color={c.accent} /> : null}
        {goals && goals.length === 0 ? (
          <Text style={[styles.empty, { color: c.inkSecondary }]}>Запишите первую цель — разбейте на шаги и отмечайте, что уже сделано.</Text>
        ) : null}

        {active.map((g) => (
          <GoalCard key={g.id} goal={g} open={open === g.id} onToggle={() => setOpen(open === g.id ? null : g.id)} onChange={replace} onDelete={drop} />
        ))}
        {done.length > 0 ? <Text style={[styles.section, { color: c.inkTertiary }]}>ДОСТИГНУТЫ · {done.length}</Text> : null}
        {done.map((g) => (
          <GoalCard key={g.id} goal={g} open={open === g.id} onToggle={() => setOpen(open === g.id ? null : g.id)} onChange={replace} onDelete={drop} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function GoalCard(props: { goal: Goal; open: boolean; onToggle: () => void; onChange: (g: Goal) => void; onDelete: (id: string) => void }) {
  const { goal, open, onToggle, onChange, onDelete } = props;
  const c = usePalette();
  const call = useRpc();
  const progress = goalProgress(goal);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState("");
  const [measuring, setMeasuring] = useState(false);
  const [target, setTarget] = useState(goal.target ? String(goal.target) : "");
  const [unit, setUnit] = useState(goal.unit ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const numeric = goal.kind === "number";
  const stepsDone = goal.steps.filter((s) => s.done).length;

  async function run(fn: string, ...args: unknown[]) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await call<Goal>(fn, ...args));
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addEntry() {
    if (!text.trim() && !amount.trim()) return;
    const n = Number(amount.replace(",", "."));
    const ok = await run("goals.addEntry", goal.id, {
      text: text.trim() || (numeric && amount ? `+${amount}` : ""),
      amount: numeric && amount && Number.isFinite(n) ? n : null,
    });
    if (ok) {
      setText("");
      setAmount("");
    }
  }

  async function addStep() {
    if (!step.trim()) return;
    if (await run("goals.addStep", goal.id, step.trim())) setStep("");
  }

  async function saveMeasure(kind: GoalKind) {
    const ok = await run(
      "goals.setMeasure",
      goal.id,
      kind === "number" ? { kind, target: Number(target.replace(",", ".")), unit: unit.trim() || null } : { kind },
    );
    if (ok) setMeasuring(false);
  }

  function remove() {
    confirmAsk(`Удалить цель «${goal.title}»?`, "Шаги и записи тоже удалятся.", "Удалить", async () => {
      try {
        await call("goals.delete", goal.id);
        onDelete(goal.id);
      } catch (e) {
        setError(errorText(e));
      }
    });
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, opacity: goal.doneAt ? 0.8 : 1 }]}>
      <Pressable onPress={onToggle} style={{ gap: 8 }}>
        <View style={styles.cardHead}>
          <Text style={[styles.goalTitle, { color: c.ink }]}>{goal.doneAt ? "🏆 " : ""}{goal.title}</Text>
          <Text style={[styles.chev, { color: c.inkTertiary }]}>{open ? "⌃" : "⌄"}</Text>
        </View>
        <View style={[styles.track, { backgroundColor: c.track }]}>
          <View style={[styles.fill, { backgroundColor: goal.doneAt ? c.success : c.accent, width: `${Math.round((goal.doneAt ? 1 : progress.ratio ?? 0) * 100)}%` }]} />
        </View>
        <Text style={[styles.meta, { color: c.inkSecondary }]}>
          {goal.doneAt ? "Цель достигнута" : progress.label}
          {goal.steps.length ? ` · шаги ${stepsDone}/${goal.steps.length}` : ""}
          {goal.deadline ? ` · до ${format(fromDateKey(goal.deadline), "d MMMM", { locale: ru })}` : ""}
        </Text>
      </Pressable>

      {open ? (
        <View style={styles.details}>
          {goal.why ? <Text style={[styles.why, { color: c.inkSecondary }]}>Зачем: {goal.why}</Text> : null}

          {/* How progress is measured */}
          {!goal.doneAt && !numeric ? (
            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: c.inkSecondary }]}>Насколько вы ближе к цели?</Text>
              <View style={styles.scale}>
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => {
                  const on = (goal.selfProgress ?? -1) >= v && goal.selfProgress !== null;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => void run("goals.setSelfProgress", goal.id, v)}
                      style={[styles.scaleCell, { backgroundColor: on ? c.accent : c.track }]}
                      accessibilityLabel={`${v}%`}
                    />
                  );
                })}
              </View>
              <Text style={[styles.small, { color: c.inkTertiary }]}>
                {goal.selfProgress === null ? "Нажмите на шкалу" : `${goal.selfProgress}% по вашей оценке`}
              </Text>
            </View>
          ) : null}

          {measuring ? (
            <View style={[styles.box, { borderColor: c.border, backgroundColor: c.surfaceMuted }]}>
              <Text style={[styles.label, { color: c.inkSecondary }]}>Сколько нужно</Text>
              <View style={styles.row}>
                <TextInput
                  value={target}
                  onChangeText={setTarget}
                  placeholder="12"
                  keyboardType="decimal-pad"
                  placeholderTextColor={c.inkTertiary}
                  style={[styles.amount, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
                />
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="книг, км, раз…"
                  placeholderTextColor={c.inkTertiary}
                  maxLength={20}
                  style={[styles.entryInput, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
                />
              </View>
              <View style={styles.rowWrap}>
                <Chip title="Сохранить числом" on onPress={() => void saveMeasure("number")} />
                <Chip title="По ощущениям" onPress={() => void saveMeasure("feeling")} />
                <Chip title="Отмена" onPress={() => setMeasuring(false)} />
              </View>
            </View>
          ) : !goal.doneAt ? (
            <Pressable onPress={() => setMeasuring(true)} hitSlop={6}>
              <Text style={[styles.link, { color: c.accent }]}>
                {numeric ? "Изменить, сколько нужно" : "Считать в цифрах"}
              </Text>
            </Pressable>
          ) : null}

          {/* Steps */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: c.inkSecondary }]}>Шаги</Text>
            {goal.steps.map((s) => (
              <View key={s.id} style={styles.stepRow}>
                <Pressable
                  onPress={() => void run("goals.toggleStep", s.id)}
                  style={[styles.check, { borderColor: s.done ? c.success : c.inkTertiary, backgroundColor: s.done ? c.success : "transparent" }]}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Шаг: ${s.title}`}
                  accessibilityState={{ checked: s.done }}
                >
                  {s.done ? <Text style={styles.checkMark}>✓</Text> : null}
                </Pressable>
                <Text style={[styles.stepText, { color: s.done ? c.inkTertiary : c.ink }, s.done && styles.struck]}>{s.title}</Text>
                <Pressable onPress={() => void run("goals.deleteStep", s.id)} hitSlop={8}>
                  <Text style={{ color: c.inkTertiary, fontSize: 18 }}>×</Text>
                </Pressable>
              </View>
            ))}
            {!goal.doneAt ? (
              <View style={styles.row}>
                <TextInput
                  value={step}
                  onChangeText={setStep}
                  onSubmitEditing={() => void addStep()}
                  placeholder="Новый шаг"
                  placeholderTextColor={c.inkTertiary}
                  style={[styles.entryInput, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
                />
                <Pressable onPress={() => void addStep()} style={[styles.round, { backgroundColor: c.accent, opacity: step.trim() ? 1 : 0.5 }]}>
                  <Text style={[styles.roundText, { color: c.onAccent }]}>+</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* What was done */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: c.inkSecondary }]}>Что сделано</Text>
            {!goal.doneAt ? (
              <View style={styles.row}>
                {numeric ? (
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder={goal.unit ? `+ ${goal.unit}` : "+ сколько"}
                    placeholderTextColor={c.inkTertiary}
                    keyboardType="decimal-pad"
                    style={[styles.amount, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
                  />
                ) : null}
                <TextInput
                  value={text}
                  onChangeText={setText}
                  onSubmitEditing={() => void addEntry()}
                  placeholder="Что получилось?"
                  placeholderTextColor={c.inkTertiary}
                  style={[styles.entryInput, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
                />
                <Pressable onPress={() => void addEntry()} style={[styles.round, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
                  <Text style={[styles.roundText, { color: c.onAccent }]}>✓</Text>
                </Pressable>
              </View>
            ) : null}
            {goal.entries.slice(0, 12).map((e) => (
              <View key={e.id} style={styles.stepRow}>
                <Text style={[styles.entry, { color: c.ink }]}>
                  <Text style={{ color: c.inkTertiary }}>{format(new Date(e.createdAt), "d MMM", { locale: ru })} · </Text>
                  {e.amount !== null ? `+${formatAmount(e.amount)}${goal.unit ? ` ${goal.unit}` : ""} ` : ""}
                  {e.text}
                </Text>
                <Pressable onPress={() => void run("goals.deleteEntry", e.id)} hitSlop={8}>
                  <Text style={{ color: c.inkTertiary, fontSize: 18 }}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>

          {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}

          <View style={styles.rowWrap}>
            <Pressable
              onPress={() => void run("goals.setDone", goal.id, !goal.doneAt)}
              style={[styles.pill, { borderColor: goal.doneAt ? c.border : c.success }]}
            >
              <Text style={{ color: goal.doneAt ? c.inkSecondary : c.success, fontWeight: "700" }}>
                {goal.doneAt ? "Вернуть в работу" : "Цель достигнута 🎉"}
              </Text>
            </Pressable>
            <Pressable onPress={remove} style={[styles.pill, { borderColor: c.border }]}>
              <Text style={{ color: c.danger, fontWeight: "700" }}>Удалить</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Chip({ title, onPress, on }: { title: string; onPress: () => void; on?: boolean }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} style={[styles.chip, on ? { backgroundColor: c.accent } : { borderWidth: 1, borderColor: c.border }]}>
      <Text style={{ color: on ? c.onAccent : c.ink, fontWeight: "700", fontSize: 13 }}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 120, gap: 14 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1, marginTop: 6 },
  newCard: { borderWidth: 1, borderRadius: radius.md, padding: 6, paddingLeft: 14, gap: 8 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15, marginRight: 8 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  roundText: { fontSize: 20, fontWeight: "700" },
  empty: { fontSize: 15, textAlign: "center", marginTop: 20, lineHeight: 21 },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, paddingLeft: 4, marginTop: 6 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 12 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  goalTitle: { flex: 1, fontSize: 17, fontWeight: "700" },
  chev: { fontSize: 18 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  meta: { fontSize: 13, paddingBottom: 4 },
  details: { gap: 14 },
  why: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  small: { fontSize: 13 },
  link: { fontSize: 14, fontWeight: "700" },
  scale: { flexDirection: "row", gap: 4 },
  scaleCell: { flex: 1, height: 26, borderRadius: 6 },
  box: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 10 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  rowWrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "900" },
  stepText: { flex: 1, fontSize: 15 },
  struck: { textDecorationLine: "line-through" },
  amount: { width: 84, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15 },
  entryInput: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15 },
  entry: { flex: 1, fontSize: 14, lineHeight: 20 },
  pill: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
});
