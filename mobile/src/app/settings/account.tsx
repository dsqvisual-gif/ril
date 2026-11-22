import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SettingsScreen } from "@/components/settings/SettingsUI";
import { radius, usePalette } from "@/theme/theme";

/** Placeholder until signing in to the website account comes to the app. */
export default function AccountSettings() {
  const c = usePalette();
  return (
    <SettingsScreen
      title="Аккаунт Uspeyka"
      lead="Вход по почте и паролю, как на сайте, появится в следующем обновлении приложения."
    >
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.text, { color: c.ink }]}>После входа здесь будут:</Text>
        {["дела и цели — те же, что на сайте, на всех устройствах", "друзья, совместные дела и команда", "резервная копия ваших записей"].map((t) => (
          <Text key={t} style={[styles.point, { color: c.inkSecondary }]}>
            •  {t}
          </Text>
        ))}
        <Text style={[styles.text, { color: c.ink, marginTop: 8 }]}>
          А пока можно пользоваться сайтом — аккаунт там уже работает.
        </Text>
        <Pressable
          onPress={() => void Linking.openURL("https://www.uspeyka.com/register")}
          style={[styles.btn, { backgroundColor: c.accent }]}
        >
          <Text style={styles.btnText}>Открыть uspeyka.com</Text>
        </Pressable>
      </View>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 6 },
  text: { fontSize: 15, fontWeight: "600", lineHeight: 21 },
  point: { fontSize: 15, lineHeight: 21 },
  btn: { alignSelf: "flex-start", marginTop: 10, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
