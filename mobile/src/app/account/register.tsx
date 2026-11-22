import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { auth, SITE } from "@/account/api";
import { useAccount } from "@/account/account-context";
import { viaWebsite } from "@/account/finish";
import { AuthFrame, Divider, ErrorText, GoogleButton, PrimaryButton, TextLink, useStep } from "@/components/account/AuthUI";
import { Captcha } from "@/components/account/Captcha";
import { Field } from "@/components/account/Field";
import { usePalette } from "@/theme/theme";

export default function RegisterScreen() {
  const c = usePalette();
  const { signIn } = useAccount();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [captcha, setCaptcha] = useState(false);
  const step = useStep();
  const google = useStep();
  const ready = name.trim().length >= 2 && username.trim().length >= 3 && email.includes("@") && password.length >= 6 && consent;

  return (
    <AuthFrame title="Регистрация" lead="На почту придёт код — так мы убедимся, что она ваша.">
      <Field label="Имя" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
      <Field
        label="Ник"
        value={username}
        onChangeText={(v) => setUsername(v.replace(/[^A-Za-z0-9_@]/g, ""))}
        placeholder="danil"
        hint="Только английские буквы, цифры и _ — по нику вас найдут друзья"
        maxLength={21}
      />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Пароль" value={password} onChangeText={setPassword} secret hint="Не короче 6 символов" autoComplete="new-password" textContentType="newPassword" />

      <Pressable onPress={() => setConsent((v) => !v)} style={styles.consent} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
        <View style={[styles.box, { borderColor: consent ? c.accent : c.inkTertiary, backgroundColor: consent ? c.accent : "transparent" }]}>
          {consent ? <Text style={styles.tick}>✓</Text> : null}
        </View>
        <Text style={[styles.consentText, { color: c.inkSecondary }]}>
          Принимаю{" "}
          <Text style={{ color: c.accent }} onPress={() => void Linking.openURL(`${SITE}/terms`)}>
            правила использования
          </Text>{" "}
          и даю{" "}
          <Text style={{ color: c.accent }} onPress={() => void Linking.openURL(`${SITE}/privacy#consent`)}>
            согласие на сбор и обработку персональных данных
          </Text>
        </Text>
      </Pressable>

      <ErrorText text={step.error} />
      <PrimaryButton title="Получить код на почту" busy={step.busy} disabled={!ready} onPress={() => setCaptcha(true)} />
      <Divider />
      <GoogleButton busy={google.busy} onPress={() => void google.run(() => viaWebsite("google", signIn))} />
      <ErrorText text={google.error} />
      <Text style={[styles.small, { color: c.inkTertiary }]}>
        Входя через Google, вы принимаете правила использования и политику конфиденциальности.
      </Text>
      <TextLink title="Уже есть аккаунт? Войти" onPress={() => router.replace("/account/login")} />

      <Captcha
        visible={captcha}
        onCancel={() => setCaptcha(false)}
        onToken={(token) => {
          setCaptcha(false);
          void step.run(async () => {
            const r = await auth<{ email: string }>("register-start", {
              name,
              username,
              email,
              password,
              consent,
              captcha: token,
            });
            router.push({ pathname: "/account/verify", params: { purpose: "register", email: r.email } });
          });
        }}
      />
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  consent: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  tick: { color: "#fff", fontWeight: "800", fontSize: 13 },
  consentText: { flex: 1, fontSize: 13, lineHeight: 19 },
  small: { fontSize: 12, textAlign: "center", lineHeight: 17 },
});
