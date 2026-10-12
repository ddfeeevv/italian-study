create extension if not exists pgcrypto;

do $$ begin
  create type public.card_type as enum ('vocab', 'cloze', 'transform');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.card_type not null default 'vocab',
  term text not null default '',
  translation text not null default '',
  sentence text,
  target text not null default '',
  options text[] not null default '{}',
  explanation text,
  notes text,
  stage smallint not null default 0 check (stage >= 0 and stage <= 5),
  next_review_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists decks_user_id_idx on public.decks (user_id, created_at desc);
create index if not exists cards_user_due_idx on public.cards (user_id, next_review_date);
create index if not exists cards_deck_id_idx on public.cards (deck_id);

alter table public.decks enable row level security;
alter table public.cards enable row level security;

drop policy if exists "decks_owner_all" on public.decks;
create policy "decks_owner_all"
  on public.decks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cards_owner_all" on public.cards;
create policy "cards_owner_all"
  on public.cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
