# SARSH_KKZH

Система состоит из:

- [SARSH_KKZH.html](./SARSH_KKZH.html) — главный сводный файл.
- `departments/*.html` — отдельные страницы отделений.
- `assets/` — общая логика и стили.
- `supabase/` — шаблон серверной синхронизации для GitHub Pages.

## Как это работает

- Каждое отделение открывает только свою HTML-страницу и вводит данные там.
- Главный файл собирает все строки в один документ.
- Печать PDF делается из браузера через кнопку `Печать`.

## Локальный режим

По умолчанию проект запускается в `local-only` режиме.

- Это удобно для проверки на одном компьютере.
- Для работы между разными компьютерами нужно включить интернет-синхронизацию.

Настройка находится в [assets/sharsh-runtime-config.js](./assets/sharsh-runtime-config.js).

## GitHub Pages

1. Загрузить проект в репозиторий GitHub.
2. Включить GitHub Pages для ветки с файлами сайта.
3. После публикации главным адресом можно использовать `index.html` или `SARSH_KKZH.html`.

Официальная инструкция GitHub:
https://docs.github.com/en/pages/getting-started-with-github-pages

## Supabase для общей синхронизации

1. Создай проект Supabase.
2. Выполни SQL из [supabase/migrations/20260506_create_sharsh_tables.sql](./supabase/migrations/20260506_create_sharsh_tables.sql).
3. Разверни функцию [supabase/functions/sharsh-sync/index.ts](./supabase/functions/sharsh-sync/index.ts).
4. Заполни `supabaseUrl` и `supabaseAnonKey` в [assets/sharsh-runtime-config.js](./assets/sharsh-runtime-config.js).
5. Поставь `syncMode: "supabase-function"`.

Если хочешь выдавать отделениям отдельные коды, добавь в secrets функции переменную `DEPARTMENT_CODES_JSON`, например:

```json
{
  "r4": "surgery-2026",
  "r5": "dsvb-2026"
}
```

И затем включи `requireAccessCode: true` в [assets/sharsh-runtime-config.js](./assets/sharsh-runtime-config.js).

Официальные документы Supabase:

- Edge Functions quickstart: https://supabase.com/docs/guides/functions/quickstart
- JavaScript setup: https://supabase.com/docs/reference/javascript/installing

## Отдельные ссылки отделений

Главный файл уже показывает кнопки `Открыть` и `Копировать ссылку` для каждого отделения.

Примеры:

- `departments/virabuzhakan.html`
- `departments/terapia.html`
- `departments/inf.html`
