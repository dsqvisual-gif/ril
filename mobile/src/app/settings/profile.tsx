import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAccount } from "@/account/account-context";
import type { AccountUser } from "@/account/api";
import { pickAvatar } from "@/account/photo";
import { useRpc } from "@/account/use-rpc";
import { AccountAvatar } from "@/components/AccountAvatar";
import { Field } from "@/components/account/Field";
import { errorText } from "@/components/dialogs";
import { SettingsScreen } from "@/components/settings/SettingsUI";
import { radius, usePalette } from "@/theme/theme";

/** Photo, name and nickname — the same profile as on the website. */
export default function ProfileSettings() {
  const c = usePalette();
  const call = useRpc();
  const { user, replaceUser } = useAccount();
  const [name, setName] = useState(user?.name ?? "");
  const [nick, setNick] = useState(user?.username ?? "");
  const [busy, setBusy] = useState<"photo" | "name" | "nick" | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  if (!user) return null;

  async function run(kind: "photo" | "name" | "nick", task: () => Promise<string | null>) {
    setBusy(kind);
    setMessage(null);
    try {
      const done = await task();
      if (done) setMessage({ text: done });
    } catch (e) {
      setMessage({ text: errorText(e), bad: true });
    } finally {
      setBusy(null);
    }
  }

  const refresh = async () => replaceUser(await call<AccountUser>("account.profile"));

  const changePhoto = () =>
    run("photo", async () => {
      const dataUrl = await pickAvatar();
      if (!dataUrl) return null;
      await call("avatar.set", dataUrl);
      await refresh();
      return "Фото обновлено";
    });

  const removePhoto = () =>
    run("photo", async () => {
      await call("avatar.remove");
      await refresh();
      return "Фото убрано";
    });

  const saveName = () =>
    run("name", async () => {
      const saved = await call<string>("account.rename", name);
      await replaceUser({ ...user, name: saved });
      setName(saved);
      return "Имя сохранено";
    });

  const saveNick = () =>
    run("nick", async () => {
      const fresh = await call<AccountUser>("account.setUsername", nick);
      await replaceUser(fresh);
      setNick(fresh.username ?? "");
      return "Ник сохранён";
    });

  const uploaded = Boolean(user.avatar?.includes("/api/avatar/"));

  return (
    <SettingsScreen title="Профиль" lead="Так вас видят друзья и команда — и в приложении, и на сайте.">
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.photoRow}>
          <View>
            <AccountAvatar name={user.name} uri={user.avatar} size={84} />
            {busy === "photo" ? (
              <View style={styles.photoBusy}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Small title={user.avatar ? "Сменить фото" : "Поставить фото"} onPress={() => void changePhoto()} disabled={busy !== null} />
            {uploaded ? <Small title="Убрать фото" ghost onPress={() => void removePhoto()} disabled={busy !== null} /> : null}
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Field label="Имя" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} placeholder="Как вас зовут" />
        <Small
          title={busy === "name" ? "Сохраняем…" : "Сохранить имя"}
          onPress={() => void saveName()}
          disabled={busy !== null || name.trim() === user.name || name.trim().length < 2}
        />
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Field
          label="Ник"
          hint="3–20 латинских букв, цифр или _. По нику вас находят друзья."
          value={nick}
          onChangeText={(t) => setNick(t.replace(/^@/, "").toLowerCase())}
          maxLength={20}
          placeholder="например danil"
        />
        <Small
          title={busy === "nick" ? "Сохраняем…" : "Сохранить ник"}
          onPress={() => void saveNick()}
          disabled={busy !== null || nick === (user.username ?? "") || nick.length < 3}
        />
      </View>

      {message ? (
        <Text style={[styles.message, { color: message.bad ? c.danger : c.success }]}>{message.text}</Text>
      ) : null}
    </SettingsScreen>
  );
}

function Small({ title, onPress, ghost, disabled }: { title: string; onPress: () => void; ghost?: boolean; disabled?: boolean }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        ghost ? { borderWidth: 1.5, borderColor: c.border } : { backgroundColor: c.accent },
        { opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Text style={{ color: ghost ? c.ink : c.onAccent, fontWeight: "800", fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 12 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  photoBusy: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 42, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  btn: { alignSelf: "flex-start", paddingHorizontal: 18, paddingVertical: 11, borderRadius: radius.pill },
  message: { fontSize: 15, fontWeight: "700", textAlign: "center" },
});
