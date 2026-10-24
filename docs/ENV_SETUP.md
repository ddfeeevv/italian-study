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
