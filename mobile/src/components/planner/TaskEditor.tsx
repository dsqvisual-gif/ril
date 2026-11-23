import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import type { FriendOption, TaskInput } from "@/account/api";
import { useRpc } from "@/account/use-rpc";
import { AccountAvatar } from "@/components/AccountAvatar";
import { Button, DateField, Icon, type IconName } from "@/components/ui";
import { errorText } from "@/components/dialogs";
import { radius, usePalette } from "@/theme/theme";

const TITLE_MAX = 140;
const NOTE_MAX = 1000;
const ITEM_MAX = 100;
const ITEMS_MAX = 60;

type Item = { text: string; done?: boolean };

export function friendLabel(f: FriendOption): string {
  return f.alias || f.name || `@${f.username}`;
}

/** Splits pasted text into list lines: one per line, comma or semicolon — as on the site. */
function splitLines(text: string): string[] {
  const separator = /[\n;]/.test(text) ? /[\n;]/ : /,/;
  return text
    .split(separator)
    .map((line) => line.replace(/^\s*[-•*\d.)]+\s*/, "").trim())
    .filter(Boolean);
}

let friendsCache: FriendOption[] | null = null;

/** The person's friends for "с другом"; kept for the session so the form opens at once. */
function useFriends() {
  const call = useRpc();
  const [friends, setFriends] = useState<FriendOption[] | null>(friendsCache);
  useEffect(() => {
    let alive = true;
    call<FriendOption[]>("friends.list")
      .then((rows) => {
        friendsCache = rows;
        if (alive) setFriends(rows);
      })
      .catch(() => alive && setFriends((f) => f ?? []));
    return () => {
      alive = false;
    };
  }, [call]);
  return friends;
}

type Props = {
  initial: Partial<TaskInput> & { date: string };
  /** Shows the day, for moving a task while editing. */
  withDate?: boolean;
  submitLabel: string;
  onSubmit: (input: TaskInput) => Promise<void>;
  onCancel: () => void;
};

