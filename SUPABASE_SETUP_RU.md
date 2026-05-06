# Supabase Setup For SARSH_KKZH

1. Create a new Supabase project.

2. Open SQL Editor and run the SQL from:
   `supabase/migrations/20260506_create_sharsh_tables.sql`

3. Create or deploy the Edge Function named:
   `sharsh-sync`

   Source file:
   `supabase/functions/sharsh-sync/index.ts`

4. In Supabase, copy these two values:
   `Project URL`
   `Legacy API Keys -> anon`

   Do not use:
   `service_role`

5. Open:
   `setup-sync.html`

6. Paste:
   `Supabase URL`
   `Supabase anon key`

7. Click:
   `Проверить подключение`
   then
   `Сохранить в браузере`

8. Open the generated main link and use it as the working link:
   `SARSH_KKZH.html`

9. Give each department its own generated link from:
   `setup-sync.html`
   or from the main file itself.

10. Final test:
   open one department page on another device,
   enter data,
   then open the main file and verify the update appears there.

Notes:

- The SQL file now enables Row Level Security and blocks direct table access from public client roles.
- Data should go through the `sharsh-sync` function only.
- If you enable department access codes later, keep the checkbox `Показывать поле кода отделения` enabled on `setup-sync.html`.
