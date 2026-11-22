import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { goalProgress, guessTarget } from "@/shared/goal-progress";
import { fromDateKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";

type Entry = { id: string; text: string; amount: number | null; progress: number | null; createdAt: string };
type Goal = {
  id: string;
  title: string;
  why: string | null;
  deadline: string | null;
  kind: string;
  target: number | null;
  unit: string | null;
  selfProgress: number | null;
  doneAt: string | null;
  entries: Entry[];
};

/** Goals with progress and "что сделано" entries — the same as on the website. */
export default function GoalsScreen() {
  const c = usePalette();
  const call = useRpc();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setGoals(await call<Goal[]>("goals.list"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось загрузить");
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

  async function create() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      // Like on the website: "Прочитать 12 книг" becomes a goal counted in numbers.
      const guess = guessTarget(t);
      const goal = await call<Goal>("goals.create", guess ? { title: t, kind: "number", ...guess } : { title: t, kind: "feeling" });
      setGoals((prev) => [goal, ...(prev ?? [])]);
      setTitle("");
      setOpen(goal.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
    } finally {
      setBusy(false);
    }
  }

  const active = (goals ?? []).filter((g) => !g.doneAt);
  const done = (goals ?? []).filter((g) => g.doneAt);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <Text style={[styles.title, { color: c.ink }]}>Цели</Text>
        <View style={[styles.addRow, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Новая цель, например: прочитать 12 книг"
            placeholderTextColor={c.inkTertiary}
            onSubmitEditing={() => void create()}
            returnKeyType="done"
            style={[styles.addInput, { color: c.ink }]}
          />
          <Pressable onPress={() => void create()} disabled={!title.trim() || busy} style={[styles.addBtn, { backgroundColor: c.accent, opacity: title.trim() ? 1 : 0.5 }]}>
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>

        {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}
        {!goals && !error ? <ActivityIndicator color={c.accent} /> : null}
        {goals && goals.length === 0 ? (
          <Text style={[styles.empty, { color: c.inkSecondary }]}>Запишите первую цель — и отмечайте, что уже сделано.</Text>
        ) : null}

        {active.map((g) => (
          <GoalCard key={g.id} goal={g} open={open === g.id} onToggle={() => setOpen(open === g.id ? null : g.id)} onChange={replace} />
        ))}
        {done.length > 0 ? <Text style={[styles.section, { color: c.inkTertiary }]}>ДОСТИГНУТЫ · {done.length}</Text> : null}
        {done.map((g) => (
          <GoalCard key={g.id} goal={g} open={open === g.id} onToggle={() => setOpen(open === g.id ? null : g.id)} onChange={replace} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function GoalCard({ goal, open, onToggle, onChange }: { goal: Goal; open: boolean; onToggle: () => void; onChange: (g: Goal) => void }) {
  const c = usePalette();
  const call = useRpc();
  const progress = goalProgress(goal);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const numeric = goal.kind === "number";

  async function addEntry() {
    if (busy || (!text.trim() && !amount.trim())) return;
    setBusy(true);
    try {
      const n = Number(amount.replace(",", "."));
      const g = await call<Goal>("goals.addEntry", goal.id, {
        text: text.trim() || (numeric && amount ? `+${amount}` : ""),
        amount: numeric && amount && Number.isFinite(n) ? n : null,
      });
      onChange(g);
      setText("");
      setAmount("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, opacity: goal.doneAt ? 0.75 : 1 }]}>
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
          {goal.deadline ? ` · до ${format(fromDateKey(goal.deadline), "d MMMM", { locale: ru })}` : ""}
        </Text>
      </Pressable>

      {open ? (
        <View style={styles.details}>
          {goal.why ? <Text style={[styles.why, { color: c.inkSecondary }]}>Зачем: {goal.why}</Text> : null}
          {!goal.doneAt ? (
            <View style={styles.entryForm}>
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
                placeholder="Что сделано?"
                placeholderTextColor={c.inkTertiary}
                style={[styles.entryInput, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
              />
              <Pressable onPress={() => void addEntry()} style={[styles.entryBtn, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
                <Text style={styles.addBtnText}>✓</Text>
              </Pressable>
            </View>
          ) : null}
          {goal.entries.slice(0, 8).map((e) => (
            <Text key={e.id} style={[styles.entry, { color: c.ink }]}>
              <Text style={{ color: c.inkTertiary }}>{format(new Date(e.createdAt), "d MMM", { locale: ru })} · </Text>
              {e.amount !== null ? `+${e.amount}${goal.unit ? ` ${goal.unit}` : ""} ` : ""}
              {e.text}
            </Text>
          ))}
          <Pressable
            onPress={async () => onChange(await call<Goal>("goals.setDone", goal.id, !goal.doneAt))}
            style={[styles.doneBtn, { borderColor: goal.doneAt ? c.border : c.success }]}
          >
            <Text style={{ color: goal.doneAt ? c.inkSecondary : c.success, fontWeight: "700" }}>
              {goal.doneAt ? "Вернуть в работу" : "Цель достигнута 🎉"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1, marginTop: 6 },
  addRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, gap: 8 },
  addInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  addBtnText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  empty: { fontSize: 15, textAlign: "center", marginTop: 20 },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, paddingLeft: 4, marginTop: 6 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 12 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  goalTitle: { flex: 1, fontSize: 17, fontWeight: "700" },
  chev: { fontSize: 18 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  meta: { fontSize: 13 },
  details: { gap: 10 },
  why: { fontSize: 14, lineHeight: 20 },
  entryForm: { flexDirection: "row", gap: 8, alignItems: "center" },
  amount: { width: 84, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15 },
  entryInput: { flex: 1, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15 },
  entryBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  entry: { fontSize: 14, lineHeight: 20 },
  doneBtn: { alignSelf: "flex-start", borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
});
