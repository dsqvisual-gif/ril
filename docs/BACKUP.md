# Резервные копии базы

Каждую ночь в 03:23 по Алматы GitHub Actions (`.github/workflows/db-backup.yml`):

1. снимает полный дамп схемы `public` боевой базы (`pg_dump`);
2. проверяет его — восстанавливает во временный Postgres и считает пользователей, дела, цели, детей;
3. шифрует AES-256 паролем `BACKUP_PASSPHRASE`;
4. хранит 90 дней во вкладке **Actions → Database backup → нужный запуск → Artifacts**.

Если копия не снялась или не прошла проверку, GitHub пришлёт письмо владельцу репозитория.

## Настройка (один раз)

GitHub → репозиторий → **Settings → Secrets and variables → Actions → New repository secret**:

- `BACKUP_DATABASE_URL` — строка подключения к базе (как `DATABASE_URL` в Vercel). Если провайдер даёт
  две строки — «pooled» и «direct», — берите **direct** (без `-pooler` и без `pgbouncer=true`).
- `BACKUP_PASSPHRASE` — длинный пароль для шифрования (от 20 символов). **Сохраните его в менеджере
  паролей: без него копию не расшифровать.**

Проверить сразу: **Actions → Database backup → Run workflow**.

## Как восстановить

1. Скачайте артефакт `uspeyka-db-ГГГГ-ММ-ДД.dump.gpg` и распакуйте zip.
2. Расшифруйте:
   ```sh
   gpg --decrypt uspeyka-db-2026-11-23.dump.gpg > db.dump
   ```
3. Восстановите в **новую пустую** базу (лучше не поверх рабочей):
   ```sh
   pg_restore --clean --if-exists --no-owner --no-privileges -d "postgresql://…новая база…" db.dump
   ```
4. Проверьте данные и поменяйте `DATABASE_URL` в Vercel на новую базу → Redeploy.

> `--clean` стирает таблицы приложения в той базе, куда восстанавливаете, поэтому восстанавливайте в
> новую базу и переключайтесь на неё, а не поверх рабочей.
