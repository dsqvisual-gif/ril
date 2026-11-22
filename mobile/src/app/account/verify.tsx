import { useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { auth } from "@/account/api";
import { useAccount } from "@/account/account-context";
import { goHomeAfterSignIn } from "@/account/finish";
import { AuthFrame, ErrorText, PrimaryButton, TextLink, useStep } from "@/components/account/AuthUI";
import { Field } from "@/components/account/Field";
import { radius, usePalette } from "@/theme/theme";

type Purpose = "register" | "login" | "reset";

const TEXT: Record<Purpose, { title: string; button: string }> = {
  register: { title: "Подтвердите почту", button: "Подтвердить и войти" },
  login: { title: "Код из письма", button: "Войти" },
  reset: { title: "Новый пароль", button: "Сохранить и войти" },
};

export default function VerifyScreen() {
  const c = usePalette();
  const { signIn } = useAccount();
  const params = useLocalSearchParams<{ purpose: Purpose; email: string }>();
  const purpose: Purpose = params.purpose === "register" || params.purpose === "reset" ? params.purpose : "login";
  const email = String(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const step = useStep();
  const resend = useStep();
  const t = TEXT[purpose];

  async function submit() {
    await step.run(async () => {
      const action = purpose === "register" ? "register-confirm" : purpose === "reset" ? "reset-confirm" : "code-confirm";
      await signIn(await auth(action, { email, code, password }));
      goHomeAfterSignIn();
    });
  }

  return (
    <AuthFrame title={t.title} lead={`Мы отправили код на ${email}. Он действует 10 минут. Не видно письма — загляните в «Спам».`}>
      <TextInput
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        placeholderTextColor={c.inkTertiary}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        maxLength={6}
        style={[styles.code, { color: c.ink, borderColor: c.border, backgroundColor: c.surface }]}
        accessibilityLabel="Код из письма"
      />
      {purpose === "reset" ? (
        <Field label="Новый пароль" value={password} onChangeText={setPassword} secret hint="Не короче 6 символов" autoComplete="new-password" />
      ) : null}
      <ErrorText text={step.error ?? resend.error} />
      {notice ? <Text style={[styles.notice, { color: c.success }]}>{notice}</Text> : null}
      <PrimaryButton
        title={t.button}
        busy={step.busy}
        disabled={code.length !== 6 || (purpose === "reset" && password.length < 6)}
        onPress={() => void submit()}
      />
      <TextLink
        title={resend.busy ? "Отправляю…" : "Отправить код ещё раз"}
        onPress={() =>
          void resend.run(async () => {
            setNotice(null);
            await auth("resend", { email, purpose });
            setNotice("Новый код отправлен");
          })
        }
      />
      <TextLink title="Изменить почту" onPress={() => router.back()} />
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  code: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 16,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: "center",
    fontWeight: "700",
  },
  notice: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});
