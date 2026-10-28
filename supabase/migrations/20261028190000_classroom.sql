-- Teacher and student accounts.
-- A teacher has one class code. A student joins by that code.
-- Sharing a deck or exercise copies it onto the student and enrolls them,
-- so the teacher can see stage counts without reading card text of unrelated decks
-- through the API. Card text of a shared copy is the teacher's own material.

alter table public.profiles
  add column if not exists role text not null default 'student';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'teacher'));

-- Apply the choice made at sign-up before the trigger starts freezing role.
update public.profiles p
set role = 'teacher'
from auth.users u
where u.id = p.id
  and u.raw_user_meta_data->>'account_role' = 'teacher'
  and p.role is distinct from 'teacher';

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
  if new.role is null or new.role not in ('student', 'teacher') then
    new.role := 'student';
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.role := old.role;
    new.created_at := old.created_at;
    new.updated_at := now();
    if auth.uid() is not null then
      new.customized := true;
    end if;
  end if;
  return new;
end;
$$;

drop function if exists public.ensure_profile();

create function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.profiles;
  chosen text;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  select * into row from public.profiles where id = auth.uid();
  if found then
    return row;
  end if;
  select case
    when u.raw_user_meta_data->>'account_role' = 'teacher' then 'teacher'
    else 'student'
  end
  into chosen
  from auth.users u
  where u.id = auth.uid();
  if chosen is null then
    chosen := 'student';
  end if;
  begin
    insert into public.profiles (id, username, role)
    values (auth.uid(), public.make_username(auth.uid()), chosen)
    on conflict (id) do nothing;
  exception
    when unique_violation then
      null;
  end;
  select * into row from public.profiles where id = auth.uid();
  return row;
end;
$$;

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references public.profiles (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  constraint classrooms_code_format check (code ~ '^[A-Z0-9]{6}$')
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint enrollments_pair unique (classroom_id, student_id)
);

create index if not exists enrollments_student_idx on public.enrollments (student_id);

