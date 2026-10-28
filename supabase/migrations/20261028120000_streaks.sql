create table if not exists public.streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  count integer not null default 0 check (count >= 0),
  last_date date,
  saved_count integer not null default 0 check (saved_count >= 0),
  saved_date date,
  restore_month text check (restore_month is null or restore_month ~ '^\d{4}-\d{2}$'),
  updated_at timestamptz not null default now()
);

alter table public.streaks enable row level security;

drop policy if exists "streaks_owner_all" on public.streaks;
create policy "streaks_owner_all"
  on public.streaks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
