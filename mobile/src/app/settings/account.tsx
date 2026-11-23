import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAccount } from "@/account/account-context";
import { useRpc } from "@/account/use-rpc";
import { Field } from "@/components/account/Field";
import { confirmAsk, errorText } from "@/components/dialogs";
import { SettingsGroup, SettingsRow, SettingsScreen } from "@/components/settings/SettingsUI";
import { radius, usePalette } from "@/theme/theme";

/** Account and safety: the e-mail, signing out, deleting the account. */
export default function AccountSettings() {
  const c = usePalette();
  const call = useRpc();
  const { user, signOut } = useAccount();
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const expected = user.username ? `@${user.username}` : user.email;

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await call("account.delete", confirm);
      await signOut();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <SettingsScreen title="Аккаунт" lead="Один аккаунт для сайта и приложения: дела, цели, друзья и команда одинаковые и там, и тут.">
      <SettingsGroup>
        <SettingsRow icon="mail-outline" tone="#0a84ff" title="Почта" value={user.email} />
        <SettingsRow icon="at-outline" tone="#7950f2" title="Ник" value={user.username ? `@${user.username}` : "не задан"} last />
      </SettingsGroup>

      <Pressable
        onPress={() => confirmAsk("Выйти из аккаунта?", "Чтобы снова видеть дела, нужно будет войти.", "Выйти", () => void signOut())}
        style={[styles.button, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <Text style={[styles.buttonText, { color: c.accent }]}>Выйти из аккаунта</Text>
      </Pressable>

      {!deleting ? (
        <Pressable onPress={() => setDeleting(true)} style={[styles.button, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.buttonText, { color: c.danger }]}>Удалить аккаунт</Text>
        </Pressable>
      ) : (
        <View style={[styles.card, { backgroundColor: c.tintDanger, borderColor: c.border }]}>
          <Text style={[styles.title, { color: c.ink }]}>Удалить аккаунт навсегда?</Text>
          <Text style={{ color: c.inkSecondary, lineHeight: 20 }}>
            Удалятся все дела, цели, друзья и фото — и в приложении, и на сайте. Вернуть их будет нельзя.
          </Text>
          <Field label={`Чтобы подтвердить, введите ${expected}`} value={confirm} onChangeText={setConfirm} placeholder={expected} />
          {error ? <Text style={{ color: c.danger, fontWeight: "600" }}>{error}</Text> : null}
          <View style={styles.row}>
            <Pressable
              onPress={() => void remove()}
              disabled={busy || !confirm.trim()}
              style={[styles.small, { backgroundColor: c.danger, opacity: busy || !confirm.trim() ? 0.5 : 1 }]}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>{busy ? "Удаляем…" : "Удалить навсегда"}</Text>
            </Pressable>
            <Pressable onPress={() => { setDeleting(false); setConfirm(""); setError(null); }} style={[styles.small, { borderWidth: 1.5, borderColor: c.border }]}>
              <Text style={{ color: c.ink, fontWeight: "700" }}>Отмена</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: radius.lg, borderWidth: 1, paddingVertical: 15, alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "700" },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: "800" },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  small: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: radius.pill },
});
