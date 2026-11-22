import { useState } from "react";
import { router } from "expo-router";
import { auth } from "@/account/api";
import { AuthFrame, ErrorText, PrimaryButton, useStep } from "@/components/account/AuthUI";
import { Captcha } from "@/components/account/Captcha";
import { Field } from "@/components/account/Field";

/** Login by a code from email — also for accounts without a password. */
export default function CodeLoginScreen() {
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState(false);
  const step = useStep();
  return (
    <AuthFrame title="Вход по коду" lead="Пришлём на почту код из 6 цифр — пароль не нужен.">
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
      <ErrorText text={step.error} />
      <PrimaryButton title="Прислать код" busy={step.busy} disabled={!email.includes("@")} onPress={() => setCaptcha(true)} />
      <Captcha
        visible={captcha}
        onCancel={() => setCaptcha(false)}
        onToken={(token) => {
          setCaptcha(false);
          void step.run(async () => {
            const r = await auth<{ email: string }>("code-start", { email, captcha: token });
            router.push({ pathname: "/account/verify", params: { purpose: "login", email: r.email } });
          });
        }}
      />
    </AuthFrame>
  );
}
