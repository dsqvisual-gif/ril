import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { format, isSameDay } from "date-fns";
import { ru } from "date-fns/locale";
import { useRpc } from "@/account/use-rpc";
import { BabyIcon, ChildChips, useChildren } from "@/components/baby/children";
import { confirmAsk, errorText } from "@/components/dialogs";
import { Button, DateField, Icon, Segmented, Tag } from "@/components/ui";
import {
  childAge,
  formatClock,
  formatDuration,
  plural,
  rhythm,
  type BabyEvent,
  type BabyEventKind,
  type Caregiver,
  type Child,
  type ChildInvite,
  type DiaperData,
  type Health,
} from "@/shared/baby";
import { shiftDateKey, toDateKey, todayKey } from "@/shared/dates";
import { radius, usePalette } from "@/theme/theme";
import { Mascot } from "@/components/Mascot";

const DAY = 86_400_000;
const startOfDay = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const eventEnd = (e: BabyEvent, now: number) => (e.endedAt ? new Date(e.endedAt).getTime() : now);

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Mom mode: the baby's day in one tap — sleep, feeding and diapers, as on the website. */
export default function BabyScreen() {
  const c = usePalette();
  const call = useRpc();
  const { kids, setKids, child, setChildId, reload, error } = useChildren();
  const [form, setForm] = useState<"new" | Child | null>(null);
  const [invites, setInvites] = useState<ChildInvite[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    call<ChildInvite[]>("baby.invites").then(setInvites).catch(() => {});
  }, [call, kids]);

  const showForm = kids !== null && (kids.length === 0 || form !== null);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void reload().finally(() => setRefreshing(false)); }} />}
      >
        {invites.map((inv) => (
          <View key={inv.id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.accent }]}>
            <Text style={[styles.cardTitle, { color: c.ink }]}>
              {inv.fromName ?? "Вас"} {inv.fromName ? "приглашает" : "пригласили"} отмечать малыша: {inv.childName}
            </Text>
            <View style={styles.row}>
              <Button title="Принять" small onPress={() => void call("baby.respondInvite", inv.id, true).then(reload)} />
              <Button title="Отказаться" small kind="ghost" onPress={() => void call("baby.respondInvite", inv.id, false).then(() => setInvites((p) => p.filter((x) => x.id !== inv.id)))} />
            </View>
          </View>
        ))}

        {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}
        {kids === null && !error ? <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} /> : null}

        {kids && kids.length > 0 && !showForm ? (
          <ChildChips kids={kids} childId={child?.id ?? null} onChange={setChildId} onAdd={() => setForm("new")} onEdit={(k) => setForm(k)} />
        ) : null}

        {showForm ? (
          <ChildForm
            first={kids!.length === 0}
            initial={form && form !== "new" ? form : undefined}
            onCancel={kids!.length > 0 ? () => setForm(null) : undefined}
            onSaved={(saved, isNew) => {
              setKids((prev) => (isNew ? [...(prev ?? []), saved] : (prev ?? []).map((k) => (k.id === saved.id ? saved : k))));
              setChildId(saved.id);
              setForm(null);
            }}
            onDeleted={(id) => {
              const rest = (kids ?? []).filter((k) => k.id !== id);
              setKids(rest);
              setChildId(rest[0]?.id ?? null);
              setForm(null);
            }}
          />
        ) : null}

        {child && !showForm ? <ChildDay key={child.id} child={child} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChildForm({
  first,
  initial,
  onSaved,
  onCancel,
  onDeleted,
}: {
  first: boolean;
  initial?: Child;
  onSaved: (child: Child, isNew: boolean) => void;
  onCancel?: () => void;
  onDeleted: (id: string) => void;
}) {
  const c = usePalette();
  const call = useRpc();
  const [name, setName] = useState(initial?.name ?? "");
  const [birth, setBirth] = useState<string | null>(initial?.birthDate ?? null);
  const [sex, setSex] = useState<Child["sex"]>(initial?.sex ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (initial && !initial.isOwner) {
    const owner = initial.people[0]?.name ?? "родитель";
    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={{ color: c.ink, lineHeight: 21 }}>
          Малыша ведёт <Text style={{ fontWeight: "800" }}>{owner}</Text>, вы отмечаете вместе. Имя и дату рождения меняет только {owner}.
        </Text>
        <View style={styles.row}>
          <Button title="Готово" small kind="secondary" onPress={() => onCancel?.()} />
          <Button
            title="Выйти из доступа"
            small
            kind="danger"
            onPress={() =>
              confirmAsk(`Перестать отмечать ${initial.name}?`, `Записи останутся у ${owner}.`, "Выйти", async () => {
                await call("baby.leave", initial.id);
                onDeleted(initial.id);
              })
            }
          />
        </View>
      </View>
    );
  }

  async function save() {
    if (!name.trim() || !birth) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await call<Child>("baby.saveChild", initial?.id ?? null, { name: name.trim(), birthDate: birth, sex }), !initial);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {first ? (
        <View style={{ alignItems: "center", gap: 6 }}>
          <Mascot width={95} />
          <Text style={[styles.h1, { color: c.ink, textAlign: "center" }]}>Расскажите о малыше</Text>
          <Text style={{ color: c.inkSecondary, textAlign: "center", lineHeight: 20 }}>
            Отмечайте сон, кормления и подгузники в одно касание, ведите прикорм и смотрите статистику. Личный планер — рядом, во вкладке «Планер».
          </Text>
        </View>
      ) : (
        <Text style={[styles.cardTitle, { color: c.ink }]}>{initial ? "Данные малыша" : "Ещё один ребёнок"}</Text>
      )}
      <Text style={[styles.label, { color: c.inkSecondary }]}>Имя</Text>
      <TextInput value={name} onChangeText={setName} maxLength={40} placeholder="Например: Маша" placeholderTextColor={c.inkTertiary} style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]} />
      <Text style={[styles.label, { color: c.inkSecondary }]}>Дата рождения</Text>
      <DateField value={birth} onChange={setBirth} placeholder="Выберите дату" />
      <Segmented
        items={[
          { id: "girl", label: "Девочка" },
          { id: "boy", label: "Мальчик" },
        ]}
        value={sex}
        onChange={(v) => setSex(v)}
      />
      {initial ? <Caregivers childId={initial.id} /> : null}
      {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        {initial ? (
          <Pressable
            onPress={() =>
              confirmAsk(`Удалить ${initial.name} и все записи?`, "Это нельзя отменить.", "Удалить", async () => {
                try {
                  await call("baby.deleteChild", initial.id);
                  onDeleted(initial.id);
                } catch (e) {
                  setError(errorText(e));
                }
              })
            }
          >
            <Text style={{ color: c.danger, fontWeight: "700" }}>Удалить</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={styles.row}>
          {onCancel ? <Button title="Отмена" kind="ghost" small onPress={onCancel} /> : null}
          <Button title={first ? "Начать" : "Сохранить"} small onPress={() => void save()} busy={busy} disabled={!name.trim() || !birth} />
        </View>
      </View>
    </View>
  );
}

/** Who else marks this baby: dad, grandma, a nanny. */
function Caregivers({ childId }: { childId: string }) {
  const c = usePalette();
  const call = useRpc();
  const [list, setList] = useState<Caregiver[] | null>(null);
  const [nick, setNick] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    call<Caregiver[]>("baby.caregivers", childId).then(setList).catch(() => setList([]));
  }, [call, childId]);
  return (
    <View style={[styles.sub, { backgroundColor: c.surfaceMuted }]}>
      <Text style={{ color: c.ink, fontWeight: "800" }}>Отмечать вместе</Text>
      <Text style={{ color: c.inkSecondary, fontSize: 13, lineHeight: 18 }}>Папа, бабушка или няня тоже смогут отмечать сон, кормления и подгузники.</Text>
      {list?.map((p) => (
        <View key={p.id} style={styles.row}>
          <Text style={{ flex: 1, color: c.ink }}>
            {p.name} {p.username ? <Text style={{ color: c.inkTertiary }}>@{p.username}</Text> : null}
            {p.status === "invited" ? <Text style={{ color: c.inkTertiary }}> · ждём ответа</Text> : null}
          </Text>
          <Pressable onPress={() => void call("baby.removeCaregiver", p.id).then(() => setList((l) => l?.filter((x) => x.id !== p.id) ?? l))} hitSlop={8}>
            <Icon name="close" color={c.inkTertiary} size={16} />
          </Pressable>
        </View>
      ))}
      <View style={styles.row}>
        <TextInput
          value={nick}
          onChangeText={(t) => setNick(t.replace(/^@/, "").toLowerCase())}
          placeholder="ник, например papa"
          autoCapitalize="none"
          placeholderTextColor={c.inkTertiary}
          style={[styles.input, { flex: 1, minWidth: 0, paddingVertical: 9, color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
        />
        <Button
          title="Позвать"
          small
          kind="secondary"
          disabled={nick.length < 3}
          onPress={() =>
            void call<Caregiver[]>("baby.inviteCaregiver", childId, nick)
              .then((l) => {
                setList(l);
                setNick("");
                setError(null);
              })
              .catch((e) => setError(errorText(e)))
          }
        />
      </View>
      {error ? <Text style={{ color: c.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

function ChildDay({ child }: { child: Child }) {
  const c = usePalette();
  const call = useRpc();
  const now = useNow();
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [day, setDay] = useState(() => startOfDay(Date.now()));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [night, setNight] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);

  const merge = useCallback((items: BabyEvent[]) => {
    setEvents((prev) => {
      const map = new Map(prev.map((e) => [e.id, e]));
      for (const item of items) map.set(item.id, item);
      return [...map.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    });
  }, []);

  useEffect(() => {
    const from = Math.min(day, Date.now() - 2 * DAY);
    const to = Math.max(day + DAY, Date.now() + 60_000);
    call<BabyEvent[]>("baby.events", child.id, new Date(from).toISOString(), new Date(to).toISOString())
      .then(merge)
      .catch((e) => setError(errorText(e, "Не удалось загрузить записи")));
  }, [call, child.id, day, merge]);

  useEffect(() => {
    const today = todayKey();
    call<Health[]>("baby.health", child.id)
      .then((rows) => setHealth(rows.filter((h) => !h.done && h.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null))
      .catch(() => {});
  }, [call, child.id]);

  async function act(key: string, run: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await run();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const runningSleep = events.find((e) => e.kind === "sleep" && !e.endedAt) ?? null;
  const runningFeed = events.find((e) => e.kind === "feed" && !e.endedAt) ?? null;
  const lastSleep = events.find((e) => e.kind === "sleep" && e.endedAt) ?? null;
  const lastFeed = events.find((e) => e.kind === "feed") ?? null;
  const lastDiaper = events.find((e) => e.kind === "diaper") ?? null;

  const dayEvents = useMemo(
    () => events.filter((e) => new Date(e.startedAt).getTime() < day + DAY && eventEnd(e, now) >= day),
    [events, day, now],
  );
  const totals = useMemo(() => {
    let sleep = 0;
    let feeds = 0;
    let diapers = 0;
    for (const e of dayEvents) {
      if (e.kind === "sleep") sleep += Math.max(0, Math.min(eventEnd(e, now), day + DAY) - Math.max(new Date(e.startedAt).getTime(), day));
      else if (new Date(e.startedAt).getTime() >= day) {
        if (e.kind === "feed") feeds += 1;
        else diapers += 1;
      }
    }
    return { sleep, feeds, diapers };
  }, [dayEvents, day, now]);

  const tips = useMemo(() => rhythm(events, now), [events, now]);
  const isToday = isSameDay(new Date(day), new Date(now));
  const shared = child.people.length > 1;
  const nameOf = (id: string | null) => child.people.find((p) => p.id === id)?.name ?? null;
  const verbs = child.sex === "girl" ? { slept: "Уснула", woke: "Проснулась" } : { slept: "Уснул", woke: "Проснулся" };

  const toggleSleep = () =>
    act("sleep", async () => (runningSleep ? merge([await call<BabyEvent>("baby.stop", runningSleep.id)]) : merge(await call<BabyEvent[]>("baby.start", child.id, "sleep"))));
  const toggleFeed = () =>
    act("feed", async () => (runningFeed ? merge([await call<BabyEvent>("baby.stop", runningFeed.id)]) : merge(await call<BabyEvent[]>("baby.start", child.id, "feed"))));
  const diaper = (data: DiaperData) =>
    act("diaper", async () => merge([await call<BabyEvent>("baby.addEvent", child.id, { kind: "diaper", startedAt: new Date().toISOString(), data })]));

  return (
    <>
      <View style={styles.headline}>
        <View style={styles.row}>
          <View style={[styles.face, { backgroundColor: c.accentSoft }]}>
            <BabyIcon name={child.sex === "boy" ? "face-man-shimmer-outline" : child.sex === "girl" ? "face-woman-shimmer-outline" : "baby-face-outline"} color={c.accent} size={24} />
          </View>
          <Text style={[styles.h1, { color: c.ink }]}>{child.name}</Text>
        </View>
        <Tag tone="accent" text={childAge(child.birthDate, todayKey())} />
      </View>

      <View style={[styles.row, { flexWrap: "wrap" }]}>
        <Pressable onPress={() => setNight(true)} style={[styles.nightBtn, { backgroundColor: "#1d2340" }]}>
          <BabyIcon name="weather-night" color="#ffd8a8" size={16} />
          <Text style={{ color: "#fff", fontWeight: "700" }}>Ночной режим</Text>
        </Pressable>
        {shared ? <Text style={{ color: c.inkSecondary, fontSize: 13, flex: 1 }}>Отмечаете вместе: {child.people.map((p) => p.name).join(", ")}</Text> : null}
      </View>

      {tips.map((t) => (
        <View key={t.text} style={[styles.tip, { backgroundColor: t.now ? c.accentSoft : c.surface, borderColor: t.now ? c.accent : c.border }]}>
          <BabyIcon name={t.kind === "sleep" ? "sleep" : "baby-bottle-outline"} color={c.accent} size={18} />
          <Text style={{ flex: 1, color: c.ink, fontWeight: t.now ? "700" : "500", lineHeight: 19 }}>{t.text}</Text>
        </View>
      ))}

      {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}

      <NowCard
        icon="sleep"
        title="Сон"
        active={Boolean(runningSleep)}
        big={runningSleep ? formatClock(now - new Date(runningSleep.startedAt).getTime()) : lastSleep ? formatDuration(now - eventEnd(lastSleep, now)) : "—"}
        sub={runningSleep ? `спит с ${format(new Date(runningSleep.startedAt), "HH:mm")}` : lastSleep ? "бодрствует" : "сна ещё не записано"}
      >
        <Button title={runningSleep ? verbs.woke : verbs.slept} icon={runningSleep ? "sunny-outline" : "moon-outline"} full onPress={() => void toggleSleep()} busy={busy === "sleep"} />
      </NowCard>

      <NowCard
        icon="baby-bottle-outline"
        title="Кормление"
        active={Boolean(runningFeed)}
        big={runningFeed ? formatClock(now - new Date(runningFeed.startedAt).getTime()) : lastFeed ? formatDuration(now - new Date(lastFeed.startedAt).getTime()) : "—"}
        sub={runningFeed ? `кормление с ${format(new Date(runningFeed.startedAt), "HH:mm")}` : lastFeed ? "с прошлого кормления" : "кормлений ещё не записано"}
      >
        <Button title={runningFeed ? "Закончить" : "Начать кормление"} full onPress={() => void toggleFeed()} busy={busy === "feed"} />
      </NowCard>

      <NowCard
        icon="human-baby-changing-table"
        title="Подгузник"
        big={lastDiaper ? formatDuration(now - new Date(lastDiaper.startedAt).getTime()) : "—"}
        sub={lastDiaper ? "с прошлой смены" : "смен ещё не записано"}
      >
        <View style={styles.row}>
          <Soft icon="water-outline" title="Мокрый" onPress={() => void diaper({ pee: true, poo: false })} disabled={busy === "diaper"} />
          <Soft icon="emoticon-poop-outline" title="Грязный" onPress={() => void diaper({ pee: false, poo: true })} disabled={busy === "diaper"} />
        </View>
        <Soft title="Оба" onPress={() => void diaper({ pee: true, poo: true })} disabled={busy === "diaper"} />
      </NowCard>

      {health ? (
        <Pressable onPress={() => router.push("/settings/health")} style={[styles.health, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.face, { backgroundColor: c.accentSoft }]}>
            <BabyIcon name={health.kind === "vaccine" ? "needle" : "stethoscope"} color={c.accent} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontWeight: "700", fontSize: 15 }}>{health.title}</Text>
            <Text style={{ color: c.inkSecondary, fontSize: 13 }}>{format(new Date(`${health.date}T12:00:00`), "d MMMM", { locale: ru })}</Text>
          </View>
          <Icon name="chevron-forward" color={c.inkTertiary} />
        </Pressable>
      ) : null}

      <View style={styles.dayHead}>
        <Pressable onPress={() => setDay((d) => d - DAY)} hitSlop={10} accessibilityLabel="Предыдущий день">
          <Icon name="chevron-back" color={c.accent} size={22} />
        </Pressable>
        <Text style={[styles.dayTitle, { color: c.ink }]}>{isToday ? "Сегодня" : format(new Date(day), "d MMMM, EEEE", { locale: ru })}</Text>
        <Pressable onPress={() => !isToday && setDay((d) => d + DAY)} hitSlop={10} disabled={isToday} accessibilityLabel="Следующий день">
          <Icon name="chevron-forward" color={isToday ? c.border : c.accent} size={22} />
        </Pressable>
      </View>

      <View style={[styles.row, { flexWrap: "wrap", gap: 14 }]}>
        <Total icon="sleep" text={`${totals.sleep ? formatDuration(totals.sleep) : "0 мин"} сна`} />
        <Total icon="baby-bottle-outline" text={`${totals.feeds} ${plural(totals.feeds, ["кормление", "кормления", "кормлений"])}`} />
        <Total icon="human-baby-changing-table" text={`${totals.diapers} подгузн.`} />
      </View>

      <View style={{ gap: 8 }}>
        {dayEvents.length === 0 ? <Text style={{ color: c.inkSecondary, textAlign: "center", padding: 10 }}>Записей за этот день нет</Text> : null}
        {dayEvents.map((e) =>
          editing === e.id ? (
            <EventForm
              key={e.id}
              fixedKind={e.kind}
              initial={e}
              wokeLabel={verbs.woke}
              onSave={(input) => act(e.id, async () => { merge([await call<BabyEvent>("baby.updateEvent", e.id, input)]); setEditing(null); })}
              onDelete={() => act(e.id, async () => { await call("baby.deleteEvent", e.id); setEvents((p) => p.filter((x) => x.id !== e.id)); setEditing(null); })}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <Pressable key={e.id} onPress={() => setEditing(e.id)} style={[styles.event, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={[styles.eventIcon, { backgroundColor: c.accentSoft }]}>
                <BabyIcon name={iconOf(e)} color={c.accent} size={19} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontWeight: "700", fontSize: 15 }}>{titleOf(e)}</Text>
                <Text style={{ color: c.inkSecondary, fontSize: 13 }}>
                  {detailsOf(e, now)}
                  {shared && nameOf(e.byUserId) ? ` · ${nameOf(e.byUserId)}` : ""}
                </Text>
              </View>
              <Text style={{ color: c.ink, fontWeight: "800" }}>{format(new Date(e.startedAt), "HH:mm")}</Text>
            </Pressable>
          ),
        )}
      </View>

      {adding ? (
        <EventForm
          wokeLabel={verbs.woke}
          onSave={(input) => act("add", async () => { merge([await call<BabyEvent>("baby.addEvent", child.id, input)]); setAdding(false); })}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Pressable onPress={() => setAdding(true)} hitSlop={6}>
          <Text style={{ color: c.accent, fontWeight: "700", fontSize: 15 }}>+ Добавить запись задним числом</Text>
        </Pressable>
      )}

      <NightMode
        visible={night}
        name={child.name}
        verbs={verbs}
        now={now}
        runningSleep={runningSleep}
        runningFeed={runningFeed}
        lastSleepEnd={lastSleep ? eventEnd(lastSleep, now) : null}
        lastFeedStart={lastFeed ? new Date(lastFeed.startedAt).getTime() : null}
        busy={busy}
        onSleep={() => void toggleSleep()}
        onFeed={() => void toggleFeed()}
        onDiaper={(d) => void diaper(d)}
        onClose={() => setNight(false)}
      />
    </>
  );
}

function iconOf(e: BabyEvent): string {
  if (e.kind === "sleep") return "sleep";
  if (e.kind === "diaper") return (e.data as DiaperData | null)?.poo ? "emoticon-poop-outline" : "water-outline";
  return "baby-bottle-outline";
}

function titleOf(e: BabyEvent): string {
  if (e.kind === "sleep") return e.endedAt ? "Сон" : "Спит сейчас";
  if (e.kind === "diaper") {
    const d = e.data as DiaperData | null;
    return d?.pee && d?.poo ? "Подгузник: мокрый и грязный" : d?.poo ? "Подгузник: грязный" : "Подгузник: мокрый";
  }
  return e.endedAt ? "Кормление" : "Кормление идёт";
}

function detailsOf(e: BabyEvent, now: number): string {
  const parts: string[] = [];
  if (e.kind !== "diaper") {
    parts.push(
      `${format(new Date(e.startedAt), "HH:mm")}–${e.endedAt ? format(new Date(e.endedAt), "HH:mm") : "сейчас"} · ${formatDuration(eventEnd(e, now) - new Date(e.startedAt).getTime())}`,
    );
  }
  if (e.note) parts.push(e.note);
  return parts.join(" · ") || "нажмите, чтобы изменить";
}

function NowCard({ icon, title, big, sub, active, children }: { icon: string; title: string; big: string; sub: string; active?: boolean; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={[styles.now, { backgroundColor: active ? c.accentSoft : c.surface, borderColor: active ? c.accent : c.border }]}>
      <View style={styles.nowHead}>
        <View style={{ gap: 2, flex: 1 }}>
          <View style={styles.row}>
            <BabyIcon name={icon} color={c.accent} size={19} />
            <Text style={{ color: c.ink, fontWeight: "800", fontSize: 16 }}>{title}</Text>
          </View>
          <Text style={{ color: c.inkSecondary, fontSize: 13 }}>{sub}</Text>
        </View>
        <Text style={[styles.big, { color: c.ink }, big.length > 9 && { fontSize: 19, maxWidth: 150, textAlign: "right" }]}>{big}</Text>
      </View>
      {children}
    </View>
  );
}

function Soft({ title, icon, onPress, disabled }: { title: string; icon?: string; onPress: () => void; disabled?: boolean }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.soft, { backgroundColor: c.accentSoft, opacity: disabled || pressed ? 0.6 : 1 }]}>
      {icon ? <BabyIcon name={icon} color={c.accent} size={18} /> : null}
      <Text style={{ color: c.accent, fontWeight: "800", fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

function Total({ icon, text }: { icon: string; text: string }) {
  const c = usePalette();
  return (
    <View style={styles.row}>
      <BabyIcon name={icon} color={c.inkSecondary} size={16} />
      <Text style={{ color: c.ink, fontWeight: "700", fontSize: 14 }}>{text}</Text>
    </View>
  );
}

type EventInput = { kind: BabyEventKind; startedAt: string; endedAt: string | null; data?: DiaperData; note: string };

/** A date and a time "14:30". */
function When({ label, date, time, onDate, onTime }: { label: string; date: string; time: string; onDate: (d: string) => void; onTime: (t: string) => void }) {
  const c = usePalette();
  const yesterday = shiftDateKey(todayKey(), -1);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: c.inkSecondary }]}>{label}</Text>
      <View style={styles.row}>
        <Segmented
          items={[
            { id: yesterday, label: "Вчера" },
            { id: todayKey(), label: "Сегодня" },
          ]}
          value={date === todayKey() || date === yesterday ? date : null}
          onChange={onDate}
        />
        <TextInput
          value={time}
          onChangeText={(raw) => {
            const d = raw.replace(/\D/g, "").slice(0, 4);
            onTime(d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d);
          }}
          keyboardType="number-pad"
          placeholder="14:30"
          placeholderTextColor={c.inkTertiary}
          maxLength={5}
          style={[styles.input, styles.time, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
        />
      </View>
      {date !== todayKey() && date !== yesterday ? <DateField value={date} onChange={(d) => d && onDate(d)} /> : null}
    </View>
  );
}

function split(iso: Date) {
  return { date: toDateKey(iso), time: format(iso, "HH:mm") };
}

function join(date: string, time: string): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return new Date(`${date}T${time}:00`).toISOString();
}

function EventForm({
  fixedKind,
  initial,
  wokeLabel,
  onSave,
  onDelete,
  onCancel,
}: {
  fixedKind?: BabyEventKind;
  initial?: BabyEvent;
  wokeLabel: string;
  onSave: (input: EventInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}) {
  const c = usePalette();
  const [kind, setKind] = useState<BabyEventKind>(fixedKind ?? "sleep");
  // An hour ago → now, for a sleep or feed entered afterwards.
  const [s0] = useState(() => split(initial ? new Date(initial.startedAt) : new Date(new Date().getTime() - 3_600_000)));
  const [e0] = useState(() => split(initial?.endedAt ? new Date(initial.endedAt) : new Date()));
  const [sd, setSd] = useState(s0.date);
  const [st, setSt] = useState(s0.time);
  const [ed, setEd] = useState(e0.date);
  const [et, setEt] = useState(e0.time);
  const d0 = initial?.data as DiaperData | null;
  const [pee, setPee] = useState(d0?.pee ?? true);
  const [poo, setPoo] = useState(d0?.poo ?? false);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const running = Boolean(initial && !initial.endedAt);
  const instant = kind === "diaper";

  function submit() {
    const start = join(sd, st);
    const end = instant || running ? null : join(ed, et);
    if (!start || (!instant && !running && !end)) {
      setError("Время — в виде 14:30");
      return;
    }
    void onSave({ kind, startedAt: start, endedAt: end, data: instant ? { pee, poo } : undefined, note });
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {!fixedKind ? (
        <Segmented
          items={[
            { id: "sleep", label: "Сон" },
            { id: "feed", label: "Кормление" },
            { id: "diaper", label: "Подгузник" },
          ]}
          value={kind}
          onChange={setKind}
        />
      ) : null}
      {instant ? (
        <View style={styles.row}>
          <Toggle on={pee} title="Мокрый" icon="water-outline" onPress={() => setPee((v) => !v)} />
          <Toggle on={poo} title="Грязный" icon="emoticon-poop-outline" onPress={() => setPoo((v) => !v)} />
        </View>
      ) : null}
      <When label={instant ? "Когда" : "Начало"} date={sd} time={st} onDate={setSd} onTime={setSt} />
      {!instant && !running ? <When label={kind === "sleep" ? wokeLabel : "Конец"} date={ed} time={et} onDate={setEd} onTime={setEt} /> : null}
      <TextInput value={note} onChangeText={setNote} placeholder="Заметка (необязательно)" placeholderTextColor={c.inkTertiary} maxLength={300} style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]} />
      {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        {onDelete ? (
          <Pressable onPress={() => void onDelete()} hitSlop={6}>
            <Text style={{ color: c.danger, fontWeight: "700" }}>Удалить</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={styles.row}>
          <Button title="Отмена" kind="ghost" small onPress={onCancel} />
          <Button title="Сохранить" small onPress={submit} />
        </View>
      </View>
    </View>
  );
}

function Toggle({ on, title, icon, onPress }: { on: boolean; title: string; icon: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} style={[styles.soft, { backgroundColor: on ? c.accent : c.surfaceMuted }]}>
      <BabyIcon name={icon} color={on ? c.onAccent : c.inkSecondary} size={18} />
      <Text style={{ color: on ? c.onAccent : c.ink, fontWeight: "700" }}>{title}</Text>
    </Pressable>
  );
}

/** Night mode: dark, huge buttons, nothing else — for the 3 a.m. feed. */
function NightMode(props: {
  visible: boolean;
  name: string;
  verbs: { slept: string; woke: string };
  now: number;
  runningSleep: BabyEvent | null;
  runningFeed: BabyEvent | null;
  lastSleepEnd: number | null;
  lastFeedStart: number | null;
  busy: string | null;
  onSleep: () => void;
  onFeed: () => void;
  onDiaper: (d: DiaperData) => void;
  onClose: () => void;
}) {
  const { now } = props;
  return (
    <Modal visible={props.visible} animationType="fade" onRequestClose={props.onClose} statusBarTranslucent>
      <View style={styles.night}>
        <SafeAreaView style={{ flex: 1, gap: 14, padding: 18 }}>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Text style={{ color: "#c9cbe0", fontSize: 16, fontWeight: "700" }}>{props.name}</Text>
            <Pressable onPress={props.onClose} hitSlop={10}>
              <Text style={{ color: "#ffd8a8", fontWeight: "800", fontSize: 16 }}>Выйти</Text>
            </Pressable>
          </View>
          <Text style={{ color: "#fff", fontSize: 64, fontWeight: "200", textAlign: "center", marginTop: 10 }}>{format(now, "HH:mm")}</Text>
          <NightButton
            icon={props.runningSleep ? "white-balance-sunny" : "weather-night"}
            title={props.runningSleep ? props.verbs.woke : props.verbs.slept}
            sub={props.runningSleep ? `спит ${formatClock(now - new Date(props.runningSleep.startedAt).getTime())}` : props.lastSleepEnd ? `не спит ${formatDuration(now - props.lastSleepEnd)}` : ""}
            onPress={props.onSleep}
            disabled={props.busy === "sleep"}
          />
          <NightButton
            icon="baby-bottle-outline"
            title={props.runningFeed ? "Закончить кормление" : "Кормление"}
            sub={props.runningFeed ? formatClock(now - new Date(props.runningFeed.startedAt).getTime()) : props.lastFeedStart ? `прошло ${formatDuration(now - props.lastFeedStart)}` : ""}
            onPress={props.onFeed}
            disabled={props.busy === "feed"}
          />
          <View style={styles.row}>
            <NightButton small icon="water-outline" title="Мокрый" onPress={() => props.onDiaper({ pee: true, poo: false })} disabled={props.busy === "diaper"} />
            <NightButton small icon="emoticon-poop-outline" title="Грязный" onPress={() => props.onDiaper({ pee: false, poo: true })} disabled={props.busy === "diaper"} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function NightButton({ icon, title, sub, onPress, disabled, small }: { icon: string; title: string; sub?: string; onPress: () => void; disabled?: boolean; small?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.nightBig, small && { flex: 1, minHeight: 90 }, { opacity: disabled || pressed ? 0.6 : 1 }]}>
      <BabyIcon name={icon} color="#ffd8a8" size={small ? 26 : 34} />
      <Text style={{ color: "#fff", fontSize: small ? 17 : 22, fontWeight: "700" }}>{title}</Text>
      {sub ? <Text style={{ color: "#9aa0c7", fontSize: 15 }}>{sub}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 120, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: "800" },
  h1: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  label: { fontSize: 13, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  time: { width: 84, textAlign: "center", paddingVertical: 8 },
  sub: { borderRadius: radius.md, padding: 12, gap: 8 },
  headline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  face: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  nightBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  tip: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radius.md, padding: 12 },
  now: { borderWidth: 1.5, borderRadius: radius.lg, padding: 16, gap: 12 },
  nowHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  big: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  soft: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", minHeight: 46, borderRadius: radius.md },
  health: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radius.md, padding: 12, borderStyle: "dashed" },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  dayTitle: { fontSize: 20, fontWeight: "800", textTransform: "capitalize" },
  event: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radius.md, padding: 12 },
  eventIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  night: { flex: 1, backgroundColor: "#0c0f1f" },
  nightBig: { minHeight: 130, borderRadius: 24, backgroundColor: "#1a1f3a", alignItems: "center", justifyContent: "center", gap: 6, padding: 14 },
});
