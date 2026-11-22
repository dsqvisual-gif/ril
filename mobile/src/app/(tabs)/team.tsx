import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { fromDateKey, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";

type Summary = { id: string; name: string; role: string; memberCount: number };
type Invitation = { memberId: string; companyId: string; companyName: string; invitedBy: string | null };
type Member = { id: string; userId: string; name: string; username: string | null; role: string; status: string };
type CTask = { id: string; title: string; assigneeId: string | null; deadline: string | null; status: "todo" | "doing" | "done"; important: boolean };
type View_ = { company: { id: string; name: string }; me: { userId: string; role: string }; members: Member[]; tasks: CTask[] };

const STATUS: Record<CTask["status"], { label: string; next: CTask["status"]; color: string }> = {
  todo: { label: "К работе", next: "doing", color: "#8e8e93" },
  doing: { label: "В работе", next: "done", color: "#007aff" },
  done: { label: "Готово", next: "todo", color: "#34c759" },
};

/** Teams, as on the website: companies, invitations, tasks with owners and deadlines. */
export default function TeamScreen() {
  const c = usePalette();
  const call = useRpc();
  const [list, setList] = useState<{ companies: Summary[]; invitations: Invitation[] } | null>(null);
  const [view, setView] = useState<View_ | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // The open company, kept across reloads.
  const openId = useRef<string | null>(null);
  useEffect(() => {
    openId.current = view?.company.id ?? null;
  }, [view]);

  const load = useCallback(async () => {
    try {
      const l = await call<{ companies: Summary[]; invitations: Invitation[] }>("company.list");
      setList(l);
      const id = openId.current ?? l.companies[0]?.id;
      setView(id ? await call<View_>("company.view", id) : null);
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

  async function run<T>(task: () => Promise<T>) {
    try {
      setError(null);
      return await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
    }
  }

  const memberName = (id: string | null) => view?.members.find((m) => m.userId === id)?.name ?? "без исполнителя";

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <Text style={[styles.title, { color: c.ink }]}>Команда</Text>
        {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}
        {!list && !error ? <ActivityIndicator color={c.accent} /> : null}

        {list?.invitations.map((inv) => (
          <View key={inv.memberId} style={[styles.card, { backgroundColor: c.tintWarn, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.ink }]}>Приглашение в «{inv.companyName}»</Text>
            {inv.invitedBy ? <Text style={{ color: c.inkSecondary }}>от {inv.invitedBy}</Text> : null}
            <View style={styles.row}>
              <Btn title="Принять" onPress={() => void run(async () => { await call("company.respond", inv.memberId, true); await load(); })} />
              <Btn title="Отклонить" ghost onPress={() => void run(async () => { await call("company.respond", inv.memberId, false); await load(); })} />
            </View>
          </View>
        ))}

        {list && list.companies.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {list.companies.map((co) => (
              <Pressable
                key={co.id}
                onPress={() => void run(async () => setView(await call<View_>("company.view", co.id)))}
                style={[styles.chip, { backgroundColor: view?.company.id === co.id ? c.accent : c.surface, borderColor: c.border }]}
              >
                <Text style={{ color: view?.company.id === co.id ? "#fff" : c.ink, fontWeight: "700" }}>{co.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {list && list.companies.length === 0 ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.ink }]}>У вас пока нет команды</Text>
            <Text style={{ color: c.inkSecondary, lineHeight: 20 }}>
              Создайте компанию — и добавляйте людей по нику, раздавайте задачи со сроками.
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Название, например: Студия Uspeyka"
              placeholderTextColor={c.inkTertiary}
              style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
            />
            <Btn
              title="Создать команду"
              onPress={() =>
                void run(async () => {
                  if (!draft.trim()) return;
                  setView(await call<View_>("company.create", draft.trim()));
                  setDraft("");
                  await load();
                })
              }
            />
          </View>
        ) : null}

        {view ? (
          <>
            <Text style={[styles.company, { color: c.ink }]}>{view.company.name}</Text>
            <Text style={{ color: c.inkSecondary, marginTop: -8 }}>
              {view.members.filter((m) => m.status === "active").map((m) => m.name).join(", ")}
            </Text>
            <View style={[styles.addRow, { backgroundColor: c.surface, borderColor: c.border }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Новая задача для команды"
                placeholderTextColor={c.inkTertiary}
                style={[styles.addInput, { color: c.ink }]}
              />
              <Pressable
                onPress={() =>
                  void run(async () => {
                    if (!draft.trim()) return;
                    setView(await call<View_>("company.createTask", view.company.id, { title: draft.trim(), assigneeId: view.me.userId, startDate: todayKey() }));
                    setDraft("");
                  })
                }
                style={[styles.plus, { backgroundColor: c.accent }]}
              >
                <Text style={styles.plusText}>+</Text>
              </Pressable>
            </View>
            {view.tasks.length === 0 ? <Text style={{ color: c.inkSecondary }}>Задач пока нет.</Text> : null}
            {view.tasks.map((t) => {
              const s = STATUS[t.status];
              return (
                <View key={t.id} style={[styles.task, { backgroundColor: c.surface, borderColor: t.important ? "#f0b429" : c.border }]}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.taskTitle, { color: t.status === "done" ? c.inkTertiary : c.ink }, t.status === "done" && styles.struck]}>
                      {t.title}
                    </Text>
                    <Text style={{ color: c.inkSecondary, fontSize: 13 }}>
                      {memberName(t.assigneeId)}
                      {t.deadline ? ` · до ${format(fromDateKey(t.deadline), "d MMM", { locale: ru })}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void run(async () => setView(await call<View_>("company.updateTask", t.id, { status: s.next })))}
                    style={[styles.status, { borderColor: s.color }]}
                    accessibilityLabel={`Статус: ${s.label}. Нажмите, чтобы сменить`}
                  >
                    <Text style={{ color: s.color, fontWeight: "700", fontSize: 13 }}>{s.label}</Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Btn({ title, onPress, ghost }: { title: string; onPress: () => void; ghost?: boolean }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} style={[styles.btn, ghost ? { borderWidth: 1.5, borderColor: c.accent } : { backgroundColor: c.accent }]}>
      <Text style={{ color: ghost ? c.accent : "#fff", fontWeight: "800" }}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1, marginTop: 6 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  row: { flexDirection: "row", gap: 10 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: radius.pill, alignItems: "center", alignSelf: "flex-start" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  company: { fontSize: 22, fontWeight: "800" },
  addRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, gap: 8 },
  addInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  plus: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  plusText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  task: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radius.md, padding: 14 },
  taskTitle: { fontSize: 16, fontWeight: "600" },
  struck: { textDecorationLine: "line-through" },
  status: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
});
