alter table public.streaks
  add column if not exists progress_date date,
  add column if not exists progress_ids text[] not null default '{}';
