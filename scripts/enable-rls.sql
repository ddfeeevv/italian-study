-- Скрипт для включения Row Level Security (RLS)
-- Выполнить в Supabase SQL Editor

-- 1. Включить RLS на всех таблицах
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- 2. Удалить старые политики (если есть)
DROP POLICY IF EXISTS "Users can only access their own decks" ON decks;
DROP POLICY IF EXISTS "Users can only access their own cards" ON cards;

-- 3. Создать политики для decks
CREATE POLICY "Users can only access their own decks"
  ON decks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Создать политики для cards
CREATE POLICY "Users can only access their own cards"
  ON cards
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Проверка результата
SELECT
  tablename,
  rowsecurity as rls_enabled,
  CASE
    WHEN rowsecurity THEN '✅ Включён'
    ELSE '❌ Выключен'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('decks', 'cards');

-- 6. Проверка политик
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('decks', 'cards');
