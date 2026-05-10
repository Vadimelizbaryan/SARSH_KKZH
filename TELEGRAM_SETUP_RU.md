# Telegram bot setup

<!-- deploy-touch: Mainflow-telegram -->

Этот проект уже умеет принимать фото бланков через Telegram-бота и сохранять данные в систему через новую Supabase Edge Function `Mainflow-telegram`.

## Что бот умеет сейчас

- принимать фото бланка;
- по подписи вида `r4`, `SR-4` или по самому фото определять отделение;
- распознавать верхнюю таблицу через ту же OCR-логику, что и сайт;
- сохранять значения в нужное отделение;
- отвечать ссылкой на страницу отделения;
- показывать текущее состояние сводки и список кодов отделений.

## Команды бота

- `/start`
- `/help`
- `/status`
- `/departments`
- `/pdf`
- `/done`

Сейчас `/pdf` и `/done` присылают ссылку на главный файл:

`https://vadimelizbaryan.github.io/SARSH_KKZH/index.html`

PDF по-прежнему сохраняется через кнопку печати в браузере.

## Что нужно создать в Telegram

1. Открой `@BotFather`
2. Выполни `/newbot`
3. Задай имя и username
4. Сохрани `BOT_TOKEN`

## Какие env variables добавить в Supabase

В `Supabase Dashboard -> Edge Functions -> Secrets` добавь:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_ALLOWED_CHAT_IDS`
- `PUBLIC_SITE_BASE_URL`

Если нужен Telegram-месседж при входе в сайт, укажи свой chat id в `TELEGRAM_ALLOWED_CHAT_IDS`.
Сейчас уведомление о входе отправляется в те chat id, которые перечислены в этой переменной.

Уже должны существовать:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_PHOTO_MODEL` (необязательно)

### Пример значений

- `PUBLIC_SITE_BASE_URL=https://vadimelizbaryan.github.io/SARSH_KKZH`
- `TELEGRAM_ALLOWED_CHAT_IDS=123456789`

`TELEGRAM_ALLOWED_CHAT_IDS` — список chat id через запятую. Если оставить пустым, бот будет принимать сообщения от всех.

## Как поставить webhook

После деплоя функции выполни такой запрос в браузере или PowerShell:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://ywecvlapdlaojpvijaqy.supabase.co/functions/v1/Mainflow-telegram
```

Лучше сразу передать секретный токен:

```powershell
$body = @{
  url = "https://ywecvlapdlaojpvijaqy.supabase.co/functions/v1/Mainflow-telegram"
  secret_token = "<TELEGRAM_WEBHOOK_SECRET>"
}

Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" `
  -Body $body
```

## Как пользоваться

### Вариант 1: просто фото

Отправляешь фото бланка. Бот:

1. скачивает фото;
2. пытается определить отделение;
3. распознаёт цифры;
4. сохраняет их в систему;
5. отвечает результатом.

### Вариант 2: фото с явной подсказкой

Подпись к фото:

```text
r4 10.05.26
```

или

```text
SR-4
```

Тогда бот использует это как подсказку для отделения и даты.

## Что лучше делать дальше

Следующий логичный шаг:

- отдельный режим накопления нескольких фото;
- команда, которая после серии фото присылает итоговый документ;
- отдельный server-side PDF вместо простой ссылки на главный файл.
