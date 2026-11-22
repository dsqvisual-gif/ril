import { useRef } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { SITE } from "@/account/api";
import { radius, usePalette } from "@/theme/theme";

type Props = {
  visible: boolean;
  onToken: (token: string) => void;
  onCancel: () => void;
};

/** The website's Cloudflare check in a small window; usually passes by itself in a second. */
export function Captcha({ visible, onToken, onCancel }: Props) {
  const c = usePalette();
  const done = useRef(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.title, { color: c.ink }]}>Проверяем, что вы не робот</Text>
          <View style={styles.frame}>
            {visible ? (
              <WebView
                source={{ uri: `${SITE}/mobile/captcha` }}
                style={styles.web}
                startInLoadingState
                renderLoading={() => <ActivityIndicator color={c.accent} style={StyleSheet.absoluteFill} />}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data) as { source?: string; type?: string; token?: string };
                    if (data.source !== "uspeyka-captcha" || data.type !== "token" || done.current) return;
                    done.current = true;
                    onToken(data.token ?? "");
                    setTimeout(() => {
                      done.current = false;
                    }, 500);
                  } catch {
                    // Not our message.
                  }
                }}
              />
            ) : null}
          </View>
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={[styles.cancel, { color: c.accent }]}>Отмена</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,17,22,0.45)", justifyContent: "center", padding: 20 },
  card: { borderRadius: radius.lg, padding: 18, gap: 12, alignItems: "center" },
  title: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  frame: { width: "100%", height: 90, overflow: "hidden", borderRadius: radius.md },
  web: { flex: 1, backgroundColor: "transparent" },
  cancel: { fontSize: 15, fontWeight: "700", paddingVertical: 6 },
});
