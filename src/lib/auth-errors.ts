export function authErrorMessage(error?: string): string | null {
  if (!error) return null;
  if (error === "google" || error === "Configuration") {
    return "Вход через Google ещё не настроен. Добавьте AUTH_GOOGLE_ID и AUTH_GOOGLE_SECRET в файл .env и перезапустите приложение.";
  }
  if (error === "AccessDenied") {
    return "Google не разрешил вход.";
  }
  if (error === "OAuthAccountNotLinked") {
    return "Этот email уже есть в PLANO. Войдите паролем или ником — Google подключится к тому же аккаунту.";
  }
  return "Не удалось войти через Google. Попробуйте ещё раз.";
}
