import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useRpc } from "@/account/use-rpc";
import { notifyChanged } from "@/notify/notify";
import { confirmAsk, errorText } from "@/components/dialogs";
import { Button, Icon, Segmented, Tag } from "@/components/ui";
import { Initial } from "@/components/team/Initial";
import { Schedule } from "@/components/team/Schedule";
import { TaskBoard } from "@/components/team/TaskBoard";
import { isManager, ROLE, type Member, type Role, type Run, type TeamView } from "@/components/team/types";
import { radius, usePalette } from "@/theme/theme";
import { Mascot } from "@/components/Mascot";

type Summary = { id: string; name: string; role: Role; memberCount: number };
type Invitation = { memberId: string; companyId: string; companyName: string; invitedBy: string | null };
type Lists = { companies: Summary[]; invitations: Invitation[] };

/** Teams as on the website: admins hand out tasks, everyone marks how their own ones are going. */
export default function TeamScreen() {
  const c = usePalette();
  const call = useRpc();
  const [lists, setLists] = useState<Lists | null>(null);
  const [view, setView] = useState<TeamView | null>(null);
  const [tab, setTab] = useState<"tasks" | "schedule" | "people">("tasks");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const openId = useRef<string | null>(null);
  useEffect(() => {
    openId.current = view?.company.id ?? null;
    notifyChanged();
  }, [view]);

  const load = useCallback(async () => {
    try {
      const l = await call<Lists>("company.list");
      setLists(l);
      const keep = openId.current && l.companies.some((x) => x.id === openId.current) ? openId.current : null;
      const id = keep ?? l.companies[0]?.id;
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

  const run: Run = async (task) => {
    try {
      setError(null);
      await task();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    }
  };

  const noTeams = lists !== null && lists.companies.length === 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <View style={{ gap: 4 }}>
          <Text style={[styles.title, { color: c.ink }]}>Команда</Text>
          <Text style={[styles.lead, { color: c.inkSecondary }]}>Задачи команды, сроки и загрузка людей.</Text>
        </View>

        {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
        {!lists && !error ? <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} /> : null}

        {lists?.invitations.map((inv) => (
          <View key={inv.memberId} style={[styles.card, { backgroundColor: c.surface, borderColor: c.accent }]}>
            <View style={styles.row}>
              <Icon name="mail-unread-outline" color={c.accent} size={22} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: c.ink }]}>Приглашение в «{inv.companyName}»</Text>
                {inv.invitedBy ? <Text style={[styles.muted, { color: c.inkSecondary }]}>Позвал(а) {inv.invitedBy}</Text> : null}
              </View>
            </View>
            <View style={styles.row}>
              <Button title="Вступить" small onPress={() => void run(async () => { openId.current = inv.companyId; await call("company.respond", inv.memberId, true); await load(); })} />
              <Button title="Отказаться" small kind="ghost" onPress={() => void run(async () => { await call("company.respond", inv.memberId, false); await load(); })} />
            </View>
          </View>
        ))}

        {lists && lists.companies.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {lists.companies.map((co) => {
              const on = view?.company.id === co.id && !creating;
              return (
                <Pressable
                  key={co.id}
                  onPress={() => void run(async () => { setCreating(false); setView(await call<TeamView>("company.view", co.id)); })}
                  style={[styles.chip, { backgroundColor: on ? c.accent : c.surface, borderColor: on ? c.accent : c.border }]}
                >
                  <Text style={{ color: on ? c.onAccent : c.ink, fontWeight: "700" }}>{co.name}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setCreating(true)} style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ color: c.accent, fontWeight: "700" }}>+ Новая команда</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {noTeams || creating ? (
          <CreateTeam
            first={noTeams}
            onCancel={noTeams ? undefined : () => setCreating(false)}
            onCreate={(name) =>
              run(async () => {
                const v = await call<TeamView>("company.create", name);
                openId.current = v.company.id;
                setView(v);
                setCreating(false);
                setTab("people");
                setLists(await call<Lists>("company.list"));
              })
            }
          />
        ) : null}

        {view && !creating ? (
          <>
            <View style={styles.companyHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.company, { color: c.ink }]} numberOfLines={1}>
                  {view.company.name}
                </Text>
                <Text style={{ color: c.inkSecondary, fontSize: 13 }}>
                  {view.members.filter((m) => m.status === "active").length} чел. · вы {ROLE[view.me.role].toLowerCase()}
                </Text>
              </View>
            </View>
            <Segmented
              items={[
                { id: "tasks", label: "Задачи" },
                { id: "schedule", label: "График" },
                { id: "people", label: `Люди · ${view.members.filter((m) => m.status === "active").length}` },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === "tasks" ? (
              <TaskBoard view={view} onView={setView} run={run} />
            ) : tab === "schedule" ? (
              <Schedule view={view} onView={setView} run={run} />
            ) : (
              <People
                view={view}
                onView={setView}
                run={run}
                onGone={() => {
                  openId.current = null;
                  setTab("tasks");
                  void load();
                }}
              />
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CreateTeam({ first, onCreate, onCancel }: { first: boolean; onCreate: (name: string) => Promise<boolean>; onCancel?: () => void }) {
  const c = usePalette();
  const [name, setName] = useState("");
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {first ? <Mascot width={90} style={{ alignSelf: "center" }} /> : null}
      <Text style={[styles.cardTitle, { color: c.ink, textAlign: first ? "center" : "left" }]}>{first ? "Соберите свою команду" : "Новая команда"}</Text>
      <Text style={[styles.muted, { color: c.inkSecondary, textAlign: first ? "center" : "left", lineHeight: 19 }]}>
        Вы станете владельцем: позовёте людей по нику и будете раздавать задачи со сроками.
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Название, например «Кофейня Утро»"
        placeholderTextColor={c.inkTertiary}
        maxLength={60}
        style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
      />
      <View style={styles.row}>
        <Button title="Создать команду" onPress={() => void onCreate(name.trim()).then((ok) => ok && setName(""))} disabled={!name.trim()} full={first} style={first ? { flex: 1 } : undefined} />
        {onCancel ? <Button title="Отмена" kind="ghost" onPress={onCancel} /> : null}
      </View>
    </View>
  );
}

function People({ view, onView, run, onGone }: { view: TeamView; onView: (v: TeamView) => void; run: Run; onGone: () => void }) {
  const c = usePalette();
  const call = useRpc();
  const [nick, setNick] = useState("");
  const [name, setName] = useState(view.company.name);
  const [renaming, setRenaming] = useState(false);
  const manager = isManager(view.me.role);
  const owner = view.me.role === "owner";
  const id = view.company.id;
  const me = view.members.find((m) => m.userId === view.me.userId);
  const sorted = useMemo(() => {
    const order: Record<Role, number> = { owner: 0, admin: 1, member: 2 };
    return [...view.members].sort((a, b) => (a.status === b.status ? order[a.role] - order[b.role] : a.status === "active" ? -1 : 1));
  }, [view.members]);

  function actions(m: Member) {
    const self = m.userId === view.me.userId;
    const out: { label: string; danger?: boolean; run: () => void }[] = [];
    if (owner && !self && m.role !== "owner" && m.status === "active") {
      out.push({
        label: m.role === "admin" ? "Сделать участником" : "Сделать админом",
        run: () => void run(async () => onView(await call<TeamView>("company.setRole", id, m.id, m.role === "admin" ? "member" : "admin"))),
      });
    }
    if (!self && m.role !== "owner" && manager && (m.role !== "admin" || owner)) {
      out.push({
        label: m.status === "invited" ? "Отменить приглашение" : "Убрать из команды",
        danger: true,
        run: () =>
          confirmAsk(`Убрать ${m.name} из команды?`, undefined, "Убрать", () =>
            void run(async () => {
              const v = await call<TeamView | null>("company.removeMember", id, m.id);
              if (v) onView(v);
            }),
          ),
      });
    }
    return out;
  }

  return (
    <View style={{ gap: 14 }}>
      {manager ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.ink }]}>Позвать в команду</Text>
          <View style={styles.row}>
            <View style={[styles.nickBox, { borderColor: c.border, backgroundColor: c.surfaceMuted }]}>
              <Text style={{ color: c.inkTertiary, fontSize: 16 }}>@</Text>
              <TextInput
                value={nick}
                onChangeText={(t) => setNick(t.replace(/^@/, "").toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="ник"
                placeholderTextColor={c.inkTertiary}
                style={[styles.nickInput, { color: c.ink }]}
              />
            </View>
            <Button
              title="Позвать"
              small
              disabled={nick.length < 3}
              onPress={() => void run(async () => { onView(await call<TeamView>("company.invite", id, nick)); setNick(""); })}
            />
          </View>
          <Text style={[styles.muted, { color: c.inkSecondary }]}>Человек увидит приглашение у себя в «Команде».</Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, paddingVertical: 6 }]}>
        {sorted.map((m, i) => {
          const self = m.userId === view.me.userId;
          const acts = actions(m);
          return (
            <View key={m.id} style={[styles.member, i < sorted.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
              <Initial name={m.name} id={m.userId} size={38} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.memberName, { color: c.ink }]}>
                  {m.name}
                  {self ? " (я)" : ""}
                </Text>
                <View style={styles.tags}>
                  {m.status === "invited" ? (
                    <Tag tone="muted" text="ждём ответа" />
                  ) : (
                    <Tag tone={m.role === "member" ? "muted" : "accent"} text={ROLE[m.role]} />
                  )}
                  {m.username ? <Text style={[styles.muted, { color: c.inkTertiary }]}>@{m.username}</Text> : null}
                </View>
                {acts.length ? (
                  <View style={[styles.row, { marginTop: 4, flexWrap: "wrap" }]}>
                    {acts.map((a) => (
                      <Pressable key={a.label} onPress={a.run} hitSlop={6}>
                        <Text style={{ color: a.danger ? c.danger : c.accent, fontWeight: "700", fontSize: 13 }}>{a.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <View style={[styles.note, { backgroundColor: c.surfaceMuted }]}>
        <Icon name="shield-checkmark-outline" color={c.inkSecondary} size={18} />
        <Text style={{ flex: 1, color: c.inkSecondary, fontSize: 13, lineHeight: 18 }}>
          Владелец и админы добавляют и меняют задачи. Участники видят задачи команды и отмечают статус своих.
        </Text>
      </View>

      {manager ? (
        renaming ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={60}
              autoFocus
              style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
            />
            <View style={styles.row}>
              <Button
                title="Сохранить"
                small
                disabled={!name.trim() || name.trim() === view.company.name}
                onPress={() => void run(async () => { onView(await call<TeamView>("company.rename", id, name.trim())); setRenaming(false); })}
              />
              <Button title="Отмена" small kind="ghost" onPress={() => { setName(view.company.name); setRenaming(false); }} />
            </View>
          </View>
        ) : (
          <Button title="Переименовать команду" kind="ghost" icon="create-outline" onPress={() => setRenaming(true)} full />
        )
      ) : null}

      {owner ? (
        <Button
          title="Удалить команду"
          kind="danger"
          icon="trash-outline"
          full
          onPress={() =>
            confirmAsk(`Удалить «${view.company.name}»?`, "Задачи команды пропадут у всех участников.", "Удалить", () =>
              void run(async () => {
                await call("company.delete", id);
                onGone();
              }),
            )
          }
        />
      ) : me ? (
        <Button
          title="Выйти из команды"
          kind="danger"
          icon="exit-outline"
          full
          onPress={() =>
            confirmAsk(`Выйти из «${view.company.name}»?`, undefined, "Выйти", () =>
              void run(async () => {
                await call("company.removeMember", id, me.id);
                onGone();
              }),
            )
          }
        />
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
  cardTitle: { fontSize: 17, fontWeight: "800" },
  mascot: { width: 110, height: 120, alignSelf: "center" },
  muted: { fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 64, textAlignVertical: "top" },
  label: { fontSize: 13, fontWeight: "700" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addBar: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radius.lg, padding: 10 },
  plus: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  note: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderRadius: radius.md, padding: 12 },
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  companyHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  company: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  emptyLine: { fontSize: 14, textAlign: "center", paddingVertical: 10 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 2 },
  groupDot: { width: 9, height: 9, borderRadius: 5 },
  groupTitle: { fontSize: 15, fontWeight: "800" },
  task: { borderWidth: 1, borderRadius: radius.md, overflow: "hidden" },
  taskMain: { padding: 14, gap: 8 },
  taskTitle: { flex: 1, fontSize: 16, fontWeight: "700", lineHeight: 21 },
  struck: { textDecorationLine: "line-through" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  statusBar: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: StyleSheet.hairlineWidth, padding: 6 },
  statusItem: { flex: 1, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center", minHeight: 34, borderRadius: 9 },
  details: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  dangerLink: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  person: { flexDirection: "row", alignItems: "center", gap: 7, paddingLeft: 5, paddingRight: 12, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  nickBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, minWidth: 0 },
  nickInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 11 },
  member: { flexDirection: "row", gap: 12, paddingVertical: 12, alignItems: "flex-start" },
  memberName: { fontSize: 16, fontWeight: "700" },
});
