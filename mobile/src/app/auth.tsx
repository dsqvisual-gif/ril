import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { auth } from "@/account/api";
import { useAccount } from "@/account/account-context";
import { goHomeAfterSignIn } from "@/account/finish";
import { usePalette } from "@/theme/theme";

WebBrowser.maybeCompleteAuthSession();

/** The website sends people back here after signing in (Google, web forms). */
export default function AuthReturn() {
  const c = usePalette();
  const { signIn, user } = useAccount();
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const [failed, setFailed] = useState<string | null>(error ? "Не получилось войти. Попробуйте ещё раз." : null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!code) {
      if (!error) router.replace("/profile");
      return;
    }
    void auth("exchange", { code })
      .then(async (session) => {
        await signIn(session);
        goHomeAfterSignIn();
      })
      .catch((e: Error) => {
        // The phone app may already have used this code on its own.
        if (user) router.replace("/profile");
        else setFailed(e.message);
      });
  }, [code, error, signIn, user]);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {failed ? (
        <>
          <Text style={[styles.text, { color: c.ink }]}>{failed}</Text>
          <Text style={[styles.link, { color: c.accent }]} onPress={() => router.replace("/account/login")}>
            Ко входу
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={c.accent} />
          <Text style={[styles.text, { color: c.inkSecondary }]}>Входим…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  text: { fontSize: 16, textAlign: "center" },
  link: { fontSize: 16, fontWeight: "700" },
});
