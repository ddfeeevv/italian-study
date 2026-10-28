-- Daily tutor counters. Clients can read their own row.
-- Only the service role can reserve or release a budget, via the functions below.
-- Free vs premium limits live in the app, keyed by auth app_metadata.plan.

create table if not exists public.generation_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  words integer not null default 0 check (words >= 0),
  requests integer not null default 0 check (requests >= 0),
  primary key (user_id, day)
);

alter table public.generation_usage enable row level security;

drop policy if exists "generation_usage_select_own" on public.generation_usage;
create policy "generation_usage_select_own"
  on public.generation_usage
  for select
  using (auth.uid() = user_id);

create or replace function public.reserve_generation(
  p_user uuid,
  p_local_day date,
  p_utc_day date,
  p_words integer,
  p_word_limit integer,
  p_request_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  used_words integer := 0;
  used_requests integer := 0;
  grant_words integer := p_words;
  seen integer := 0;
begin
  if p_words < 1 or p_word_limit < 1 or p_request_limit < 1 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'limit',
      'granted', 0,
      'words_used', 0,
      'requests_used', 0
    );
  end if;

  insert into public.generation_usage (user_id, day, words, requests)
  select p_user, day_value, 0, 0
  from (
    select distinct day_value
    from (values (p_local_day), (p_utc_day)) as days(day_value)
  ) distinct_days
  on conflict (user_id, day) do nothing;

  for rec in
    select words, requests
    from public.generation_usage
    where user_id = p_user
      and day in (p_local_day, p_utc_day)
    order by day
    for update
  loop
    seen := seen + 1;
    if rec.words > used_words then
      used_words := rec.words;
    end if;
    if rec.requests > used_requests then
      used_requests := rec.requests;
    end if;
    if rec.requests >= p_request_limit then
      grant_words := 0;
    elsif p_word_limit - rec.words < grant_words then
      grant_words := p_word_limit - rec.words;
    end if;
  end loop;

  if seen < 1 or grant_words < 1 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'limit',
      'granted', 0,
      'words_used', used_words,
      'requests_used', used_requests
    );
  end if;

  update public.generation_usage
  set words = words + grant_words,
      requests = requests + 1
  where user_id = p_user
    and day in (p_local_day, p_utc_day);

  return jsonb_build_object(
    'ok', true,
    'granted', grant_words,
    'words_used', used_words + grant_words,
    'requests_used', used_requests + 1
  );
end;
$$;

create or replace function public.release_generation(
  p_user uuid,
  p_local_day date,
  p_utc_day date,
  p_words integer,
  p_requests integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.generation_usage
  set words = greatest(0, words - greatest(p_words, 0)),
      requests = greatest(0, requests - greatest(p_requests, 0))
  where user_id = p_user
    and day in (p_local_day, p_utc_day);
end;
$$;

revoke all on function public.reserve_generation(uuid, date, date, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.release_generation(uuid, date, date, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_generation(uuid, date, date, integer, integer, integer) to service_role;
grant execute on function public.release_generation(uuid, date, date, integer, integer) to service_role;

notify pgrst, 'reload schema';