create table if not exists public.deck_shares (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  deck_id uuid not null unique references public.decks (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  constraint deck_shares_code_format check (code ~ '^[A-Z0-9]{8}$')
);

alter table public.decks
  add column if not exists share_id uuid references public.deck_shares (id) on delete set null;

create index if not exists decks_share_id_idx on public.decks (share_id);

create or replace function public.random_code(len integer)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  if len < 4 or len > 12 then
    raise exception 'bad code' using errcode = 'P0001';
  end if;
  for i in 1..len loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.normalize_code(raw text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Returns true when the student was already in the class.
create or replace function public.enroll_self(class_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  teacher uuid;
  n integer;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student'
  ) then
    raise exception 'not a student' using errcode = 'P0001';
  end if;
  select c.teacher_id into teacher from public.classrooms c where c.id = class_id;
  if teacher is null or teacher = auth.uid() then
    raise exception 'bad code' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.enrollments e
    where e.classroom_id = class_id and e.student_id = auth.uid()
  ) then
    return true;
  end if;
  select count(*)::integer into n from public.enrollments e where e.classroom_id = class_id;
  if n >= 80 then
    raise exception 'class full' using errcode = 'P0001';
  end if;
  insert into public.enrollments (classroom_id, student_id)
  values (class_id, auth.uid());
  return false;
exception
  when unique_violation then
    return true;
end;
$$;

create or replace function public.ensure_teacher_classroom(teacher uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  room_id uuid;
  attempt integer;
  next_code text;
begin
  if not exists (
    select 1 from public.profiles p where p.id = teacher and p.role = 'teacher'
  ) then
    raise exception 'not a teacher' using errcode = 'P0001';
  end if;
  select c.id into room_id from public.classrooms c where c.teacher_id = teacher;
  if found then
    return room_id;
  end if;
  for attempt in 1..8 loop
    next_code := public.random_code(6);
    begin
      insert into public.classrooms (teacher_id, code)
      values (teacher, next_code)
      returning id into room_id;
      return room_id;
    exception
      when unique_violation then
        select c.id into room_id from public.classrooms c where c.teacher_id = teacher;
        if found then
          return room_id;
        end if;
    end;
  end loop;
  raise exception 'bad code' using errcode = 'P0001';
end;
$$;

create or replace function public.ensure_classroom()
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  room_id uuid;
  room_code text;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'
  ) then
    raise exception 'not a teacher' using errcode = 'P0001';
  end if;
  room_id := public.ensure_teacher_classroom(auth.uid());
  select c.code into room_code from public.classrooms c where c.id = room_id;
  return query select room_id, room_code;
end;
$$;

create or replace function public.preview_class(join_code text)
returns table (username text, avatar text, already boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.username,
    p.avatar,
    exists (
      select 1 from public.enrollments e
      where e.classroom_id = c.id and e.student_id = auth.uid()
    ) as already
  from public.classrooms c
  join public.profiles p on p.id = c.teacher_id
  where auth.uid() is not null
    and c.code = public.normalize_code(join_code)
    and char_length(public.normalize_code(join_code)) = 6;
$$;

create or replace function public.join_classroom(join_code text)
returns table (classroom_id uuid, username text, already boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  room_id uuid;
  teacher_name text;
  already_flag boolean;
begin
  if char_length(public.normalize_code(join_code)) <> 6 then
    raise exception 'bad code' using errcode = 'P0001';
  end if;
  select c.id, p.username into room_id, teacher_name
  from public.classrooms c
  join public.profiles p on p.id = c.teacher_id
  where c.code = public.normalize_code(join_code);
  if room_id is null then
    raise exception 'bad code' using errcode = 'P0001';
  end if;
  already_flag := public.enroll_self(room_id);
  return query select room_id, teacher_name, already_flag;
end;
$$;

create or replace function public.my_classes()
returns table (classroom_id uuid, username text, avatar text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, p.username, p.avatar
  from public.enrollments e
  join public.classrooms c on c.id = e.classroom_id
  join public.profiles p on p.id = c.teacher_id
  where e.student_id = auth.uid()
  order by e.created_at desc;
$$;

create or replace function public.leave_class(class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  delete from public.enrollments e
  where e.classroom_id = class_id and e.student_id = auth.uid();
  get diagnostics removed = row_count;
  if removed = 0 then
    raise exception 'bad code' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.dismiss_student(student uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  delete from public.enrollments e
  using public.classrooms c
  where e.classroom_id = c.id
    and c.teacher_id = auth.uid()
    and e.student_id = student;
  get diagnostics removed = row_count;
  if removed = 0 then
    raise exception 'bad code' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.share_deck(deck uuid)
returns table (code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  share_code text;
  attempt integer;
  next_code text;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'
  ) then
    raise exception 'not a teacher' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.decks d where d.id = deck and d.user_id = auth.uid()
  ) then
    raise exception 'no such deck' using errcode = 'P0001';
  end if;
  select s.code into share_code from public.deck_shares s where s.deck_id = deck;
  if found then
    return query select share_code;
    return;
  end if;
  for attempt in 1..8 loop
    next_code := public.random_code(8);
    begin
      insert into public.deck_shares (teacher_id, deck_id, code)
      values (auth.uid(), deck, next_code)
      returning code into share_code;
      return query select share_code;
      return;
    exception
      when unique_violation then
        select s.code into share_code from public.deck_shares s where s.deck_id = deck;
        if found then
          return query select share_code;
          return;
        end if;
    end;
  end loop;
  raise exception 'bad code' using errcode = 'P0001';
end;
$$;

create or replace function public.preview_share(share_code text)
returns table (
  title text,
  kind text,
  cards integer,
  teacher_username text,
  teacher_avatar text,
  own boolean,
  already boolean,
  deck_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with hit as (
    select s.id, s.teacher_id, s.deck_id, d.title, d.description
    from public.deck_shares s
    join public.decks d on d.id = s.deck_id
    where auth.uid() is not null
      and s.code = public.normalize_code(share_code)
      and char_length(public.normalize_code(share_code)) = 8
  )
  select
    hit.title,
    case
      when left(coalesce(hit.description, ''), 13) = '[[exercise]]' then 'exercise'
      else 'words'
    end as kind,
    (select count(*)::integer from public.cards c where c.deck_id = hit.deck_id) as cards,
    p.username,
    p.avatar,
    hit.teacher_id = auth.uid() as own,
    exists (
      select 1 from public.decks copy
      where copy.user_id = auth.uid() and copy.share_id = hit.id
    ) as already,
    case
      when hit.teacher_id = auth.uid() then hit.deck_id
      else (
        select copy.id from public.decks copy
        where copy.user_id = auth.uid() and copy.share_id = hit.id
        limit 1
      )
    end as deck_id
  from hit
  join public.profiles p on p.id = hit.teacher_id;
$$;

create or replace function public.redeem_share(share_code text)
returns table (deck_id uuid, kind text, already boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  share_row public.deck_shares;
  source public.decks;
  source_subject public.subjects;
  dest_subject_id uuid;
  copy_id uuid;
  kind_value text;
  card_count integer;
begin
  if char_length(public.normalize_code(share_code)) <> 8 then
    raise exception 'bad code' using errcode = 'P0001';
  end if;
  select * into share_row
  from public.deck_shares s
  where s.code = public.normalize_code(share_code);
  if not found then
    raise exception 'bad code' using errcode = 'P0001';
  end if;
  if share_row.teacher_id = auth.uid() then
    raise exception 'own material' using errcode = 'P0001';
  end if;
  select * into source from public.decks d where d.id = share_row.deck_id;
  if not found then
    raise exception 'bad code' using errcode = 'P0001';
  end if;
  kind_value := case
    when left(coalesce(source.description, ''), 13) = '[[exercise]]' then 'exercise'
    else 'words'
  end;
  perform public.enroll_self(public.ensure_teacher_classroom(share_row.teacher_id));
  select d.id into copy_id
  from public.decks d
  where d.user_id = auth.uid() and d.share_id = share_row.id
  limit 1;
  if copy_id is not null then
    return query select copy_id, kind_value, true;
    return;
  end if;
  select count(*)::integer into card_count from public.cards c where c.deck_id = source.id;
  if card_count > 400 then
    raise exception 'deck too big' using errcode = 'P0001';
  end if;
  if source.subject_id is not null then
    select * into source_subject from public.subjects s where s.id = source.subject_id;
    if found then
      if source_subject.preset_id is not null then
        select s.id into dest_subject_id
        from public.subjects s
        where s.user_id = auth.uid() and s.preset_id = source_subject.preset_id
        order by s.created_at
        limit 1;
      end if;
      if dest_subject_id is null then
        select s.id into dest_subject_id
        from public.subjects s
        where s.user_id = auth.uid()
          and s.preset_id is null
          and s.title = source_subject.title
          and s.kind = source_subject.kind
        order by s.created_at
        limit 1;
      end if;
      if dest_subject_id is null then
        insert into public.subjects (
          user_id, title, kind, locale, accents, answer_script, prompt_script, speech_label, preset_id
        )
        values (
          auth.uid(),
          source_subject.title,
          source_subject.kind,
          source_subject.locale,
          source_subject.accents,
          source_subject.answer_script,
          source_subject.prompt_script,
          source_subject.speech_label,
          source_subject.preset_id
        )
        returning id into dest_subject_id;
      end if;
    end if;
  end if;
  insert into public.decks (user_id, title, description, color, subject_id, share_id)
  values (auth.uid(), source.title, source.description, source.color, dest_subject_id, share_row.id)
  returning id into copy_id;
  insert into public.cards (
    deck_id, user_id, type, term, translation, sentence, target, options, explanation, notes, stage, next_review_date
  )
  select
    copy_id,
    auth.uid(),
    c.type,
    c.term,
    c.translation,
    c.sentence,
    c.target,
    c.options,
    c.explanation,
    c.notes,
    0,
    now()
  from public.cards c
  where c.deck_id = source.id;
  return query select copy_id, kind_value, false;
end;
$$;

create or replace function public.class_board(today date)
returns table (
  student_id uuid,
  username text,
  avatar text,
  joined_at timestamptz,
  cards integer,
  mastered integer,
  working integer,
  streak integer,
  studied_today boolean,
  decks jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select auth.uid() as me, public.clamp_study_day(today) as anchor
  ),
  gate as (
    select params.me, params.anchor
    from params
    join public.profiles teacher on teacher.id = params.me and teacher.role = 'teacher'
  ),
  roster as (
    select e.student_id, e.created_at as joined_at
    from public.enrollments e
    join public.classrooms c on c.id = e.classroom_id
    join gate on gate.me = c.teacher_id
  )
  select
    p.id,
    p.username,
    p.avatar,
    roster.joined_at,
    (select count(*)::integer from public.cards c where c.user_id = p.id) as cards,
    (select count(*)::integer from public.cards c where c.user_id = p.id and c.stage = 5) as mastered,
    (select count(*)::integer from public.cards c where c.user_id = p.id and c.stage > 0) as working,
    coalesce(w.streak, 0) as streak,
    coalesce(w.studied_today, false) as studied_today,
    coalesce(listed.decks, '[]'::jsonb) as decks
  from roster
  join gate on true
  join public.profiles p on p.id = roster.student_id
  left join public.streaks s on s.user_id = p.id
  left join lateral public.streak_window(s.last_date, coalesce(s.count, 0), gate.anchor) w on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'title', item.title,
        'kind', item.kind,
        'shared', item.shared,
        'total', item.total,
        'fresh', item.fresh,
        'learning', item.learning,
        'mastered', item.mastered
      )
      order by item.shared desc, item.created_at desc
    ) as decks
    from (
      select
        d.id,
        d.title,
        d.created_at,
        case
          when left(coalesce(d.description, ''), 13) = '[[exercise]]' then 'exercise'
          else 'words'
        end as kind,
        exists (
          select 1 from public.deck_shares sh
          where sh.id = d.share_id and sh.teacher_id = gate.me
        ) as shared,
        count(card.id)::integer as total,
        count(card.id) filter (where card.stage = 0)::integer as fresh,
        count(card.id) filter (where card.stage between 1 and 4)::integer as learning,
        count(card.id) filter (where card.stage = 5)::integer as mastered
      from public.decks d
      left join public.cards card on card.deck_id = d.id
      where d.user_id = p.id
      group by d.id
      order by 5 desc, d.created_at desc
      limit 30
    ) item
  ) listed on true
  order by 9 desc, 2;
$$;

alter table public.classrooms enable row level security;
alter table public.enrollments enable row level security;
alter table public.deck_shares enable row level security;

revoke all on table public.classrooms from public, anon, authenticated;
revoke all on table public.enrollments from public, anon, authenticated;
revoke all on table public.deck_shares from public, anon, authenticated;

revoke all on function public.random_code(integer) from public, anon, authenticated;
revoke all on function public.normalize_code(text) from public, anon, authenticated;
revoke all on function public.enroll_self(uuid) from public, anon, authenticated;
revoke all on function public.ensure_teacher_classroom(uuid) from public, anon, authenticated;
revoke all on function public.ensure_classroom() from public, anon, authenticated;
revoke all on function public.preview_class(text) from public, anon, authenticated;
revoke all on function public.join_classroom(text) from public, anon, authenticated;
revoke all on function public.my_classes() from public, anon, authenticated;
revoke all on function public.leave_class(uuid) from public, anon, authenticated;
revoke all on function public.dismiss_student(uuid) from public, anon, authenticated;
revoke all on function public.share_deck(uuid) from public, anon, authenticated;
revoke all on function public.preview_share(text) from public, anon, authenticated;
revoke all on function public.redeem_share(text) from public, anon, authenticated;
revoke all on function public.class_board(date) from public, anon, authenticated;
revoke all on function public.ensure_profile() from public, anon, authenticated;

grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.ensure_classroom() to authenticated;
grant execute on function public.preview_class(text) to authenticated;
grant execute on function public.join_classroom(text) to authenticated;
grant execute on function public.my_classes() to authenticated;
grant execute on function public.leave_class(uuid) to authenticated;
grant execute on function public.dismiss_student(uuid) to authenticated;
grant execute on function public.share_deck(uuid) to authenticated;
grant execute on function public.preview_share(text) to authenticated;
grant execute on function public.redeem_share(text) to authenticated;
grant execute on function public.class_board(date) to authenticated;
