create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  kind text not null default 'language' check (kind in ('language', 'topic')),
  locale text,
  accents text[] not null default '{}',
  answer_script text not null default 'latin',
  prompt_script text not null default 'cyrillic',
  speech_label text not null default '',
  preset_id text,
  created_at timestamptz not null default now()
);

create index if not exists subjects_user_id_idx on public.subjects (user_id, created_at desc);

alter table public.subjects enable row level security;

drop policy if exists "subjects_owner_all" on public.subjects;
create policy "subjects_owner_all"
  on public.subjects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.decks
  add column if not exists subject_id uuid references public.subjects (id) on delete set null;

create index if not exists decks_subject_id_idx on public.decks (subject_id);

insert into public.subjects (
  user_id,
  title,
  kind,
  locale,
  accents,
  answer_script,
  prompt_script,
  speech_label,
  preset_id
)
select distinct
  d.user_id,
  'Итальянский',
  'language',
  'it-IT',
  array['à', 'è', 'é', 'ì', 'ò', 'ù'],
  'latin',
  'cyrillic',
  'по-итальянски',
  'it'
from public.decks d
where not exists (
  select 1 from public.subjects s
  where s.user_id = d.user_id and s.preset_id = 'it'
);

update public.decks d
set subject_id = s.id
from public.subjects s
where d.subject_id is null
  and s.user_id = d.user_id
  and s.preset_id = 'it';
