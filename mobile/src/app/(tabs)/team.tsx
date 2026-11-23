import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { addDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { confirmAsk, errorText } from "@/components/dialogs";
import { fromDateKey, toDateKey, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";

type Role = "owner" | "admin" | "member";
type Status = "todo" | "doing" | "done";
type Summary = { id: string; name: string; role: Role; memberCount: number };
type Invitation = { memberId: string; companyId: string; companyName: string; invitedBy: string | null };
type Member = { id: string; userId: string; name: string; username: string | null; role: Role; status: "invited" | "active" };
type CTask = {
  id: string;
  title: string;
  note: string | null;
  assigneeId: string | null;
  creatorId: string;
  startDate: string;
  deadline: string | null;
  status: Status;
  important: boolean;
};
type TeamView = { company: { id: string; name: string }; me: { userId: string; role: Role }; members: Member[]; tasks: CTask[] };
type Lists = { companies: Summary[]; invitations: Invitation[] };

const STATUS: Record<Status, { label: string; color: string }> = {
  todo: { label: "К работе", color: "#8e8e93" },
  doing: { label: "В работе", color: "#007aff" },
  done: { label: "Готово", color: "#34c759" },
};
const ROLE: Record<Role, string> = { owner: "владелец", admin: "админ", member: "участник" };
const isManager = (r: Role) => r === "owner" || r === "admin";

const DEADLINES: { label: string; days: number | null }[] = [
  { label: "Без срока", days: null },
  { label: "Сегодня", days: 0 },
  { label: "Завтра", days: 1 },
  { label: "Через 3 дня", days: 3 },
  { label: "Через неделю", days: 7 },
];
const deadlineFor = (days: number | null) => (days === null ? null : toDateKey(addDays(new Date(), days)));

/** Teams, as on the website: companies, people and roles, tasks with owners and deadlines. */
export default function TeamScreen() {
  const c = usePalette();
  const call = useRpc();
  const [lists, setLists] = useState<Lists | null>(null);
  const [view, setView] = useState<TeamView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [people, setPeople] = useState(false);
  const openId = useRef<string | null>(null);
  useEffect(() => {
    openId.current = view?.company.id ?? null;
  }, [view]);

  const load = useCallback(async () => {
    try {
      const l = await call<Lists>("company.list");
      setLists(l);
      const id = (openId.current && l.companies.some((x) => x.id === openId.current) ? openId.current : null) ?? l.companies[0]?.id;
      setView(id ? await call<TeamView>("company.view", id) : null);
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

  async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    try {
      setError(null);
      return await task();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const noTeams = lists && lists.companies.length === 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <Text style={[styles.title, { color: c.ink }]}>Команда</Text>
        {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}
        {!lists && !error ? <ActivityIndicator color={c.accent} /> : null}

        {lists?.invitations.map((inv) => (
          <View key={inv.memberId} style={[styles.card, { backgroundColor: c.tintWarn, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.ink }]}>Приглашение в «{inv.companyName}»</Text>
            {inv.invitedBy ? <Text style={{ color: c.inkSecondary }}>от {inv.invitedBy}</Text> : null}
            <View style={styles.row}>
              <Btn title="Принять" onPress={() => void run(async () => { openId.current = inv.companyId; await call("company.respond", inv.memberId, true); await load(); })} />
              <Btn title="Отклонить" ghost onPress={() => void run(async () => { await call("company.respond", inv.memberId, false); await load(); })} />
            </View>
          </View>
        ))}

        {lists && lists.companies.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {lists.companies.map((co) => {
              const on = view?.company.id === co.id && !creating;
              return (
                <Pressable
                  key={co.id}
                  onPress={() => void run(async () => { setCreating(false); setPeople(false); setView(await call<TeamView>("company.view", co.id)); })}
                  style={[styles.chip, { backgroundColor: on ? c.accent : c.surface, borderColor: c.border }]}
                >
                  <Text style={{ color: on ? c.onAccent : c.ink, fontWeight: "700" }}>{co.name}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setCreating(true)} style={[styles.chip, { backgroundColor: creating ? c.accent : c.surface, borderColor: c.border }]}>
              <Text style={{ color: creating ? c.onAccent : c.accent, fontWeight: "800" }}>+ Новая</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {noTeams || creating ? (
          <CreateTeam
            first={Boolean(noTeams)}
            onCancel={noTeams ? undefined : () => setCreating(false)}
            onCreate={(name) =>
              run(async () => {
                const v = await call<TeamView>("company.create", name);
                setView(v);
                openId.current = v.company.id;
                setCreating(false);
                setPeople(true);
                setLists(await call<Lists>("company.list"));
              })
            }
          />
        ) : null}

        {view && !creating ? (
          <>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.company, { color: c.ink }]}>{view.company.name}</Text>
                <Text style={{ color: c.inkSecondary }}>
                  {view.members.filter((m) => m.status === "active").length} чел. · вы {ROLE[view.me.role]}
                </Text>
              </View>
              <Pressable onPress={() => setPeople((v) => !v)} style={[styles.chip, { backgroundColor: people ? c.accent : c.surface, borderColor: c.border }]}>
                <Text style={{ color: people ? c.onAccent : c.ink, fontWeight: "700" }}>👥 Люди</Text>
              </Pressable>
            </View>

            {people ? <PeoplePanel view={view} onView={setView} onLeft={() => { openId.current = null; setPeople(false); void load(); }} run={run} /> : null}

            <NewTask view={view} onView={setView} run={run} />

            {view.tasks.length === 0 ? <Text style={{ color: c.inkSecondary }}>Задач пока нет — добавьте первую.</Text> : null}
            {(["todo", "doing", "done"] as Status[]).map((st) => {
              const tasks = view.tasks.filter((t) => t.status === st);
              if (tasks.length === 0) return null;
              return (
                <View key={st} style={{ gap: 8 }}>
                  <Text style={[styles.section, { color: STATUS[st].color }]}>
                    {STATUS[st].label.toUpperCase()} · {tasks.length}
                  </Text>
                  {tasks.map((t) => (
                    <TaskCard key={t.id} task={t} view={view} onView={setView} run={run} />
                  ))}
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type Run = <T>(task: () => Promise<T>) => Promise<T | undefined>;

function CreateTeam({ first, onCreate, onCancel }: { first: boolean; onCreate: (name: string) => Promise<unknown>; onCancel?: () => void }) {
  const c = usePalette();
  const [name, setName] = useState("");
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.cardTitle, { color: c.ink }]}>{first ? "У вас пока нет команды" : "Новая команда"}</Text>
      <Text style={{ color: c.inkSecondary, lineHeight: 20 }}>
        Создайте команду, добавляйте людей по нику и раздавайте задачи со сроками.
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Название, например: Студия Uspeyka"
        placeholderTextColor={c.inkTertiary}
        style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
      />
      <View style={styles.row}>
        <Btn title="Создать команду" disabled={!name.trim()} onPress={() => void onCreate(name.trim()).then(() => setName(""))} />
        {onCancel ? <Btn title="Отмена" ghost onPress={onCancel} /> : null}
      </View>
    </View>
  );
}

function PeoplePanel({ view, onView, onLeft, run }: { view: TeamView; onView: (v: TeamView) => void; onLeft: () => void; run: Run }) {
  const c = usePalette();
  const call = useRpc();
  const [nick, setNick] = useState("");
  const [name, setName] = useState(view.company.name);
  const manager = isManager(view.me.role);
  const owner = view.me.role === "owner";
  const id = view.company.id;
  const mine = view.members.find((m) => m.userId === view.me.userId);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {manager ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: c.inkSecondary }]}>Пригласить по нику</Text>
          <View style={styles.row}>
            <TextInput
              value={nick}
              onChangeText={(t) => setNick(t.replace(/^@/, "").toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="ник, например danil"
              placeholderTextColor={c.inkTertiary}
              style={[styles.input, styles.flex, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
            />
            <Btn
              title="Позвать"
              disabled={nick.length < 3}
              onPress={() => void run(async () => { onView(await call<TeamView>("company.invite", id, nick)); setNick(""); })}
            />
          </View>
        </View>
      ) : null}

      <Text style={[styles.label, { color: c.inkSecondary }]}>Участники</Text>
      {view.members.map((m) => {
        const self = m.userId === view.me.userId;
        const canRemove = !self && m.role !== "owner" && manager && (m.role !== "admin" || owner);
        return (
          <View key={m.id} style={[styles.member, { borderBottomColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.memberName, { color: c.ink }]}>
                {m.name}
                {self ? " (вы)" : ""}
              </Text>
              <Text style={{ color: c.inkSecondary, fontSize: 13 }}>
                {m.username ? `@${m.username} · ` : ""}
                {m.status === "invited" ? "приглашён, ждём ответа" : ROLE[m.role]}
              </Text>
            </View>
            {owner && !self && m.role !== "owner" && m.status === "active" ? (
              <Pressable
                onPress={() => void run(async () => onView(await call<TeamView>("company.setRole", id, m.id, m.role === "admin" ? "member" : "admin")))}
                hitSlop={6}
              >
                <Text style={[styles.action, { color: c.accent }]}>{m.role === "admin" ? "Снять админа" : "Сделать админом"}</Text>
              </Pressable>
            ) : null}
            {canRemove ? (
              <Pressable
                onPress={() =>
                  confirmAsk(`Убрать ${m.name} из команды?`, undefined, "Убрать", () =>
                    void run(async () => {
                      const v = await call<TeamView | null>("company.removeMember", id, m.id);
                      if (v) onView(v);
                    }),
                  )
                }
                hitSlop={6}
              >
                <Text style={[styles.action, { color: c.danger }]}>Убрать</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {manager ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: c.inkSecondary }]}>Название</Text>
          <View style={styles.row}>
            <TextInput
              value={name}
              onChangeText={setName}
              style={[styles.input, styles.flex, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
            />
            <Btn
              title="Сохранить"
              ghost
              disabled={!name.trim() || name.trim() === view.company.name}
              onPress={() => void run(async () => onView(await call<TeamView>("company.rename", id, name.trim())))}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.rowWrap}>
        {!owner && mine ? (
          <Btn
            title="Выйти из команды"
            ghost
            danger
            onPress={() =>
              confirmAsk(`Выйти из «${view.company.name}»?`, undefined, "Выйти", () =>
                void run(async () => {
                  await call("company.removeMember", id, mine.id);
                  onLeft();
                }),
              )
            }
          />
        ) : null}
        {owner ? (
          <Btn
            title="Удалить команду"
            ghost
            danger
            onPress={() =>
              confirmAsk(`Удалить «${view.company.name}»?`, "Все задачи команды удалятся у всех участников.", "Удалить", () =>
                void run(async () => {
                  await call("company.delete", id);
                  onLeft();
                }),
              )
            }
          />
        ) : null}
      </View>
    </View>
  );
}

function AssigneeChips({ view, value, onChange }: { view: TeamView; value: string | null; onChange: (id: string | null) => void }) {
  const c = usePalette();
  const people = view.members.filter((m) => m.status === "active");
  const items: { id: string | null; label: string }[] = [
    ...people.map((m) => ({ id: m.userId, label: m.userId === view.me.userId ? "Я" : m.name.split(" ")[0] })),
    { id: null, label: "Без исполнителя" },
  ];
  return (
    <View style={styles.rowWrap}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <Pressable key={it.id ?? "none"} onPress={() => onChange(it.id)} style={[styles.pick, { backgroundColor: on ? c.accent : c.surfaceMuted, borderColor: c.border }]}>
            <Text style={{ color: on ? c.onAccent : c.ink, fontWeight: "700", fontSize: 13 }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DeadlineChips({ value, onChange }: { value: string | null; onChange: (d: string | null) => void }) {
  const c = usePalette();
  const known = DEADLINES.some((d) => deadlineFor(d.days) === value);
  return (
    <View style={styles.rowWrap}>
      {DEADLINES.map((d) => {
        const on = deadlineFor(d.days) === value;
        return (
          <Pressable key={d.label} onPress={() => onChange(deadlineFor(d.days))} style={[styles.pick, { backgroundColor: on ? c.accent : c.surfaceMuted, borderColor: c.border }]}>
            <Text style={{ color: on ? c.onAccent : c.ink, fontWeight: "700", fontSize: 13 }}>{d.label}</Text>
          </Pressable>
        );
      })}
      {value && !known ? (
        <View style={[styles.pick, { backgroundColor: c.accent, borderColor: c.border }]}>
          <Text style={{ color: c.onAccent, fontWeight: "700", fontSize: 13 }}>до {format(fromDateKey(value), "d MMM", { locale: ru })}</Text>
        </View>
      ) : null}
    </View>
  );
}

function NewTask({ view, onView, run }: { view: TeamView; onView: (v: TeamView) => void; run: Run }) {
  const c = usePalette();
  const call = useRpc();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string | null>(view.me.userId);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [important, setImportant] = useState(false);
  const open = title.trim().length > 0;

  async function add() {
    if (!title.trim()) return;
    await run(async () => {
      onView(
        await call<TeamView>("company.createTask", view.company.id, {
          title: title.trim(),
          assigneeId: assignee,
          startDate: todayKey(),
          deadline,
          important,
        }),
      );
      setTitle("");
      setDeadline(null);
      setImportant(false);
    });
  }

  return (
    <View style={[styles.addCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.row}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={() => void add()}
          placeholder="Новая задача для команды"
          placeholderTextColor={c.inkTertiary}
          style={[styles.addInput, { color: c.ink }]}
        />
        <Pressable onPress={() => void add()} style={[styles.plus, { backgroundColor: c.accent, opacity: open ? 1 : 0.5 }]}>
          <Text style={[styles.plusText, { color: c.onAccent }]}>+</Text>
        </Pressable>
      </View>
      {open ? (
        <View style={{ gap: 10, paddingRight: 8, paddingBottom: 6 }}>
          <Text style={[styles.label, { color: c.inkSecondary }]}>Кто делает</Text>
          <AssigneeChips view={view} value={assignee} onChange={setAssignee} />
          <Text style={[styles.label, { color: c.inkSecondary }]}>Срок</Text>
          <DeadlineChips value={deadline} onChange={setDeadline} />
          <Pressable onPress={() => setImportant((v) => !v)} style={[styles.pick, { alignSelf: "flex-start", backgroundColor: important ? "#f0b429" : c.surfaceMuted, borderColor: c.border }]}>
            <Text style={{ color: important ? "#3b2a00" : c.ink, fontWeight: "700", fontSize: 13 }}>★ Важно</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function TaskCard({ task, view, onView, run }: { task: CTask; view: TeamView; onView: (v: TeamView) => void; run: Run }) {
  const c = usePalette();
  const call = useRpc();
  const [open, setOpen] = useState(false);
  const manager = isManager(view.me.role);
  const canEdit = manager || task.creatorId === view.me.userId;
  const canStatus = canEdit || task.assigneeId === view.me.userId;
  const who = view.members.find((m) => m.userId === task.assigneeId);
  const late = task.deadline && task.status !== "done" && task.deadline < todayKey();
  const s = STATUS[task.status];
  const patch = (p: Partial<CTask>) => void run(async () => onView(await call<TeamView>("company.updateTask", task.id, p)));
  const next: Status = task.status === "todo" ? "doing" : task.status === "doing" ? "done" : "todo";

  return (
    <View style={[styles.task, { backgroundColor: c.surface, borderColor: task.important ? "#f0b429" : c.border }]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.taskHead}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.taskTitle, { color: task.status === "done" ? c.inkTertiary : c.ink }, task.status === "done" && styles.struck]}>
            {task.important ? "★ " : ""}
            {task.title}
          </Text>
          <Text style={{ color: late ? c.danger : c.inkSecondary, fontSize: 13 }}>
            {who ? (who.userId === view.me.userId ? "вы" : who.name) : "без исполнителя"}
            {task.deadline ? ` · до ${format(fromDateKey(task.deadline), "d MMM", { locale: ru })}${late ? " — просрочено" : ""}` : ""}
          </Text>
        </View>
        {canStatus ? (
          <Pressable onPress={() => patch({ status: next })} style={[styles.status, { borderColor: s.color }]} accessibilityLabel={`Статус: ${s.label}. Нажмите, чтобы сменить`}>
            <Text style={{ color: s.color, fontWeight: "700", fontSize: 13 }}>{s.label}</Text>
          </Pressable>
        ) : (
          <Text style={{ color: s.color, fontWeight: "700", fontSize: 13 }}>{s.label}</Text>
        )}
      </Pressable>
      {open && canEdit ? (
        <View style={{ gap: 10, marginTop: 10 }}>
          <Text style={[styles.label, { color: c.inkSecondary }]}>Кто делает</Text>
          <AssigneeChips view={view} value={task.assigneeId} onChange={(id) => patch({ assigneeId: id })} />
          <Text style={[styles.label, { color: c.inkSecondary }]}>Срок</Text>
          <DeadlineChips value={task.deadline} onChange={(d) => patch({ deadline: d })} />
          <View style={styles.rowWrap}>
            <Pressable onPress={() => patch({ important: !task.important })} style={[styles.pick, { backgroundColor: task.important ? "#f0b429" : c.surfaceMuted, borderColor: c.border }]}>
              <Text style={{ color: task.important ? "#3b2a00" : c.ink, fontWeight: "700", fontSize: 13 }}>★ Важно</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                confirmAsk(`Удалить задачу «${task.title}»?`, undefined, "Удалить", () =>
                  void run(async () => onView(await call<TeamView>("company.deleteTask", task.id))),
                )
              }
              style={[styles.pick, { borderColor: c.border }]}
            >
              <Text style={{ color: c.danger, fontWeight: "700", fontSize: 13 }}>Удалить</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {open && !canEdit ? (
        <Text style={{ color: c.inkTertiary, fontSize: 13, marginTop: 8 }}>Менять задачу может её автор или администратор.</Text>
      ) : null}
    </View>
  );
}

function Btn({ title, onPress, ghost, danger, disabled }: { title: string; onPress: () => void; ghost?: boolean; danger?: boolean; disabled?: boolean }) {
  const c = usePalette();
  const color = danger ? c.danger : c.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, ghost ? { borderWidth: 1.5, borderColor: danger ? c.border : color } : { backgroundColor: color }, { opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={{ color: ghost ? color : c.onAccent, fontWeight: "800" }}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 120, gap: 14 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1, marginTop: 6 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  rowWrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  flex: { flex: 1, minWidth: 0 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: radius.pill, alignItems: "center", alignSelf: "flex-start" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  pick: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  company: { fontSize: 22, fontWeight: "800" },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, paddingLeft: 4, marginTop: 4 },
  member: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  memberName: { fontSize: 15, fontWeight: "700" },
  action: { fontSize: 13, fontWeight: "700" },
  addCard: { borderWidth: 1, borderRadius: radius.md, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, gap: 8 },
  addInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  plus: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  plusText: { fontSize: 22, fontWeight: "700" },
  task: { borderWidth: 1, borderRadius: radius.md, padding: 14 },
  taskHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  taskTitle: { fontSize: 16, fontWeight: "600" },
  struck: { textDecorationLine: "line-through" },
  status: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
});
