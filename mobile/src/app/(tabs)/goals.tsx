import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { confirmAsk, errorText } from "@/components/dialogs";
import { Button, DateField, Icon, Segmented, SectionLabel, Tag } from "@/components/ui";
import { formatAmount, GOAL_KINDS, goalProgress, guessTarget, type GoalKind } from "@/shared/goal-progress";
import { fromDateKey, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";
import { Mascot } from "@/components/Mascot";

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

function plural(n: number, [one, few, many]: [string, string, string]) {
  const d = n % 10;
  const t = n % 100;
  if (d === 1 && t !== 11) return one;
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return few;
  return many;
}

/** Goals, laid out like the website: a short form, then one card per goal. */
export default function GoalsScreen() {
  const c = usePalette();
  const call = useRpc();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
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

  async function setDone(goal: Goal, done: boolean) {
    try {
      replace(await call<Goal>("goals.setDone", goal.id, done));
      if (done) setOpenId(null);
    } catch (e) {
      setError(errorText(e));
    }
  }

  function remove(goal: Goal) {
    confirmAsk(`Удалить цель «${goal.title}»?`, "Шаги и записи удалятся вместе с ней.", "Удалить", async () => {
      try {
        await call("goals.delete", goal.id);
        drop(goal.id);
      } catch (e) {
        setError(errorText(e));
      }
    });
  }

  const active = (goals ?? []).filter((g) => !g.doneAt);
  const achieved = (goals ?? []).filter((g) => g.doneAt);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <View style={{ gap: 4 }}>
          <Text style={[styles.title, { color: c.ink }]}>Цели</Text>
          <Text style={[styles.lead, { color: c.inkSecondary }]}>
            Запиши, к чему идёшь, выбери, как считать прогресс, и отмечай, что уже сделано.
          </Text>
        </View>

        <NewGoal
          onCreate={async (input) => {
            const goal = await call<Goal>("goals.create", input);
            setGoals((prev) => [goal, ...(prev ?? [])]);
            setOpenId(goal.id);
          }}
        />

        {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
        {!goals && !error ? <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} /> : null}

        {goals && goals.length === 0 ? (
          <View style={styles.empty}>
            <Mascot width={100} bubble />
            <Text style={[styles.emptyTitle, { color: c.ink }]}>Пока ни одной цели</Text>
            <Text style={[styles.emptyText, { color: c.inkSecondary }]}>
              Начни с чего-то конкретного: «Прочитать 5 книг», «Пробежать 10 км», «Выучить 300 слов».
            </Text>
          </View>
        ) : null}

        {active.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            open={openId === g.id}
            onToggle={() => setOpenId((id) => (id === g.id ? null : g.id))}
            onChange={replace}
            onDone={() => void setDone(g, true)}
            onDelete={() => remove(g)}
          />
        ))}

        {achieved.length > 0 ? (
          <View style={{ gap: 8, marginTop: 6 }}>
            <SectionLabel>Достигнуто · {achieved.length}</SectionLabel>
            {achieved.map((g) => (
              <View key={g.id} style={[styles.achieved, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={[styles.trophy, { backgroundColor: "rgba(240,180,41,0.18)" }]}>
                  <Icon name="trophy" color="#d99a06" size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.achievedTitle, { color: c.ink }]} numberOfLines={2}>
                    {g.title}
                  </Text>
                  <Text style={[styles.muted, { color: c.inkSecondary }]}>
                    {format(new Date(g.doneAt!), "d MMMM yyyy", { locale: ru })}
                    {g.entries.length ? ` · ${g.entries.length} ${plural(g.entries.length, ["запись", "записи", "записей"])}` : ""}
                  </Text>
                </View>
                <Pressable onPress={() => void setDone(g, false)} hitSlop={6}>
                  <Text style={[styles.link, { color: c.accent }]}>Вернуть</Text>
                </Pressable>
                <Pressable onPress={() => remove(g)} hitSlop={8} accessibilityLabel="Удалить цель">
                  <Icon name="close" color={c.inkTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type NewGoalInput = { title: string; why: string | null; deadline: string | null; kind: GoalKind; target?: number; unit?: string | null };

function NewGoal({ onCreate }: { onCreate: (input: NewGoalInput) => Promise<void> }) {
  const c = usePalette();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<GoalKind>("feeling");
  const [kindTouched, setKindTouched] = useState(false);
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [more, setMore] = useState(false);
  const [why, setWhy] = useState("");
  const [deadline, setDeadline] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Прочитать 5 книг" — the number and unit are picked up from the title, as on the site.
  function onTitle(text: string) {
    setTitle(text);
    if (kindTouched) return;
    const guess = guessTarget(text);
    setKind(guess ? "number" : "feeling");
    setTarget(guess ? String(guess.target) : "");
    setUnit(guess?.unit ?? "");
  }

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const n = Number(target.replace(",", "."));
      await onCreate({
        title: title.trim(),
        why: why.trim() || null,
        deadline,
        kind,
        ...(kind === "number" ? { target: n, unit: unit.trim() || null } : {}),
      });
      setTitle("");
      setWhy("");
      setDeadline(null);
      setTarget("");
      setUnit("");
      setKind("feeling");
      setKindTouched(false);
      setMore(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const hint = GOAL_KINDS.find((k) => k.id === kind)?.hint;

  return (
    <View style={[styles.card, styles.form, { backgroundColor: c.surface, borderColor: c.border }]}>
      <TextInput
        value={title}
        onChangeText={onTitle}
        placeholder="Новая цель — например, «Прочитать 5 книг»"
        placeholderTextColor={c.inkTertiary}
        maxLength={140}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
      />
      {title.trim() ? (
        <>
          <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: c.inkSecondary }]}>Прогресс считать</Text>
            <Segmented
              items={GOAL_KINDS.map((k) => ({ id: k.id, label: k.label }))}
              value={kind}
              onChange={(k) => {
                setKind(k);
                setKindTouched(true);
              }}
            />
            {kind === "number" ? (
              <View style={styles.row}>
                <TextInput
                  value={target}
                  onChangeText={setTarget}
                  placeholder="5"
                  keyboardType="decimal-pad"
                  placeholderTextColor={c.inkTertiary}
                  style={[styles.input, styles.amount, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
                />
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="книг, км, слов"
                  placeholderTextColor={c.inkTertiary}
                  maxLength={20}
                  style={[styles.input, styles.grow, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
                />
              </View>
            ) : null}
            <Text style={[styles.hint, { color: c.inkSecondary }]}>{hint}</Text>
          </View>

          {more ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: c.inkSecondary }]}>Зачем</Text>
              <TextInput
                value={why}
                onChangeText={setWhy}
                placeholder="Чтобы не забыть, ради чего стараешься"
                placeholderTextColor={c.inkTertiary}
                maxLength={300}
                multiline
                style={[styles.input, styles.multiline, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
              />
              <Text style={[styles.label, { color: c.inkSecondary }]}>Срок</Text>
              <DateField value={deadline} onChange={setDeadline} min={todayKey()} />
            </View>
          ) : (
            <Pressable onPress={() => setMore(true)} hitSlop={6}>
              <Text style={[styles.link, { color: c.accent }]}>+ срок и зачем</Text>
            </Pressable>
          )}
        </>
      ) : null}
      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
      <Button title="Добавить" onPress={() => void submit()} disabled={!title.trim()} busy={busy} full />
    </View>
  );
}

function GoalCard(props: {
  goal: Goal;
  open: boolean;
  onToggle: () => void;
  onChange: (g: Goal) => void;
  onDone: () => void;
  onDelete: () => void;
}) {
  const { goal, open, onToggle, onChange, onDone, onDelete } = props;
  const c = usePalette();
  const call = useRpc();
  const progress = goalProgress(goal);
  const percent = progress.ratio === null ? null : Math.round(progress.ratio * 100);
  const [step, setStep] = useState("");
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [editMeasure, setEditMeasure] = useState(false);
  const [mKind, setMKind] = useState<GoalKind>(goal.kind);
  const [mTarget, setMTarget] = useState(goal.target ? String(goal.target) : "");
  const [mUnit, setMUnit] = useState(goal.unit ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const numeric = goal.kind === "number";

  async function run(key: string, fn: string, ...args: unknown[]) {
    if (busy) return false;
    setBusy(key);
    setError(null);
    try {
      onChange(await call<Goal>(fn, ...args));
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function addStep() {
    if (step.trim() && (await run("step", "goals.addStep", goal.id, step.trim()))) setStep("");
  }

  async function addEntry() {
    const n = Number(amount.replace(",", "."));
    const hasAmount = numeric && amount.trim() !== "" && Number.isFinite(n) && n !== 0;
    if (!text.trim() && !hasAmount) return;
    const ok = await run("entry", "goals.addEntry", goal.id, {
      text: text.trim() || `+${formatAmount(n)}${goal.unit ? ` ${goal.unit}` : ""}`,
      amount: hasAmount ? n : null,
    });
    if (ok) {
      setText("");
      setAmount("");
    }
  }

  async function saveMeasure() {
    const input = mKind === "number" ? { kind: mKind, target: Number(mTarget.replace(",", ".")), unit: mUnit.trim() || null } : { kind: mKind };
    if (await run("measure", "goals.setMeasure", goal.id, input)) setEditMeasure(false);
  }

  const daysLeft = goal.deadline ? differenceInCalendarDays(fromDateKey(goal.deadline), new Date()) : null;
  const sub = [progress.ratio === null ? progress.label : numeric ? progress.label : "по твоей оценке"];
  if (goal.entries.length) sub.push(`${goal.entries.length} ${plural(goal.entries.length, ["запись", "записи", "записей"])}`);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Pressable onPress={onToggle} style={styles.head} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[styles.goalTitle, { color: c.ink }]}>{goal.title}</Text>
          {goal.deadline ? (
            <Tag
              tone={daysLeft !== null && daysLeft < 0 ? "danger" : daysLeft !== null && daysLeft <= 7 ? "warn" : "accent"}
              text={`до ${format(fromDateKey(goal.deadline), "d MMM", { locale: ru })}${
                daysLeft === null ? "" : daysLeft < 0 ? " · срок прошёл" : daysLeft === 0 ? " · сегодня" : ` · ${daysLeft} ${plural(daysLeft, ["день", "дня", "дней"])}`
              }`}
            />
          ) : null}
          <Text style={[styles.muted, { color: c.inkSecondary }]}>{sub.join(" · ")}</Text>
        </View>
        {percent !== null ? <Text style={[styles.percent, { color: c.accent }]}>{percent}%</Text> : null}
        <Icon name={open ? "chevron-up" : "chevron-down"} color={c.inkTertiary} />
      </Pressable>
      <View style={[styles.track, { backgroundColor: c.track }]}>
        <View style={[styles.fill, { backgroundColor: percent !== null && percent >= 100 ? c.success : c.accent, width: `${percent ?? 0}%` }]} />
      </View>

      {open ? (
        <View style={styles.body}>
          {goal.why ? (
            <View style={[styles.why, { backgroundColor: c.tintWarn }]}>
              <Text style={{ color: c.warnInk, fontSize: 14, lineHeight: 20 }}>
                <Text style={{ fontWeight: "700" }}>Зачем: </Text>
                {goal.why}
              </Text>
            </View>
          ) : null}

          {!numeric ? (
            <View style={styles.block}>
              <SectionLabel>Насколько ты ближе к цели</SectionLabel>
              <View style={styles.scale}>
                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => {
                  const on = goal.selfProgress !== null && goal.selfProgress >= v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => void run("feeling", "goals.setSelfProgress", goal.id, goal.selfProgress === v ? v - 10 : v)}
                      style={[styles.scaleCell, { backgroundColor: on ? c.accent : c.track }]}
                      accessibilityLabel={`${v}%`}
                    />
                  );
                })}
              </View>
              <Text style={[styles.hint, { color: c.inkSecondary }]}>
                {goal.selfProgress === null ? "Нажми на шкалу — честно отметь, как ощущаешь движение." : `${goal.selfProgress}% — можно менять в любой момент.`}
              </Text>
            </View>
          ) : null}

          <View style={styles.block}>
            <SectionLabel>План по шагам</SectionLabel>
            {goal.steps.map((s, i) => (
              <View key={s.id} style={styles.stepRow}>
                <Pressable
                  onPress={() => void run(s.id, "goals.toggleStep", s.id)}
                  hitSlop={6}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Шаг: ${s.title}`}
                  accessibilityState={{ checked: s.done }}
                  style={[styles.check, { borderColor: s.done ? c.success : c.inkTertiary, backgroundColor: s.done ? c.success : "transparent" }]}
                >
                  {s.done ? <Icon name="checkmark" color="#fff" size={15} /> : null}
                </Pressable>
                <Tag tone="accent" text={`Шаг ${i + 1}`} />
                <Text style={[styles.stepText, { color: s.done ? c.inkTertiary : c.ink }, s.done && styles.struck]}>{s.title}</Text>
                <Pressable onPress={() => void run(s.id, "goals.deleteStep", s.id)} hitSlop={8} accessibilityLabel={`Удалить шаг ${i + 1}`}>
                  <Icon name="close" color={c.inkTertiary} size={17} />
                </Pressable>
              </View>
            ))}
            <View style={styles.row}>
              <TextInput
                value={step}
                onChangeText={setStep}
                onSubmitEditing={() => void addStep()}
                placeholder={`Шаг ${goal.steps.length + 1} — что нужно сделать`}
                placeholderTextColor={c.inkTertiary}
                maxLength={140}
                style={[styles.input, styles.grow, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
              />
              <Button title="Добавить" kind="secondary" small onPress={() => void addStep()} disabled={!step.trim()} busy={busy === "step"} />
            </View>
          </View>

          <View style={styles.block}>
            <SectionLabel>Что сделано</SectionLabel>
            {numeric ? (
              <View style={styles.row}>
                <Text style={{ color: c.accent, fontSize: 18, fontWeight: "800" }}>+</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={c.inkTertiary}
                  style={[styles.input, styles.amount, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
                />
                <Text style={{ color: c.inkSecondary, fontSize: 15 }}>{goal.unit ?? ""}</Text>
              </View>
            ) : null}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Что сегодня сделано для этой цели?"
              placeholderTextColor={c.inkTertiary}
              maxLength={500}
              multiline
              style={[styles.input, styles.multiline, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
            />
            <Button title="Записать" onPress={() => void addEntry()} busy={busy === "entry"} disabled={!text.trim() && !amount.trim()} full />
            {goal.entries.slice(0, 20).map((e) => (
              <View key={e.id} style={styles.entry}>
                <View style={[styles.dot, { backgroundColor: c.accent }]} />
                <Text style={[styles.entryText, { color: c.ink }]}>
                  <Text style={{ color: c.inkTertiary }}>{format(new Date(e.createdAt), "d MMM", { locale: ru })}   </Text>
                  {e.amount !== null ? <Text style={{ color: c.success, fontWeight: "800" }}>+{formatAmount(e.amount)} </Text> : null}
                  {e.text}
                </Text>
                <Pressable onPress={() => void run(e.id, "goals.deleteEntry", e.id)} hitSlop={8} accessibilityLabel="Удалить запись">
                  <Icon name="close" color={c.inkTertiary} size={16} />
                </Pressable>
              </View>
            ))}
          </View>

          {editMeasure ? (
            <View style={[styles.measure, { backgroundColor: c.surfaceMuted }]}>
              <Segmented items={GOAL_KINDS.map((k) => ({ id: k.id, label: k.label }))} value={mKind} onChange={setMKind} />
              {mKind === "number" ? (
                <View style={styles.row}>
                  <TextInput
                    value={mTarget}
                    onChangeText={setMTarget}
                    placeholder="5"
                    keyboardType="decimal-pad"
                    placeholderTextColor={c.inkTertiary}
                    style={[styles.input, styles.amount, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
                  />
                  <TextInput
                    value={mUnit}
                    onChangeText={setMUnit}
                    placeholder="книг, км, слов"
                    placeholderTextColor={c.inkTertiary}
                    style={[styles.input, styles.grow, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
                  />
                </View>
              ) : null}
              <Text style={[styles.hint, { color: c.inkSecondary }]}>{GOAL_KINDS.find((k) => k.id === mKind)?.hint}</Text>
              <View style={styles.row}>
                <Button title="Сохранить" kind="secondary" small onPress={() => void saveMeasure()} busy={busy === "measure"} disabled={mKind === "number" && !(Number(mTarget.replace(",", ".")) > 0)} />
                <Pressable onPress={() => setEditMeasure(false)} hitSlop={6}>
                  <Text style={[styles.link, { color: c.inkSecondary }]}>Отмена</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setEditMeasure(true)} hitSlop={6}>
              <Text style={[styles.measureLink, { color: c.accent }]}>
                Как считается прогресс: {GOAL_KINDS.find((k) => k.id === goal.kind)?.label.toLowerCase()}
                {numeric && goal.target ? ` (${formatAmount(goal.target)}${goal.unit ? ` ${goal.unit}` : ""})` : ""} · изменить
              </Text>
            </Pressable>
          )}

          {percent !== null && percent >= 100 ? (
            <Text style={[styles.reached, { color: c.success }]}>Похоже, цель достигнута — отметь это!</Text>
          ) : null}
          {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

          <View style={[styles.footer, { borderTopColor: c.border }]}>
            <Pressable onPress={onDone} style={[styles.doneBtn, { backgroundColor: c.success }]}>
              <Icon name="trophy-outline" color="#fff" size={17} />
              <Text style={styles.doneText}>Цель достигнута</Text>
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={6}>
              <Text style={[styles.link, { color: c.danger }]}>Удалить цель</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 120, gap: 14 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1, marginTop: 6 },
  lead: { fontSize: 15, lineHeight: 21 },
  error: { fontWeight: "600", fontSize: 14 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 12 },
  form: { gap: 14 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  amount: { width: 90, textAlign: "center" },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 13, fontWeight: "700" },
  hint: { fontSize: 13, lineHeight: 18 },
  link: { fontSize: 14, fontWeight: "700" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 20 },
  mascot: { width: 120, height: 140 },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 300 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  goalTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  percent: { fontSize: 17, fontWeight: "800" },
  muted: { fontSize: 13 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  body: { gap: 18, paddingTop: 4 },
  why: { borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  block: { gap: 10 },
  scale: { flexDirection: "row", gap: 4 },
  scaleCell: { flex: 1, height: 28, borderRadius: 6 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 34 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  stepText: { flex: 1, fontSize: 15, lineHeight: 20 },
  struck: { textDecorationLine: "line-through" },
  entry: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  entryText: { flex: 1, fontSize: 14, lineHeight: 20 },
  measure: { borderRadius: radius.md, padding: 12, gap: 10 },
  measureLink: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  reached: { fontSize: 15, fontWeight: "800", textAlign: "center" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
  doneBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 18, minHeight: 44, borderRadius: radius.pill },
  doneText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  achieved: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radius.md, padding: 12 },
  trophy: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  achievedTitle: { fontSize: 15, fontWeight: "700" },
});
