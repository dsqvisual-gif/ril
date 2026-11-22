# Uspeyka — мобильное приложение

Android и iPhone из одного кода (Expo SDK 58, React Native, Expo Router).
Планер работает без интернета: всё хранится на телефоне в SQLite (`src/db`).

## Запуск при разработке

```sh
cd mobile
npm install
npx expo start          # QR для Expo Go на телефоне
npx expo start --web    # предпросмотр в браузере
```

## Проверки

```sh
npx tsc --noEmit
npx expo lint
```

## Сборка

- Android `.apk` для установки без магазина: `npx eas-cli@latest build -p android --profile preview`
- Для магазинов: профиль `production`, отправка — `npx eas-cli@latest submit`.

## Устройство

- `src/app` — экраны (Expo Router), вкладки в `src/app/(tabs)`.
- `src/db` — база на телефоне: миграции и запросы. У каждой записи `updated_at` и мягкое
  удаление `deleted_at` — задел для будущей синхронизации с сайтом.
- `src/shared` — логика, общая с сайтом (даты). Держать в соответствии с `src/lib` сайта.
- `src/theme` — цвета сайта для светлой и тёмной темы.
