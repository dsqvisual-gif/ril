import { AuthForm } from "@/components/AuthForm";
import { Brand } from "@/components/Brand";
import { registerAction } from "@/lib/actions/register";
import { authErrorMessage } from "@/lib/auth-errors";
import styles from "../auth.module.css";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className={styles.wrap}>
      <Brand href="/" />
      <AuthForm
        mode="register"
        action={registerAction}
        notice={authErrorMessage(params.error)}
      />
    </main>
  );
}
