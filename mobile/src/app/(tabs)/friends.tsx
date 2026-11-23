import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import type { AccountRow, FriendsBoard } from "@/account/api";
import { useRpc } from "@/account/use-rpc";
import { AccountAvatar } from "@/components/AccountAvatar";
import { radius, usePalette } from "@/theme/theme";

type ActionState = { error?: string };

/** Friends, as on the website: requests, search by nickname, the friends list. */
export default function FriendsScreen() {
  const c = usePalette();
  const call = useRpc();
  const [board, setBoard] = useState<FriendsBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccountRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard(await call<FriendsBoard>("friends.board"));
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

  useEffect(() => {
    const q = query.trim();
    if (q.replace(/^@/, "").length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      call<AccountRow[]>("friends.search", q)
        .then((rows) => alive && setResults(rows))
        .catch(() => {});
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, call]);

  async function act(key: string, fn: string, arg: string) {
    setBusy(key);
    try {
      const r = await call<ActionState>(fn, arg);
      if (r?.error) throw new Error(r.error);
      await load();
      if (query.trim().length >= 2) setResults(await call<AccountRow[]>("friends.search", query.trim()));
    } catch (e) {
      const text = e instanceof Error ? e.message : "Не получилось";
      if (Platform.OS === "web") window.alert(text);
      else Alert.alert(text);
    } finally {
      setBusy(null);
    }
  }

  function confirmRemove(row: AccountRow) {
    const go = () => row.friendshipId && void act(row.id, "friends.remove", row.friendshipId);
    if (Platform.OS === "web") {
      if (window.confirm(`Убрать ${row.alias || row.name} из друзей?`)) go();
      return;
    }
    Alert.alert(`Убрать ${row.alias || row.name} из друзей?`, undefined, [
      { text: "Отмена", style: "cancel" },
      { text: "Убрать", style: "destructive", onPress: go },
    ]);
  }

  const accounts = board?.accounts ?? [];
  const incoming = accounts.filter((a) => a.relation === "incoming");
  const outgoing = accounts.filter((a) => a.relation === "outgoing");
  const friends = accounts.filter((a) => a.relation === "friend");
  const searching = query.trim().replace(/^@/, "").length >= 2;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        <Text style={[styles.title, { color: c.ink }]}>Друзья</Text>
        {board ? (
          <Text style={[styles.lead, { color: c.inkSecondary }]}>
            Ваш ник <Text style={{ color: c.accent, fontWeight: "700" }}>@{board.me.username}</Text>. Человека можно найти только по нику.
          </Text>
        ) : null}
        <Pressable onPress={() => router.push("/settings/qr")} style={[styles.qrBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ fontSize: 20 }}>🔳</Text>
          <Text style={{ flex: 1, color: c.ink, fontWeight: "700", fontSize: 15 }}>Мой QR — друг добавит вас камерой</Text>
          <Text style={{ color: c.inkTertiary, fontSize: 22 }}>›</Text>
        </Pressable>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Найти по нику, например danil"
          placeholderTextColor={c.inkTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.search, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
        />

        {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}
        {!board && !error ? <ActivityIndicator color={c.accent} /> : null}

        {searching ? (
          <Section title="Поиск">
            {results && results.length === 0 ? <Empty text="Никого не нашлось" /> : null}
            {(results ?? []).map((row) => (
              <PersonRow key={row.id} row={row}>
                {row.relation === "none" ? (
                  <Small title="Добавить" busy={busy === row.id} onPress={() => void act(row.id, "friends.request", row.id)} />
                ) : row.relation === "incoming" && row.friendshipId ? (
                  <Small title="Принять" busy={busy === row.id} onPress={() => void act(row.id, "friends.accept", row.friendshipId!)} />
                ) : (
                  <Text style={[styles.status, { color: c.inkTertiary }]}>
                    {row.relation === "friend" ? "в друзьях" : "заявка отправлена"}
                  </Text>
                )}
              </PersonRow>
            ))}
          </Section>
        ) : null}

        {incoming.length > 0 ? (
          <Section title="Хотят дружить">
            {incoming.map((row) => (
              <PersonRow key={row.id} row={row}>
                <Small title="Принять" busy={busy === row.id} onPress={() => void act(row.id, "friends.accept", row.friendshipId!)} />
              </PersonRow>
            ))}
          </Section>
        ) : null}

        {board ? (
          <Section title={`Друзья · ${friends.length}`}>
            {friends.length === 0 ? <Empty text="Пока никого — найдите друга по нику выше." /> : null}
            {friends.map((row) => (
              <PersonRow key={row.id} row={row}>
                <Pressable onPress={() => confirmRemove(row)} hitSlop={8}>
                  <Text style={[styles.status, { color: c.inkTertiary }]}>Убрать</Text>
                </Pressable>
              </PersonRow>
            ))}
          </Section>
        ) : null}

        {outgoing.length > 0 ? (
          <Section title="Ждут ответа">
            {outgoing.map((row) => (
              <PersonRow key={row.id} row={row}>
                <Text style={[styles.status, { color: c.inkTertiary }]}>заявка отправлена</Text>
              </PersonRow>
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={{ gap: 7 }}>
      <Text style={[styles.section, { color: c.inkTertiary }]}>{title.toUpperCase()}</Text>
      <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>
    </View>
  );
}

function PersonRow({ row, children }: { row: AccountRow; children: React.ReactNode }) {
  const c = usePalette();
  const shown = row.alias || row.name;
  return (
    <View style={[styles.person, { borderBottomColor: c.border }]}>
      <AccountAvatar name={shown} uri={row.avatar} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>
          {shown}
        </Text>
        <Text style={[styles.nick, { color: c.inkSecondary }]} numberOfLines={1}>
          {row.alias ? `${row.name} · ` : ""}@{row.username}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Small({ title, onPress, busy }: { title: string; onPress: () => void; busy?: boolean }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} disabled={busy} style={[styles.small, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}>
      <Text style={styles.smallText}>{title}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  const c = usePalette();
  return <Text style={[styles.empty, { color: c.inkSecondary }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 120, gap: 16 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -1, marginTop: 6 },
  lead: { fontSize: 15, lineHeight: 21, marginTop: -8 },
  qrBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  search: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, paddingLeft: 14 },
  box: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  person: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 16, fontWeight: "700" },
  nick: { fontSize: 13, marginTop: 1 },
  status: { fontSize: 13, fontWeight: "600" },
  small: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  smallText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  empty: { padding: 14, fontSize: 14 },
});
