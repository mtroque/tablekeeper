-- Start a new campaign (requested by D2): archive the caller's active campaign for a game and
-- insert the new one in one transaction, since campaigns_one_active allows only one active row.
-- Security invoker, so row level security still limits the caller to their own campaigns.
create function public.start_campaign(p_game_id text, p_state jsonb, p_state_version integer)
returns setof public.campaigns
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.campaigns set archived = true
  where user_id = (select auth.uid()) and game_id = p_game_id and not archived;

  return query
  insert into public.campaigns (game_id, state, state_version)
  values (p_game_id, p_state, p_state_version)
  returning *;
end;
$$;

revoke all on function public.start_campaign(text, jsonb, integer) from public, anon;
grant execute on function public.start_campaign(text, jsonb, integer) to authenticated;
