-- Avatars are a character, a background, and a badge: face.background.mark.
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

alter table public.profiles alter column avatar set default 'mira.clay.none';

update public.profiles
set avatar = 'mira.clay.none'
where not public.avatar_ok(avatar);

revoke all on function public.avatar_faces() from public, anon, authenticated;
revoke all on function public.avatar_backgrounds() from public, anon, authenticated;
revoke all on function public.avatar_marks() from public, anon, authenticated;
revoke all on function public.avatar_ok(text) from public, anon, authenticated;
