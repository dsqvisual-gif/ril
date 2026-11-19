# PLANO — планер дел

Веб-сервис планера на день, неделю и месяц с аккаунтом, опциональным временем у задач и достижениями.

## Стек

- Next.js (App Router) + TypeScript
- Prisma + SQLite
- Auth.js (email, ник или Google)

## Запуск

```bash
npm install
npx prisma migrate dev
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Возможности

- Регистрация и вход по email, нику или Google
- Ник у каждого аккаунта, друзья и совместные дела
- Виды: день / неделя / месяц
- Плашки задач с отметкой выполнения
- Опциональное время
- Достижения: 10, 50, 100, 250, 500, 1000 выполненных дел

## Вход через Google

1. В [Google Cloud Console](https://console.cloud.google.com/apis/credentials) создайте OAuth Client ID типа Web.
2. В Authorized redirect URIs добавьте `http://localhost:3000/api/auth/callback/google`.
3. Впишите идентификатор и секрет в `.env`:

```
AUTH_GOOGLE_ID="....apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="...."
```

4. Перезапустите `npm run dev`. Кнопка «Войти через Google» на страницах входа и регистрации откроет аккаунт Google. Если email уже есть в PLANO, это будет тот же аккаунт.
