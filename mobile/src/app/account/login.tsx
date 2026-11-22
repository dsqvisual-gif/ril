import { useState } from "react";
import { router } from "expo-router";
import { auth } from "@/account/api";
import { useAccount } from "@/account/account-context";
import { goHomeAfterSignIn, needsWebsite, viaWebsite } from "@/account/finish";
import { AuthFrame, Divider, ErrorText, GoogleButton, PrimaryButton, TextLink, useStep } from "@/components/account/AuthUI";
import { Field } from "@/components/account/Field";

export default function LoginScreen() {
  const { signIn } = useAccount();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const step = useStep();
  const google = useStep();

  return (
    <AuthFrame title="Вход" lead="Тот же аккаунт, что на сайте uspeyka.com.">
      <Field label="Email или ник" value={login} onChangeText={setLogin} keyboardType="email-address" autoComplete="username" textContentType="username" />
      <Field label="Пароль" value={password} onChangeText={setPassword} secret autoComplete="current-password" textContentType="password" onSubmitEditing={() => void submit()} />
      <ErrorText text={step.error} />
      <PrimaryButton title="Войти" busy={step.busy} disabled={!login.trim() || !password} onPress={() => void submit()} />
      <TextLink title="Войти по коду из письма" onPress={() => (needsWebsite() ? void viaWebsite("code", signIn) : router.push("/account/code"))} />
      <TextLink title="Забыли пароль?" onPress={() => (needsWebsite() ? void viaWebsite("forgot", signIn) : router.push("/account/forgot"))} />
      <Divider />
      <GoogleButton busy={google.busy} onPress={() => void google.run(() => viaWebsite("google", signIn))} />
      <ErrorText text={google.error} />
      <TextLink title="Нет аккаунта? Зарегистрироваться" onPress={() => (needsWebsite() ? void viaWebsite("register", signIn) : router.replace("/account/register"))} />
    </AuthFrame>
  );

  async function submit() {
    await step.run(async () => {
      await signIn(await auth("login", { login, password }));
      goHomeAfterSignIn();
    });
  }
}
