-- Every table, trigger and policy in docs/ARCHITECTURE.md → Data model.
-- Frozen after S0: later changes are new migrations.

-- ---------- helpers ----------

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates the profile on sign-up, named from the Google profile or the email.
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Player'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- campaigns ----------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z_][a-z0-9_-]*$'),
  state jsonb not null,
  state_version integer not null check (state_version >= 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active campaign per user and game.
create unique index campaigns_one_active on public.campaigns (user_id, game_id) where not archived;

create trigger campaigns_set_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

-- ---------- play_sessions ----------

create table public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z_][a-z0-9_-]*$'),
  status text not null check (status in ('in_progress', 'completed')),
  state jsonb not null,
  state_version integer not null check (state_version >= 0),
  score_total integer,
  breakdown jsonb,
  detection_meta jsonb,
  campaign_id uuid references public.campaigns (id) on delete set null,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index play_sessions_history on public.play_sessions (user_id, game_id, played_at desc, id desc);
create index play_sessions_campaign on public.play_sessions (campaign_id) where campaign_id is not null;

create trigger play_sessions_set_updated_at before update on public.play_sessions
  for each row execute function public.set_updated_at();

-- ---------- rulebooks ----------

create table public.rulebooks (
  id uuid primary key default gen_random_uuid(),
  game_id text not null unique,
  edition text not null,
  title text not null,
  publisher_url text not null,
  source_version text not null,
  created_at timestamptz not null default now()
);

create table public.rulebook_sections (
  id uuid primary key default gen_random_uuid(),
  rulebook_id uuid not null references public.rulebooks (id) on delete cascade,
  ordinal integer not null,
  number text,
  title text not null,
  parent_id uuid references public.rulebook_sections (id) on delete cascade,
  pdf_page_start integer not null check (pdf_page_start >= 1),
  pdf_page_end integer not null,
  -- The page number printed in the rulebook ("4", "4 and 5"); null when none is printed.
  printed_pages text,
  body text not null,
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(number, '') || ' ' || title), 'A')
    || setweight(to_tsvector('english', body), 'B')
  ) stored,
  unique (rulebook_id, ordinal),
  check (pdf_page_end >= pdf_page_start)
);

create index rulebook_sections_search on public.rulebook_sections using gin (search);
create index rulebook_sections_parent on public.rulebook_sections (parent_id);

-- ---------- llm_usage ----------

create table public.llm_usage (
  subject_type text not null check (subject_type in ('user', 'ip', 'global')),
  -- A user id, a salted IP hash, or 'global'.
  subject_key text not null,
  day date not null,
  requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (subject_type, subject_key, day)
);

-- ---------- row level security ----------
-- Users reach only their own profiles, play_sessions and campaigns. The other tables have no
-- user policies, so only the API's service role reaches them.

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.play_sessions enable row level security;
alter table public.rulebooks enable row level security;
alter table public.rulebook_sections enable row level security;
alter table public.llm_usage enable row level security;

create policy profiles_select_owner on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_owner on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy play_sessions_select_owner on public.play_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy play_sessions_insert_owner on public.play_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy play_sessions_update_owner on public.play_sessions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy play_sessions_delete_owner on public.play_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy campaigns_select_owner on public.campaigns
  for select to authenticated using ((select auth.uid()) = user_id);
create policy campaigns_insert_owner on public.campaigns
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy campaigns_update_owner on public.campaigns
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy campaigns_delete_owner on public.campaigns
  for delete to authenticated using ((select auth.uid()) = user_id);

-- A session may only link a campaign its owner can see.
create function public.play_sessions_check_campaign() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.campaign_id is not null and not exists (
    select 1 from public.campaigns c where c.id = new.campaign_id and c.user_id = new.user_id
  ) then
    raise exception 'campaign % does not belong to this user', new.campaign_id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger play_sessions_check_campaign before insert or update of campaign_id, user_id
  on public.play_sessions for each row execute function public.play_sessions_check_campaign();

-- Guests (anon) get nothing; the API reaches the shared tables with the service role.
revoke all on public.rulebooks, public.rulebook_sections, public.llm_usage from anon, authenticated;
revoke all on public.profiles, public.play_sessions, public.campaigns from anon;
