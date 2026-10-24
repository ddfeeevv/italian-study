#!/usr/bin/env bash
# Скрипт для проверки RLS в Supabase
# Использование: ./scripts/check-rls.sh

set -e

echo "🔍 Проверка Row Level Security (RLS) в Supabase..."
echo ""

# Проверяем наличие переменных окружения
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "⚠️  SUPABASE_DB_URL не установлена"
  echo ""
  echo "Получить URL можно в Supabase Dashboard:"
  echo "Settings → Database → Connection string (Session mode)"
  echo ""
  echo "Затем запустите:"
  echo "export SUPABASE_DB_URL='postgresql://postgres:[PASSWORD]@[PROJECT_REF].example.com:5432/postgres'"
  echo "./scripts/check-rls.sh"
  exit 1
fi

# SQL запрос для проверки RLS
SQL_QUERY="
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE
    WHEN rowsecurity THEN '✅ Включён'
    ELSE '❌ ВЫКЛЮЧЕН'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"

echo "Таблицы в public schema:"
echo ""

# Выполняем запрос (требует psql)
if command -v psql &> /dev/null; then
  psql "$SUPABASE_DB_URL" -c "$SQL_QUERY"

  echo ""
  echo "📋 Проверка политик RLS:"
  echo ""

  POLICIES_QUERY="
  SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
  "

  psql "$SUPABASE_DB_URL" -c "$POLICIES_QUERY"

else
  echo "❌ psql не установлен"
  echo ""
  echo "Установите PostgreSQL client:"
  echo "  macOS: brew install postgresql"
  echo "  Ubuntu: sudo apt-get install postgresql-client"
  echo ""
  echo "Или проверьте RLS вручную в Supabase Dashboard:"
  echo "Database → Tables → [выберите таблицу] → RLS"
fi

echo ""
echo "✅ Проверка завершена"
echo ""
echo "⚠️  Если RLS выключен на таблицах decks или cards:"
echo "   Выполните SQL скрипт: ./scripts/enable-rls.sql"