/** Fields of a task, as on the website: priority, time, friends, list and note. */
export function TaskEditor({ initial, withDate, submitLabel, onSubmit, onCancel }: Props) {
  const c = usePalette();
  const friends = useFriends();
  const [title, setTitle] = useState(initial.title ?? "");
  const [date, setDate] = useState(initial.date);
  const [important, setImportant] = useState(Boolean(initial.important));
  const [urgent, setUrgent] = useState(Boolean(initial.urgent));
  const [withTime, setWithTime] = useState(Boolean(initial.time));
  const [time, setTime] = useState(initial.time ?? "");
  const [friendIds, setFriendIds] = useState<string[]>(initial.friendIds ?? []);
  const [picking, setPicking] = useState(false);
  const [withList, setWithList] = useState((initial.items?.length ?? 0) > 0);
  const [items, setItems] = useState<Item[]>(initial.items ?? []);
  const [withNote, setWithNote] = useState(Boolean(initial.note));
  const [note, setNote] = useState(initial.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFriend = (id: string) => setFriendIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const timeOk = !withTime || /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

  async function submit() {
    if (!title.trim() || busy) return;
    if (!timeOk) {
      setError("Время — в виде 09:30");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        date,
        time: withTime && time ? time : null,
        important,
        urgent,
        friendIds,
        note: withNote ? note.trim() || null : null,
        items: withList ? items.filter((i) => i.text.trim()) : [],
      });
    } catch (e) {
      setError(errorText(e, "Не удалось сохранить"));
    } finally {
      setBusy(false);
    }
  }

  function onTime(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    setTime(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.label, { color: c.inkSecondary }]}>Что сделать</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Например: созвон с командой"
        placeholderTextColor={c.inkTertiary}
        maxLength={TITLE_MAX}
        autoFocus={!initial.title}
        style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
      />

      {withDate ? (
        <>
          <Text style={[styles.label, { color: c.inkSecondary }]}>День</Text>
          <DateField value={date} onChange={(d) => d && setDate(d)} />
        </>
      ) : null}

      <Text style={[styles.label, { color: c.inkSecondary }]}>Приоритет</Text>
      <View style={styles.row}>
        <Flag on={important} onPress={() => setImportant((v) => !v)} dot="#f0b429" label="Важно" onBg="#ffe08a" onInk="#7a4b00" />
        <Flag on={urgent} onPress={() => setUrgent((v) => !v)} dot="#ff3b30" label="Срочно" onBg="#ff3b30" onInk="#ffffff" />
        <Flag on={withTime} onPress={() => setWithTime((v) => !v)} icon="time-outline" label={withTime && time ? time : "Время"} onBg={c.accentSoft} onInk={c.accent} />
      </View>
      {withTime ? (
        <View style={styles.row}>
          <TextInput
            value={time}
            onChangeText={onTime}
            placeholder="09:30"
            keyboardType="number-pad"
            placeholderTextColor={c.inkTertiary}
            maxLength={5}
            style={[styles.input, styles.time, { color: c.ink, borderColor: timeOk ? c.border : c.danger, backgroundColor: c.surfaceMuted }]}
          />
          {["09:00", "12:00", "15:00", "19:00"].map((t) => (
            <Pressable key={t} onPress={() => setTime(t)} style={[styles.quick, { backgroundColor: time === t ? c.accent : c.surfaceMuted }]}>
              <Text style={{ color: time === t ? c.onAccent : c.ink, fontWeight: "700", fontSize: 13 }}>{t}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={[styles.label, { color: c.inkSecondary }]}>Добавить к делу</Text>
      <View style={styles.row}>
        <Extra
          icon="people-outline"
          label={friendIds.length ? `С друзьями · ${friendIds.length}` : "С другом"}
          on={friendIds.length > 0 || picking}
          onPress={() => setPicking((v) => !v)}
        />
        <Extra
          icon="checkbox-outline"
          label={withList && items.length ? `Список · ${items.length}` : "Список"}
          on={withList}
          onPress={() => {
            // The friend list is a picker: it folds away when you move on.
            setPicking(false);
            setWithList((v) => !v);
          }}
        />
        <Extra
          icon="document-text-outline"
          label="Заметка"
          on={withNote}
          onPress={() => {
            setPicking(false);
            setWithNote((v) => !v);
          }}
        />
      </View>

      {picking ? (
        <FriendPicker friends={friends} selected={friendIds} onToggle={toggleFriend} onDone={() => setPicking(false)} />
      ) : friendIds.length > 0 ? (
        <View style={styles.wrap}>
          {friendIds.map((id) => {
            const f = friends?.find((x) => x.id === id);
            return (
              <Pressable key={id} onPress={() => toggleFriend(id)} style={[styles.friendChip, { backgroundColor: c.accentSoft }]} accessibilityLabel="Убрать друга">
                <Text style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>{f ? friendLabel(f) : "друг"}</Text>
                <Icon name="close" color={c.accent} size={14} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {withList ? <ChecklistEditor items={items} onChange={setItems} /> : null}

      {withNote ? (
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Адрес, телефон, ссылка — всё, что пригодится"
          placeholderTextColor={c.inkTertiary}
          maxLength={NOTE_MAX}
          multiline
          style={[styles.input, styles.note, { color: c.ink, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
        />
      ) : null}

      {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}

      <View style={[styles.row, { justifyContent: "flex-end", marginTop: 4 }]}>
        <Button title="Отмена" kind="ghost" onPress={onCancel} />
        <Button title={busy ? "Сохраняю…" : submitLabel} onPress={() => void submit()} disabled={!title.trim()} busy={busy} />
      </View>
    </View>
  );
}

function Flag(props: { on: boolean; onPress: () => void; label: string; onBg: string; onInk: string; dot?: string; icon?: IconName }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: props.on }}
      style={[styles.flag, { backgroundColor: props.on ? props.onBg : c.surfaceMuted, borderColor: props.on ? props.onBg : c.border }]}
    >
      {props.dot ? <View style={[styles.dot, { backgroundColor: props.on && props.onInk === "#ffffff" ? "#fff" : props.dot }]} /> : null}
      {props.icon ? <Icon name={props.icon} color={props.on ? props.onInk : c.inkSecondary} size={15} /> : null}
      <Text style={{ color: props.on ? props.onInk : c.inkSecondary, fontWeight: "700", fontSize: 14 }}>{props.label}</Text>
    </Pressable>
  );
}

/** "Добавить к делу" tiles: clearly separate from the priority flags. */
function Extra({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.extra, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }]}
    >
      <Icon name={icon} color={on ? c.accent : c.inkSecondary} size={20} />
      <Text style={{ color: on ? c.accent : c.ink, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function FriendPicker({ friends, selected, onToggle, onDone }: { friends: FriendOption[] | null; selected: string[]; onToggle: (id: string) => void; onDone: () => void }) {
  const c = usePalette();
  const [query, setQuery] = useState("");
  if (friends && friends.length === 0) {
    return (
      <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surfaceMuted }]}>
        <Text style={{ color: c.inkSecondary, lineHeight: 20 }}>
          Друзей пока нет. Добавьте друга по нику — и планируйте дела вместе: дело появится и у него.
        </Text>
        <Button title="Найти друга" kind="secondary" small icon="person-add-outline" onPress={() => router.push("/friends")} />
      </View>
    );
  }
  const q = query.trim().toLowerCase().replace(/^@/, "");
  const shown = (friends ?? []).filter((f) => !q || [f.alias, f.name, f.username].some((v) => v && v.toLowerCase().includes(q)));
  return (
    <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surfaceMuted }]}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text style={{ color: c.ink, fontWeight: "800", fontSize: 15 }}>С кем запланировать</Text>
        <Pressable onPress={onDone} hitSlop={8}>
          <Text style={{ color: c.accent, fontWeight: "800" }}>Готово</Text>
        </Pressable>
      </View>
      {(friends?.length ?? 0) > 6 ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Найти друга"
          placeholderTextColor={c.inkTertiary}
          autoCapitalize="none"
          style={[styles.input, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
        />
      ) : null}
      <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {shown.map((f) => {
          const on = selected.includes(f.id);
          return (
            <Pressable
              key={f.id}
              onPress={() => onToggle(f.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.friend, on && { backgroundColor: c.accentSoft }]}
            >
              <AccountAvatar name={friendLabel(f)} uri={f.avatar} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontWeight: "700", fontSize: 15 }}>{friendLabel(f)}</Text>
                <Text style={{ color: c.inkSecondary, fontSize: 13 }}>@{f.username}</Text>
              </View>
              <View style={[styles.tick, { borderColor: on ? c.accent : c.inkTertiary, backgroundColor: on ? c.accent : "transparent" }]}>
                {on ? <Icon name="checkmark" color={c.onAccent} size={14} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ChecklistEditor({ items, onChange }: { items: Item[]; onChange: (items: Item[]) => void }) {
  const c = usePalette();
  const [draft, setDraft] = useState("");
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const full = items.length >= ITEMS_MAX;

  function add(lines: string[]) {
    const room = ITEMS_MAX - items.length;
    if (!lines.length || room <= 0) return;
    onChange([...items, ...lines.slice(0, room).map((text) => ({ text: text.slice(0, ITEM_MAX), done: false }))]);
    setDraft("");
    input.current?.focus();
  }

  return (
    <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surfaceMuted }]}>
      <Text style={{ color: c.ink, fontWeight: "800", fontSize: 15 }}>Список</Text>
      {items.map((it, i) => (
        <View key={i} style={styles.itemRow}>
          <Icon name="ellipse-outline" color={c.inkTertiary} size={18} />
          <TextInput
            value={it.text}
            onChangeText={(t) => onChange(items.map((x, k) => (k === i ? { ...x, text: t } : x)))}
            maxLength={ITEM_MAX}
            style={[styles.itemText, { color: c.ink }]}
          />
          <Pressable onPress={() => onChange(items.filter((_, k) => k !== i))} hitSlop={8} accessibilityLabel={`Убрать пункт ${i + 1}`}>
            <Icon name="close" color={c.inkTertiary} size={16} />
          </Pressable>
        </View>
      ))}
      {!full ? (
        <View style={styles.itemRow}>
          <Icon name="add" color={c.accent} size={18} />
          <TextInput
            ref={input}
            value={draft}
            onChangeText={(t) => (/[\n;]/.test(t) || (t.includes(",") && t.length - draft.length > 1) ? add(splitLines(t)) : setDraft(t))}
            onSubmitEditing={() => add(draft.trim() ? [draft.trim()] : [])}
            submitBehavior="submit"
            placeholder={items.length ? "Ещё пункт" : "Например: молоко, хлеб, яйца"}
            placeholderTextColor={c.inkTertiary}
            returnKeyType="next"
            style={[styles.itemText, { color: c.ink }]}
          />
          {draft.trim() ? (
            <Pressable onPress={() => add([draft.trim()])} hitSlop={8}>
              <Text style={{ color: c.accent, fontWeight: "800" }}>Добавить</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Text style={{ color: c.inkTertiary, fontSize: 12, lineHeight: 17 }}>
        Можно вставить сразу весь список через запятую. Дело закроется, когда отмечены все пункты.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  time: { width: 86, textAlign: "center", paddingVertical: 9 },
  quick: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.pill },
  note: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  extra: { flex: 1, minWidth: 92, alignItems: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 6, borderRadius: radius.md, borderWidth: 1.5 },
  friendChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  panel: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 8 },
  friend: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: radius.sm },
  tick: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemText: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 6 },
});
