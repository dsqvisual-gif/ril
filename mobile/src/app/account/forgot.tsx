import { useState } from "react";
import { router } from "expo-router";
import { auth } from "@/account/api";
import { AuthFrame, ErrorText, PrimaryButton, useStep } from "@/components/account/AuthUI";
import { Captcha } from "@/components/account/Captcha";
import { Field } from "@/components/account/Field";

/** Password reset: a code from email, then a new password. */
export default function ForgotScreen() {
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState(false);
  const step = useStep();
  return (
    <AuthFrame title="Восстановление пароля" lead="Пришлём код на почту аккаунта, потом зададите новый пароль.">
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <ErrorText text={step.error} />
      <PrimaryButton title="Прислать код" busy={step.busy} disabled={!email.includes("@")} onPress={() => setCaptcha(true)} />
      <Captcha
        visible={captcha}
        onCancel={() => setCaptcha(false)}
        onToken={(token) => {
          setCaptcha(false);
          void step.run(async () => {
            const r = await auth<{ email: string }>("reset-start", { email, captcha: token });
            router.push({ pathname: "/account/verify", params: { purpose: "reset", email: r.email } });
          });
        }}
      />
    </AuthFrame>
  );
}
