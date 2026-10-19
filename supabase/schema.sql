-- Journey to Mattar database. Paste this whole file into Supabase → SQL Editor → Run.
-- Groups ("travels") are fully private: you can only see a travel, its members
-- and its steps if you are a member of it.

create table if not exists public.travels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  code        text not null unique,
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  travel_id     uuid not null references public.travels (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  joined_at     timestamptz not null default now(),
  primary key (travel_id, user_id)
);

create table if not exists public.actions (
  id          uuid primary key default gen_random_uuid(),
  travel_id   uuid not null references public.travels (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category    text not null check (category in ('savings', 'tithe', 'initiatives')),
  note        text check (char_length(note) <= 200),
  created_at  timestamptz not null default now()
);
create index if not exists actions_travel_created on public.actions (travel_id, created_at);
create index if not exists members_user on public.members (user_id);

-- Is the signed-in person part of this travel?
create or replace function public.is_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where travel_id = t and user_id = auth.uid());
$$;

alter table public.travels enable row level security;
alter table public.members enable row level security;
alter table public.actions enable row level security;

drop policy if exists "members can see their travels" on public.travels;
create policy "members can see their travels" on public.travels
  for select to authenticated using (public.is_member(id));

drop policy if exists "members can see fellow travellers" on public.members;
create policy "members can see fellow travellers" on public.members
  for select to authenticated using (public.is_member(travel_id));

drop policy if exists "members can see steps" on public.actions;
create policy "members can see steps" on public.actions
  for select to authenticated using (public.is_member(travel_id));

drop policy if exists "members log their own steps" on public.actions;
create policy "members log their own steps" on public.actions
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(travel_id));

drop policy if exists "people can remove their own steps" on public.actions;
create policy "people can remove their own steps" on public.actions
  for delete to authenticated using (user_id = auth.uid());

-- Creating and joining go through these functions so nobody can add themselves
-- to a travel without knowing its code.
create or replace function public.create_travel(p_name text)
returns public.travels language plpgsql security definer set search_path = public as $$
declare
  t public.travels;
  v_code text;
  v_meta jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.travels where code = v_code);
  end loop;

  insert into public.travels (name, code, created_by)
  values (trim(p_name), v_code, auth.uid()) returning * into t;

  insert into public.members (travel_id, user_id, display_name, avatar_url)
  values (t.id, auth.uid(),
          coalesce(v_meta ->> 'full_name', v_meta ->> 'name', auth.jwt() ->> 'email', 'Traveller'),
          v_meta ->> 'avatar_url');
  return t;
end $$;

create or replace function public.join_travel(p_code text)
returns public.travels language plpgsql security definer set search_path = public as $$
declare
  t public.travels;
  v_meta jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  select * into t from public.travels where code = upper(trim(p_code));
  if t.id is null then raise exception 'No journey has that code'; end if;

  insert into public.members (travel_id, user_id, display_name, avatar_url)
  values (t.id, auth.uid(),
          coalesce(v_meta ->> 'full_name', v_meta ->> 'name', auth.jwt() ->> 'email', 'Traveller'),
          v_meta ->> 'avatar_url')
  on conflict (travel_id, user_id) do nothing;
  return t;
end $$;

revoke execute on function public.create_travel(text) from public, anon;
revoke execute on function public.join_travel(text) from public, anon;
grant execute on function public.create_travel(text) to authenticated;
grant execute on function public.join_travel(text) to authenticated;

-- Live updates: everyone's map moves when anyone in the group logs a step.
-- (If this line errors with "already member of publication", that's fine.)
alter publication supabase_realtime add table public.actions, public.members;
