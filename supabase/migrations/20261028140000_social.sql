-- Profiles and friend requests.
-- Depends on public.streaks. Friends see a username, an avatar, the same
-- streak the app already keeps, the overlap of two current streaks, and
-- card counts. Card text and email stay on the owner row.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  avatar text not null default 'mira.clay.none',
  customized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_distinct check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair_uidx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

create or replace function public.allowed_avatars()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    '🍋', '🍊', '🍓', '🍑', '🥑', '🍅', '🥐',
    '🧀', '🍕', '🍜', '🍣', '🍪', '☕', '🌿',
    '🌸', '🌻', '🌙', '⭐', '🔥', '📚', '🎧',
    '🐱', '🦊', '🐼', '🐧', '🐸', '🦉', '🐝'
  ]::text[];
$$;

create or replace function public.make_username(user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  em text;
  base text;
  candidate text;
  n int := 0;
begin
  select email into em from auth.users where id = user_id;
  base := lower(regexp_replace(split_part(coalesce(em, ''), '@', 1), '[^a-z0-9_]', '', 'g'));
  if base is null or char_length(base) < 3 then
    base := 'user';
  end if;
  base := left(base, 14);
  candidate := base;
  while exists (select 1 from public.profiles p where p.username = candidate) loop
    n := n + 1;
    if n > 50 then
      candidate := 'u' || substr(replace(user_id::text, '-', ''), 1, 19);
      exit;
    end if;
    candidate := base || n::text;
  end loop;
  if exists (select 1 from public.profiles p where p.username = candidate) then
    candidate := substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
  end if;
  return candidate;
end;
$$;

create or replace function public.clamp_study_day(today date)
returns date
language sql
stable
set search_path = public
as $$
  select case
    when today is null or today < current_date - 1 or today > current_date + 1 then current_date
    else today
  end;
$$;

-- Same alive window as the client streak: count stays through yesterday,
-- and a last day in the future is treated as already practiced today.
create or replace function public.streak_window(last_day date, raw_count integer, anchor date)
returns table (streak integer, studied_today boolean, start_day date, end_day date)
language sql
immutable
set search_path = public
as $$
  select
    case when alive.ok then raw_count else 0 end,
    coalesce(alive.ok, false) and coalesce((anchor - last_day) <= 0, false),
    case
      when alive.ok then (case when (anchor - last_day) < 0 then anchor else last_day end) - (raw_count - 1)
      else null
    end,
    case
      when alive.ok then case when (anchor - last_day) < 0 then anchor else last_day end
      else null
    end
  from (
    select last_day is not null and coalesce(raw_count, 0) > 0 and (anchor - last_day) <= 1 as ok
  ) alive;
$$;

create or replace function public.avatar_faces()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['mira', 'nino', 'cleo', 'otto', 'lumi', 'pino', 'sora', 'remy']::text[];
$$;

create or replace function public.avatar_backgrounds()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['clay', 'ink', 'leaf', 'wine', 'sea', 'plum', 'sand', 'dusk']::text[];
$$;

create or replace function public.avatar_marks()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['none', 'book', 'star', 'note', 'leaf']::text[];
$$;

create or replace function public.avatar_ok(value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select split_part(value, '.', 1) = any (public.avatar_faces())
    and split_part(value, '.', 2) = any (public.avatar_backgrounds())
    and split_part(value, '.', 3) = any (public.avatar_marks())
    and split_part(value, '.', 4) = '';
$$;

create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.id is distinct from auth.uid() then
    raise exception 'not owner' using errcode = '42501';
  end if;
  new.username := lower(btrim(coalesce(new.username, '')));
  if new.username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'bad username' using errcode = '23514';
  end if;
  if new.avatar is null or btrim(new.avatar) = '' then
    new.avatar := case when tg_op = 'UPDATE' then old.avatar else 'mira.clay.none' end;
  end if;
  if not public.avatar_ok(new.avatar) then
    raise exception 'bad avatar' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
    new.updated_at := now();
    if auth.uid() is not null then
      new.customized := true;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

create or replace function public.friendships_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.requester_id is distinct from auth.uid() then
      raise exception 'not requester' using errcode = '42501';
    end if;
    if new.requester_id = new.addressee_id then
      raise exception 'bad username' using errcode = '23514';
    end if;
    new.status := 'pending';
    new.updated_at := now();
    if not exists (select 1 from public.profiles p where p.id = new.addressee_id) then
      raise exception 'no such user' using errcode = '23503';
    end if;
    if exists (
      select 1 from public.friendships f
      where least(f.requester_id, f.addressee_id) = least(new.requester_id, new.addressee_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(new.requester_id, new.addressee_id)
    ) then
      raise exception 'already related' using errcode = '23505';
    end if;
    if (
      select count(*)
      from public.friendships f
      where f.requester_id = auth.uid()
        and f.status = 'pending'
    ) >= 30 then
      raise exception 'too many requests' using errcode = 'P0001';
    end if;
    return new;
  end if;

  new.id := old.id;
  new.requester_id := old.requester_id;
  new.addressee_id := old.addressee_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  if auth.uid() is distinct from old.addressee_id then
    raise exception 'only addressee' using errcode = '42501';
  end if;
  if old.status is distinct from 'pending' or new.status is distinct from 'accepted' then
    raise exception 'only accept' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_guard on public.friendships;
create trigger friendships_guard
  before insert or update on public.friendships
  for each row execute function public.friendships_guard();

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.profiles;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  select * into row from public.profiles where id = auth.uid();
  if found then
    return row;
  end if;
  begin
    insert into public.profiles (id, username)
    values (auth.uid(), public.make_username(auth.uid()))
    on conflict (id) do nothing;
  exception
    when unique_violation then
      null;
  end;
  select * into row from public.profiles where id = auth.uid();
  return row;
end;
$$;

create or replace function public.search_profiles(q text)
returns table (id uuid, username text, avatar text)
language sql
stable
security definer
set search_path = public
as $$
  with needle as (
    select lower(regexp_replace(trim(coalesce(q, '')), '[^a-z0-9_]', '', 'g')) as name
  )
  select p.id, p.username, p.avatar
  from public.profiles p
  cross join needle
  where auth.uid() is not null
    and char_length(needle.name) >= 2
    and p.id <> auth.uid()
    and p.username like replace(needle.name, '_', '\_') || '%' escape '\'
  order by (p.username = needle.name) desc, char_length(p.username), p.username
  limit 8;
$$;

create or replace function public.friend_progress(today date)
returns table (
  friendship_id uuid,
  user_id uuid,
  username text,
  avatar text,
  relation text,
  cards integer,
  mastered integer,
  working integer,
  streak integer,
  studied_today boolean,
  pair_streak integer
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select auth.uid() as me, public.clamp_study_day(today) as anchor
  ),
  rel as (
    select
      f.id as friendship_id,
      case when f.requester_id = params.me then f.addressee_id else f.requester_id end as friend_id,
      case
        when f.status = 'accepted' then 'friend'
        when f.addressee_id = params.me then 'incoming'
        else 'outgoing'
      end as relation
    from public.friendships f
    cross join params
    where params.me is not null
      and (f.requester_id = params.me or f.addressee_id = params.me)
  ),
  listed as (
    select
      rel.friendship_id,
      rel.friend_id as user_id,
      p.username,
      p.avatar,
      rel.relation,
      case
        when rel.relation = 'friend' then (
          select count(*)::integer from public.cards c where c.user_id = rel.friend_id
        )
        else 0
      end as cards,
      case
        when rel.relation = 'friend' then (
          select count(*)::integer from public.cards c where c.user_id = rel.friend_id and c.stage = 5
        )
        else 0
      end as mastered,
      case
        when rel.relation = 'friend' then (
          select count(*)::integer from public.cards c where c.user_id = rel.friend_id and c.stage > 0
        )
        else 0
      end as working,
      case when rel.relation = 'friend' then coalesce(w.streak, 0) else 0 end as streak,
      case when rel.relation = 'friend' then coalesce(w.studied_today, false) else false end as studied_today,
      case
        when rel.relation = 'friend'
          and coalesce(w.streak, 0) > 0
          and coalesce(mine_w.streak, 0) > 0
          and w.start_day <= mine_w.end_day
          and mine_w.start_day <= w.end_day
        then (least(w.end_day, mine_w.end_day) - greatest(w.start_day, mine_w.start_day) + 1)::integer
        else 0
      end as pair_streak
    from rel
    cross join params
    join public.profiles p on p.id = rel.friend_id
    left join public.streaks s on s.user_id = rel.friend_id
    left join lateral public.streak_window(s.last_date, coalesce(s.count, 0), params.anchor) w on true
    left join public.streaks mine on mine.user_id = params.me
    left join lateral public.streak_window(mine.last_date, coalesce(mine.count, 0), params.anchor) mine_w on true
  )
  select
    listed.friendship_id,
    listed.user_id,
    listed.username,
    listed.avatar,
    listed.relation,
    listed.cards,
    listed.mastered,
    listed.working,
    listed.streak,
    listed.studied_today,
    listed.pair_streak
  from listed
  order by
    case listed.relation when 'incoming' then 0 when 'outgoing' then 1 else 2 end,
    listed.username;
$$;

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles
  for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
         or (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
    )
  );

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "friendships_select" on public.friendships;
create policy "friendships_select"
  on public.friendships
  for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "friendships_insert" on public.friendships;
create policy "friendships_insert"
  on public.friendships
  for insert
  with check (requester_id = auth.uid() and status = 'pending');

drop policy if exists "friendships_update" on public.friendships;
create policy "friendships_update"
  on public.friendships
  for update
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status = 'accepted');

drop policy if exists "friendships_delete" on public.friendships;
create policy "friendships_delete"
  on public.friendships
  for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());

