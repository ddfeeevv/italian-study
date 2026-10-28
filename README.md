# Parola — Italian Study

Репозиторий: https://github.com/ddfeeevv/parola

Мобильное SPA для лексики и грамматики: интервальные повторения, два уровня проверки, синхронизация через Supabase.

## Стек

- Vite + React 19 + TypeScript + Tailwind CSS 4
- `@supabase/supabase-js` (Auth + Postgres)
- Локальный кэш + очередь мутаций для офлайна

## Запуск

```bash
cp .env.example .env.local
# вставьте anon key проекта
npm install
npm run dev
```

Проект: `https://xxzsivlzbiktxjmdadkr.supabase.co`

Схема: `supabase/migrations/20261013000000_init.sql`

Друзья, имя и аватар: `supabase/migrations/20261028140000_social.sql` (после миграции стриков).

В SQL Editor выполните миграцию, затем в Authentication:

- Email: включить password + magic link
- Confirm email можно выключить для быстрой разработки
- Redirect URL: `http://localhost:5173/**`

## Карточки

- `vocab` — перевод → выбор слова → написание
- `cloze` — предложение с `{blank}` → выбор формы → ввод в пропуск
- `transform` — исходная форма → выбор → полная фраза

Ошибка показывает `explanation` и сбрасывает SRS-стадию.

## Импорт

```
lavorare - работать
Noi {blank} il treno | prendiamo | 1 лицо мн.ч. prendere
la casa nuova (plurale) | le case nuove | la → le
```
# Security update: Sat Oct 24 10:54:20 AM UTC 2026
# Trigger rebuild after key rotation
