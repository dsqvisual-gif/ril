import { AuthForm } from "@/components/AuthForm";
import { Brand } from "@/components/Brand";
import { loginAction } from "@/lib/actions/login";
import { authErrorMessage } from "@/lib/auth-errors";
import styles from "../auth.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className={styles.wrap}>
      <Brand href="/" />
      <AuthForm mode="login" action={loginAction} notice={authErrorMessage(params.error)} />
    </main>
  );
}