revoke all on table public.profiles from public, anon, authenticated;
grant select, update on table public.profiles to authenticated;

revoke all on table public.friendships from public, anon, authenticated;
grant select, insert, update, delete on table public.friendships to authenticated;

revoke all on function public.allowed_avatars() from public, anon, authenticated;
revoke all on function public.avatar_faces() from public, anon, authenticated;
revoke all on function public.avatar_backgrounds() from public, anon, authenticated;
revoke all on function public.avatar_marks() from public, anon, authenticated;
revoke all on function public.avatar_ok(text) from public, anon, authenticated;
revoke all on function public.make_username(uuid) from public, anon, authenticated;
revoke all on function public.clamp_study_day(date) from public, anon, authenticated;
revoke all on function public.streak_window(date, integer, date) from public, anon, authenticated;
revoke all on function public.profiles_guard() from public, anon, authenticated;
revoke all on function public.friendships_guard() from public, anon, authenticated;
revoke all on function public.ensure_profile() from public, anon, authenticated;
revoke all on function public.search_profiles(text) from public, anon, authenticated;
revoke all on function public.friend_progress(date) from public, anon, authenticated;

grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.friend_progress(date) to authenticated;

do $$
declare
  r record;
begin
  for r in select id from auth.users loop
    insert into public.profiles (id, username)
    values (r.id, public.make_username(r.id))
    on conflict (id) do nothing;
  end loop;
end $$;
