-- Database on Neon (X3): drop auth.* foreign keys and sign-up trigger, and move RLS policies
-- from Supabase's auth.uid() / authenticated role to transaction-local app.user_id / app_user.

-- ---------- drop auth.* dependencies ----------

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.campaigns drop constraint if exists campaigns_user_id_fkey;
alter table public.play_sessions drop constraint if exists play_sessions_user_id_fkey;

-- ---------- transaction-local user context ----------

create function public.app_user_id() returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

alter table public.campaigns alter column user_id set default public.app_user_id();
alter table public.play_sessions alter column user_id set default public.app_user_id();

-- Non-superuser role for user-scoped transactions so RLS applies even when the pool connects
-- as the database owner (postgres locally, neondb_owner on Neon).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
  execute format('grant app_user to %I', current_user);
end
$$;

grant usage on schema public to app_user;
grant select, insert, update on public.profiles to app_user;
grant select, insert, update, delete on public.play_sessions, public.campaigns to app_user;
revoke all on public.rulebooks, public.rulebook_sections, public.llm_usage, public.rate_limit_hits from app_user;

-- ---------- row level security policies ----------

drop policy if exists profiles_select_owner on public.profiles;
drop policy if exists profiles_insert_owner on public.profiles;
drop policy if exists profiles_update_owner on public.profiles;

create policy profiles_select_owner on public.profiles
  for select to app_user using ((select public.app_user_id()) = id);
create policy profiles_insert_owner on public.profiles
  for insert to app_user with check ((select public.app_user_id()) = id);
create policy profiles_update_owner on public.profiles
  for update to app_user using ((select public.app_user_id()) = id)
  with check ((select public.app_user_id()) = id);

drop policy if exists play_sessions_select_owner on public.play_sessions;
drop policy if exists play_sessions_insert_owner on public.play_sessions;
drop policy if exists play_sessions_update_owner on public.play_sessions;
drop policy if exists play_sessions_delete_owner on public.play_sessions;

create policy play_sessions_select_owner on public.play_sessions
  for select to app_user using ((select public.app_user_id()) = user_id);
create policy play_sessions_insert_owner on public.play_sessions
  for insert to app_user with check ((select public.app_user_id()) = user_id);
create policy play_sessions_update_owner on public.play_sessions
  for update to app_user using ((select public.app_user_id()) = user_id)
  with check ((select public.app_user_id()) = user_id);
create policy play_sessions_delete_owner on public.play_sessions
  for delete to app_user using ((select public.app_user_id()) = user_id);

drop policy if exists campaigns_select_owner on public.campaigns;
drop policy if exists campaigns_insert_owner on public.campaigns;
drop policy if exists campaigns_update_owner on public.campaigns;
drop policy if exists campaigns_delete_owner on public.campaigns;

create policy campaigns_select_owner on public.campaigns
  for select to app_user using ((select public.app_user_id()) = user_id);
create policy campaigns_insert_owner on public.campaigns
  for insert to app_user with check ((select public.app_user_id()) = user_id);
create policy campaigns_update_owner on public.campaigns
  for update to app_user using ((select public.app_user_id()) = user_id)
  with check ((select public.app_user_id()) = user_id);
create policy campaigns_delete_owner on public.campaigns
  for delete to app_user using ((select public.app_user_id()) = user_id);

-- ---------- start_campaign ----------

create or replace function public.start_campaign(
  p_game_id text,
  p_state jsonb,
  p_state_version integer
) returns setof public.campaigns
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.campaigns set archived = true
  where user_id = (select public.app_user_id()) and game_id = p_game_id and not archived;

  return query
  insert into public.campaigns (user_id, game_id, state, state_version)
  values ((select public.app_user_id()), p_game_id, p_state, p_state_version)
  returning *;
end;
$$;

grant execute on function public.app_user_id() to app_user;
grant execute on function public.start_campaign(text, jsonb, integer) to app_user;
revoke all on function public.llm_consume_request(text, text, integer, integer, bigint) from app_user;
revoke all on function public.llm_record_tokens(text, text, bigint, bigint) from app_user;
revoke all on function public.search_rulebook_sections(uuid, text, integer) from app_user;
revoke all on function public.replace_rulebook(jsonb, jsonb) from app_user;
revoke all on function public.rate_limit_hit(text, integer) from app_user;
revoke all on function public.rate_limit_undo(text) from app_user;
