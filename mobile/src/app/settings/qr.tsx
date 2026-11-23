import { useMemo } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import QRCode from "qrcode";
import { useAccount } from "@/account/account-context";
import { SITE } from "@/account/api";
import { notify } from "@/components/dialogs";
import { SettingsScreen } from "@/components/settings/SettingsUI";
import { radius, usePalette } from "@/theme/theme";

/** A QR code with the website's "add me as a friend" link, as in the site's settings. */
export default function FriendQrScreen() {
  const c = usePalette();
  const { user } = useAccount();
  const link = user?.username ? `${SITE}/add/${user.username}` : null;
  const modules = useMemo(() => {
    if (!link) return null;
    const qr = QRCode.create(link, { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    const rows: boolean[][] = [];
    for (let y = 0; y < size; y += 1) {
      const row: boolean[] = [];
      for (let x = 0; x < size; x += 1) row.push(Boolean(qr.modules.get(x, y)));
      rows.push(row);
    }
    return rows;
  }, [link]);

  async function share() {
    if (!link) return;
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(link);
        notify("Ссылка скопирована");
      } catch {
        notify(link);
      }
      return;
    }
    await Share.share({ message: `Добавь меня в друзья в Uspeyka: ${link}` });
  }

  if (!link || !modules) {
    return (
      <SettingsScreen title="Мой QR" lead="Сначала задайте ник в профиле — по нему друзья вас найдут.">
        <View />
      </SettingsScreen>
    );
  }

  const cell = Math.floor(240 / (modules.length + 8));
  return (
    <SettingsScreen title="Мой QR" lead="Покажите другу: он наведёт камеру телефона и добавит вас в друзья.">
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.qr, { padding: cell * 4 }]}>
          {modules.map((row, y) => (
            <View key={y} style={{ flexDirection: "row" }}>
              {row.map((on, x) => (
                <View key={x} style={{ width: cell, height: cell, backgroundColor: on ? "#111" : "#fff" }} />
              ))}
            </View>
          ))}
        </View>
        <Text style={[styles.nick, { color: c.ink }]}>@{user?.username}</Text>
        <Text style={[styles.link, { color: c.inkSecondary }]} selectable>
          {link}
        </Text>
        <Pressable onPress={() => void share()} style={[styles.btn, { backgroundColor: c.accent }]}>
          <Text style={{ color: c.onAccent, fontWeight: "800", fontSize: 16 }}>
            {Platform.OS === "web" ? "Скопировать ссылку" : "Поделиться ссылкой"}
          </Text>
        </Pressable>
      </View>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 20, gap: 12, alignItems: "center" },
  qr: { backgroundColor: "#fff", borderRadius: radius.md },
  nick: { fontSize: 20, fontWeight: "800" },
  link: { fontSize: 13, textAlign: "center" },
  btn: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: radius.pill, marginTop: 4 },
});
