# Настройка переменных окружения

## Локальная разработка

1. Скопируйте файл `.env.example` в `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Получите credentials из Supabase Dashboard:
   - URL: Settings → API → Project URL
   - Anon Key: Settings → API → Project API keys → anon public

3. Заполните `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.example.com
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Production (Vercel/Netlify)

Добавьте переменные окружения в настройках платформы:

**Vercel:**
- Settings → Environment Variables
- Добавить `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`

**Netlify:**
- Site settings → Environment variables
- Добавить `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`

## Помощник с колодами (ИИ)

Ключ модели и сервисный ключ Supabase живут только на сервере. В браузер они не попадают, поэтому **не** добавляйте к ним префикс `VITE_`.

В `.env.local` и в переменных Vercel:

```env
AI_API_KEY=sk-...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`AI_BASE_URL` — любой OpenAI-совместимый адрес (`/v1`), например Groq или OpenRouter. Модель лучше оставить дешёвой: один запрос собирает сразу пачку слов, история чата в модель не уходит.

Лимит считается в базе. Примените миграцию `supabase/migrations/20261028140000_generation_usage.sql` (SQL Editor или `supabase db push`).

Пока у всех план free: **30 слов и 3 генерации в день**. Премиум — **120 слов и 10 генераций**. Числа лежат в `src/lib/generation-quota.ts`. Чтобы включить премиум конкретному человеку, в Supabase → Authentication → Users → App Metadata поставьте `{ "plan": "premium" }`. Самостоятельно пользователь это поле не меняет.

Сутки для лимита — календарный день устройства. Отдельно есть потолок на сутки UTC, чтобы смена часового пояса не обходила ограничение.

## ⚠️ ВАЖНО

- **НИКОГДА** не коммитьте `.env.local` в Git
- **ВСЕГДА** используйте `.env.example` для документации
- После ротации ключей обновите все окружения (local, staging, production)

## Проверка

```bash
# Убедитесь, что переменные загружаются:
npm run dev

# В консоли браузера:
console.log(import.meta.env.VITE_SUPABASE_URL)
# Должен вывести ваш URL

# Если выводит undefined:
# 1. Перезапустите dev server
# 2. Проверьте, что файл называется .env.local (не .env)
# 3. Проверьте, что переменные начинаются с VITE_
```
